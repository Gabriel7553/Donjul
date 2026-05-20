import OpenAI from "openai";
import { logger } from "./logger";

const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

export const hasOpenAI = Boolean(OPENAI_API_KEY);

if (!hasOpenAI) {
  logger.warn(
    "AI_INTEGRATIONS_OPENAI_API_KEY is not set — AI routes (scan, coach, parse) will return 503 until the OpenAI integration is configured.",
  );
}

// Construct lazily so a missing key returns a clean 503 instead of crashing at startup.
let client: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY });
  }
  return client;
}

// Parse a JSON object out of a model response that may include stray prose.
export function extractJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
