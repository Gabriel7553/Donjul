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

Respond with ONLY a JSON object, no prose, exactly these keys:
{
  "name": "short summary of the food",
  "protein": <grams, number>,
  "carbs": <grams, number>,
  "fat": <grams, number>,
  "calories": <number>,
  "fiber": <grams>,
  "sugar": <grams>,
  "saturatedFat": <grams>,
  "cholesterol": <milligrams>,
  "sodium": <milligrams>,
  "potassium": <milligrams>,
  "calcium": <milligrams>,
  "iron": <milligrams>,
  "magnesium": <milligrams>,
  "zinc": <milligrams>,
  "vitaminA": <micrograms RAE>,
  "vitaminC": <milligrams>,
  "vitaminD": <micrograms>,
  "vitaminB12": <micrograms>
}
Use realistic best-effort estimates for every key. Use 0 when truly negligible. Numbers only — no units in values. Keep calories consistent with the macros (~4 kcal per gram of protein and carbs, ~9 per gram of fat); a normal meal is a few hundred to ~1500 calories.`;

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

  // Clamp to non-negative, sane bounds — the model occasionally returns absurd values.
  const num = (v: any, max: number) => Math.max(0, Math.min(max, Math.round((Number(v) || 0) * 10) / 10));
  const protein = num(data.protein, 600);
  const carbs = num(data.carbs, 1500);
  const fat = num(data.fat, 600);
  // The model sometimes hallucinates the calorie figure (e.g. 11000 for a bowl of
  // cereal). The macro-derived Atwater estimate is far more reliable — fall back to it
  // when the two disagree badly.
  const macroCal = protein * 4 + carbs * 4 + fat * 9;
  let calories = num(data.calories, 20000);
  if (macroCal > 0 && (calories > macroCal * 1.5 || calories < macroCal * 0.5)) calories = Math.round(macroCal);
  else if (macroCal === 0) calories = Math.min(calories, 5000);

  const micros = {
    fiber: num(data.fiber, 500),
    sugar: num(data.sugar, 1000),
    saturatedFat: num(data.saturatedFat, 500),
    cholesterol: num(data.cholesterol, 50000),
    sodium: num(data.sodium, 100000),
    potassium: num(data.potassium, 100000),
    calcium: num(data.calcium, 50000),
    iron: num(data.iron, 5000),
    magnesium: num(data.magnesium, 10000),
    zinc: num(data.zinc, 5000),
    vitaminA: num(data.vitaminA, 100000),
    vitaminC: num(data.vitaminC, 50000),
    vitaminD: num(data.vitaminD, 10000),
    vitaminB12: num(data.vitaminB12, 5000),
  };

  return res.json({
    name: typeof data.name === "string" ? data.name : input.slice(0, 40),
    protein, carbs, fat, calories,
    ...micros,
    source: "Typed",
  });
});

export default router;
