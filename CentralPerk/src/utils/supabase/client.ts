import { createClient } from '@supabase/supabase-js';
import { publicAnonKey, supabaseUrl } from '/utils/supabase/info';

export const hasSupabaseConfig = Boolean(supabaseUrl && publicAnonKey);
export const supabaseConfigError = hasSupabaseConfig
  ? ''
  : 'Missing Supabase environment variables. Set VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY in CentralPerk/.env.';

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  publicAnonKey || 'missing-supabase-key',
);
