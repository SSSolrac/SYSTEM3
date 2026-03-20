import { supabase } from "../../utils/supabase/client";
import { setStoredCustomerSession } from "./auth";

const DEMO_ACCOUNTS_KEY = "loyaltyhub-demo-accounts-v1";
const MIN_PASSWORD_LENGTH = 8;
const DEMO_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const DEMO_LOCAL_PART_HINTS = [
  "demo",
  "test",
  "fake",
  "sample",
  "qa",
  "dev",
  "staging",
  "dummy",
  "mock",
];

const DEMO_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.local",
  "local.test",
  "localhost",
  "invalid",
  "mailinator.com",
  "tempmail.com",
]);

const MEMBER_SELECT_COLUMNS = "id,member_id,member_number,first_name,last_name,email,phone,birthdate,points_balance,enrollment_date";
const AUTH_RATE_LIMIT_HINTS = ["over_email_send_rate_limit", "rate limit", "too many requests"];
const AUTH_ALREADY_EXISTS_HINTS = ["user already registered", "already registered", "already exists", "user exists"];
const PROFILE_CONSTRAINT_HINTS = ["duplicate key", "already exists", "violates unique constraint"];

export type RegisterCustomerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthdate: string;
  password: string;
};

type DemoAccount = {
  email: string;
  passwordHash: string;
  memberId: string;
  fullName: string;
  phone: string;
  createdAt: string;
};

export type RegisterCustomerResult = {
  authMode: "demo" | "supabase";
  emailConfirmationRequired: boolean;
  immediateLoginAvailable: boolean;
  memberRecord: Record<string, any>;
  recoveredFromExistingAuthSignup: boolean;
  authUserAlreadyExisted: boolean;
};

export type LoginCustomerResult = {
  authMode: "demo" | "supabase";
  accessToken?: string;
  userId?: string;
};

class AuthFlowError extends Error {
  constructor(
    public readonly code:
      | "INVALID_EMAIL"
      | "INVALID_PASSWORD"
      | "MISSING_PASSWORD"
      | "DUPLICATE_EMAIL"
      | "DUPLICATE_PHONE"
      | "DUPLICATE_EMAIL_AND_PHONE"
      | "AUTH_RATE_LIMIT"
      | "AUTH_EMAIL_NOT_CONFIRMED"
      | "INVALID_CREDENTIALS"
      | "PROFILE_CREATION_FAILED"
      | "AUTH_PROVIDER_ERROR",
    message: string,
    public readonly causeValue?: unknown
  ) {
    super(message);
  }
}

function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

