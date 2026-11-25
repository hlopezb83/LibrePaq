import { formatCurrency } from '../../lib/formatters';
import {
  buildTopCounterpartyAging,
  computeDossierBankReconSummary
} from '../../lib/excel-bancarios-cxc-sheets';
import { formatBalanceCutoffLabel } from '../../shared/date-utils';
import type {
  BankReconciliationResponse,
  Company,
  CxcCxpAgingResponse
} from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableBancosCxcDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  preparerName?: string;
  logoDataUrl?: string;
  issuanceCity?: string;
  issuanceDate: string;
  bankReconciliations?: BankReconciliationResponse[];
  agingData?: CxcCxpAgingResponse | null;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableBancosCxcDoc({
  company, year, period, mesNombre, firmName, preparerName, logoDataUrl,
  issuanceCity, issuanceDate, bankReconciliations = [], agingData,
  auditorName, auditorCedula, legalRepName, legalRepTitle
}: DeliverableBancosCxcDocProps) {
  if (bankReconciliations.length === 0 && !agingData) return null;
  const cutoff = formatBalanceCutoffLabel(year, period, mesNombre);
  const topCxc = agingData ? buildTopCounterpartyAging(agingData.cxcItems, 8) : [];
  const topCxp = agingData ? buildTopCounterpartyAging(agingData.cxpItems, 8) : [];

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {logoDataUrl && (
            <img src={logoDataUrl} alt={`Logo ${firmName}`} className="max-h-12 w-auto object-contain rounded shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{firmName}</div>
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">{company.name}</h2>
            <div className="text-xs font-mono text-slate-600">RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {cutoff}</div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
              Conciliación Bancaria Bilateral, Partidas en Tránsito y Top CxC/CxP Vencidos
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-BCX-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
        </div>
      </div>

      {bankReconciliations.map((recon) => {
        const s = computeDossierBankReconSummary(recon);
        const pendingRows = [
          ...s.pendingBank.map((l) => ({ origen: 'Banco No Reg.', fecha: l.fecha, ref: l.referencia, desc: l.descripcion, cargo: l.cargoBanco, abono: l.abonoBanco })),
          ...s.pendingBooks.map((b) => ({ origen: 'Libros Tránsito', fecha: b.fecha, ref: b.polizaFolio, desc: b.concepto, cargo: b.cargoContable, abono: b.abonoContable }))
        ];
        return (
          <section key={recon.account.id} className="border border-slate-200 rounded-lg overflow-hidden text-xs space-y-2 pb-2 avoid-page-break">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-900 flex flex-wrap justify-between gap-2">
              <span>Conciliación Bancaria: {recon.account.code} — {recon.account.name}</span>
              <span className="font-mono text-[10px] text-slate-700">
                {recon.summary.movimientosConciliados} conciliados • {s.pendingBank.length + s.pendingBooks.length} en tránsito
              </span>
            </div>
            <div className="px-3 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono tabular-nums">
              <div className="rounded border border-slate-200 p-2.5 space-y-1 bg-slate-50/50">
                <div className="font-sans font-bold text-[10px] uppercase text-slate-600">Lado Banco</div>
                <div className="flex justify-between"><span>Saldo Edo. Cuenta:</span><span>{s.hasCapturedBankBalance ? formatCurrency(s.saldoEstadoCuenta) : 'Por capturar'}</span></div>
                <div className="flex justify-between"><span>(+) Dep. en Tránsito:</span><span className="text-emerald-800">{formatCurrency(s.cargosContablesEnTransito)}</span></div>
                <div className="flex justify-between"><span>(-) Pagos en Tránsito:</span><span className="text-red-700">-{formatCurrency(s.abonosContablesEnTransito)}</span></div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                  <span>(=) Conciliado Banco:</span><span>{s.hasCapturedBankBalance ? formatCurrency(s.saldoConciliadoBanco) : 'Pendiente'}</span>
                </div>
              </div>
              <div className="rounded border border-slate-200 p-2.5 space-y-1 bg-slate-50/50">
                <div className="font-sans font-bold text-[10px] uppercase text-slate-600">Lado Libros</div>
                <div className="flex justify-between"><span>Saldo Final Libros:</span><span>{formatCurrency(s.saldoFinalLibros)}</span></div>
                <div className="flex justify-between"><span>(+) Dep. Banco No Reg.:</span><span className="text-emerald-800">{formatCurrency(s.depositosBancoNoRegistrados)}</span></div>
                <div className="flex justify-between"><span>(-) Cargos Banco No Reg.:</span><span className="text-red-700">-{formatCurrency(s.cargosBancoNoRegistrados)}</span></div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                  <span>(=) Conciliado Libros:</span><span>{formatCurrency(s.saldoConciliadoLibros)}</span>
                </div>
              </div>
            </div>
            {pendingRows.length > 0 && (
              <div className="px-3 overflow-x-auto">
                <table className="w-full border-collapse font-mono tabular-nums text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 font-sans text-[10px] uppercase text-slate-600">
                      <th scope="col" className="text-left py-1 px-2">Origen</th>
                      <th scope="col" className="text-left py-1 px-2">Fecha</th>
                      <th scope="col" className="text-left py-1 px-2">Ref. / Póliza</th>
                      <th scope="col" className="text-left py-1 px-2">Concepto</th>
                      <th scope="col" className="text-right py-1 px-2">Cargo</th>
                      <th scope="col" className="text-right py-1 px-2">Abono</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingRows.slice(0, 12).map((r, idx) => (
                      <tr key={`${r.origen}-${r.ref}-${idx}`}>
                        <td className="py-1 px-2 font-sans text-slate-700 whitespace-nowrap">{r.origen}</td>
                        <td className="py-1 px-2 whitespace-nowrap">{r.fecha}</td>
                        <td className="py-1 px-2 whitespace-nowrap">{r.ref}</td>
                        <td className="py-1 px-2 font-sans text-slate-700 truncate max-w-[240px]">{r.desc}</td>
                        <td className="py-1 px-2 text-right">{r.cargo > 0 ? formatCurrency(r.cargo) : '—'}</td>
                        <td className="py-1 px-2 text-right">{r.abono > 0 ? formatCurrency(r.abono) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {agingData && (topCxc.length > 0 || topCxp.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <section className="border border-slate-200 rounded-lg overflow-hidden avoid-page-break">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-900">
              Top Clientes por Saldo / Vencimiento (CxC)
            </div>
            <table className="w-full border-collapse font-mono tabular-nums text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-sans text-[10px] uppercase text-slate-600">
                  <th scope="col" className="text-left py-1 px-2">Cliente</th>
                  <th scope="col" className="text-right py-1 px-2">Días</th>
                  <th scope="col" className="text-right py-1 px-2">&gt;30d</th>
                  <th scope="col" className="text-right py-1 px-2">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCxc.length === 0 ? (
                  <tr><td colSpan={4} className="py-2 px-2 text-center font-sans text-slate-500">Sin saldos pendientes.</td></tr>
                ) : topCxc.map((c) => (
                  <tr key={`${c.rfc}-${c.nombre}`}>
                    <td className="py-1 px-2 font-sans text-slate-800 truncate max-w-[170px]" title={`${c.rfc} · ${c.nombre}`}>{c.nombre}</td>
                    <td className="py-1 px-2 text-right">{c.maxDaysPast}d</td>
                    <td className="py-1 px-2 text-right text-red-700">{formatCurrency(c.vencidoMas30Mxn)}</td>
                    <td className="py-1 px-2 text-right font-bold">{formatCurrency(c.saldoInsolutoMxn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="border border-slate-200 rounded-lg overflow-hidden avoid-page-break">
            <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-900">
              Top Proveedores por Saldo / Vencimiento (CxP)
            </div>
            <table className="w-full border-collapse font-mono tabular-nums text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-sans text-[10px] uppercase text-slate-600">
                  <th scope="col" className="text-left py-1 px-2">Proveedor</th>
                  <th scope="col" className="text-right py-1 px-2">Días</th>
                  <th scope="col" className="text-right py-1 px-2">&gt;30d</th>
                  <th scope="col" className="text-right py-1 px-2">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCxp.length === 0 ? (
                  <tr><td colSpan={4} className="py-2 px-2 text-center font-sans text-slate-500">Sin saldos pendientes.</td></tr>
                ) : topCxp.map((p) => (
                  <tr key={`${p.rfc}-${p.nombre}`}>
                    <td className="py-1 px-2 font-sans text-slate-800 truncate max-w-[170px]" title={`${p.rfc} · ${p.nombre}`}>{p.nombre}</td>
                    <td className="py-1 px-2 text-right">{p.maxDaysPast}d</td>
                    <td className="py-1 px-2 text-right text-red-700">{formatCurrency(p.vencidoMas30Mxn)}</td>
                    <td className="py-1 px-2 text-right font-bold">{formatCurrency(p.saldoInsolutoMxn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      <DeliverableSignaturesBlock
        preparerName={preparerName}
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}
