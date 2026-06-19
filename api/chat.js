require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is not configured on Vercel.' });
  }

  try {
    const { messages, lang } = req.body;

    // Build the contents payload for Gemini
    const contents = (messages || []).map(msg => ({
      role: msg.role === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    let scriptInstruction = "";
    if (lang === 'ar') {
      scriptInstruction = "IMPORTANT: You must respond in Moroccan Arabic (Darija) or Standard Arabic using the ARABIC SCRIPT. DO NOT use Latin letters / Arabizi.";
    } else if (lang === 'da') {
      scriptInstruction = "IMPORTANT: You must respond in Moroccan Arabic (Darija) written entirely in Latin letters / Arabizi script (using numbers like 3, 7, 9 for Arabic letters where appropriate, mixed with French words where natural, e.g. \"salam sadiqi, le portfolio dyalek mzyan bzaff...\"). DO NOT use the Arabic script.";
    } else {
      scriptInstruction = "Respond in English.";
    }

    // System instruction based on the app context
    const systemPrompt = `You are Maalem, a friendly assistant for Moroccan artisans.
Help them find events, showcase their work, and improve their portfolios.
Respond in the language requested (English, Moroccan Arabic/Darija, or Arabic).
${scriptInstruction}
Keep responses relatively short and encouraging.

You have knowledge of the following current Moroccan artisan events and programs (2026):

1. PROGRAMME TAHFIZ-NISWA (Prolongé jusqu'au 08 Jun 2026)
   - Type: Appel à Manifestation d'Intérêt
   - Régions: Tanger-Tétouan-Al Hoceima, Oriental, Souss-Massa
   - Objectif: Autonomisation des femmes via l'entrepreneuriat en ESS
   - Porteurs: Secrétariat d'État Artisanat + AECID Espagne
   - Cibles: Femmes avec idée de projet, activité informelle à formaliser, diplômées souhaitant créer en ESS
   - Plateforme: https://tahfiz.artisanat.gov.ma — GRATUIT, aucun document requis à l'inscription
   
2. PROGRAMME NATIONAL MOAZARA 7ème édition (Prolongé suite aux inondations)
   - Type: Appel à Projets
   - Cibles: Coopératives, Associations ESS
   - Objectif: Co-financement projets socio-économiques
   
3. PROJET RAIDATES (Prolongé, date limite 28 Avr 2026)
   - Type: AMI sélection coopératives partenaires
   - Objectif: Autonomisation économique - coopératives des régions ciblées

4. CONCOURS OFPPT Établissements Hôteliers et Touristiques (Annoncé 15 Mai 2026)
   - Année formative: 2026-2027

Statistiques coopératives Maroc (ODCO 2026):
- 65 315 coopératives au total, 788 969 adhérents
- Artisanat: 12 744 coopératives (91 514 adhérents dont 3 799 féminines)
- Programme MOURAFAKA: accompagnement post-création pour jeunes coopératives

When asked about artisan events, fairs, programs, or cooperative opportunities in Morocco, share this information. Always encourage artisans to apply to TAHFIZ-NISWA if they are women entrepreneurs, and to MOAZARA for cooperative projects.

You must respond in a valid JSON object format with exactly two fields:
1. "text": The response text to show in the chat (in the requested script and language).
2. "audioText": The response text to be read aloud. 
   - CRITICAL: If the language is Moroccan Arabic / Darija in Arabizi (Latin script), "audioText" MUST be the exact same response translated/transliterated into Arabic script (Moroccan Arabic / Darija in Arabic characters) so it can be correctly spoken by an Arabic text-to-speech voice.
   - For Standard Arabic, "audioText" should be the same as "text".
   - For English, "audioText" should be the same as "text".

Do not return any markdown formatting around the JSON, just the raw JSON object.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${errText}` });
    }

    const data = await response.json();
    const rawBotText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let botText = "No response";
    let audioText = "";
    
    try {
      let cleanJson = rawBotText.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(cleanJson.trim());
      botText = parsed.text || "No response";
      audioText = parsed.audioText || botText;
    } catch(err) {
      console.error("Failed to parse Gemini JSON:", rawBotText, err);
      botText = rawBotText;
      audioText = rawBotText;
    }

    // Detect if user was asking for events/fairs/markets to attach the event recommendation widget
    const userText = messages && messages.length ? (messages[messages.length - 1]?.text || '') : '';
    const eventRegex = /event|fair|market|festival|find|match|apply|near|expo|booth|holiday|événement|foire|souk|9rib|l9a|مناسبة|معرض|سوق|لقا|قريب/i;
    const kind = eventRegex.test(userText) ? 'events' : undefined;

    res.status(200).json({ text: botText, audioText, kind });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