function normalizePhoneNumber(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  if (!trimmed) return "";
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return "";
  return trimmed.startsWith("+") ? `+${digitsOnly}` : digitsOnly;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasStrongEnoughPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

function extractErrorText(rawError: unknown): string {
  return typeof rawError === "string"
    ? rawError
    : rawError && typeof rawError === "object"
      ? [
          "message" in rawError ? String(rawError.message ?? "") : "",
          "details" in rawError ? String(rawError.details ?? "") : "",
          "hint" in rawError ? String(rawError.hint ?? "") : "",
          JSON.stringify(rawError),
        ]
          .filter(Boolean)
          .join(" ")
      : "";
}

function hasAnyHint(haystack: string, hints: string[]): boolean {
  return hints.some((hint) => haystack.toLowerCase().includes(hint));
}

function isAlreadyExistsAuthError(rawError: unknown): boolean {
  if (!rawError || typeof rawError !== "object") return false;
  const code = "code" in rawError ? String(rawError.code ?? "").toLowerCase() : "";
  const normalizedText = extractErrorText(rawError).toLowerCase();
  return code.includes("already") || hasAnyHint(normalizedText, AUTH_ALREADY_EXISTS_HINTS);
}

function isRateLimitError(rawError: unknown): boolean {
  if (!rawError || typeof rawError !== "object") return false;
  if (isAlreadyExistsAuthError(rawError)) return false;
  const status = "status" in rawError ? Number(rawError.status) : NaN;
  const code = "code" in rawError ? String(rawError.code ?? "").toLowerCase() : "";
  const text = extractErrorText(rawError).toLowerCase();
  return status === 429 || code.includes("over_email_send_rate_limit") || hasAnyHint(text, AUTH_RATE_LIMIT_HINTS);
}

export function isDemoEmail(rawEmail: string): boolean {
  const normalized = normalizeEmail(rawEmail);
  const [localPart = "", domain = ""] = normalized.split("@");

  if (!localPart || !domain) return false;
  if (DEMO_DOMAINS.has(domain)) return true;
  if (domain.endsWith(".local") || domain.endsWith(".test")) return true;
  return DEMO_LOCAL_PART_HINTS.some((hint) => localPart.includes(hint));
}

function loadDemoAccounts(): DemoAccount[] {
  try {
    const raw = localStorage.getItem(DEMO_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Boolean(entry?.email && entry?.passwordHash && entry?.memberId));
  } catch {
    return [];
  }
}

function saveDemoAccounts(accounts: DemoAccount[]): void {
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function hashSecret(secret: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return Array.from(new Uint8Array(digest))
      .map((part) => part.toString(16).padStart(2, "0"))
      .join("");
  }
  return btoa(secret);
}

export function persistDemoSession(input: { memberId: string; email: string; phone: string; fullName: string }) {
  setStoredCustomerSession({
    memberId: input.memberId,
    email: normalizeEmail(input.email),
    phone: input.phone,
    fullName: input.fullName,
    expiresAt: new Date(Date.now() + DEMO_SESSION_TTL_MS).toISOString(),
  });
}

async function createOrRepairMemberProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthdate: string;
}): Promise<{ memberRecord: Record<string, any>; recoveredFromExistingAuthSignup: boolean }> {
  const { data: insertedMember, error: insertError } = await supabase
    .from("loyalty_members")
    .insert([
      {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        birthdate: input.birthdate,
        points_balance: 0,
        tier: "Bronze",
      },
    ])
    .select(MEMBER_SELECT_COLUMNS)
    .single();

  if (!insertError && insertedMember) {
    return { memberRecord: insertedMember, recoveredFromExistingAuthSignup: false };
  }

  const insertErrorText = extractErrorText(insertError).toLowerCase();
  if (!hasAnyHint(insertErrorText, PROFILE_CONSTRAINT_HINTS)) {
    throw new AuthFlowError("PROFILE_CREATION_FAILED", "Unable to create customer profile.", insertError);
  }

  const { data: existingMember, error: existingMemberError } = await supabase
    .from("loyalty_members")
    .select(MEMBER_SELECT_COLUMNS)
    .or(`email.ilike.${input.email},phone.eq.${input.phone}`)
    .limit(1)
    .maybeSingle();

  if (existingMemberError || !existingMember) {
    throw new AuthFlowError("PROFILE_CREATION_FAILED", "Unable to create customer profile.", existingMemberError);
  }

  const needsRepair =
    !existingMember.first_name ||
    !existingMember.last_name ||
    !existingMember.phone ||
    !existingMember.birthdate;

  if (!needsRepair) {
    return { memberRecord: existingMember, recoveredFromExistingAuthSignup: false };
  }

  const { data: repairedMember, error: repairError } = await supabase
    .from("loyalty_members")
    .update({
      first_name: existingMember.first_name || input.firstName,
      last_name: existingMember.last_name || input.lastName,
      phone: existingMember.phone || input.phone,
      birthdate: existingMember.birthdate || input.birthdate,
    })
    .eq("id", existingMember.id)
    .select(MEMBER_SELECT_COLUMNS)
    .single();

  if (repairError || !repairedMember) {
    throw new AuthFlowError("PROFILE_CREATION_FAILED", "Unable to create customer profile.", repairError);
  }

  return { memberRecord: repairedMember, recoveredFromExistingAuthSignup: true };
}

