import OpenAI from "openai";
import { logger } from "./logger";

const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const OPENAI_API_KEY =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

export const hasOpenAI = Boolean(OPENAI_API_KEY);

if (!hasOpenAI) {
  logger.warn(
    "No OpenAI API key found — AI routes (scan, coach, parse) will return 503. Set OPENAI_API_KEY in secrets.",
  );
}

// Construct lazily so a missing key returns a clean 503 instead of crashing at startup.
let client: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
      apiKey: OPENAI_API_KEY,
    });
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
