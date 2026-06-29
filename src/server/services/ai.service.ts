import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { GapNarrativeInput } from "@/lib/ai-prompts/gap-analysis.prompt";
import type { LearningTipInput, LearningPathSummaryInput } from "@/lib/ai-prompts/learning-path.prompt";
import type { FeedbackSynthesisInput } from "@/lib/ai-prompts/feedback-synthesis.prompt";
import type { MeetingPrepInput } from "@/lib/ai-prompts/meeting-prep.prompt";
import { buildGapNarrativePrompt } from "@/lib/ai-prompts/gap-analysis.prompt";
import { buildLearningTipPrompt, buildLearningPathSummaryPrompt } from "@/lib/ai-prompts/learning-path.prompt";
import { buildFeedbackSynthesisPrompt } from "@/lib/ai-prompts/feedback-synthesis.prompt";
import { buildMeetingPrepPrompt } from "@/lib/ai-prompts/meeting-prep.prompt";

// ─── Per-user rate limiting (in-memory) ───────────────────────────────────────
// Production: replace with Redis or DB-backed store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Response cache (in-memory, per feature+user) ────────────────────────────
// Prevents hitting the free-tier rate limit on every page navigation.
// Successful responses cached for 30 min; 429 failures cached for 25 s.
const responseCache = new Map<string, { value: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;      // 30 minutes for successful responses
const RATE_LIMIT_BACKOFF_MS = 25 * 1000;  // 25 s backoff after a 429

function getCached(key: string): string | null | undefined {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return undefined;
  }
  return entry.value; // null = cached miss (rate-limited); string = cached hit
}

function setCached(key: string, value: string | null, ttl = CACHE_TTL_MS): void {
  responseCache.set(key, { value, expiresAt: Date.now() + ttl });
}

// ─── Response validation schemas ─────────────────────────────────────────────

const feedbackSummarySchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).min(1).max(5),
  developmentAreas: z.array(z.string()).min(1).max(4),
  promotionReadiness: z.enum(["READY_FOR_PROMOTION", "NEAR_READY", "NEEDS_DEVELOPMENT", "NOT_ELIGIBLE_YET"]),
  promotionNotes: z.string().min(1),
});

const meetingPrepSchema = z.object({
  headline: z.string().min(1),
  priorityActions: z.array(z.string()).min(1).max(5),
  talkingPoints: z.array(z.string()).min(1).max(5),
  watchItems: z.array(z.string()).max(4),
});

export type FeedbackSummaryOutput = z.infer<typeof feedbackSummarySchema>;
export type MeetingPrepOutput = z.infer<typeof meetingPrepSchema>;

// ─── Gemini client ────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });
}

async function callGemini(prompt: string, cacheKey: string): Promise<string | null> {
  // Return cached result (hit or rate-limited backoff) without calling the API
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  const model = getClient();
  if (!model) return null;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    setCached(cacheKey, text, CACHE_TTL_MS);
    return text;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      // Free-tier rate limit - expected, not an error. Backoff for 25 s.
      console.warn("[ai.service] Gemini free-tier rate limit hit - backing off 25 s");
      setCached(cacheKey, null, RATE_LIMIT_BACKOFF_MS);
    } else {
      console.error("[ai.service] Gemini call failed:", (err as Error).message ?? err);
    }
    return null;
  }
}

function parseJSON<T>(text: string, schema: z.ZodType<T>): T | null {
  try {
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(clean);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.error("[ai.service] Response validation failed:", result.error.flatten());
      return null;
    }
    return result.data;
  } catch {
    console.error("[ai.service] JSON parse failed");
    return null;
  }
}

export const aiService = {
  /**
   * Generate a gap analysis narrative for an employee's skill profile.
   * SECURITY: Only skill names/levels/categories are sent - no employee PII.
   */
  generateGapNarrative: async (userId: string, input: GapNarrativeInput): Promise<string | null> => {
    if (!checkRateLimit(userId)) {
      console.warn(`[ai.service] Internal rate limit exceeded for user ${userId}`);
      return null;
    }
    return callGemini(buildGapNarrativePrompt(input), `gap:${userId}`);
  },

  /**
   * Generate a specific learning tip for one skill.
   * SECURITY: Only skill name, level, category, and role are sent.
   */
  generateLearningTip: async (userId: string, input: LearningTipInput): Promise<string | null> => {
    if (!checkRateLimit(userId)) return null;
    return callGemini(buildLearningTipPrompt(input), `tip:${userId}`);
  },

  /**
   * Generate a learning path strategy summary.
   * SECURITY: Only aggregated skill names/gaps and role are sent.
   */
  generateLearningPathSummary: async (userId: string, input: LearningPathSummaryInput): Promise<string | null> => {
    if (!checkRateLimit(userId)) return null;
    return callGemini(buildLearningPathSummaryPrompt(input), `learning:${userId}`);
  },

  /**
   * Synthesise feedback responses into a structured summary.
   * SECURITY: Question text and anonymised responses only - no reviewer/reviewee names.
   */
  generateFeedbackSummary: async (userId: string, input: FeedbackSynthesisInput): Promise<FeedbackSummaryOutput | null> => {
    if (!checkRateLimit(userId)) return null;
    const raw = await callGemini(buildFeedbackSynthesisPrompt(input), `feedback:${userId}`);
    if (!raw) return null;
    return parseJSON(raw, feedbackSummarySchema);
  },

  /**
   * Generate a manager meeting prep briefing.
   * SECURITY: Only aggregated team metrics - no individual employee data.
   */
  generateMeetingBrief: async (userId: string, input: MeetingPrepInput): Promise<MeetingPrepOutput | null> => {
    if (!checkRateLimit(userId)) return null;
    const raw = await callGemini(buildMeetingPrepPrompt(input), `meeting:${userId}`);
    if (!raw) return null;
    return parseJSON(raw, meetingPrepSchema);
  },

  isConfigured: (): boolean => {
    return !!(process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY);
  },
};
