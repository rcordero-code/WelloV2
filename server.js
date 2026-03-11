import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const ALLOWED_ORIGINS = new Set([
  'https://rcordero-code.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

function sendJson(res, statusCode, payload, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function sendAudio(res, statusCode, audioBuffer, contentType, origin) {
  const headers = {
    'Content-Type': contentType || 'audio/mpeg',
    'Content-Length': String(audioBuffer.byteLength)
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  res.writeHead(statusCode, headers);
  res.end(audioBuffer);
}

function handleCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseJsonSafely(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
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

function buildElevenLabsError(status, payload) {
  const detail = payload?.detail?.message || payload?.detail?.status || payload?.raw || 'ElevenLabs request failed.';
  let userMessage = 'Voice playback is unavailable right now.';

  if (status === 401) {
    userMessage = 'The ElevenLabs server key is missing, invalid, or revoked.';
  } else if (status === 429) {
    userMessage = 'ElevenLabs is rate-limiting requests right now. Falling back to browser speech may help.';
  } else if (status >= 500) {
    userMessage = 'ElevenLabs is having a temporary server issue. Falling back to browser speech.';
  }

  return {
    error: detail,
    userMessage,
    provider: 'elevenlabs',
    providerStatus: status,
    details: payload
  };
}

async function readRequestBody(req, origin, res) {
  let rawBody = '';
  for await (const chunk of req) {
    rawBody += chunk;
  }

  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    sendJson(res, 400, { error: 'Request body must be valid JSON.' }, origin);
    return null;
  }
}

async function handleChat(req, res) {
  const origin = req.headers.origin;

  if (!OPENAI_API_KEY) {
    sendJson(
      res,
      500,
      {
        error: 'OPENAI_API_KEY is not set on the server.',
        userMessage: 'The OpenAI server key is not configured yet.'
      },
      origin
    );
    return;
  }

  const parsedBody = await readRequestBody(req, origin, res);
  if (!parsedBody) return;

  const question = String(parsedBody.question || '').trim();
  const schoolContext = String(parsedBody.schoolContext || '').trim();

  if (!question) {
    sendJson(res, 400, { error: 'Question is required.', userMessage: 'Please enter a message first.' }, origin);
    return;
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
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

  const upstreamText = await upstream.text();
  const upstreamJson = parseJsonSafely(upstreamText);

  if (!upstream.ok) {
    sendJson(res, upstream.status, buildOpenAiError(upstream.status, upstreamJson), origin);
    return;
  }

  const answer = upstreamJson.choices?.[0]?.message?.content?.trim();
  sendJson(res, 200, { answer: answer || '' }, origin);
}

async function handleTts(req, res) {
  const origin = req.headers.origin;

  if (!ELEVENLABS_API_KEY) {
    sendJson(
      res,
      500,
      {
        error: 'ELEVENLABS_API_KEY is not set on the server.',
        userMessage: 'The ElevenLabs server key is not configured yet.'
      },
      origin
    );
    return;
  }

  const parsedBody = await readRequestBody(req, origin, res);
  if (!parsedBody) return;

  const text = String(parsedBody.text || '').trim();
  const voiceId = String(parsedBody.voiceId || DEFAULT_VOICE_ID).trim() || DEFAULT_VOICE_ID;

  if (!text) {
    sendJson(
      res,
      400,
      {
        error: 'Text is required for speech synthesis.',
        userMessage: 'There is no text available to speak.'
      },
      origin
    );
    return;
  }

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.85,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  });

  if (!upstream.ok) {
    const upstreamText = await upstream.text();
    const upstreamJson = parseJsonSafely(upstreamText);
    sendJson(res, upstream.status, buildElevenLabsError(upstream.status, upstreamJson), origin);
    return;
  }

  const audioBuffer = Buffer.from(await upstream.arrayBuffer());
  sendAudio(res, 200, audioBuffer, upstream.headers.get('content-type') || 'audio/mpeg', origin);
}

const server = http.createServer(async (req, res) => {
  handleCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(
      res,
      200,
      {
        ok: true,
        service: 'wello-api',
        openaiConfigured: Boolean(OPENAI_API_KEY),
        elevenLabsConfigured: Boolean(ELEVENLABS_API_KEY)
      },
      req.headers.origin
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    await handleChat(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tts') {
    await handleTts(req, res);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' }, req.headers.origin);
    return;
  }
  sendJson(res, 404, { error: 'Not found' }, req.headers.origin);
});

server.listen(PORT, () => {
  console.log(`Wello backend listening on http://localhost:${PORT}`);
});
