html_path = '/Users/rafaelcordero/Downloads/index.html'
config_path = '/Users/rafaelcordero/Downloads/wello.config.js'

html = File.read(html_path)

html.sub!(
  "<div class=\"toast\" id=\"toast\"></div>\n\n<script>",
  "<div class=\"toast\" id=\"toast\"></div>\n\n<script src=\"./wello.config.js\"></script>\n<script>"
)

old_block = <<~OLD
  function resolveApiBaseUrl() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
    return 'https://YOUR-PROJECT.vercel.app';
  }

  const APP_CONFIG = {
    apiBaseUrl: resolveApiBaseUrl(),
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL'
  };
OLD

new_block = <<~NEW
  const DEFAULT_CONFIG = {
    apiBaseUrl: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : 'https://YOUR-PROJECT.vercel.app',
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL'
  };

  const APP_CONFIG = {
    ...DEFAULT_CONFIG,
    ...(window.WELLO_CONFIG || {})
  };
NEW

html.sub!(old_block, new_block)

config_contents = <<~JS
  window.WELLO_CONFIG = {
    apiBaseUrl: 'https://YOUR-PROJECT.vercel.app',
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL'
  };
JS

File.write(html_path, html)
File.write(config_path, config_contents)
