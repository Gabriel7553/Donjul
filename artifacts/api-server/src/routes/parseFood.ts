import { Router } from "express";
import { logger } from "../lib/logger";
import { getOpenAI, hasOpenAI, extractJson } from "../lib/openai";

const router = Router();

router.post("/parse-food", async (req, res) => {
  if (!hasOpenAI) {
    return res.status(503).json({ error: "Food parsing isn't configured on the server yet (missing OpenAI key)." });
  }
  const { text: input } = req.body as { text?: string };
  if (!input || !input.trim()) {
    return res.status(400).json({ error: "No food description provided." });
  }

  const prompt = `Estimate the total nutrition for this food description. Sum everything described into one total.

Description: "${input.replace(/"/g, "'")}"

Respond with ONLY a JSON object, no prose:
{
  "name": "short summary of the food",
  "protein": <grams, number>,
  "carbs": <grams, number>,
  "fat": <grams, number>,
  "calories": <number>
}
Use realistic estimates. Numbers only for macro values.`;

  let out: string;
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    out = response.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "parse-food: OpenAI request failed");
    return res.status(502).json({ error: "The AI service could not be reached. Try again in a moment." });
  }

  const data = extractJson(out);
  if (!data || typeof data !== "object") {
    logger.warn({ text: out.slice(0, 300) }, "parse-food: could not parse AI response");
    return res.status(422).json({ error: "Couldn't read that. Try rephrasing, e.g. '2 eggs and a slice of toast'." });
  }

  return res.json({
    name: typeof data.name === "string" ? data.name : input.slice(0, 40),
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fat: Number(data.fat) || 0,
    calories: Number(data.calories) || 0,
    source: "Typed",
  });
});

export default router;