export async function registerCustomer(input: RegisterCustomerInput): Promise<RegisterCustomerResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhoneNumber(input.phone);

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthFlowError("INVALID_EMAIL", "Please enter a valid email address.");
  }
  if (!input.password) {
    throw new AuthFlowError("MISSING_PASSWORD", "Password is required.");
  }
  if (!hasStrongEnoughPassword(input.password)) {
    throw new AuthFlowError("INVALID_PASSWORD", "Password must be at least 8 characters long.");
  }

  const { data: existingMembers, error: existingMembersError } = await supabase
    .from("loyalty_members")
    .select("email, phone")
    .or(`email.ilike.${normalizedEmail},phone.eq.${normalizedPhone}`);

  if (existingMembersError) {
    throw new AuthFlowError("AUTH_PROVIDER_ERROR", "Unable to validate existing customer records.", existingMembersError);
  }

  const emailExists = (existingMembers ?? []).some((member) => String(member.email || "").trim().toLowerCase() === normalizedEmail);
  const phoneExists = (existingMembers ?? []).some((member) => normalizePhoneNumber(String(member.phone || "")) === normalizedPhone);
  if (emailExists && phoneExists) {
    throw new AuthFlowError("DUPLICATE_EMAIL_AND_PHONE", "A user with that email and phone number already exists.");
  }
  if (emailExists) {
    throw new AuthFlowError("DUPLICATE_EMAIL", "Email already registered.");
  }
  if (phoneExists) {
    throw new AuthFlowError("DUPLICATE_PHONE", "This phone number is already registered.");
  }

  if (isDemoEmail(normalizedEmail)) {
    console.log("DEMO AUTH USED", normalizedEmail);
    const demoAccounts = loadDemoAccounts();
    const duplicateDemo = demoAccounts.find((entry) => entry.email === normalizedEmail);
    if (duplicateDemo) {
      throw new AuthFlowError("DUPLICATE_EMAIL", "Email already registered.");
    }

    const { memberRecord, recoveredFromExistingAuthSignup } = await createOrRepairMemberProfile({
      firstName: input.firstName,
      lastName: input.lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      birthdate: input.birthdate,
    });

    const passwordHash = await hashSecret(input.password);
    demoAccounts.push({
      email: normalizedEmail,
      passwordHash,
      memberId: String(memberRecord.member_number),
      fullName: `${input.firstName} ${input.lastName}`.trim(),
      phone: normalizedPhone,
      createdAt: new Date().toISOString(),
    });
    saveDemoAccounts(demoAccounts);

    persistDemoSession({
      memberId: String(memberRecord.member_number),
      email: normalizedEmail,
      phone: normalizedPhone,
      fullName: `${input.firstName} ${input.lastName}`.trim() || "Member",
    });

    return {
      authMode: "demo",
      emailConfirmationRequired: false,
      immediateLoginAvailable: true,
      memberRecord,
      recoveredFromExistingAuthSignup,
      authUserAlreadyExisted: false,
    };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        birthdate: input.birthdate,
      },
    },
  });

  let authUserAlreadyExisted = false;
  if (signUpError) {
    if (isAlreadyExistsAuthError(signUpError)) {
      authUserAlreadyExisted = true;
    } else if (isRateLimitError(signUpError)) {
      throw new AuthFlowError(
        "AUTH_RATE_LIMIT",
        "Supabase Auth is rate-limited (429) while trying to send confirmation/login email. Use a demo email in development or wait and retry.",
        signUpError
      );
    } else {
      throw new AuthFlowError("AUTH_PROVIDER_ERROR", extractErrorText(signUpError) || "Unable to register account.", signUpError);
    }
  }

  const { memberRecord, recoveredFromExistingAuthSignup } = await createOrRepairMemberProfile({
    firstName: input.firstName,
    lastName: input.lastName,
    email: normalizedEmail,
    phone: normalizedPhone,
    birthdate: input.birthdate,
  });

  return {
    authMode: "supabase",
    emailConfirmationRequired: !authUserAlreadyExisted && !signUpData?.session,
    immediateLoginAvailable: !authUserAlreadyExisted && Boolean(signUpData?.session),
    memberRecord,
    recoveredFromExistingAuthSignup,
    authUserAlreadyExisted,
  };
}

