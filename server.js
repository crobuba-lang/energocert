const https = require('https');
const Busboy = require('busboy');
const http = require('http');
const fs = require('fs');
const path = require('path');


// ── STARTUP: ensure python-docx is installed ─────────────────────
const { execSync, execFile } = require('child_process');
let PYTHON_CMD = 'python3';
let DOCX_AVAILABLE = false;

function tryInstallDocx() {
  // Try python3 first
  for (const py of ['python3', 'python']) {
    try {
      execSync(py + ' -c "from docx import Document; print(1)"', { timeout: 8000 });
      PYTHON_CMD = py;
      DOCX_AVAILABLE = true;
      console.log('✅ python-docx available via', py);
      return;
    } catch(e) {}
  }
  
  // Try installing
  const pipCmds = ['pip3 install python-docx --break-system-packages --quiet',
                   'pip3 install python-docx --quiet',
                   'pip install python-docx --break-system-packages --quiet',
                   'pip install python-docx --quiet'];
  for (const cmd of pipCmds) {
    try {
      console.log('Trying:', cmd);
      execSync(cmd, { timeout: 120000 });
      execSync('python3 -c "from docx import Document"', { timeout: 5000 });
      DOCX_AVAILABLE = true;
      PYTHON_CMD = 'python3';
      console.log('✅ python-docx installed successfully');
      return;
    } catch(e) { console.log('Failed:', e.message.substring(0, 100)); }
  }
  console.error('❌ python-docx not available - parse-docx endpoint will fail');
}

tryInstallDocx();

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
  // Test GET for parse endpoint
  if (req.url === '/api/parse-docx' && req.method === 'GET') {
    const { execFileSync } = require('child_process');
    let pyVersion = 'unknown';
    let docxAvailable = false;
    try { pyVersion = execFileSync('python3', ['--version']).toString().trim(); } catch(e) {}
    try { execFileSync('python3', ['-c', 'from docx import Document']); docxAvailable = true; } catch(e) {}
    const scriptExists = require('fs').existsSync(require('path').join(__dirname, 'parse_ki.py'));
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', python: pyVersion, docxAvailable, scriptExists }));
    return;
  }

  if ((req.url === '/api/parse-docx' || req.url.startsWith('/api/parse-docx')) && req.method === 'POST') {
    const tmpPath = '/tmp/ki_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.docx';
    const writeStream = require('fs').createWriteStream(tmpPath);
    let fileFound = false;

    const bb = Busboy({ headers: req.headers });
    
    bb.on('file', (fieldname, fileStream, info) => {
      console.log('Receiving file:', info.filename, 'type:', info.mimeType);
      fileFound = true;
      fileStream.pipe(writeStream);
    });

    bb.on('finish', () => {
      writeStream.end();
      writeStream.on('finish', () => {
        const stats = require('fs').statSync(tmpPath);
        console.log('File written:', tmpPath, 'size:', stats.size, 'bytes');

        if (!fileFound || stats.size < 100) {
          try { require('fs').unlinkSync(tmpPath); } catch(e) {}
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No valid file received. Size: ' + stats.size }));
          return;
        }

        const scriptPath = require('path').join(__dirname, 'parse_ki.py');
        const pythonCmd = PYTHON_CMD || 'python3';
        console.log('Parsing with:', pythonCmd, scriptPath);

        require('child_process').execFile(pythonCmd, [scriptPath, tmpPath], 
          { timeout: 60000, maxBuffer: 50 * 1024 * 1024 },
          (err, stdout, stderr) => {
            try { require('fs').unlinkSync(tmpPath); } catch(e) {}
            
            if (err) {
              console.error('Parse error:', err.message);
              if (stderr) console.error('stderr:', stderr.substring(0, 500));
              res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Parse error: ' + err.message }));
              return;
            }

            try {
              const result = JSON.parse(stdout);
              console.log('Parse success, keys:', Object.keys(result).length);
              res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch(parseErr) {
              console.error('JSON error. stdout preview:', stdout.substring(0, 300));
              res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'JSON parse failed: ' + parseErr.message }));
            }
          }
        );
      });
    });

    bb.on('error', (err) => {
      console.error('Busboy error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upload error: ' + err.message }));
    });

    req.pipe(bb);
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
