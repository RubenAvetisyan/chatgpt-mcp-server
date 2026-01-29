import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const handler: Handler = async (_event: HandlerEvent, _context: HandlerContext) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'chatgpt-mcp-server',
    version: '1.0.0',
    uptime: process.uptime(),
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(healthStatus),
  };
};

export { handler };
