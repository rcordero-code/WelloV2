const ALLOWED_ORIGINS = new Set([
  'https://rcordero-code.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function buildOpenAiError(status, payload) {
  const detail = payload?.error?.message || payload?.raw || 'OpenAI request failed.';
  let userMessage = 'The assistant could not respond right now. Please try again.';

  if (status === 401) {
    userMessage = 'The OpenAI server key is missing, invalid, or revoked.';
  } else if (status === 429) {
    userMessage = 'OpenAI is rate-limiting requests right now. Please wait a moment and try again.';
  } else if (status >= 500) {
    userMessage = 'OpenAI is having a temporary server issue. Please try again shortly.';
  } else if (status === 400) {
    userMessage = 'The request sent to OpenAI was rejected. Check the model and payload.';
  }

  return {
    error: detail,
    userMessage,
    provider: 'openai',
    providerStatus: status,
    details: payload
  };
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    res.status(500).json({
      error: 'OPENAI_API_KEY is not set on the server.',
      userMessage: 'The OpenAI server key is not configured yet.'
    });
    return;
  }

  const question = String(req.body?.question || '').trim();
  const schoolContext = String(req.body?.schoolContext || '').trim();

  if (!question) {
    res.status(400).json({
      error: 'Question is required.',
      userMessage: 'Please enter a message first.'
    });
    return;
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: schoolContext },
        { role: 'user', content: question }
      ]
    })
  });

  const payload = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    res.status(upstream.status).json(buildOpenAiError(upstream.status, payload));
    return;
  }

  const answer = payload.choices?.[0]?.message?.content?.trim() || '';
  res.status(200).json({ answer });
}
