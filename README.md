# Wello backend

This backend keeps the OpenAI and ElevenLabs API keys off the frontend.

## Local Node server

1. Export the variable:
   `export OPENAI_API_KEY=your_new_key`
2. Export the ElevenLabs variable:
   `export ELEVENLABS_API_KEY=your_elevenlabs_key`
3. Optional voice override:
   `export ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL`
4. Start the server:
   `npm start`

The local APIs run at:

- `http://localhost:3000/api/chat`
- `http://localhost:3000/api/tts`

## Vercel deployment

1. Create a new Vercel project from this folder.
2. Add environment variables in the Vercel project settings:
   `OPENAI_API_KEY`
   `ELEVENLABS_API_KEY`
   Optional: `ELEVENLABS_VOICE_ID`
3. Deploy.
4. Your chat endpoint will be:
   `https://YOUR-PROJECT.vercel.app/api/chat`

## Frontend

Point the frontend API base URL to one of these:

- Local testing: `http://localhost:3000`
- Vercel: `https://YOUR-PROJECT.vercel.app`
