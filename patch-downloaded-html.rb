target_path = '/Users/rafaelcordero/Downloads/index.html'
html = File.read(target_path)

html.sub!(
  /const OPENAI_KEY\s*=\s*'[^']*';/,
  "const CHAT_API_URL   = 'http://localhost:3000/api/chat';"
)

html.sub!(
  <<~OLD.chomp,
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            messages: [
              { role: 'system', content: SCHOOL_CONTEXT },
              { role: 'user',   content: question }
            ]
          })
        });
  OLD
  <<~NEW.chomp
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
  NEW
)

html.sub!(
  <<~OLD.chomp,
    const data   = await res.json();
        const answer = data.choices?.[0]?.message?.content || "I'm not sure — please visit www.rivieraridge.org for more info!";
  OLD
  <<~NEW.chomp
    const data   = await res.json();
        const answer = data.answer || "I'm not sure — please visit www.rivieraridge.org for more info!";
  NEW
)

File.write(target_path, html)
