import { Router } from "express";
import { logger } from "../lib/logger";
import { getOpenAI, hasOpenAI, extractJson } from "../lib/openai";

const router = Router();

router.post("/weekly-review", async (req, res) => {
  if (!hasOpenAI) {
    return res.status(503).json({ error: "The weekly review isn't configured on the server yet (missing OpenAI key)." });
  }
  const { subjects, workoutsThisWeek, avgProtein, proteinTarget, bodyTrend, streaks } = req.body as any;

  const prompt = `You are a concise weekly coach across study, fitness, and nutrition. Give a short, motivating but honest review of the user's week.

Subject progress (name, on-pace status, weekly goal hit): ${JSON.stringify(subjects || [])}
Workouts this week: ${JSON.stringify(workoutsThisWeek)}
Avg protein vs target: ${JSON.stringify(avgProtein)} / ${JSON.stringify(proteinTarget)}
Body trend: ${JSON.stringify(bodyTrend || {})}
Streaks: ${JSON.stringify(streaks || {})}

Respond with ONLY a JSON object:
{
  "wins": ["1-3 short wins from this week"],
  "focus": ["1-3 specific things to focus on next week"],
  "summary": "one encouraging sentence"
}`;

  let text: string;
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    text = response.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "weekly-review: OpenAI request failed");
    return res.status(502).json({ error: "The AI service could not be reached. Try again in a moment." });
  }

  const data = extractJson(text);
  if (!data || typeof data !== "object") {
    return res.status(422).json({ error: "Couldn't generate a review right now." });
  }
  return res.json({
    wins: Array.isArray(data.wins) ? data.wins.slice(0, 4).map(String) : [],
    focus: Array.isArray(data.focus) ? data.focus.slice(0, 4).map(String) : [],
    summary: typeof data.summary === "string" ? data.summary : "",
  });
});

export default router;
