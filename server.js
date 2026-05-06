const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ── MIME TYPES ────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

// ── GEMINI PROXY ──────────────────────────────────────────────────
function callGemini(promptText, maxTokens) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { resolve({ error: 'GEMINI_API_KEY not set' }); return; }

    // Try models in order
    const models = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-pro',
    ];

    function tryModel(idx) {
      if (idx >= models.length) { resolve({ error: 'No working model found' }); return; }
      const model = models[idx];
      const body = JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: maxTokens || 1500, temperature: 0.3 }
      });
      const buf = Buffer.from(body, 'utf8');
      const opts = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
      };
      const req = https.request(opts, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          if (res.statusCode === 404 || res.statusCode === 400) {
            console.log(`Model ${model} not available, trying next...`);
            tryModel(idx + 1);
          } else {
            resolve({ status: res.statusCode, body: text, model });
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(buf);
      req.end();
    }
    tryModel(0);
  });
}

// ── HTTP SERVER ───────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // ── API PROXY ─────────────────────────────────────────────────
  if (req.url === '/api/ai' || req.url === '/.netlify/functions/claude') {
    if (req.method === 'GET') {
      // List available models
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set' }));
        return;
      }
      const opts = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models?key=${apiKey}`,
        method: 'GET'
      };
      https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, (r) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            const names = (data.models || [])
              .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
              .map(m => m.name);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ available_models: names }));
          } catch(e) {
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      }).on('error', (e) => {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: e.message }));
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', async () => {
        try {
          let bodyObj = {};
          try { bodyObj = JSON.parse(body); } catch(e) {}

          const messages = bodyObj.messages || [];
          const userMsg = messages.find(m => m.role === 'user');
          const promptText = typeof userMsg?.content === 'string'
            ? userMsg.content
            : (userMsg?.content || []).map(c => c.text || '').join('');

          console.log('Prompt length:', promptText.length);
          const result = await callGemini(promptText, bodyObj.max_tokens);

          if (result.error) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error }));
            return;
          }

          console.log('Model used:', result.model, '| Status:', result.status);

          if (result.status !== 200) {
            res.writeHead(result.status, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(result.body);
            return;
          }

          // Convert Gemini → Anthropic format
          const geminiResp = JSON.parse(result.body);
          const text = geminiResp.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const anthropicResp = {
            content: [{ type: 'text', text }],
            model: result.model,
            usage: { input_tokens: 0, output_tokens: 0 }
          };

          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify(anthropicResp));

        } catch(err) {
          console.error('Error:', err.message);
          res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
  }

  // ── STATIC FILES ──────────────────────────────────────────────
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Remove query string
  filePath = filePath.split('?')[0];
  const fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // SPA fallback – serve index.html
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { ...corsHeaders, 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ EnergoCert server running on port ${PORT}`);
});
