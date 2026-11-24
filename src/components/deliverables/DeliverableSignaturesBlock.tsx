interface DeliverableSignaturesBlockProps {
  preparerName?: string;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableSignaturesBlock({
  preparerName = 'Auxiliar Contable',
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle
}: DeliverableSignaturesBlockProps) {
  return (
    <div className="pt-8 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs text-slate-600 avoid-page-break print-signatures">
      <div className="pt-6 border-t border-slate-400">
        <div className="font-bold text-slate-900">{preparerName || 'Auxiliar Contable'}</div>
        <div className="text-[10px] text-slate-500">Elaboró</div>
      </div>
      <div className="pt-6 border-t border-slate-400">
        <div className="font-bold text-slate-900">{auditorName}</div>
        <div className="text-[10px] text-slate-500">Revisó ({auditorCedula})</div>
      </div>
      <div className="pt-6 border-t border-slate-400">
        <div className="font-bold text-slate-900">{legalRepName}</div>
        <div className="text-[10px] text-slate-500">Autorizó ({legalRepTitle})</div>
      </div>
    </div>
  );
}
