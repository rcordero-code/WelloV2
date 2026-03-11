target_path = '/Users/rafaelcordero/Downloads/index.html'
html = File.read(target_path)

old_constants = <<~OLD
  <script>
  const CHAT_API_URL   = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api/chat' : 'https://YOUR-PROJECT.vercel.app/api/chat';
  const ELEVENLABS_KEY  = 'PASTE_YOUR_ELEVENLABS_KEY_HERE';
  const ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah — warm & clear
OLD

new_constants = <<~NEW
  <script>
  function resolveApiBaseUrl() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
    return 'https://YOUR-PROJECT.vercel.app';
  }

  const APP_CONFIG = {
    apiBaseUrl: resolveApiBaseUrl(),
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL'
  };

  const API_ENDPOINTS = {
    chat: `${APP_CONFIG.apiBaseUrl}/api/chat`,
    tts: `${APP_CONFIG.apiBaseUrl}/api/tts`
  };
NEW

old_helpers = <<~OLD
  let mouthInterval = null;
  let recognition    = null;
  let isRecording    = false;
  let currentAudio   = null;
OLD

new_helpers = <<~NEW
  let mouthInterval = null;
  let recognition    = null;
  let isRecording    = false;
  let currentAudio   = null;

  function getApiErrorMessage(status, payload, fallback) {
    if (payload?.userMessage) return payload.userMessage;
    if (payload?.error) return `${fallback} (${status}): ${String(payload.error).slice(0, 120)}`;
    return fallback;
  }
NEW

old_tts = <<~OLD
  async function speakWithElevenLabs(text) {
    const clean = text.replace(/[\\u{1F000}-\\u{1FFFF}]/gu, '').trim();
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_KEY
        },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true }
        })
      });

      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      currentAudio = new Audio(url);
      currentAudio.onplay  = () => startSpeaking();
      currentAudio.onended = () => { stopSpeaking(); URL.revokeObjectURL(url); };
      currentAudio.onerror = () => { stopSpeaking(); fallbackSpeak(clean); };
      await currentAudio.play();

    } catch (err) {
      console.warn('ElevenLabs error:', err);
      fallbackSpeak(clean);
    }
  }
OLD

new_tts = <<~NEW
  async function speakWithElevenLabs(text) {
    const clean = text.replace(/[\\u{1F000}-\\u{1FFFF}]/gu, '').trim();
    try {
      const res = await fetch(API_ENDPOINTS.tts, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: clean,
          voiceId: APP_CONFIG.elevenLabsVoiceId
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = getApiErrorMessage(res.status, errData, 'Voice playback failed');
        throw new Error(message);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      currentAudio = new Audio(url);
      currentAudio.onplay  = () => startSpeaking();
      currentAudio.onended = () => { stopSpeaking(); URL.revokeObjectURL(url); };
      currentAudio.onerror = () => { stopSpeaking(); fallbackSpeak(clean); };
      await currentAudio.play();

    } catch (err) {
      console.warn('TTS error:', err);
      showToast(String(err.message || 'Voice playback failed').slice(0, 120), 5000);
      fallbackSpeak(clean);
    }
  }
NEW

old_chat = <<~OLD
  async function sendMessage(text) {
    const input    = document.getElementById('userInput');
    const question = text || input.value.trim();
    if (!question) return;

    input.value = '';
    document.getElementById('chipsContainer').style.display = 'none';

    const bubble = document.getElementById('chatBubble');
    bubble.innerHTML = '<div class="dot-loader"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    setStatus('thinking', 'Thinking…');

    try {
      const res = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          schoolContext: SCHOOL_CONTEXT
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg  = errData.error?.message || '';
        const status  = res.status;
        console.error('OpenAI error response:', status, errData);
        showToast(`⚠️ ${status}: ${errMsg.slice(0,80)}`, 7000);
        throw new Error(`${status}: ${errMsg}`);
      }

      const data   = await res.json();
      const answer = data.answer || "I'm not sure — please visit www.rivieraridge.org for more info!";

      bubble.textContent = answer;
      await speakWithElevenLabs(answer);

    } catch (err) {
      console.error('sendMessage error:', err);
      bubble.textContent = "Oops! Something went wrong. Please check your connection and try again.";
      stopSpeaking();
    }
  }
OLD

new_chat = <<~NEW
  async function sendMessage(text) {
    const input    = document.getElementById('userInput');
    const question = text || input.value.trim();
    if (!question) return;

    input.value = '';
    document.getElementById('chipsContainer').style.display = 'none';

    const bubble = document.getElementById('chatBubble');
    bubble.innerHTML = '<div class="dot-loader"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    setStatus('thinking', 'Thinking…');

    try {
      const res = await fetch(API_ENDPOINTS.chat, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          schoolContext: SCHOOL_CONTEXT
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = getApiErrorMessage(res.status, errData, 'The assistant could not respond');
        console.error('Chat error response:', res.status, errData);
        showToast(message.slice(0, 120), 7000);
        throw new Error(message);
      }

      const data   = await res.json();
      const answer = data.answer || "I'm not sure — please visit www.rivieraridge.org for more info!";

      bubble.textContent = answer;
      await speakWithElevenLabs(answer);

    } catch (err) {
      console.error('sendMessage error:', err);
      bubble.textContent = String(err.message || "Oops! Something went wrong. Please try again.");
      stopSpeaking();
    }
  }
NEW

html.sub!(old_constants, new_constants)
html.sub!(old_helpers, new_helpers)
html.sub!(old_tts, new_tts)
html.sub!(old_chat, new_chat)

File.write(target_path, html)
