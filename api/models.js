// Temporary diagnostic endpoint. Visit /api/models in the browser to see
// which Gemini models THIS API key is allowed to use. Safe to delete later.
module.exports = async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, status: r.status, gemini: data });
    }
    const models = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));
    res.status(200).json({ ok: true, count: models.length, models });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
