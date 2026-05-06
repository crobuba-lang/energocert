const https = require('https');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'No API key' }) };
  }

  // If GET or special path – list available models
  if (event.httpMethod === 'GET' || event.path.includes('list-models')) {
    const result = await makeRequest('api.anthropic.com', '/v1/models', 'GET', null, {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    });
    console.log('Models response:', result.status, result.body.substring(0, 1000));
    return { statusCode: result.status, headers: corsHeaders, body: result.body };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    let bodyObj = {};
    try { bodyObj = JSON.parse(event.body || '{}'); } catch(e) {}

    // Use the model from request, fallback to haiku
    const model = bodyObj.model || 'claude-3-haiku-20240307';
    bodyObj.model = model;
    if (!bodyObj.max_tokens) bodyObj.max_tokens = 1500;

    const requestBody = JSON.stringify(bodyObj);
    console.log('Model:', model);

    const result = await makeRequest('api.anthropic.com', '/v1/messages', 'POST', requestBody, {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(requestBody)
    });

    console.log('Status:', result.status);
    if (result.status !== 200) console.log('Error:', result.body.substring(0, 500));
    return { statusCode: result.status, headers: corsHeaders, body: result.body };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

function makeRequest(hostname, path, method, body, headers) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method, headers };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}
