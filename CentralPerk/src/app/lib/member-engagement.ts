import type { MemberData } from "../types/loyalty";
import type { LoyaltyTransaction, Member, MemberLoginActivity } from "../admin-panel/types";
import { supabase } from "../../utils/supabase/client";

export type EngagementSegment =
  | "All Members"
  | "Bronze"
  | "Silver"
  | "Gold"
  | "High Value"
  | "Inactive 60+ Days";

export type NotificationTrigger =
  | "Points Earned"
  | "Tier Upgrade"
  | "Reward Available"
  | "Flash Sale"
  | "Birthday";

export type SocialChannel = "facebook" | "instagram";

export type QuestionType = "multiple-choice" | "rating" | "free-text";

export type ChallengeType = "purchase-count" | "points-earned" | "survey-completion";

export type WinBackOfferType = "2x Points" | "Special Discount" | "Bonus Reward";

export interface SprintDayPlan {
  day: string;
  focus: string;
  tasks: string[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  trigger: NotificationTrigger;
  subject: string;
  message: string;
}

export interface NotificationCampaign {
  id: string;
  name: string;
  trigger: NotificationTrigger;
  segment: EngagementSegment;
  scheduledFor: string;
  status: "scheduled" | "live" | "completed";
  audienceSize: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  variantA: string;
  variantB: string;
  winner: "A" | "B" | "Pending";
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  targetValue: number;
  unitLabel: string;
  startAt: string;
  endAt: string;
  rewardPoints: number;
  rewardBadge: string;
  competitive: boolean;
  segment: EngagementSegment;
}

export interface SurveyQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
  options?: string[];
}

export interface SurveyResponseRecord {
  memberId: string;
  memberName: string;
  answers: Record<string, string | number>;
  submittedAt: string;
}

export interface SurveyDefinition {
  id: string;
  title: string;
  description: string;
  segment: EngagementSegment;
  bonusPoints: number;
  status: "draft" | "live" | "closed";
  createdAt: string;
  questions: SurveyQuestion[];
  responses: SurveyResponseRecord[];
}

export interface SharePrivacySettings {
  showName: boolean;
  showReferralCode: boolean;
  publicProfile: boolean;
}

export interface ShareEvent {
  id: string;
  memberId: string;
  memberName: string;
  tier: string;
  channel: SocialChannel;
  achievement: string;
  referralCode: string;
  conversions: number;
  createdAt: string;
}

export interface WinBackCampaign {
  id: string;
  name: string;
  segment: EngagementSegment;
  offerType: WinBackOfferType;
  offerValue: string;
  status: "scheduled" | "running" | "completed";
  targetedMembers: number;
  responses: number;
  reengagedMembers: number;
  estimatedRevenue: number;
  offerCost: number;
  launchDate: string;
}

export interface EngagementState {
  notificationCampaigns: NotificationCampaign[];
  challenges: ChallengeDefinition[];
  surveys: SurveyDefinition[];
  shareEvents: ShareEvent[];
  winBackCampaigns: WinBackCampaign[];
  claimedChallengeRewardsByMember: Record<string, string[]>;
  privacySettingsByMember: Record<string, SharePrivacySettings>;
}

export interface InactiveMemberInsight {
  memberId: string;
  memberNumber: string;
  memberName: string;
  tier: string;
  daysInactive: number;
  riskLevel: "Low" | "Medium" | "High";
  suggestedOffer: WinBackOfferType;
}

export interface ChallengeProgressSnapshot {
  current: number;
  target: number;
  percent: number;
  completed: boolean;
}

export const developer12SprintPlan: SprintDayPlan[] = [
  {
    day: "Day 1",
    focus: "Notification service and engagement data models",
    tasks: [
      "LYL-036-T1 Integrate push notification service",
      "LYL-037-T1 Design challenge data model",
      "LYL-039-T1 Design survey data model",
      "LYL-040-T1 Implement inactive member detection",
    ],
  },
  {
    day: "Day 2",
    focus: "Message templates, progress logic, and sharing foundation",
    tasks: [
      "LYL-036-T2 Build notification templates",
      "LYL-037-T2 Implement progress tracking",
      "LYL-038-T1 Implement social share API",
      "LYL-040-T2 Create win-back campaign engine",
    ],
  },
  {
    day: "Day 3",
    focus: "Member-facing experiences",
    tasks: [
      "LYL-036-T3 Implement scheduling",
      "LYL-037-T3 Build challenge UI",
      "LYL-038-T2 Generate shareable images",
      "LYL-039-T2 Build survey creator",
    ],
  },
  {
    day: "Day 4",
    focus: "Tracking, leaderboards, and dashboards",
    tasks: [
      "LYL-036-T4 Add delivery tracking",
      "LYL-037-T4 Add leaderboard",
      "LYL-038-T3 Add tracking",
      "LYL-039-T3 Create survey response UI",
      "LYL-040-T3 Build campaign dashboard",
    ],
  },
];

