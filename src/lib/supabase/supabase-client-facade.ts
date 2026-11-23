import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabaseAccountLedger } from './supabase-account-ledger';
import { supabasePolizas } from './supabase-polizas';
import { supabaseCfdi } from './supabase-cfdi';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';
import { supabaseDiot } from './supabase-diot';
import { supabaseBank } from './supabase-bank';
import { supabaseFiscalAndAssets } from './supabase-fiscal-assets';
import { supabaseFiscalWorkpaper } from './supabase-fiscal-workpaper';
import { supabaseCxcSat } from './supabase-cxc-sat';
import { supabaseFielAndSoap } from './supabase-fiel-soap';
import { supabaseAdminApi } from './supabase-admin';
import { supabaseAdminEnterpriseApi } from './supabase-admin-enterprise';
import { supabaseAdminOpsApi } from './supabase-admin-ops';
import { supabaseBackupRestore } from './supabase-backup-restore';
import { supabaseClosingAndVerification } from './supabase-closing-verification';

export const supabaseCloudApi = {
  ...supabaseCompaniesAndAccounts,
  ...supabaseAccountLedger,
  ...supabasePolizas,
  ...supabaseCfdi,
  ...supabaseReportsAndDashboard,
  ...supabaseDiot,
  ...supabaseBank,
  ...supabaseFiscalAndAssets,
  ...supabaseFiscalWorkpaper,
  ...supabaseCxcSat,
  ...supabaseFielAndSoap,
  ...supabaseAdminApi,
  ...supabaseAdminEnterpriseApi,
  ...supabaseAdminOpsApi,
  ...supabaseBackupRestore,
  ...supabaseClosingAndVerification
};

export default supabaseCloudApi;
