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
                                            │  - memory_save       │
                                            │  - memory_search     │
                                            │  - memory_forget     │
                                            │  - memory_list       │
                                            │  - memory_update     │
                                            └──────────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────────┐
                                            │   Supabase (Free)    │
                                            │   - memories table   │
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
│   ├── lib/
│   │   └── supabase.ts     # Supabase client helper
│   ├── tools/
│   │   ├── index.ts        # Tool definitions and router
│   │   └── memory.ts       # Memory tools (Supabase-backed)
│   └── types/
│       ├── mcp.ts          # TypeScript types for MCP protocol
│       └── memory.ts       # Memory system types
├── public/
│   └── index.html          # Landing page
├── package.json
├── tsconfig.json
├── netlify.toml            # Netlify configuration
└── README.md
```

## Available Tools

### Utility Tools

| Tool | Description | Input |
|------|-------------|-------|
| `echo` | Returns input text back | `{ text: string }` |
| `get_current_time` | Returns current UTC timestamp | `{}` |
| `calculate` | Basic arithmetic operations | `{ operation: "add"\|"subtract"\|"multiply"\|"divide", a: number, b: number }` |
| `generate_uuid` | Generates UUID v4 | `{}` |
| `text_stats` | Text analysis (chars, words, sentences) | `{ text: string }` |

### Memory Tools (Supabase-backed)

| Tool | Description | Input |
|------|-------------|-------|
| `memory_save` | Save a memory item for a user | `{ userId, content, type?, tags?, importance?, sessionId? }` |
| `memory_search` | Search memories by keyword | `{ userId, query, limit?, type?, sessionId? }` |
| `memory_forget` | Delete memories | `{ userId, id? } or { userId, contentMatch? }` |
| `memory_list` | List all memories with pagination | `{ userId, type?, limit?, offset? }` |
| `memory_update` | Update an existing memory | `{ userId, id, content?, type?, tags?, importance? }` |

**Memory Types:** `preference`, `profile`, `task`, `note`, `fact`

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
| Supabase Database | **$0** | 500MB storage, 2GB bandwidth |
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
- **@supabase/supabase-js**: MIT License - Supabase client
- **@netlify/functions**: MIT License - Netlify Functions types
- **typescript**: Apache-2.0 License - TypeScript compiler

---

## Supabase Memory System Setup

### 1. Create a Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Create a new project
3. Note your **Project URL** and **anon/public key** from Settings → API

### 2. Create the Memories Table

Run this SQL in the Supabase SQL Editor:

```sql
-- Create memories table for persistent user memory storage
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  session_id text NULL,
  type text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  tags text[] DEFAULT ARRAY[]::text[],
  importance int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (customize for your auth setup)
CREATE POLICY "Allow all operations" ON memories
  FOR ALL USING (true) WITH CHECK (true);
```

### 3. Configure Environment Variables

Set these in Netlify (Site Settings → Environment Variables):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

For local development, create a `.env` file (add to `.gitignore`):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

---

## ChatGPT Memory Usage Guidelines

Use these guidelines in your ChatGPT system/developer prompts to enable memory:

### System Prompt Example

```
You have access to a persistent memory system via MCP tools. Use it as follows:

**Retrieving Context:**
- Before answering questions about user preferences or past interactions, call `memory_search` with relevant keywords.
- Example: memory_search({ userId: "user123", query: "favorite color" })

**Saving Memories:**
- When the user says "remember this", "don't forget", or expresses stable preferences, call `memory_save`.
- Save concise, distilled facts—NOT full conversation logs.
- Use appropriate types: preference, profile, task, note, fact.
- Example: memory_save({ userId: "user123", content: "Prefers dark mode", type: "preference" })

**Forgetting:**
- When the user asks to forget something, call `memory_forget`.
- Example: memory_forget({ userId: "user123", contentMatch: "dark mode" })

**Privacy:**
- NEVER store passwords, API keys, or highly sensitive personal data.
- Only store information the user explicitly wants remembered.
```

### User Identity

The memory system requires a `userId` for all operations. Options:

1. **Single-user setup**: Use a fixed userId like `"default"` or `"user1"`
2. **Multi-user setup**: Pass a unique identifier per user (from your auth system)

> ⚠️ **Note**: The current implementation does not verify userId ownership. This is suitable for personal use but not for untrusted multi-user environments without additional authentication.

### Example Tool Calls

**Save a preference:**
```json
{
  "name": "memory_save",
  "arguments": {
    "userId": "user123",
    "content": "User prefers concise responses without emojis",
    "type": "preference",
    "importance": 5
  }
}
```

**Search for context:**
```json
{
  "name": "memory_search",
  "arguments": {
    "userId": "user123",
    "query": "response style",
    "limit": 5
  }
}
```

**Forget a memory:**
```json
{
  "name": "memory_forget",
  "arguments": {
    "userId": "user123",
    "contentMatch": "emoji"
  }
}
```
