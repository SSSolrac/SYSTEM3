import { supabase } from "../../utils/supabase/client";

export type Role = "customer" | "admin";

const ADMIN_SUFFIX = "@admin.loyaltyhub.com";
const ROLE_VALUES: Role[] = ["customer", "admin"];
const CUSTOMER_SESSION_KEY = "loyaltyhub-customer-session";
const CUSTOMER_DASHBOARD_USER_KEY = "points-dashboard-user-v1";

export type CustomerSession = {
  role: "customer";
  memberId: string;
  email: string;
  phone: string;
  fullName: string;
  expiresAt: string;
};

export function clearStoredAuth() {
  localStorage.removeItem("role");
  localStorage.removeItem("token");
  localStorage.removeItem("user_id");
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  localStorage.removeItem(CUSTOMER_DASHBOARD_USER_KEY);
}

function inferRoleFromEmail(email?: string | null): Role | null {
  if (!email) return null;
  return email.endsWith(ADMIN_SUFFIX) ? "admin" : null;
}

function normalizeRole(raw: unknown): Role | null {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return ROLE_VALUES.includes(value as Role) ? (value as Role) : null;
}

function loadCustomerSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerSession;
    if (!parsed?.memberId || !parsed?.phone || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
    return null;
  }
}

export function getStoredCustomerSession() {
  return loadCustomerSession();
}

export function getCurrentCustomerSession() {
  return loadCustomerSession();
}

export function setStoredCustomerSession(session: Omit<CustomerSession, "role">) {
  const payload: CustomerSession = { role: "customer", ...session };
  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(payload));
}

export function touchStoredCustomerSession() {
  const session = loadCustomerSession();
  if (!session) return;
  localStorage.setItem(
    CUSTOMER_SESSION_KEY,
    JSON.stringify({
      ...session,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    } satisfies CustomerSession)
  );
}

export async function getSession() {
  const localCustomerSession = loadCustomerSession();
  if (localCustomerSession) {
    return {
      access_token: "customer-otp-session",
      user: {
        email: localCustomerSession.email,
        phone: localCustomerSession.phone,
        app_metadata: { role: "customer" },
        user_metadata: {
          role: "customer",
          member_id: localCustomerSession.memberId,
          full_name: localCustomerSession.fullName,
        },
      },
    } as any;
  }

  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

async function getRoleFromDb(email?: string | null): Promise<Role | null> {
  if (!email) return null;
  const { data, error } = await supabase
    .from("loyalty_members")
    .select("id")
    .ilike("email", email.trim())
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ? "customer" : null;
}

export async function getRoleFromSession(): Promise<Role | null> {
  const localCustomerSession = loadCustomerSession();
  if (localCustomerSession) return "customer";

  const session = await getSession();
  if (!session) return null;

  const appMetadataRole = normalizeRole(session.user?.app_metadata?.role);
  if (appMetadataRole) return appMetadataRole;

  const userMetadataRole = normalizeRole(session.user?.user_metadata?.role);
  if (userMetadataRole) return userMetadataRole;

  const dbRole = await getRoleFromDb(session.user?.email);
  if (dbRole) return dbRole;

  // Legacy fallback to keep existing admin accounts working without
  // accidentally treating profile-less customer accounts as valid.
  return inferRoleFromEmail(session.user?.email);
}
