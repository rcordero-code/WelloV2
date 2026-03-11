const ALLOWED_ORIGINS = new Set([
  'https://rcordero-code.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    res.status(500).json({
      error: 'ELEVENLABS_API_KEY is not set on the server.',
      userMessage: 'The ElevenLabs server key is not configured yet.'
    });
    return;
  }

  const text = String(req.body?.text || '').trim();
  const voiceId = String(req.body?.voiceId || DEFAULT_VOICE_ID).trim() || DEFAULT_VOICE_ID;

  if (!text) {
    res.status(400).json({
      error: 'Text is required for speech synthesis.',
      userMessage: 'There is no text available to speak.'
    });
    return;
  }

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey,
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
    const raw = await upstream.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    res.status(upstream.status).json(buildElevenLabsError(upstream.status, payload));
    return;
  }

  const audioBuffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
  res.status(200).send(audioBuffer);
}
