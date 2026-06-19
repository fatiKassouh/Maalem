require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Text-to-speech for the chatbot replies. Sends the reply text to Gemini's
// TTS models and returns raw PCM audio (base64, 16-bit mono) plus its sample
// rate. The browser wraps it into a playable WAV. If no TTS model is available
// for this API key, the front-end falls back to the browser voice.
const TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
  }

  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'No text provided.' });

    let lastErr = '';
    for (const model of TTS_MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
            },
          }),
        }
      );

      if (!r.ok) {
        lastErr = await r.text();
        continue; // try the next model
      }

      const data = await r.json();
      const part = (data.candidates?.[0]?.content?.parts || []).find(
        (p) => p.inlineData
      );
      const audio = part?.inlineData?.data;
      if (!audio) {
        lastErr = 'Model returned no audio.';
        continue;
      }
      const mime = part.inlineData.mimeType || 'audio/L16;rate=24000';
      const rate = parseInt((mime.match(/rate=(\d+)/) || [])[1] || '24000', 10);
      return res.status(200).json({ audio, rate });
    }

    return res.status(502).json({ error: `No TTS model available: ${lastErr}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
