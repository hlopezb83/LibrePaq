import { useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import {
  fromCents,
  resolveFiscalAccount,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import type { Account, PolizaType } from '../../shared/types';
import type { DraftMovement } from './PolizaEditorModal';

export function useDraftPolizaMovements(
  accounts: Account[],
  predictedNextFolio: number,
  setTipo: (t: PolizaType) => void,
  setConcepto: (c: string) => void
) {
  const toast = useToast();
  const [movements, setMovements] = useState<DraftMovement[]>([
    { _rowId: 'init-0', accountId: '', referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 },
    { _rowId: 'init-1', accountId: '', referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 }
  ]);

  const totalCargosCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonosCents = sumCents(movements.map((m) => m.abono));
  const totalCargos = fromCents(totalCargosCents);
  const totalAbonos = fromCents(totalAbonosCents);
  const diffCents = totalCargosCents - totalAbonosCents;
  const difference = fromCents(diffCents);
  const isBalanced = totalCargosCents === totalAbonosCents && totalCargosCents > 0;

  const autoBalanceDifference = useCallback(() => {
    if (diffCents === 0 || movements.length === 0) return;
    const absDiff = fromCents(Math.abs(diffCents));
    const targetIdx = movements.findIndex((m) => m.cargo === 0 && m.abono === 0);
    if (targetIdx !== -1) {
      setMovements((prev) =>
        prev.map((m, idx) => {
          if (idx !== targetIdx) return m;
          return {
            ...m,
            cargo: diffCents < 0 ? absDiff : 0,
            abono: diffCents > 0 ? absDiff : 0
          };
        })
      );
      toast.success('Renglón Cuadrado', `Se asignó la diferencia de ${formatCurrency(absDiff)}.`);
      return;
    }
    const defaultAcc =
      diffCents > 0
        ? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL')
        : resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES');
    setMovements((prev) => [
      ...prev,
      {
        _rowId: crypto.randomUUID(),
        accountId: defaultAcc.id,
        referencia: 'AJUSTE',
        concepto: 'Cuadre automático de partida doble',
        cargo: diffCents < 0 ? absDiff : 0,
        abono: diffCents > 0 ? absDiff : 0
      }
    ]);
    toast.success('Partida de Cuadre Agregada', `Se insertó renglón con cuenta ${defaultAcc.code}.`);
  }, [diffCents, movements, accounts, toast]);

  const applyBalanceToRow = useCallback((rowIndex: number, type?: 'cargo' | 'abono') => {
    if (diffCents === 0 || rowIndex < 0 || rowIndex >= movements.length) return;
    const absDiff = fromCents(Math.abs(diffCents));
    const targetType = type || (diffCents < 0 ? 'cargo' : 'abono');
    setMovements((prev) =>
      prev.map((m, idx) => {
        if (idx !== rowIndex) return m;
        return {
          ...m,
          cargo: targetType === 'cargo' ? fromCents(toCents(m.cargo) + Math.abs(diffCents)) : m.cargo,
          abono: targetType === 'abono' ? fromCents(toCents(m.abono) + Math.abs(diffCents)) : m.abono
        };
      })
    );
    toast.success('Fila Cuadrada', `Se ajustó el saldo por ${formatCurrency(absDiff)}.`);
  }, [diffCents, movements.length, toast]);

  const addIva16Line = useCallback((baseIndex: number) => {
    const baseRow = movements[baseIndex];
    if (!baseRow) return;
    const baseCents = baseRow.cargo > 0 ? toCents(baseRow.cargo) : toCents(baseRow.abono);
    if (baseCents <= 0) return;
    const ivaCents = Math.round(baseCents * 0.16);
    const ivaAcc =
      baseRow.cargo > 0
        ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
        : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
    setMovements((prev) => [
      ...prev,
      {
        _rowId: crypto.randomUUID(),
        accountId: ivaAcc.id,
        referencia: baseRow.referencia,
        concepto: `IVA 16% de ${baseRow.referencia || 'operación'}`,
        cargo: baseRow.cargo > 0 ? fromCents(ivaCents) : 0,
        abono: baseRow.abono > 0 ? fromCents(ivaCents) : 0
      }
    ]);
    toast.info('Línea de IVA 16% Generada', `Calculado sobre ${formatCurrency(fromCents(baseCents))}.`);
  }, [movements, accounts, toast]);

  const applyQuickTemplate = useCallback((tpl: 'GASTO_16' | 'VENTA_PPD' | 'PAGO_IMPUESTOS') => {
    const ref = `TPL-${String(predictedNextFolio).padStart(3, '0')}`;
    if (tpl === 'GASTO_16') {
      setTipo('EGRESO');
      setConcepto('Pago de Servicios Operativos / Comisión Bancaria con IVA');
      const g = resolveFiscalAccount(accounts, 'COMISIONES_BANCARIAS');
      const i = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
      const b = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
      setMovements([
        { _rowId: crypto.randomUUID(), accountId: g.id, referencia: ref, concepto: 'Gasto operativo del periodo', cargo: 1000, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: i.id, referencia: ref, concepto: 'IVA Acreditable 16%', cargo: 160, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: b.id, referencia: ref, concepto: 'Salida de Bancos', cargo: 0, abono: 1160 }
      ]);
    } else if (tpl === 'VENTA_PPD') {
      setTipo('INGRESO');
      setConcepto('Venta de Servicios y Cobro Inmediato en Banco');
      const b = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
      const v = resolveFiscalAccount(accounts, 'INGRESOS_TASA_16');
      const i = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
      setMovements([
        { _rowId: crypto.randomUUID(), accountId: b.id, referencia: ref, concepto: 'Depósito en Banco', cargo: 5800, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: v.id, referencia: ref, concepto: 'Ingresos por Venta', cargo: 0, abono: 5000 },
        { _rowId: crypto.randomUUID(), accountId: i.id, referencia: ref, concepto: 'IVA Trasladado 16%', cargo: 0, abono: 800 }
      ]);
    } else {
      setTipo('DIARIO');
      setConcepto('Provisión de Compra a Proveedor Nacional');
      const g = resolveFiscalAccount(accounts, 'HONORARIOS_SERVICIOS');
      const i = resolveFiscalAccount(accounts, 'IVA_PENDIENTE_PAGO');
      const p = resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES');
      setMovements([
        { _rowId: crypto.randomUUID(), accountId: g.id, referencia: ref, concepto: 'Gasto devengado', cargo: 2000, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: i.id, referencia: ref, concepto: 'IVA por Acreditar 16%', cargo: 320, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: p.id, referencia: ref, concepto: 'Cuenta por pagar Proveedor', cargo: 0, abono: 2320 }
      ]);
    }
    toast.success('Plantilla Contable Aplicada', 'Se preconfiguraron las cuentas e IVA balanceados.');
  }, [predictedNextFolio, accounts, setTipo, setConcepto, toast]);

  const resetDraftMovements = useCallback(() => {
    setMovements([
      { _rowId: crypto.randomUUID(), accountId: '', referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 },
      { _rowId: crypto.randomUUID(), accountId: '', referencia: 'REF-01', concepto: '', cargo: 0, abono: 0 }
    ]);
  }, []);

  return {
    movements,
    setMovements,
    resetDraftMovements,
    totalCargos,
    totalAbonos,
    difference,
    isBalanced,
    autoBalanceDifference,
    applyBalanceToRow,
    addIva16Line,
    applyQuickTemplate
  };
}