export const notificationTemplates: NotificationTemplate[] = [
  {
    id: "points-earned",
    name: "Points Earned",
    trigger: "Points Earned",
    subject: "You earned new loyalty points",
    message: "Nice work. Fresh points just landed in your account.",
  },
  {
    id: "tier-upgrade",
    name: "Tier Upgrade",
    trigger: "Tier Upgrade",
    subject: "You unlocked a new tier",
    message: "Your loyalty status just moved up. New perks are ready for you.",
  },
  {
    id: "reward-available",
    name: "Reward Available",
    trigger: "Reward Available",
    subject: "A reward is ready to claim",
    message: "Your points can now unlock a featured reward.",
  },
  {
    id: "flash-sale",
    name: "Flash Sale",
    trigger: "Flash Sale",
    subject: "Flash sale for loyalty members",
    message: "Limited-time rewards just dropped. Redeem before the timer runs out.",
  },
  {
    id: "birthday",
    name: "Birthday",
    trigger: "Birthday",
    subject: "Happy birthday from CentralPerk",
    message: "Celebrate with a birthday surprise waiting in your account.",
  },
];

function safeWindow() {
  return typeof window === "undefined" ? null : window;
}

function createEmptyState(): EngagementState {
  return {
    notificationCampaigns: [],
    challenges: [],
    surveys: [],
    shareEvents: [],
    winBackCampaigns: [],
    claimedChallengeRewardsByMember: {},
    privacySettingsByMember: {},
  };
}

export function loadEngagementState(): EngagementState {
  return createEmptyState();
}

export function saveEngagementState(_state: EngagementState) {
  // Deprecated: engagement data is no longer persisted in browser localStorage.
}

type NotificationCampaignRow = {
  id: string;
  name: string;
  trigger: NotificationTrigger;
  segment: EngagementSegment;
  scheduled_for: string;
  status: "scheduled" | "live" | "completed";
  audience_size: number | null;
  sent_count: number | null;
  delivered_count: number | null;
  opened_count: number | null;
  variant_a: string | null;
  variant_b: string | null;
  winner: "A" | "B" | "Pending" | null;
};

function mapNotificationCampaign(row: NotificationCampaignRow): NotificationCampaign {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    segment: row.segment,
    scheduledFor: row.scheduled_for,
    status: row.status,
    audienceSize: Number(row.audience_size ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    openedCount: Number(row.opened_count ?? 0),
    variantA: String(row.variant_a ?? ""),
    variantB: String(row.variant_b ?? ""),
    winner: row.winner ?? "Pending",
  };
}

export async function loadNotificationCampaigns() {
  const { data, error } = await supabase
    .from("notification_campaigns")
    .select("id,name,trigger,segment,scheduled_for,status,audience_size,sent_count,delivered_count,opened_count,variant_a,variant_b,winner")
    .order("scheduled_for", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as NotificationCampaignRow[]).map(mapNotificationCampaign);
}

export async function createNotificationCampaignRecord(input: Omit<NotificationCampaign, "id">) {
  const { data, error } = await supabase
    .from("notification_campaigns")
    .insert({
      name: input.name,
      trigger: input.trigger,
      segment: input.segment,
      scheduled_for: input.scheduledFor,
      status: input.status,
      audience_size: input.audienceSize,
      sent_count: input.sentCount,
      delivered_count: input.deliveredCount,
      opened_count: input.openedCount,
      variant_a: input.variantA,
      variant_b: input.variantB,
      winner: input.winner,
    })
    .select("id,name,trigger,segment,scheduled_for,status,audience_size,sent_count,delivered_count,opened_count,variant_a,variant_b,winner")
    .single();

  if (error) throw error;
  return mapNotificationCampaign(data as NotificationCampaignRow);
}

