import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  Account,
  BusinessSegment,
  CfdiDocument,
  Company,
  PolizaTemplate,
  PolizaType
} from '../../shared/types';
import type { PolizaEditorSnapshot } from './polizaDirtyCheck';

export interface DraftMovement {
  _rowId?: string;
  accountId: string;
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
  cfdiUuid?: string | null;
  paymentMethodSat?: string | null;
  bankCodeOri?: string | null;
  accountOri?: string | null;
  bankCodeDest?: string | null;
  accountDest?: string | null;
  beneficiaryName?: string | null;
  beneficiaryRfc?: string | null;
  chequeNum?: string | null;
  businessSegmentId?: string | null;
}

export interface PolizaEditorModalProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  editingPolizaId: string | null;
  activeCompany?: Company | null;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  predictedNextFolio: number;
  tipo: PolizaType;
  setTipo: (t: PolizaType) => void;
  fecha: string;
  setFecha: (f: string) => void;
  concepto: string;
  setConcepto: (c: string) => void;
  cfdiUuid: string;
  cfdiUuids: string[];
  pendingCfdis: CfdiDocument[];
  allCfdis?: CfdiDocument[];
  handleSelectCfdiForForm: (uuid: string) => void;
  handleAddCfdiUuid: (uuid: string) => void;
  handleRemoveCfdiUuid: (uuid: string) => void;
  formError: string | null;
  setFormError: (e: string | null) => void;
  movements: DraftMovement[];
  setMovements: Dispatch<SetStateAction<DraftMovement[]>>;
  accounts: Account[];
  affectableAccounts: Account[];
  businessSegments?: BusinessSegment[];
  polizaTemplates?: PolizaTemplate[];
  applyQuickTemplate: (tpl: 'GASTO_16' | 'VENTA_PPD' | 'PAGO_IMPUESTOS') => void;
  applySavedTemplate?: (tpl: PolizaTemplate, baseAmount?: number) => void;
  onSaveAsTemplate?: (name: string) => Promise<void>;
  isSavingTemplate?: boolean;
  addIva16Line: (idx: number) => void;
  autoBalanceDifference: () => void;
  applyBalanceToRow: (idx: number, type: 'cargo' | 'abono') => void;
  totalCargos: number;
  totalAbonos: number;
  difference: number;
  isBalanced: boolean;
  isDateDifferentPeriod: boolean;
  onUseActivePeriodDate?: () => void;
  editorSessionId?: number;
  initialSnapshot?: PolizaEditorSnapshot | null;
  isPendingSave: boolean;
  onSave: () => void;
}
