target_path = '/Users/rafaelcordero/Downloads/index.html'
html = File.read(target_path)

html.sub!(
  "const CHAT_API_URL   = 'http://localhost:3000/api/chat';",
  "const CHAT_API_URL   = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api/chat' : 'https://YOUR-PROJECT.vercel.app/api/chat';"
)

File.write(target_path, html)
