import { z } from 'zod';
import { assertAccountingInvariant } from '../shared/accounting-engine';
import type {
  AccountNature,
  AccountType,
  Company,
  PolizaType
} from '../shared/types';

export const CompanyPayloadSchema = z.object({
  name: z.string().trim().min(2),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(v)),
  regimenFiscal: z.string().trim().default('601 - General de Ley Personas Morales'),
  codigoPostal: z.string().trim().default('64000'),
  currentYear: z.number().int().min(2000).max(2100).optional(),
  currentPeriod: z.number().int().min(1).max(13).optional(),
  catalogPreset: z.enum(['SAT_STANDARD', 'RESICO_SIMPLIFIED', 'CUSTOM']).default('SAT_STANDARD'),
  initialBankName: z.string().trim().optional(),
  initialBankAccount: z.string().trim().optional(),
  initialBankBalance: z.number().min(0).optional(),
  createOpeningEntry: z.boolean().default(false),
  fielCerBase64: z.string().trim().optional(),
  fielKeyBase64: z.string().trim().optional(),
  fielPassword: z.string().trim().optional()
});

export const PeriodPayloadSchema = z.object({
  currentYear: z.number().int().min(2000).max(2100),
  currentPeriod: z.number().int().min(1).max(13)
});

export const AccountCreatePayloadSchema = z.object({
  companyId: z.string().trim().default('comp_tnn_01'),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  parentCode: z.string().trim().nullable().optional(),
  type: z.enum(['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESOS', 'COSTOS', 'GASTOS']).default('GASTOS'),
  nature: z.enum(['DEUDORA', 'ACREEDORA']).default('DEUDORA'),
  level: z.number().int().min(1).max(5).default(3),
  isAffectable: z.boolean().optional(),
  satGroupCode: z.string().trim().default('601.84'),
  initialBalance: z.number().default(0)
});

export const AccountUpdatePayloadSchema = z.object({
  name: z.string().trim().min(1),
  satGroupCode: z.string().trim().default('601.84'),
  nature: z.enum(['DEUDORA', 'ACREEDORA']).default('DEUDORA'),
  type: z.enum(['ACTIVO', 'PASIVO', 'CAPITAL', 'INGRESOS', 'COSTOS', 'GASTOS']).default('GASTOS'),
  initialBalance: z.number().default(0)
});

export const PolizaMovementSchema = z.object({
  accountId: z.string().trim(),
  referencia: z.string().trim().optional(),
  concepto: z.string().trim().optional(),
  cargo: z.number().min(0).default(0),
  abono: z.number().min(0).default(0)
});

export const PolizaPayloadSchema = z.object({
  companyId: z.string().trim().default('comp_tnn_01'),
  tipo: z.enum(['INGRESO', 'EGRESO', 'DIARIO']).default('DIARIO'),
  fecha: z.string().default(() => new Date().toISOString().slice(0, 10)),
  concepto: z.string().trim().min(1),
  cfdiUuid: z.string().trim().nullable().optional(),
  origin: z.enum(['MANUAL', 'ADD_AUTO']).default('MANUAL'),
  movements: z.array(PolizaMovementSchema).default([])
});

export function resolveYearAndPeriod(
  yearParam: string | undefined,
  periodParam: string | undefined,
  company: Company
): { year: number; period: number } {
  const parsedYear = yearParam ? Number(yearParam) : company.currentYear;
  const parsedPeriod = periodParam ? Number(periodParam) : company.currentPeriod;

  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : company.currentYear;
  const period =
    Number.isInteger(parsedPeriod) && parsedPeriod >= 1 && parsedPeriod <= 13
      ? parsedPeriod
      : company.currentPeriod;

  return { year, period };
}

export function validateCompanyPayload(raw: unknown) {
  const result = CompanyPayloadSchema.safeParse(raw);
  assertAccountingInvariant(
    result.success,
    'INVALID_COMPANY_PAYLOAD',
    'Razón social y RFC válido (12 caracteres para Persona Moral o 13 para Persona Física) son obligatorios.'
  );
  return result.data;
}

export function validatePeriodPayload(raw: unknown): { currentYear: number; currentPeriod: number } {
  const result = PeriodPayloadSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path[0];
    if (path === 'currentYear') {
      assertAccountingInvariant(false, 'INVALID_YEAR', 'El ejercicio fiscal debe estar entre 2000 y 2100.');
    }
    assertAccountingInvariant(false, 'INVALID_PERIOD', 'El periodo contable debe estar entre 1 (Enero) y 13 (Cierre del Ejercicio).');
  }
  return result.data;
}

export function validateAccountCreatePayload(raw: unknown): {
  companyId: string;
  code: string;
  name: string;
  parentCode: string | null;
  type: AccountType;
  nature: AccountNature;
  level: number;
  isAffectable: boolean;
  satGroupCode: string;
  initialBalance: number;
} {
  const result = AccountCreatePayloadSchema.safeParse(raw);
  assertAccountingInvariant(
    result.success,
    'INVALID_ACCOUNT_PAYLOAD',
    'El código y nombre de la cuenta son obligatorios.'
  );
  const data = result.data;
  return {
    companyId: data.companyId,
    code: data.code,
    name: data.name,
    parentCode: data.parentCode || null,
    type: data.type as AccountType,
    nature: data.nature as AccountNature,
    level: data.level,
    isAffectable: data.isAffectable !== undefined ? data.isAffectable : data.level >= 3,
    satGroupCode: data.satGroupCode || '601.84',
    initialBalance: data.initialBalance
  };
}

export function validateAccountUpdatePayload(raw: unknown): {
  name: string;
  satGroupCode: string;
  nature: AccountNature;
  type: AccountType;
  initialBalance: number;
} {
  const result = AccountUpdatePayloadSchema.safeParse(raw);
  assertAccountingInvariant(
    result.success,
    'INVALID_ACCOUNT_UPDATE',
    'El nombre de la cuenta es obligatorio.'
  );
  const data = result.data;
  return {
    name: data.name,
    satGroupCode: data.satGroupCode || '601.84',
    nature: data.nature as AccountNature,
    type: data.type as AccountType,
    initialBalance: data.initialBalance
  };
}

export function validatePolizaPayload(raw: unknown): {
  companyId: string;
  tipo: PolizaType;
  fecha: string;
  concepto: string;
  cfdiUuid: string | null;
  origin: 'MANUAL' | 'ADD_AUTO';
  movements: Array<{
    accountId: string;
    referencia?: string;
    concepto?: string;
    cargo: number;
    abono: number;
  }>;
} {
  const result = PolizaPayloadSchema.safeParse(raw);
  assertAccountingInvariant(
    result.success,
    'MISSING_POLIZA_CONCEPT',
    'El concepto de la póliza es obligatorio.'
  );
  const data = result.data;
  return {
    companyId: data.companyId,
    tipo: data.tipo as PolizaType,
    fecha: data.fecha.slice(0, 10),
    concepto: data.concepto,
    cfdiUuid: data.cfdiUuid || null,
    origin: data.origin,
    movements: data.movements.map((m) => ({
      accountId: m.accountId,
      referencia: m.referencia,
      concepto: m.concepto,
      cargo: m.cargo,
      abono: m.abono
    }))
  };
}

export { buildSatAnexo24Xml } from '../shared/sat-anexo24';
