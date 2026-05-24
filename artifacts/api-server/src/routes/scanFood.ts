import { Router } from "express";
import { logger } from "../lib/logger";
import { getOpenAI, hasOpenAI, extractJson } from "../lib/openai";

const router = Router();

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
  "vitaminB12": <micrograms>,
  "source": "AI scan"
}
Use your best estimate for any value you cannot read exactly; never leave a key out. Numbers only — no units in values. Use 0 when truly negligible.`;

router.post("/scan-food", async (req, res) => {
  const { image, mime } = req.body as { image?: string; mime?: string };
  if (!image) {
    return res.status(400).json({ error: "No image provided." });
  }
  if (!hasOpenAI) {
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

  // Clamp to non-negative, sane bounds; reconcile calories with the macro (Atwater) math
  // so a misread label can't report an absurd figure.
  const num = (v: any, max: number) => Math.max(0, Math.min(max, Math.round((Number(v) || 0) * 10) / 10));
  const protein = num(data.protein, 600);
  const carbs = num(data.carbs, 1500);
  const fat = num(data.fat, 600);
  const macroCal = protein * 4 + carbs * 4 + fat * 9;
  let calories = num(data.calories, 20000);
  if (macroCal > 0 && (calories > macroCal * 1.5 || calories < macroCal * 0.5)) calories = Math.round(macroCal);
  else if (macroCal === 0) calories = Math.min(calories, 5000);

  return res.json({
    name: typeof data.name === "string" ? data.name : "",
    serving: typeof data.serving === "string" ? data.serving : "",
    protein, carbs, fat, calories,
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
    source: "AI scan",
  });
});

export default router;
