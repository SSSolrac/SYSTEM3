const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim() ?? "";

const derivedProjectId = envUrl
  .replace(/^https?:\/\//, "")
  .replace(".supabase.co", "")
  .split(".")[0];

export const projectId = envProjectId || derivedProjectId;
export const supabaseUrl = envUrl || (projectId ? `https://${projectId}.supabase.co` : "");
export const publicAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  "";
