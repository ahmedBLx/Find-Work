const http = require('http');
const { URL } = require('url');

/**
 * Dispatches payload to an n8n webhook endpoint with mapping and timeout support.
 * @param {string} path - Webhook short path or full slug
 * @param {Object} payload - Data payload to transmit
 * @returns {Promise<{ statusCode: number, data?: any, raw?: string }>}
 */
async function callN8nWebhook(path, payload) {
  const n8nBase = process.env.N8N_URL || 'http://localhost:5678';
  
  // Map short paths to actual registered n8n paths
  const pathMap = {
    'm3-matching-ranking': 'm3-workflow/m3-rank-webhook/m3-matching-ranking',
    'm5-intake': 'm5-workflow/m5-intake-webhook/m5-intake',
    'm5-decide': 'm5-workflow/m5-decide-webhook/m5-decide',
    'm5-timeout': 'm5-workflow/m5-timeout-webhook/m5-timeout'
  };
  
  const resolvedPath = pathMap[path] || path;
  const webhookUrl = `${n8nBase}/webhook/${resolvedPath}`;
  const url = new URL(webhookUrl);
  const postData = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 5678,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000 // 10s default timeout
    };
    const reqObj = http.request(options, (r) => {
      let body = '';
      r.on('data', chunk => body += chunk);
      r.on('end', () => {
        try {
          resolve({ statusCode: r.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: r.statusCode, raw: body });
        }
      });
    });
    reqObj.on('error', (e) => reject(e));
    reqObj.on('timeout', () => { reqObj.destroy(); reject(new Error('n8n webhook timeout')); });
    reqObj.write(postData);
    reqObj.end();
  });
}

module.exports = {
  callN8nWebhook
};
