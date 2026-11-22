import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabaseAccountLedger } from './supabase-account-ledger';
import { supabasePolizasAndCfdi } from './supabase-polizas-cfdi';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';
import { supabaseFiscalAndBank } from './supabase-fiscal-bank';
import { supabaseFielAndSoap } from './supabase-fiel-soap';
import { supabaseAdminApi } from './supabase-admin';
import { supabaseBackupRestore } from './supabase-backup-restore';
import { supabaseClosingAndVerification } from './supabase-closing-verification';

export const supabaseCloudApi = {
  ...supabaseCompaniesAndAccounts,
  ...supabaseAccountLedger,
  ...supabasePolizasAndCfdi,
  ...supabaseReportsAndDashboard,
  ...supabaseFiscalAndBank,
  ...supabaseFielAndSoap,
  ...supabaseAdminApi,
  ...supabaseBackupRestore,
  ...supabaseClosingAndVerification
};

export default supabaseCloudApi;