export async function loginCustomer(input: { email: string; password: string; role: "customer" | "admin" }): Promise<LoginCustomerResult> {
  const normalizedEmail = normalizeEmail(input.email);
  if (input.role === "customer" && isDemoEmail(normalizedEmail)) {
    console.log("DEMO AUTH USED", normalizedEmail);
    const demoAccount = loadDemoAccounts().find((entry) => entry.email === normalizedEmail);
    if (demoAccount) {
      const incomingHash = await hashSecret(input.password);
      if (incomingHash !== demoAccount.passwordHash) {
        throw new AuthFlowError("INVALID_CREDENTIALS", "Invalid email or password.");
      }

      persistDemoSession({
        memberId: demoAccount.memberId,
        email: demoAccount.email,
        phone: demoAccount.phone,
        fullName: demoAccount.fullName,
      });
      return { authMode: "demo", accessToken: "demo-customer-session", userId: demoAccount.memberId };
    }

    throw new AuthFlowError("INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const authEmail = input.role === "admin" ? `${input.email.trim()}@admin.loyaltyhub.com` : normalizedEmail;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: input.password,
  });

  if (error) {
    const signInCode = String(error.code ?? "").toLowerCase();
    const signInMessage = String(error.message ?? "").toLowerCase();
    const isEmailNotConfirmedError = signInCode === "email_not_confirmed" || signInMessage.includes("email not confirmed");
    const isInvalidCredentialsError = signInMessage.includes("invalid login credentials");

    if (isEmailNotConfirmedError) {
      throw new AuthFlowError("AUTH_EMAIL_NOT_CONFIRMED", "Email confirmation is still required for this account.", error);
    }
    if (isRateLimitError(error)) {
      throw new AuthFlowError(
        "AUTH_RATE_LIMIT",
        "Supabase temporarily blocked this auth attempt (429/rate limit). This usually happens in development when built-in auth email limits are exceeded.",
        error
      );
    }
    if (isInvalidCredentialsError) {
      throw new AuthFlowError("INVALID_CREDENTIALS", "Invalid email or password.", error);
    }
    throw new AuthFlowError("AUTH_PROVIDER_ERROR", extractErrorText(error) || "Unable to sign in.", error);
  }

  return {
    authMode: "supabase",
    accessToken: data.session?.access_token,
    userId: data.user?.id,
  };
}

export function mapAuthErrorToMessage(error: unknown): string {
  if (!(error instanceof AuthFlowError)) {
    return error instanceof Error ? error.message : "An unexpected auth error occurred.";
  }

  switch (error.code) {
    case "INVALID_EMAIL":
      return "Please enter a valid email address.";
    case "MISSING_PASSWORD":
      return "Password is required.";
    case "INVALID_PASSWORD":
      return "Password must be at least 8 characters long.";
    case "DUPLICATE_EMAIL":
      return "Duplicate email.";
    case "DUPLICATE_PHONE":
      return "Duplicate number.";
    case "DUPLICATE_EMAIL_AND_PHONE":
      return "A user with that email and phone number already exists.";
    case "AUTH_RATE_LIMIT":
      return "Supabase Auth rate limit reached (429). In development, use a demo/test email (example.com/.test/.local) to avoid email-send limits, or wait 60 seconds and try again.";
    case "AUTH_EMAIL_NOT_CONFIRMED":
      return "Email confirmation is still required for this account. Confirm your email, then try signing in again.";
    case "INVALID_CREDENTIALS":
      return "Invalid email or password. Please check your credentials and try again.";
    case "PROFILE_CREATION_FAILED":
      return "Account authentication was created, but profile setup failed. Please try logging in, and contact support if the issue persists.";
    case "AUTH_PROVIDER_ERROR":
    default:
      return error.message || "Authentication failed. Please try again.";
  }
}
