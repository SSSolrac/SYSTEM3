import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../utils/supabase/client';
import { ensureWelcomePackage } from '../lib/loyalty-supabase';
import { applyReferralCodeForSignup } from '../lib/member-lifecycle';

const WELCOME_NOTICE_STORAGE_KEY = 'centralperk-welcome-notice';
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const RATE_LIMIT_COOLDOWN_STORAGE_KEY = 'centralperk-signup-cooldown-until';
const AUTH_PROGRESS_STORAGE_KEY = 'centralperk-signup-auth-progress';

interface Member {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthdate: string;
  currentPointsBalance: number;
  createdAt: string;
}

const AUTH_RATE_LIMIT_HINTS = ['over_email_send_rate_limit', 'rate limit', 'too many requests'];
const AUTH_ALREADY_EXISTS_HINTS = ['user already registered', 'already registered', 'already exists', 'user exists'];
const PROFILE_CONSTRAINT_HINTS = ['duplicate key', 'already exists', 'violates unique constraint'];
const PARTIAL_SUCCESS_NOTICE =
  'Your account may already have been created. Please check your email for a confirmation link, or try signing in after confirming your email.';

export function RegistrationCard() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthdate: '',
    password: '',
    referralCode: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") || "" : "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [registeredMember, setRegisteredMember] = useState<Member | null>(null);
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  const cooldownSecondsRemaining = cooldownUntilMs
    ? Math.max(0, Math.ceil((cooldownUntilMs - currentTimeMs) / 1000))
    : 0;
  const isCooldownActive = cooldownSecondsRemaining > 0;

  useEffect(() => {
    if (!isCooldownActive) return;
    const intervalId = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isCooldownActive]);

  useEffect(() => {
    const savedCooldown = Number(localStorage.getItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY) || 0);
    if (savedCooldown > Date.now()) {
      setCooldownUntilMs(savedCooldown);
      setCurrentTimeMs(Date.now());
      return;
    }
    localStorage.removeItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (cooldownUntilMs && cooldownUntilMs <= currentTimeMs) {
      localStorage.removeItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY);
      setCooldownUntilMs(null);
    }
  }, [cooldownUntilMs, currentTimeMs]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const extractErrorText = (rawError: unknown) => {
    return typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object'
        ? [
            'message' in rawError ? String(rawError.message ?? '') : '',
            'details' in rawError ? String(rawError.details ?? '') : '',
            'hint' in rawError ? String(rawError.hint ?? '') : '',
            JSON.stringify(rawError),
          ]
            .filter(Boolean)
            .join(' ')
        : '';
  };

  const hasAnyHint = (haystack: string, hints: string[]) =>
    hints.some((hint) => haystack.toLowerCase().includes(hint));

  const isRateLimitError = (rawError: unknown) => {
    if (!rawError || typeof rawError !== 'object') return false;
    const status = 'status' in rawError ? Number(rawError.status) : NaN;
    const code = 'code' in rawError ? String(rawError.code ?? '').toLowerCase() : '';
    const text = extractErrorText(rawError).toLowerCase();
    return status === 429 || code.includes('over_email_send_rate_limit') || hasAnyHint(text, AUTH_RATE_LIMIT_HINTS);
  };

  const isAuthAlreadyExistsError = (rawError: unknown) => {
    const errorText = extractErrorText(rawError).toLowerCase();
    return hasAnyHint(errorText, AUTH_ALREADY_EXISTS_HINTS);
  };

  const setRateLimitCooldown = (durationMs = RATE_LIMIT_COOLDOWN_MS) => {
    const until = Date.now() + durationMs;
    setCooldownUntilMs(until);
    setCurrentTimeMs(Date.now());
    localStorage.setItem(RATE_LIMIT_COOLDOWN_STORAGE_KEY, String(until));
  };

  const getAuthProgressMap = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(AUTH_PROGRESS_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
    } catch {
      return {};
    }
  };

  const markAuthProgressForEmail = (email: string) => {
    const progress = getAuthProgressMap();
    progress[email.toLowerCase()] = Date.now();
    localStorage.setItem(AUTH_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  };

  const hasAuthProgressForEmail = (email: string) => {
    const progress = getAuthProgressMap();
    const recordedAt = Number(progress[email.toLowerCase()] || 0);
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (!recordedAt) return false;
    if (Date.now() - recordedAt > oneDayMs) {
      delete progress[email.toLowerCase()];
      localStorage.setItem(AUTH_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      return false;
    }
    return true;
  };

  const clearAuthProgressForEmail = (email: string) => {
    const progress = getAuthProgressMap();
    delete progress[email.toLowerCase()];
    localStorage.setItem(AUTH_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  };

  const ensureMemberProfile = async (normalizedEmail: string, normalizedPhone: string) => {
    const { data: existingMember, error: existingMemberError } = await supabase
      .from('loyalty_members')
      .select('*')
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle();
    if (existingMemberError) throw existingMemberError;
    if (existingMember) return existingMember;

    const { data: phoneOwner, error: phoneOwnerError } = await supabase
      .from('loyalty_members')
      .select('id,email')
      .eq('phone', normalizedPhone)
      .limit(1)
      .maybeSingle();
    if (phoneOwnerError) throw phoneOwnerError;
    if (phoneOwner && String(phoneOwner.email || '').trim().toLowerCase() !== normalizedEmail) {
      throw new Error('Duplicate number.');
    }

    const { data: newMember, error: insertError } = await supabase
      .from('loyalty_members')
      .insert([
        {
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          birthdate: formData.birthdate,
          points_balance: 0,
          tier: 'Bronze',
        },
      ])
      .select()
      .single();

    if (insertError) {
      const insertErrorText = extractErrorText(insertError).toLowerCase();
      if (hasAnyHint(insertErrorText, PROFILE_CONSTRAINT_HINTS)) {
        const { data: racedMember, error: racedMemberError } = await supabase
          .from('loyalty_members')
          .select('*')
          .ilike('email', normalizedEmail)
          .limit(1)
          .maybeSingle();
        if (racedMemberError) throw racedMemberError;
        if (racedMember) return racedMember;
        if (insertErrorText.includes('phone')) {
          throw new Error('Duplicate number.');
        }
      }
      throw new Error('PROFILE_CREATION_FAILED');
    }

    if (!newMember) throw new Error('PROFILE_CREATION_FAILED');
    return newMember;
  };

  const buildReadableErrorMessage = (rawError: unknown) => {
    const errorText = extractErrorText(rawError);
    const normalizedErrorText = errorText.toLowerCase();

    if (isRateLimitError(rawError) || hasAnyHint(normalizedErrorText, AUTH_RATE_LIMIT_HINTS)) {
      return 'Too many registration attempts right now. Please wait a minute before trying again.';
    }

    if (errorText.includes('A user with that email and phone number already exists.')) {
      return 'A user with that email and phone number already exists.';
    }

    if (errorText.includes('Duplicate email.') || errorText.includes('Email already registered')) {
      return 'Duplicate email.';
    }

    if (
      errorText.includes('Duplicate number.') ||
      errorText.includes('Phone number already registered') ||
      errorText.includes('This phone number is already registered')
    ) {
      return 'Duplicate number.';
    }

    if (
      errorText.includes('row-level security policy') ||
      errorText.includes('duplicate key') ||
      errorText.includes('already exists') ||
      errorText.includes('already registered')
    ) {
      return 'A user with that email and phone number already exists.';
    }

    if (errorText.includes('PROFILE_CREATION_FAILED')) {
      return 'Account authentication was created, but profile setup failed. Please try logging in, and contact support if the issue persists.';
    }

    return errorText || 'Registration failed. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;
    if (isCooldownActive) {
      setMessage({
        type: 'error',
        text: `Too many registration attempts right now. Please wait ${cooldownSecondsRemaining} seconds and try again.`,
      });
      return;
    }
    submitLockRef.current = true;
    setIsSubmitting(true);
    setMessage(null);
    setRegisteredMember(null);

    let authSignupLikelyCompleted = false;
    let normalizedEmail = '';

    try {
      normalizedEmail = formData.email.trim().toLowerCase();
      const normalizedPhone = formData.phone.trim();
      const hasPendingAuthProgress = hasAuthProgressForEmail(normalizedEmail);
      let signUpData: { session: unknown } = { session: null };

      if (!hasPendingAuthProgress) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              birthdate: formData.birthdate,
            },
          },
        });
        signUpData = { session: data.session };

        if (signUpError) {
          if (isRateLimitError(signUpError)) {
            setRateLimitCooldown();
            throw signUpError;
          }
          if (isAuthAlreadyExistsError(signUpError)) {
            authSignupLikelyCompleted = true;
            markAuthProgressForEmail(normalizedEmail);
          } else {
            throw signUpError;
          }
        } else {
          authSignupLikelyCompleted = true;
          markAuthProgressForEmail(normalizedEmail);
        }
      } else {
        authSignupLikelyCompleted = true;
      }

      const newMember = await ensureMemberProfile(normalizedEmail, normalizedPhone);

      const shouldConfirmEmail = !signUpData.session;
      const successSuffix = shouldConfirmEmail
        ? 'Please check your email to confirm your account before logging in.'
        : 'You can now log in.';
      let successMessage = `Registration successful! Welcome to our loyalty program. ${successSuffix}`;
      let memberPointsBalance = Number(newMember.points_balance ?? 0);
      try {
        const welcomeResult = await ensureWelcomePackage(newMember.member_number, newMember.email);
        memberPointsBalance = Number(welcomeResult.newBalance ?? newMember.points_balance ?? 0);

        if (welcomeResult.granted) {
          successMessage = `Registration successful! Welcome package applied. ${successSuffix}`;
          localStorage.setItem(
            WELCOME_NOTICE_STORAGE_KEY,
            JSON.stringify({
              memberNumber: newMember.member_number,
              grantedAt: new Date().toISOString(),
            })
          );
        }
      } catch (welcomeError) {
        console.warn('Welcome package setup issue after signup:', welcomeError);
        successMessage = `${successMessage} Your account is ready, but welcome points are still being finalized.`;
      }

      if (formData.referralCode.trim()) {
        try {
          const referral = await applyReferralCodeForSignup({
            referralCode: formData.referralCode.trim(),
            refereeMemberId: String(newMember.member_number),
            refereeEmail: String(newMember.email),
          });
          if (!referral.applied) {
            successMessage = `${successMessage} Note: your referral code was invalid or not applicable.`;
          }
        } catch (referralError) {
          console.warn('Referral application issue after signup:', referralError);
          successMessage = `${successMessage} Your account is ready, but referral processing is still pending.`;
        }
      }

      // Update state with new member data
      setRegisteredMember({
        id: String(newMember.id ?? newMember.member_id ?? ''),
        memberNumber: newMember.member_number,
        firstName: newMember.first_name,
        lastName: newMember.last_name,
        email: newMember.email,
        phone: newMember.phone,
        birthdate: formData.birthdate,
        currentPointsBalance: memberPointsBalance,
        createdAt: newMember.enrollment_date,
      });

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        birthdate: '',
        password: '',
        referralCode: '',
      });

      setMessage({
        type: 'success',
        text: successMessage,
      });
      clearAuthProgressForEmail(normalizedEmail);

      console.log('Member registered:', newMember);
    } catch (error) {
      console.error('Registration error:', error);

      if (isRateLimitError(error)) {
        setRateLimitCooldown();
      }

      const isPartialSuccess = authSignupLikelyCompleted || (normalizedEmail ? hasAuthProgressForEmail(normalizedEmail) : false);
      setMessage({
        type: isPartialSuccess ? 'success' : 'error',
        text: isPartialSuccess
          ? `${PARTIAL_SUCCESS_NOTICE} ${buildReadableErrorMessage(error)}`
          : buildReadableErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="flex flex-col md:flex-row">
        {/* Left Side - Branded Area */}
        <div className="w-full md:w-2/5 bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-12 flex flex-col justify-center text-white">
          <div className="mb-8">
            <div className="w-16 h-16 bg-[#1bb9d3] rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-4xl font-bold mb-4">Join Our Program</h2>
            <p className="text-gray-300 text-lg">Create your account and start earning rewards today.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#1bb9d3] rounded-full"></div>
              <span className="text-sm text-gray-300">Instant member number</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#1bb9d3] rounded-full"></div>
              <span className="text-sm text-gray-300">Earn points on every purchase</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#1bb9d3] rounded-full"></div>
              <span className="text-sm text-gray-300">Exclusive member offers</span>
            </div>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="w-full md:w-3/5 p-12">
          <h1 className="mb-2 text-3xl font-semibold text-gray-800">
            Create Account
          </h1>
          <p className="mb-8 text-gray-500">Fill in your details to get started</p>
          
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl ${
                message.type === 'success'
                  ? 'bg-[#f5f7fb] text-[#1A2B47] border border-[#1A2B47]/30'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {registeredMember && (
            <div className="mb-6 p-5 rounded-xl bg-[#1A2B47] text-white">
              <p className="text-sm opacity-90 mb-1">Your Member Number</p>
              <p className="text-2xl font-semibold mb-3">
                {registeredMember.memberNumber}
              </p>
              <div className="text-sm opacity-90">
                <p>Points Balance: <span className="font-semibold">{registeredMember.currentPointsBalance}</span></p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Two-column grid for name fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block mb-2 text-gray-700 font-medium">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                  placeholder="John"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block mb-2 text-gray-700 font-medium">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            {/* Two-column grid for email and phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block mb-2 text-gray-700 font-medium">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block mb-2 text-gray-700 font-medium">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
            </div>

            {/* Birthdate field - full width */}
            <div>
              <label htmlFor="birthdate" className="block mb-2 text-gray-700 font-medium">
                Birthdate
              </label>
              <input
                type="date"
                id="birthdate"
                name="birthdate"
                value={formData.birthdate}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Password field - full width */}
            <div>
              <label htmlFor="password" className="block mb-2 text-gray-700 font-medium">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                placeholder="Minimum 6 characters"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="referralCode" className="block mb-2 text-gray-700 font-medium">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-[#dbe4f2] rounded-xl border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1bb9d3] focus:border-transparent transition-all"
                placeholder="REF000123"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isCooldownActive}
              className="w-full bg-[#1bb9d3] text-white py-3.5 rounded-xl hover:bg-[#18a9c0] transition-colors duration-200 mt-6 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-[#1bb9d3]/20"
            >
              {isSubmitting ? 'Registering...' : isCooldownActive ? `Try again in ${cooldownSecondsRemaining}s` : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