export async function markNotificationCampaignCompleted(campaign: NotificationCampaign) {
  const deliveredCount = Math.max(1, Math.round(campaign.audienceSize * 0.94));
  const openedCount = Math.max(1, Math.round(deliveredCount * 0.47));
  const winner: "A" | "B" = openedCount / Math.max(deliveredCount, 1) > 0.4 ? "B" : "A";

  const { data, error } = await supabase
    .from("notification_campaigns")
    .update({
      status: "completed",
      sent_count: campaign.audienceSize,
      delivered_count: deliveredCount,
      opened_count: openedCount,
      winner,
    })
    .eq("id", campaign.id)
    .select("id,name,trigger,segment,scheduled_for,status,audience_size,sent_count,delivered_count,opened_count,variant_a,variant_b,winner")
    .single();

  if (error) throw error;
  return mapNotificationCampaign(data as NotificationCampaignRow);
}

export function getMemberPrivacySettings(state: EngagementState, memberId: string): SharePrivacySettings {
  return (
    state.privacySettingsByMember[memberId] ?? {
      showName: true,
      showReferralCode: true,
      publicProfile: true,
    }
  );
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestActivityDate(memberId: string, transactions: LoyaltyTransaction[], loginActivity: MemberLoginActivity[]) {
  const txDates = transactions
    .filter((item) => String(item.member_id) === memberId)
    .map((item) => parseDate(item.transaction_date))
    .filter((item): item is Date => Boolean(item));

  const loginDates = loginActivity
    .filter((item) => String(item.member_id) === memberId)
    .map((item) => parseDate(item.login_at))
    .filter((item): item is Date => Boolean(item));

  const allDates = [...txDates, ...loginDates];
  if (allDates.length === 0) return null;
  return new Date(Math.max(...allDates.map((item) => item.getTime())));
}

export function buildInactiveMemberInsights(
  members: Member[],
  transactions: LoyaltyTransaction[],
  loginActivity: MemberLoginActivity[]
): InactiveMemberInsight[] {
  const now = Date.now();

  return members
    .map((member) => {
      const memberId = String(member.member_id ?? member.id ?? "");
      const lastSeen = latestActivityDate(memberId, transactions, loginActivity);
      const enrollment = parseDate(member.enrollment_date);
      const baseDate = lastSeen ?? enrollment;
      if (!baseDate) return null;

      const daysInactive = Math.max(0, Math.floor((now - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysInactive < 60) return null;

      const tier = String(member.tier || "Bronze");
      const riskLevel: InactiveMemberInsight["riskLevel"] =
        daysInactive >= 120 ? "High" : daysInactive >= 90 ? "Medium" : "Low";
      const suggestedOffer: WinBackOfferType =
        tier.toLowerCase() === "gold" ? "2x Points" : tier.toLowerCase() === "silver" ? "Bonus Reward" : "Special Discount";

      return {
        memberId,
        memberNumber: member.member_number,
        memberName: `${member.first_name} ${member.last_name}`.trim(),
        tier,
        daysInactive,
        riskLevel,
        suggestedOffer,
      };
    })
    .filter((item): item is InactiveMemberInsight => Boolean(item))
    .sort((a, b) => b.daysInactive - a.daysInactive);
}

function isDateInRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export function getChallengeProgress(challenge: ChallengeDefinition, user: MemberData): ChallengeProgressSnapshot {
  const start = parseDate(challenge.startAt) ?? new Date(0);
  const end = parseDate(challenge.endAt) ?? new Date();
  let current = 0;

  if (challenge.type === "purchase-count") {
    current = user.transactions.filter((tx) => {
      const txDate = parseDate(tx.date);
      return Boolean(txDate) && tx.type === "earned" && Boolean(tx.receiptId) && isDateInRange(txDate!, start, end);
    }).length;
  }

  if (challenge.type === "points-earned") {
    current = user.transactions
      .filter((tx) => {
        const txDate = parseDate(tx.date);
        return Boolean(txDate) && tx.type === "earned" && isDateInRange(txDate!, start, end);
      })
      .reduce((sum, tx) => sum + Math.abs(Number(tx.points || 0)), 0);
  }

  if (challenge.type === "survey-completion") {
    current = Math.max(0, Number(user.surveysCompleted || 0));
  }

  return {
    current,
    target: challenge.targetValue,
    percent: Math.min(100, challenge.targetValue > 0 ? (current / challenge.targetValue) * 100 : 0),
    completed: current >= challenge.targetValue,
  };
}

export function getChallengeLeaderboard(challenge: ChallengeDefinition, members: Member[], transactions: LoyaltyTransaction[]) {
  const start = parseDate(challenge.startAt) ?? new Date(0);
  const end = parseDate(challenge.endAt) ?? new Date();

  const rows = members.map((member) => {
    const memberId = String(member.member_id ?? member.id ?? "");
    let value = 0;

    if (challenge.type === "purchase-count") {
      value = transactions.filter((tx) => {
        const txDate = parseDate(tx.transaction_date);
        return (
          String(tx.member_id) === memberId &&
          tx.transaction_type.toUpperCase() === "PURCHASE" &&
          Boolean(txDate) &&
          isDateInRange(txDate!, start, end)
        );
      }).length;
    }

    if (challenge.type === "points-earned") {
      value = transactions
        .filter((tx) => {
          const txDate = parseDate(tx.transaction_date);
          const upperType = tx.transaction_type.toUpperCase();
          return (
            String(tx.member_id) === memberId &&
            (upperType === "PURCHASE" || upperType === "MANUAL_AWARD" || upperType === "EARN") &&
            Number(tx.points || 0) > 0 &&
            Boolean(txDate) &&
            isDateInRange(txDate!, start, end)
          );
        })
        .reduce((sum, tx) => sum + Number(tx.points || 0), 0);
    }

    return {
      memberId,
      memberName: `${member.first_name} ${member.last_name}`.trim(),
      tier: String(member.tier || "Bronze"),
      value,
    };
  });

  return rows.sort((a, b) => b.value - a.value).slice(0, 5);
}

export function buildShareAssetDataUrl(input: {
  memberName: string;
  tier: string;
  achievement: string;
  referralCode: string;
  privacy: SharePrivacySettings;
}) {
  const safeName = input.privacy.showName ? input.memberName : "CentralPerk Member";
  const safeCode = input.privacy.showReferralCode ? input.referralCode : "Hidden";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10213a" />
          <stop offset="100%" stop-color="#00a3ad" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" rx="56" fill="url(#bg)" />
      <circle cx="860" cy="220" r="160" fill="rgba(255,255,255,0.08)" />
      <circle cx="180" cy="920" r="140" fill="rgba(255,255,255,0.08)" />
      <text x="90" y="150" fill="#dffcff" font-size="44" font-family="Poppins, Arial, sans-serif">CENTRALPERK MEMBER MOMENT</text>
      <text x="90" y="320" fill="#ffffff" font-size="86" font-weight="700" font-family="Poppins, Arial, sans-serif">${safeName}</text>
      <text x="90" y="420" fill="#b5f8ff" font-size="54" font-family="Poppins, Arial, sans-serif">${input.achievement}</text>
      <rect x="90" y="500" width="320" height="120" rx="30" fill="#ffffff" />
      <text x="140" y="575" fill="#10213a" font-size="60" font-weight="700" font-family="Poppins, Arial, sans-serif">${input.tier.toUpperCase()}</text>
      <text x="90" y="720" fill="#ffffff" font-size="40" font-family="Poppins, Arial, sans-serif">Referral Code</text>
      <text x="90" y="800" fill="#ffffff" font-size="72" font-weight="700" font-family="Poppins, Arial, sans-serif">${safeCode}</text>
      <text x="90" y="950" fill="#dffcff" font-size="34" font-family="Poppins, Arial, sans-serif">Earn, engage, and unlock more loyalty rewards.</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function triggerDownload(dataUrl: string, filename: string) {
  const browser = safeWindow();
  if (!browser) return;
  const link = browser.document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function exportSurveyResponsesCsv(survey: SurveyDefinition) {
  const browser = safeWindow();
  if (!browser) return;

  const headers = ["memberId", "memberName", "submittedAt", ...survey.questions.map((question) => question.prompt)];
  const lines = [
    headers.join(","),
    ...survey.responses.map((response) =>
      [
        response.memberId,
        response.memberName,
        response.submittedAt,
        ...survey.questions.map((question) => JSON.stringify(response.answers[question.id] ?? "")),
      ].join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = browser.URL.createObjectURL(blob);
  triggerDownload(url, `${survey.title.replace(/\s+/g, "-").toLowerCase()}-responses.csv`);
  browser.setTimeout(() => browser.URL.revokeObjectURL(url), 500);
}

export function getSegmentAudienceSize(segment: EngagementSegment, members: Member[]) {
  if (segment === "All Members") return members.length;
  if (segment === "High Value") return members.filter((member) => Number(member.points_balance || 0) >= 1000).length;
  if (segment === "Inactive 60+ Days") return members.length;
  return members.filter((member) => String(member.tier || "Bronze").toLowerCase() === segment.toLowerCase()).length;
}
