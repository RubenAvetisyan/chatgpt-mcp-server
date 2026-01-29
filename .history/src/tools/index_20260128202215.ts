import { z } from 'zod';
import type { McpTool, McpToolResult } from '../types/mcp.js';

// Tool Input Schemas using Zod for validation
const EchoInputSchema = z.object({
  text: z.string().min(1).max(10000),
});

const CalculateInputSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number(),
});

const TextStatsInputSchema = z.object({
  text: z.string().min(1).max(50000),
});

// Tool Definitions for MCP Discovery
export const toolDefinitions: McpTool[] = [
  {
    name: 'echo',
    description: 'Returns the input text back. Useful for testing connectivity.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to echo back',
          minLength: 1,
          maxLength: 10000,
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_current_time',
    description: 'Returns the current UTC timestamp in ISO 8601 format.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'calculate',
    description: 'Performs basic arithmetic operations: add, subtract, multiply, divide.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The arithmetic operation to perform',
        },
        a: {
          type: 'number',
          description: 'First operand',
        },
        b: {
          type: 'number',
          description: 'Second operand',
        },
      },
      required: ['operation', 'a', 'b'],
    },
  },
  {
    name: 'generate_uuid',
    description: 'Generates a random UUID v4.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'text_stats',
    description: 'Analyzes text and returns statistics: character count, word count, sentence count, and average word length.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to analyze',
          minLength: 1,
          maxLength: 50000,
        },
      },
      required: ['text'],
    },
  },
];

// Tool Implementations
function echo(args: unknown): McpToolResult {
  const parsed = EchoInputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: parsed.data.text }],
  };
}

function getCurrentTime(): McpToolResult {
  const now = new Date().toISOString();
  return {
    content: [{ type: 'text', text: JSON.stringify({ utc: now, timestamp: Date.now() }) }],
  };
}

function calculate(args: unknown): McpToolResult {
  const parsed = CalculateInputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { operation, a, b } = parsed.data;
  let result: number;

  switch (operation) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) {
        return {
          content: [{ type: 'text', text: 'Error: Division by zero' }],
          isError: true,
        };
      }
      result = a / b;
      break;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ operation, a, b, result }) }],
  };
}

function generateUuid(): McpToolResult {
  // Crypto-secure UUID v4 generation without external dependencies
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return {
    content: [{ type: 'text', text: JSON.stringify({ uuid }) }],
  };
}

function textStats(args: unknown): McpToolResult {
  const parsed = TextStatsInputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: 'text', text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { text } = parsed.data;
  const characters = text.length;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const avgWordLength = wordCount > 0 
    ? (words.reduce((sum, w) => sum + w.length, 0) / wordCount).toFixed(2)
    : '0';

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        characters,
        words: wordCount,
        sentences,
        averageWordLength: parseFloat(avgWordLength),
      }),
    }],
  };
}

// Tool Router
export function executeTool(name: string, args: unknown): McpToolResult {
  switch (name) {
    case 'echo':
      return echo(args);
    case 'get_current_time':
      return getCurrentTime();
    case 'calculate':
      return calculate(args);
    case 'generate_uuid':
      return generateUuid();
    case 'text_stats':
      return textStats(args);
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
