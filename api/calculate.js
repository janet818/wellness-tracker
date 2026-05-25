export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Missing description' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: `You are a nutrition expert. When given a meal description, return ONLY a JSON object (no markdown, no backticks) with this shape:
{
  "items": [{ "name": "item name", "amount": "quantity", "calories": number }],
  "total": number,
  "protein": number,
  "carbs": number,
  "fat": number
}
Be precise and realistic with calorie estimates.`,
        messages: [{ role: 'user', content: `Calculate calories for: ${description}` }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const text = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(result);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'API call failed' });
  }
}
