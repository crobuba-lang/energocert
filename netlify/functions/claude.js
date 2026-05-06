// netlify/functions/claude.js
// Serverless proxy – čuva API ključ na serveru
// CommonJS + Node.js https modul – radi na svim Netlify planovima

const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY nije postavljen u Netlify → Site Settings → Environment variables' })
    };
  }

  try {
    const requestBody = event.body || '{}';
    const result = await httpsPost('api.anthropic.com', '/v1/messages', requestBody, {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    });
    return {
      statusCode: result.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: result.body
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message })
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function httpsPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf8');
    const opts = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': buf.length }
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}
