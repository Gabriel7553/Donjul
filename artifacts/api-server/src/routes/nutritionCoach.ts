import { Router } from "express";
import { logger } from "../lib/logger";
import { getOpenAI, hasOpenAI, extractJson } from "../lib/openai";

const router = Router();

router.post("/nutrition-coach", async (req, res) => {
  if (!hasOpenAI) {
    return res.status(503).json({ error: "The nutrition coach isn't configured on the server yet (missing OpenAI key)." });
  }

  const { today, targets, remaining, weekAvg, bodyGoal, latestBody } = req.body as any;

  const prompt = `You are a concise, practical nutrition coach. Use the user's data to give specific, actionable guidance for the rest of TODAY. Be direct and encouraging, not preachy.

Today so far (grams / kcal): ${JSON.stringify(today || {})}
Daily targets: ${JSON.stringify(targets || {})}
Remaining to hit targets today: ${JSON.stringify(remaining || {})}
7-day averages: ${JSON.stringify(weekAvg || {})}
Body goal (direction/targets): ${JSON.stringify(bodyGoal || {})}
Latest body stats: ${JSON.stringify(latestBody || {})}

Respond with ONLY a JSON object, no prose, with these keys:
{
  "analysis": ["2-4 short bullet strings: where they're lacking / doing well, tied to their body goal"],
  "stop": ["1-3 foods/habits to cut back on"],
  "start": ["1-3 foods/habits to add"],
  "snack": { "name": "specific snack to hit remaining macros", "protein": <g>, "carbs": <g>, "fat": <g>, "calories": <n>, "why": "one short line" },
  "meal":  { "name": "specific meal to finish the day's targets", "protein": <g>, "carbs": <g>, "fat": <g>, "calories": <n>, "why": "one short line" }
}
Make snack and meal realistic and roughly fill the remaining macros. Numbers only for macro values.`;

  let text: string;
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    text = response.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "nutrition-coach: OpenAI request failed");
    return res.status(502).json({ error: "The AI service could not be reached. Try again in a moment." });
  }

  const data = extractJson(text);
  if (!data || typeof data !== "object") {
    logger.warn({ text: text.slice(0, 300) }, "nutrition-coach: could not parse AI response");
    return res.status(422).json({ error: "Couldn't generate advice right now. Try again in a moment." });
  }

  const macro = (m: any) => ({
    name: typeof m?.name === "string" ? m.name : "",
    protein: Number(m?.protein) || 0,
    carbs: Number(m?.carbs) || 0,
    fat: Number(m?.fat) || 0,
    calories: Number(m?.calories) || 0,
    why: typeof m?.why === "string" ? m.why : "",
  });

  return res.json({
    analysis: Array.isArray(data.analysis) ? data.analysis.slice(0, 5).map(String) : [],
    stop: Array.isArray(data.stop) ? data.stop.slice(0, 5).map(String) : [],
    start: Array.isArray(data.start) ? data.start.slice(0, 5).map(String) : [],
    snack: macro(data.snack),
    meal: macro(data.meal),
  });
});

export default router;
