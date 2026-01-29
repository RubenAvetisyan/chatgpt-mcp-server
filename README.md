# MCP Server for ChatGPT on Netlify

A **100% free**, open-source Model Context Protocol (MCP) server that can be consumed by ChatGPT. Deployed on Netlify Free Tier with zero cost.

## Architecture Overview

```
┌─────────────────┐     HTTPS/JSON-RPC      ┌──────────────────────┐
│    ChatGPT      │ ◄─────────────────────► │   Netlify Function   │
│  (MCP Client)   │                         │    (MCP Server)      │
└─────────────────┘                         └──────────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────────┐
                                            │   Tool Handlers      │
                                            │  - echo              │
                                            │  - get_current_time  │
                                            │  - calculate         │
                                            │  - generate_uuid     │
                                            │  - text_stats        │
                                            └──────────────────────┘
```

### MCP Protocol Flow

1. **Initialize**: Client sends `initialize` → Server returns capabilities and version
2. **Discover Tools**: Client sends `tools/list` → Server returns available tools with schemas
3. **Execute Tool**: Client sends `tools/call` with tool name and arguments → Server executes and returns result

All communication uses **JSON-RPC 2.0** over HTTPS POST requests.

## Project Structure

```
custom-chatgpt-mcp-server/
├── src/
│   ├── functions/
│   │   ├── mcp.ts          # Main MCP endpoint (JSON-RPC handler)
│   │   └── health.ts       # Health check endpoint
│   ├── tools/
│   │   └── index.ts        # Tool definitions and implementations
│   └── types/
│       └── mcp.ts          # TypeScript types for MCP protocol
├── public/
│   └── index.html          # Landing page
├── package.json
├── tsconfig.json
├── netlify.toml            # Netlify configuration
└── README.md
```

## Available Tools

| Tool | Description | Input |
|------|-------------|-------|
| `echo` | Returns input text back | `{ text: string }` |
| `get_current_time` | Returns current UTC timestamp | `{}` |
| `calculate` | Basic arithmetic operations | `{ operation: "add"\|"subtract"\|"multiply"\|"divide", a: number, b: number }` |
| `generate_uuid` | Generates UUID v4 | `{}` |
| `text_stats` | Text analysis (chars, words, sentences) | `{ text: string }` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Main MCP JSON-RPC endpoint |
| `/health` | GET | Health check |

## Example Requests & Responses

### Initialize

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "chatgpt",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": false
      }
    },
    "serverInfo": {
      "name": "chatgpt-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

### List Tools

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "echo",
        "description": "Returns the input text back. Useful for testing connectivity.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "text": {
              "type": "string",
              "description": "The text to echo back"
            }
          },
          "required": ["text"]
        }
      }
    ]
  }
}
```

### Call Tool

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "calculate",
    "arguments": {
      "operation": "multiply",
      "a": 7,
      "b": 6
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"operation\":\"multiply\",\"a\":7,\"b\":6,\"result\":42}"
      }
    ]
  }
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "error": {
    "code": -32601,
    "message": "Method not found: unknown_method"
  }
}
```

## Deployment Steps

### Prerequisites

