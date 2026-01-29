import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import {
  JsonRpcRequestSchema,
  ErrorCodes,
  McpMethods,
  InvalidParamsError,
  type JsonRpcResponse,
  type McpInitializeResult,
  type McpToolsListResult,
  type McpToolCallParams,
} from '../types/mcp.js';
import { toolDefinitions, executeTool } from '../tools/index.js';

// Server Configuration
const SERVER_INFO = {
  name: 'chatgpt-mcp-server',
  version: '1.0.0',
};

const PROTOCOL_VERSION = '2024-11-05';

// Allowed origins for CORS (ChatGPT domains)
const ALLOWED_ORIGINS = [
  'https://chat.openai.com',
  'https://chatgpt.com',
];

// Helper: Get CORS headers with dynamic origin
function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };
}

// Helper: Create JSON-RPC Response
function createResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

// Helper: Create JSON-RPC Error Response
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
}

// MCP Method Handlers
function handleInitialize(id: string | number | null): JsonRpcResponse {
  const result: McpInitializeResult = {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    serverInfo: SERVER_INFO,
  };
  return createResponse(id, result);
}

function handleToolsList(id: string | number | null): JsonRpcResponse {
  const result: McpToolsListResult = {
    tools: toolDefinitions,
  };
  return createResponse(id, result);
}

function handleToolsCall(
  id: string | number | null,
  params: Record<string, unknown> | undefined
): JsonRpcResponse {
  if (!params || typeof params.name !== 'string') {
    return createErrorResponse(
      id,
      ErrorCodes.INVALID_PARAMS,
      'Missing required parameter: name'
    );
  }

  const toolParams: McpToolCallParams = {
    name: params.name,
    arguments: (params.arguments as Record<string, unknown>) || {},
  };

  // Check if tool exists
  const toolExists = toolDefinitions.some((t) => t.name === toolParams.name);
  if (!toolExists) {
    return createErrorResponse(
      id,
      ErrorCodes.INVALID_PARAMS,
      `Unknown tool: ${toolParams.name}`
    );
  }

  // Execute tool and handle InvalidParamsError separately from tool execution errors
  try {
    const result = executeTool(toolParams.name, toolParams.arguments);
    return createResponse(id, result);
  } catch (error) {
    if (error instanceof InvalidParamsError) {
      // Validation error: return JSON-RPC error
      return createErrorResponse(
        id,
        ErrorCodes.INVALID_PARAMS,
        'Invalid params',
        error.message
      );
    }
    // Unexpected error: return internal error
    return createErrorResponse(
      id,
      ErrorCodes.INTERNAL_ERROR,
      'Internal error',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

function handlePing(id: string | number | null): JsonRpcResponse {
  return createResponse(id, {});
}

// Main Handler
const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const origin = event.headers['origin'] || event.headers['Origin'];
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify(
        createErrorResponse(null, ErrorCodes.INVALID_REQUEST, 'Method not allowed')
      ),
    };
  }

  // Parse request body
  let body: unknown;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(
        createErrorResponse(null, ErrorCodes.PARSE_ERROR, 'Invalid JSON')
      ),
    };
  }

  // Validate JSON-RPC request structure
  const parseResult = JsonRpcRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(
        createErrorResponse(
          null,
          ErrorCodes.INVALID_REQUEST,
          'Invalid JSON-RPC request',
          parseResult.error.issues
        )
      ),
    };
  }

  const request = parseResult.data;

  // Handle notifications (requests without id) - no response required
  if (request.id === null || request.id === undefined) {
    // For notifications like 'notifications/initialized', just acknowledge silently
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  let response: JsonRpcResponse;

  // Route to appropriate handler
  switch (request.method) {
    case McpMethods.INITIALIZE:
      response = handleInitialize(request.id);
      break;
    case McpMethods.TOOLS_LIST:
      response = handleToolsList(request.id);
      break;
    case McpMethods.TOOLS_CALL:
      response = handleToolsCall(request.id, request.params);
      break;
    case McpMethods.PING:
      response = handlePing(request.id);
      break;
    default:
      response = createErrorResponse(
        request.id,
        ErrorCodes.METHOD_NOT_FOUND,
        `Method not found: ${request.method}`
      );
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(response),
  };
};

export { handler };
