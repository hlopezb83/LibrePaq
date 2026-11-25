import { useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import {
  fromCents,
  resolveFiscalAccount,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import type { Account, PolizaTemplate, PolizaType } from '../../shared/types';
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
    setMovements((prev) => {
      const prevCargos = sumCents(prev.map((m) => m.cargo));
      const prevAbonos = sumCents(prev.map((m) => m.abono));
      return prev.map((m, idx) => {
        if (idx !== rowIndex) return m;
        const otherCargos = prevCargos - toCents(m.cargo);
        const otherAbonos = prevAbonos - toCents(m.abono);
        if (targetType === 'cargo') {
          const desiredCargo = otherAbonos - otherCargos;
          if (desiredCargo >= 0) {
            return { ...m, cargo: fromCents(desiredCargo), abono: 0 };
          }
          return { ...m, cargo: 0, abono: fromCents(Math.abs(desiredCargo)) };
        }
        const desiredAbono = otherCargos - otherAbonos;
        if (desiredAbono >= 0) {
          return { ...m, abono: fromCents(desiredAbono), cargo: 0 };
        }
        return { ...m, abono: 0, cargo: fromCents(Math.abs(desiredAbono)) };
      });
    });
    toast.success('Fila Cuadrada', `Se ajustó la diferencia de ${formatCurrency(absDiff)}.`);
  }, [diffCents, movements.length, toast]);

  const addIva16Line = useCallback((baseIndex: number) => {
    const baseRow = movements[baseIndex];
    if (!baseRow) return;
    const baseCents = baseRow.cargo > 0 ? toCents(baseRow.cargo) : toCents(baseRow.abono);
    if (baseCents <= 0) {
      toast.info(
        'Ingresa un importe base primero',
        'Captura un Cargo o Abono mayor a $0.00 en la partida para desglosar el IVA 16% (F4).'
      );
      return;
    }
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
      setConcepto('Pago de Servicios Operativos con IVA Acreditable 16%');
      const g = resolveFiscalAccount(accounts, 'HONORARIOS_SERVICIOS');
      const i = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
      const b = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
      setMovements([
        { _rowId: crypto.randomUUID(), accountId: g.id, referencia: ref, concepto: 'Gasto operativo gravado 16%', cargo: 1000, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: i.id, referencia: ref, concepto: 'IVA Acreditable Pagado 16%', cargo: 160, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: b.id, referencia: ref, concepto: 'Pago desde Bancos', cargo: 0, abono: 1160 }
      ]);
    } else if (tpl === 'VENTA_PPD') {
      setTipo('DIARIO');
      setConcepto('Venta de Servicios a Crédito (PPD) con IVA por Cobrar');
      const c = resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES');
      const v = resolveFiscalAccount(accounts, 'INGRESOS_TASA_16');
      const i = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_NO_COBRADO');
      setMovements([
        { _rowId: crypto.randomUUID(), accountId: c.id, referencia: ref, concepto: 'Cliente Nacional (Factura PPD)', cargo: 5800, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: v.id, referencia: ref, concepto: 'Ingresos por Venta Tasa 16%', cargo: 0, abono: 5000 },
        { _rowId: crypto.randomUUID(), accountId: i.id, referencia: ref, concepto: 'IVA Trasladado No Cobrado 16%', cargo: 0, abono: 800 }
      ]);
    } else {
      setTipo('EGRESO');
      setConcepto('Pago de Impuestos Federales SAT (ISR / IVA Día 17)');
      const isrAcc = resolveFiscalAccount(accounts, 'PROVISION_ISR_POR_PAGAR');
      const ivaAcc = resolveFiscalAccount(accounts, 'PROVISION_IVA_POR_PAGAR');
      const b = resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
      setMovements([
        { _rowId: crypto.randomUUID(), accountId: isrAcc.id, referencia: ref, concepto: 'Pago ISR Provisional del Periodo', cargo: 2000, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: ivaAcc.id, referencia: ref, concepto: 'Pago IVA Definitivo del Periodo', cargo: 1500, abono: 0 },
        { _rowId: crypto.randomUUID(), accountId: b.id, referencia: ref, concepto: 'Transferencia Pago de Impuestos SAT', cargo: 0, abono: 3500 }
      ]);
    }
    toast.success('Plantilla Contable Aplicada', 'Se preconfiguraron las cuentas e importes balanceados.');
  }, [predictedNextFolio, accounts, setTipo, setConcepto, toast]);

  const applySavedTemplate = useCallback((tpl: PolizaTemplate, baseAmount = 1000) => {
    const affectable = accounts.filter((a) => a.isAffectable);
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    setTipo(tpl.tipo);
    setConcepto(tpl.conceptoDefault || tpl.name);
    const nextMovs: DraftMovement[] = tpl.movementsJson.map((m, idx) => {
      const resolvedAcc = byCode.get(m.accountCode) ?? affectable[0] ?? accounts[0];
      const cargo =
        m.cargoFixed !== undefined && m.cargoFixed > 0
          ? Number(m.cargoFixed)
          : m.cargoPct && m.cargoPct > 0
            ? Math.round(baseAmount * m.cargoPct) / 100
            : 0;
      const abono =
        m.abonoFixed !== undefined && m.abonoFixed > 0
          ? Number(m.abonoFixed)
          : m.abonoPct && m.abonoPct > 0
            ? Math.round(baseAmount * m.abonoPct) / 100
            : 0;
      return {
        _rowId: crypto.randomUUID(),
        accountId: resolvedAcc?.id || '',
        referencia: m.referencia || `PRE-${idx + 1}`,
        concepto: m.concepto || tpl.conceptoDefault || tpl.name,
        cargo,
        abono,
        businessSegmentId: m.businessSegmentId ?? null
      };
    });
    if (nextMovs.length > 0) setMovements(nextMovs);
    toast.success(`Pre-póliza "${tpl.name}" aplicada`, 'Revisa los importes antes de guardar.');
  }, [accounts, setTipo, setConcepto, toast]);

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
    applyQuickTemplate,
    applySavedTemplate
  };
}
