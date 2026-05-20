import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

router.post("/scan-food", async (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image) {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this image of food, a nutrition label, or a recipe. Extract the macro-nutritional values. 
Return ONLY a valid JSON object with these exact keys (numbers only, no units):
{
  "name": "short descriptive name of the food",
  "protein": <grams as number>,
  "carbs": <grams as number>,
  "fat": <grams as number>,
  "calories": <number>,
  "source": "AI scan"
}
If you cannot determine a value, use 0. Do not include any other text outside the JSON.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: "Could not parse nutrition data from image" });
    }
    const data = JSON.parse(jsonMatch[0]);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Scan failed" });
  }
});

export default router;
