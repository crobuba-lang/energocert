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
  console.log('API key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Netlify environment variables.' })
    };
  }

  try {
    // Parse body and force correct model
    let bodyObj = {};
    try { bodyObj = JSON.parse(event.body || '{}'); } catch(e) {}

    bodyObj.model = 'claude-3-5-sonnet-20241022';
    if (!bodyObj.max_tokens) bodyObj.max_tokens = 1500;

    const requestBody = JSON.stringify(bodyObj);
    console.log('Model:', bodyObj.model);
    console.log('Messages:', bodyObj.messages ? bodyObj.messages.length : 0);

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
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout after 30s')); });
      req.write(buf);
      req.end();
    });

    console.log('Anthropic response status:', result.status);
    if (result.status !== 200) {
      console.log('Error body:', result.body.substring(0, 500));
    }
    return { statusCode: result.status, headers: corsHeaders, body: result.body };

  } catch (err) {
    console.error('Proxy error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
