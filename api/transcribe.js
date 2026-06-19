require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Transcribes a short audio clip spoken in Moroccan Darija using Gemini.
// The browser Web Speech API has no real Darija support, so we send the
// recorded audio to Gemini (which understands Darija well) and get back
// a clean Arabic-script transcription.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const { audio, mimeType } = req.body || {};
    if (!audio) return res.status(400).json({ error: 'No audio provided.' });

    const prompt =
      'Transcribe this audio exactly as spoken. The speaker talks in Moroccan ' +
      'Arabic (Darija), sometimes mixed with French words. Write the transcription ' +
      'in ARABIC SCRIPT (Darija). Output ONLY the transcription — no translation, ' +
      'no quotes, no explanations. If the audio is silent or unclear, output nothing.';

    // gemini-1.5-flash reliably accepts inline audio. If your project uses a
    // different model, change the name below.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'audio/webm', data: audio } },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};