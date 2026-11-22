import { AccountingInvariantError } from '../../shared/accounting-engine';

export function errorStatus(err: unknown, defaultStatus: 400 | 409 = 400): {
  message: string;
  status: 400 | 404 | 409;
} {
  if (err instanceof AccountingInvariantError) {
    if (err.code.includes('NOT_FOUND')) {
      return { message: err.message, status: 404 };
    }
    if (
      err.code.includes('DUPLICATE') ||
      err.code.includes('ALREADY_ACCOUNTED') ||
      err.code.includes('PERIOD_LOCKED')
    ) {
      return { message: err.message, status: 409 };
    }
    return { message: err.message, status: 400 };
  }
  if (err instanceof Error) {
    return { message: err.message, status: defaultStatus };
  }
  return { message: 'Error procesando la solicitud contable.', status: defaultStatus };
}
