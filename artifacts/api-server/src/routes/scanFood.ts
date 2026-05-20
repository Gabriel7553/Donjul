import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  logger.warn(
    "AI_INTEGRATIONS_OPENAI_API_KEY is not set — /api/scan-food will fail until the OpenAI integration is configured.",
  );
}

// Construct lazily so a missing key returns a clean 503 instead of crashing the server at startup.
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
}

const PROMPT = `You are a nutrition label and food reader. Look at this image — it may be a packaged nutrition label, a recipe/cookbook page, or a plate of food.

Read the macro-nutrition for ONE serving:
- If it is a nutrition label, use the "Amount per serving" column and report the serving size shown.
- If it is a recipe, estimate per single serving.
- If it is a plate of food, estimate the portion shown.

Respond with ONLY a JSON object (no markdown, no prose), exactly these keys:
{
  "name": "short food name",
  "serving": "serving size as written, e.g. '1 cup (240ml)' or 'estimated 1 plate'",
  "protein": <grams, number>,
  "carbs": <grams, number>,
  "fat": <grams, number>,
  "calories": <number>,
  "source": "AI scan"
}
Use your best estimate for any value you cannot read exactly; never leave a key out.`;

function extractJson(text: string): any | null {
  // Try direct parse first, then the first balanced {...} block.
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

router.post("/scan-food", async (req, res) => {
  const { image, mime } = req.body as { image?: string; mime?: string };
  if (!image) {
    return res.status(400).json({ error: "No image provided." });
  }
  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      error: "Image scanning isn't configured on the server yet (missing OpenAI key).",
    });
  }

  const dataUrl = `data:${mime || "image/jpeg"};base64,${image}`;

  let text: string;
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    });
    text = response.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "scan-food: OpenAI request failed");
    return res
      .status(502)
      .json({ error: "The AI service could not be reached. Try again in a moment." });
  }

  const data = extractJson(text);
  if (!data || typeof data !== "object") {
    logger.warn({ text: text.slice(0, 300) }, "scan-food: could not parse AI response");
    return res.status(422).json({
      error: "Couldn't read the macros from that image. Try a clearer, closer photo of the label.",
    });
  }

  return res.json({
    name: typeof data.name === "string" ? data.name : "",
    serving: typeof data.serving === "string" ? data.serving : "",
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fat: Number(data.fat) || 0,
    calories: Number(data.calories) || 0,
    source: "AI scan",
  });
});

export default router;
