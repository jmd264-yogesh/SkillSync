import { GoogleGenerativeAI } from "@google/generative-ai";

// Server-only — never import in client components
export const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? "");

export const MODELS = {
  // Complex reasoning: match rationale, copilot, forecasts
  primary: "gemini-3.1-flash-lite" as const,
  // Fast/cheap: confidence, simple classification
  fast: "gemini-3.1-flash-lite" as const,
} as const;

export const DEFAULT_TEMPERATURE = 0.2;
export const AI_TIMEOUT_MS = 8000;
