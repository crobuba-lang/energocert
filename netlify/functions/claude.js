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

  // Debug: log what we have (key prefix only, never full key)
  console.log('API key present:', !!apiKey);
  console.log('API key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set. Go to Netlify → Site Settings → Environment variables and add it, then redeploy.' })
    };
  }

  let requestBody;
  try {
    requestBody = event.body || '{}';
    JSON.parse(requestBody); // validate JSON
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
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
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout after 30s')); });
      req.write(buf);
      req.end();
    });

    console.log('Anthropic response status:', result.status);
    return { statusCode: result.status, headers: corsHeaders, body: result.body };

  } catch (err) {
    console.error('Proxy error:', err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Proxy error: ' + err.message })
    };
  }
};
