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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('API key present:', !!apiKey);

  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set.' }) };
  }

  try {
    let bodyObj = {};
    try { bodyObj = JSON.parse(event.body || '{}'); } catch(e) {}

    // Try models in order until one works
    const MODELS = [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229',
      'claude-instant-1-2',
    ];

    bodyObj.model = MODELS[0];
    if (!bodyObj.max_tokens) bodyObj.max_tokens = 1500;

    const requestBody = JSON.stringify(bodyObj);
    console.log('Trying model:', bodyObj.model);

    const result = await new Promise((resolve, reject) => {
      const buf = Buffer.from(requestBody, 'utf8');
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': buf.length
        }
      };
      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(buf);
      req.end();
    });

    console.log('Anthropic response status:', result.status);
    if (result.status !== 200) console.log('Error:', result.body.substring(0, 300));
    return { statusCode: result.status, headers: corsHeaders, body: result.body };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
