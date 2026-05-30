// netlify/functions/chat.js
// Proxy sicuro per chiamare l'API di Claude senza esporre la API key nel browser.
// Richiede la variabile d'ambiente ANTHROPIC_API_KEY configurata su Netlify.

exports.handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Bad Request' };
  }

  const { message, contesto } = body;
  if (!message) {
    return { statusCode: 400, body: 'Messaggio mancante' };
  }

  // Costruisci il system prompt con il contesto del laboratorio
  const systemPrompt = `Sei l'assistente AI integrato nel gestionale di un laboratorio artigianale di marmi e pietre naturali in Sardegna.

LABORATORIO:
- Lavorazioni: granito, marmo, pietre naturali
- Team: Titolare + Carlo (operaio)
- Volume: ~10 preventivi al mese
- Clienti: privati, imprese edili, geometri, architetti

FLUSSO DI LAVORO (8 fasi):
1. Richiesta → 2. Sopralluogo → 3. Preventivo → 4. Trattativa → 5. Conferma/Accordo → 6. Ordine materiale → 7. Lavorazione → 8. Consegna e fattura

CONTESTO ATTUALE DEL DATABASE:
${contesto || 'Nessun dato disponibile al momento.'}

ISTRUZIONI:
- Rispondi in italiano, in modo pratico e diretto
- Usa linguaggio del settore (commessa, lastra, sagoma, m², ml, scarto, sopralluogo, ecc.)
- Per domande sui prezzi, usa i valori del listino se disponibili nel contesto
- Per calcoli di preventivo: materiale (€/m² × area × scarto%), bordi (€/ml), forature (€/cad), manodopera (% sul materiale)
- Quando suggerisci azioni nel gestionale, indica la sezione esatta (es. "vai alla scheda Magazzino")
- Sii conciso: max 5-6 righe per risposta salvo calcoli dettagliati
- Non inventare dati che non hai nel contesto — di' "non ho questo dato"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Errore API: ' + response.status }),
      };
    }

    const data = await response.json();
    const testo = data.content?.[0]?.text || 'Risposta non disponibile.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risposta: testo }),
    };
  } catch (err) {
    console.error('Fetch error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Errore interno: ' + err.message }),
    };
  }
};