- Node.js 18+ installed
- npm or pnpm installed
- Git installed
- Free Netlify account (https://app.netlify.com/signup)
- Free GitHub account (for deployment)

### Step 1: Clone and Install

```bash
# Navigate to project directory
cd custom-chatgpt-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Test Locally

```bash
# Install Netlify CLI globally (if not already)
npm install -g netlify-cli

# Start local dev server
npm run dev
```

Test with curl:
```bash
# Health check
curl http://localhost:8888/health

# Initialize
curl -X POST http://localhost:8888/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:8888/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST http://localhost:8888/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"text":"Hello MCP!"}}}'
```

### Step 3: Push to GitHub

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial MCP server implementation"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/chatgpt-mcp-server.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Netlify

**Option A: Via Netlify Dashboard (Recommended)**

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub account
4. Select your repository
5. Netlify auto-detects settings from `netlify.toml`
6. Click "Deploy site"
7. Wait for deployment (usually 1-2 minutes)
8. Your MCP server is live at: `https://YOUR-SITE-NAME.netlify.app`

**Option B: Via CLI**

```bash
# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

### Step 5: Verify Deployment

```bash
# Replace with your actual Netlify URL
curl https://YOUR-SITE-NAME.netlify.app/health

curl -X POST https://YOUR-SITE-NAME.netlify.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Connecting ChatGPT to Your MCP Server

### ChatGPT MCP Configuration

As of the latest ChatGPT updates, MCP servers can be connected via:

1. **ChatGPT Settings** → **Connected Apps** or **MCP Servers**
2. Add a new MCP server with:
   - **Name**: `My MCP Server` (or any name you prefer)
   - **URL**: `https://YOUR-SITE-NAME.netlify.app/mcp`
   - **Authentication**: None (or add a token header if you implement auth)

### Important Notes for ChatGPT Integration

1. **HTTPS Required**: Netlify provides free HTTPS automatically
2. **CORS Enabled**: The server includes proper CORS headers
3. **JSON-RPC 2.0**: Fully compliant with the protocol ChatGPT expects
4. **Deterministic Responses**: All tools return consistent, predictable outputs
5. **Error Handling**: Proper JSON-RPC error codes are returned

### Testing the Connection

Once connected, you can ask ChatGPT to:
- "Use the echo tool to say hello"
- "What time is it? (use the get_current_time tool)"
- "Calculate 15 multiplied by 23"
- "Generate a UUID for me"
- "Analyze this text: 'Hello world. This is a test.'"

## Adding New Tools

To add a new tool:

1. **Define the tool** in `src/tools/index.ts`:

```typescript
// Add to toolDefinitions array
{
  name: 'my_new_tool',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'First parameter' },
    },
    required: ['param1'],
  },
}
```

2. **Implement the handler**:

```typescript
function myNewTool(args: unknown): McpToolResult {
  // Validate input with Zod
  const parsed = MyToolSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }
  
  // Your logic here
  return {
    content: [{ type: 'text', text: JSON.stringify({ result: 'success' }) }],
  };
}
```

3. **Add to the router** in `executeTool()`:

```typescript
case 'my_new_tool':
  return myNewTool(args);
```

4. **Rebuild and deploy**:

```bash
npm run build
netlify deploy --prod
```

## Cost Breakdown

| Service | Cost | Limit |
|---------|------|-------|
| Netlify Hosting | **$0** | 100GB bandwidth/month |
| Netlify Functions | **$0** | 125,000 invocations/month |
| GitHub Repository | **$0** | Unlimited public repos |
| **Total** | **$0** | More than enough for personal use |

## Security Considerations

### Adding Authentication (Optional)

To add token-based authentication, modify `src/functions/mcp.ts`:

```typescript
// At the start of the handler
const authHeader = event.headers['authorization'];
const expectedToken = process.env.MCP_AUTH_TOKEN;

if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
  return {
    statusCode: 401,
    headers: corsHeaders,
    body: JSON.stringify(
      createErrorResponse(null, -32000, 'Unauthorized')
    ),
  };
}
```

Then set `MCP_AUTH_TOKEN` in Netlify environment variables.

## Troubleshooting

### Common Issues

1. **CORS Errors**: The server includes CORS headers. If issues persist, check browser console for specific errors.

2. **Function Timeout**: Netlify Functions have a 10-second timeout on free tier. Keep tool operations fast.

3. **Cold Starts**: First request after inactivity may be slower (~500ms). This is normal for serverless.

4. **Build Failures**: Ensure `npm run build` works locally before deploying.

### Debug Locally

```bash
# Run with verbose logging
DEBUG=* npm run dev
```

## License

MIT License - Free for commercial and personal use.

## Dependencies

All dependencies are open-source and free:

- **zod**: MIT License - Runtime validation
- **@netlify/functions**: MIT License - Netlify Functions types
- **typescript**: Apache-2.0 License - TypeScript compiler
