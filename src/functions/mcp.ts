import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import {
  JsonRpcRequestSchema,
  ErrorCodes,
  McpMethods,
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

// CORS Headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

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

  const result = executeTool(toolParams.name, toolParams.arguments);
  return createResponse(id, result);
}

function handlePing(id: string | number | null): JsonRpcResponse {
  return createResponse(id, {});
}

// Main Handler
const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
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

  // Validate JSON-RPC request
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
