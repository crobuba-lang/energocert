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
  // GET request – list available models
  if (event.httpMethod === 'GET') {
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models?key=${apiKey}`,
        method: 'GET'
      };
      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject);
      req.end();
    });
    // Extract just model names for readability
    try {
      const data = JSON.parse(result.body);
      const names = (data.models || []).map(m => m.name + ' | ' + (m.supportedGenerationMethods || []).join(','));
      console.log('Available models:', names.join(' | '));
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ models: names }) };
    } catch(e) {
      return { statusCode: result.status, headers: corsHeaders, body: result.body };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Gemini API key present:', !!apiKey);

  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GEMINI_API_KEY not set.' }) };
  }

  try {
    // Parse incoming request (format: Anthropic messages API)
    let bodyObj = {};
    try { bodyObj = JSON.parse(event.body || '{}'); } catch(e) {}

    // Extract text from messages
    const messages = bodyObj.messages || [];
    const userMessage = messages.find(m => m.role === 'user');
    const promptText = typeof userMessage?.content === 'string'
      ? userMessage.content
      : userMessage?.content?.map(c => c.text || '').join('') || '';

    // Build Gemini request
    const geminiBody = JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        maxOutputTokens: bodyObj.max_tokens || 1500,
        temperature: 0.3
      }
    });

    const model = 'gemini-2.5-flash-preview-04-17';
    const path = `/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log('Calling Gemini model:', model);
    console.log('Prompt length:', promptText.length);

    const result = await new Promise((resolve, reject) => {
      const buf = Buffer.from(geminiBody, 'utf8');
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    console.log('Gemini response status:', result.status);

    if (result.status !== 200) {
      console.log('Gemini error:', result.body.substring(0, 500));
      return { statusCode: result.status, headers: corsHeaders, body: result.body };
    }

    // Convert Gemini response to Anthropic format so frontend works unchanged
    const geminiResp = JSON.parse(result.body);
    const text = geminiResp.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const anthropicFormat = {
      content: [{ type: 'text', text: text }],
      model: model,
      usage: { input_tokens: 0, output_tokens: 0 }
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(anthropicFormat)
    };

  } catch (err) {
    console.error('Error:', err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
