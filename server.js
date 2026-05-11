const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ── MIME TYPES ────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// ── GEMINI PROXY ──────────────────────────────────────────────────
function callGemini(promptText, maxTokens) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { resolve({ error: 'GEMINI_API_KEY not set' }); return; }

    // Try models in order
    const models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-flash-latest',
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


  // ── /api/parse-docx – server-side KI Expert parsing ─────────────
  if ((req.url === '/api/parse-docx' || req.url.startsWith('/api/parse-docx')) && req.method === 'POST') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        const boundary = req.headers['content-type'].split('boundary=')[1];
        if (!boundary) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No boundary in multipart' }));
          return;
        }

        // Parse multipart to extract file bytes
        const bodyStr = body.toString('binary');
        const parts = bodyStr.split('--' + boundary);
        let fileBuffer = null;

        for (const part of parts) {
          if (part.includes('filename=') && part.includes('\r\n\r\n')) {
            const dataStart = part.indexOf('\r\n\r\n') + 4;
            const dataEnd = part.lastIndexOf('\r\n');
            if (dataStart > 4 && dataEnd > dataStart) {
              fileBuffer = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
              break;
            }
          }
        }

        if (!fileBuffer) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No file found in upload' }));
          return;
        }

        // Write to temp file
        const tmpPath = '/tmp/ki_upload_' + Date.now() + '.docx';
        require('fs').writeFileSync(tmpPath, fileBuffer);
        console.log('Parsing KI Expert:', tmpPath, 'size:', fileBuffer.length);

        // Run Python parser
        const { execFile } = require('child_process');
        const scriptPath = require('path').join(__dirname, 'parse_ki.py');

        execFile('python3', [scriptPath, tmpPath], { timeout: 30000 }, (err, stdout, stderr) => {
          // Cleanup
          try { require('fs').unlinkSync(tmpPath); } catch(e) {}

          if (err) {
            console.error('Parse error:', err.message, stderr);
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Parse error: ' + err.message }));
            return;
          }

          try {
            const result = JSON.parse(stdout);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch(parseErr) {
            console.error('JSON parse error:', stdout.substring(0, 200));
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'JSON parse error: ' + parseErr.message }));
          }
        });
      } catch(err) {
        console.error('parse-docx error:', err);
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

    // ── STATIC FILES ──────────────────────────────────────────────
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Remove query string
  filePath = filePath.split('?')[0];
  const fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { ...corsHeaders, 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ EnergoCert server running on port ${PORT}`);
});
