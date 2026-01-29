/**
 * Memory Tools
 * 
 * Supabase-backed memory system tools for the MCP server.
 * Provides persistent storage for user memories, preferences, and facts.
 * 
 * IMPORTANT: Do NOT store sensitive data like API keys, passwords, or secrets.
 * This system is designed for distilled memory items, not full conversation logs.
 * 
 * @module tools/memory
 */

import { z } from 'zod';
import type { McpTool, McpToolResult } from '../types/mcp.js';
import { InvalidParamsError } from '../types/mcp.js';
import { getSupabaseClient, SupabaseConfigError } from '../lib/supabase.js';
import {
  MemorySaveInputSchema,
  MemorySearchInputSchema,
  MemoryForgetInputSchema,
  MemoryListInputSchema,
  MemoryUpdateInputSchema,
  toMemoryOutput,
  type MemoryRecord,
  type MemorySaveOutput,
  type MemorySearchOutput,
  type MemoryForgetOutput,
  type MemoryListOutput,
  type MemoryUpdateOutput,
} from '../types/memory.js';

// ============================================================================
// Tool Definitions for MCP Discovery
// ============================================================================

/**
 * MCP tool definitions for memory operations.
 * These are registered with the MCP server for discovery.
 */
export const memoryToolDefinitions: McpTool[] = [
  {
    name: 'memory_save',
    description: 'Save a memory item (fact, preference, note, task, or profile info) for a user. Use this when the user explicitly asks to remember something or expresses stable preferences.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Unique identifier for the user',
        },
        content: {
          type: 'string',
          description: 'The memory content to save (concise summary, not raw conversation)',
          maxLength: 50000,
        },
        type: {
          type: 'string',
          enum: ['preference', 'profile', 'task', 'note', 'fact'],
          description: 'Category of memory. Defaults to "note".',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization and search',
        },
        importance: {
          type: 'integer',
          description: 'Importance level from -10 to 10. Defaults to 0.',
          minimum: -10,
          maximum: 10,
        },
        sessionId: {
          type: 'string',
          description: 'Optional session identifier for grouping related memories',
        },
      },
      required: ['userId', 'content'],
    },
  },
  {
    name: 'memory_search',
    description: 'Search for relevant memories for a user. Call this before answering to retrieve context from previous interactions.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Unique identifier for the user',
        },
        query: {
          type: 'string',
          description: 'Search query to find relevant memories',
          maxLength: 1000,
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return. Defaults to 10.',
          minimum: 1,
          maximum: 100,
        },
        type: {
          type: 'string',
          enum: ['preference', 'profile', 'task', 'note', 'fact'],
          description: 'Filter by memory type',
        },
        sessionId: {
          type: 'string',
          description: 'Filter by session identifier',
        },
      },
      required: ['userId', 'query'],
    },
  },
  {
    name: 'memory_forget',
    description: 'Delete one or more memories for a user. Use when the user asks to forget something.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Unique identifier for the user',
        },
        id: {
          type: 'string',
          description: 'Specific memory ID to delete',
        },
        contentMatch: {
          type: 'string',
          description: 'Delete memories where content contains this text (case-insensitive)',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'memory_list',
    description: 'List all memories for a user with optional filtering. Useful for inspection and debugging.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Unique identifier for the user',
        },
        type: {
          type: 'string',
          enum: ['preference', 'profile', 'task', 'note', 'fact'],
          description: 'Filter by memory type',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results. Defaults to 20.',
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: 'integer',
          description: 'Number of results to skip for pagination. Defaults to 0.',
          minimum: 0,
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'memory_update',
    description: 'Update an existing memory record. Only provided fields will be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Unique identifier for the user',
        },
        id: {
          type: 'string',
          description: 'ID of the memory to update',
        },
        content: {
          type: 'string',
          description: 'New content for the memory',
          maxLength: 50000,
        },
        type: {
          type: 'string',
          enum: ['preference', 'profile', 'task', 'note', 'fact'],
          description: 'New type for the memory',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags for the memory',
        },
        importance: {
          type: 'integer',
          description: 'New importance level from -10 to 10',
          minimum: -10,
          maximum: 10,
        },
      },
      required: ['userId', 'id'],
    },
  },
];

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Creates an MCP error result with a safe error message.
 * 
 * @param message - The error message to display.
 * @returns McpToolResult with isError flag set.
 */
function createErrorResult(message: string): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/**
 * Saves a memory item to Supabase.
 * 
 * @param args - The tool input arguments.
 * @returns Promise resolving to McpToolResult with the saved memory ID.
 */
export async function memorySave(args: unknown): Promise<McpToolResult> {
  const parsed = MemorySaveInputSchema.safeParse(args);
  if (!parsed.success) {
    throw new InvalidParamsError(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { userId, content, type, tags, importance, sessionId } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: userId,
        content,
        type,
        tags: tags || [],
        importance: importance ?? 0,
        session_id: sessionId || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error.message);
      return createErrorResult(`Failed to save memory: ${error.message}`);
    }

    const result: MemorySaveOutput = {
      id: data.id,
      saved: true,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return createErrorResult(err.message);
    }
    console.error('Unexpected error in memory_save:', err);
    return createErrorResult('An unexpected error occurred while saving memory');
  }
}

/**
 * Searches for memories matching a query.
 * Uses case-insensitive text matching on content.
 * Results are ordered by importance (desc) and recency (desc).
 * 
 * @param args - The tool input arguments.
 * @returns Promise resolving to McpToolResult with matching memories.
 */
export async function memorySearch(args: unknown): Promise<McpToolResult> {
  const parsed = MemorySearchInputSchema.safeParse(args);
  if (!parsed.success) {
    throw new InvalidParamsError(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { userId, query, limit, type, sessionId } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    let queryBuilder = supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .ilike('content', `%${query}%`)
      .order('importance', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      queryBuilder = queryBuilder.eq('type', type);
    }

    if (sessionId) {
      queryBuilder = queryBuilder.eq('session_id', sessionId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Supabase search error:', error.message);
      return createErrorResult(`Failed to search memories: ${error.message}`);
    }

    const result: MemorySearchOutput = {
      memories: (data as MemoryRecord[]).map(toMemoryOutput),
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return createErrorResult(err.message);
    }
    console.error('Unexpected error in memory_search:', err);
    return createErrorResult('An unexpected error occurred while searching memories');
  }
}

/**
 * Deletes one or more memories for a user.
 * Requires either a specific ID or a content match pattern.
 * 
 * @param args - The tool input arguments.
 * @returns Promise resolving to McpToolResult with deleted count.
 */
export async function memoryForget(args: unknown): Promise<McpToolResult> {
  const parsed = MemoryForgetInputSchema.safeParse(args);
  if (!parsed.success) {
    throw new InvalidParamsError(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { userId, id, contentMatch } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    let queryBuilder = supabase
      .from('memories')
      .delete()
      .eq('user_id', userId);

    if (id) {
      queryBuilder = queryBuilder.eq('id', id);
    } else if (contentMatch) {
      queryBuilder = queryBuilder.ilike('content', `%${contentMatch}%`);
    }

    const { data, error } = await queryBuilder.select('id');

    if (error) {
      console.error('Supabase delete error:', error.message);
      return createErrorResult(`Failed to delete memories: ${error.message}`);
    }

    const result: MemoryForgetOutput = {
      deletedCount: data?.length || 0,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return createErrorResult(err.message);
    }
    console.error('Unexpected error in memory_forget:', err);
    return createErrorResult('An unexpected error occurred while deleting memories');
  }
}

/**
 * Lists memories for a user with optional filtering and pagination.
 * 
 * @param args - The tool input arguments.
 * @returns Promise resolving to McpToolResult with memory list and total count.
 */
export async function memoryList(args: unknown): Promise<McpToolResult> {
  const parsed = MemoryListInputSchema.safeParse(args);
  if (!parsed.success) {
    throw new InvalidParamsError(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { userId, type, limit, offset } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    let queryBuilder = supabase
      .from('memories')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      queryBuilder = queryBuilder.eq('type', type);
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('Supabase list error:', error.message);
      return createErrorResult(`Failed to list memories: ${error.message}`);
    }

    const result: MemoryListOutput = {
      memories: (data as MemoryRecord[]).map(toMemoryOutput),
      total: count || 0,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return createErrorResult(err.message);
    }
    console.error('Unexpected error in memory_list:', err);
    return createErrorResult('An unexpected error occurred while listing memories');
  }
}

/**
 * Updates an existing memory record.
 * Only fields provided in the input will be updated.
 * 
 * @param args - The tool input arguments.
 * @returns Promise resolving to McpToolResult with updated memory.
 */
export async function memoryUpdate(args: unknown): Promise<McpToolResult> {
  const parsed = MemoryUpdateInputSchema.safeParse(args);
  if (!parsed.success) {
    throw new InvalidParamsError(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { userId, id, content, type, tags, importance } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (tags !== undefined) updateData.tags = tags;
    if (importance !== undefined) updateData.importance = importance;

    const { data, error } = await supabase
      .from('memories')
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase update error:', error.message);
      return createErrorResult(`Failed to update memory: ${error.message}`);
    }

    if (!data) {
      return createErrorResult('Memory not found or not owned by user');
    }

    const result: MemoryUpdateOutput = {
      memory: toMemoryOutput(data as MemoryRecord),
      updated: true,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      return createErrorResult(err.message);
    }
    console.error('Unexpected error in memory_update:', err);
    return createErrorResult('An unexpected error occurred while updating memory');
  }
}

/**
 * Routes memory tool calls to the appropriate handler.
 * 
 * @param name - The tool name.
 * @param args - The tool arguments.
 * @returns Promise resolving to McpToolResult or null if not a memory tool.
 */
export async function executeMemoryTool(
  name: string,
  args: unknown
): Promise<McpToolResult | null> {
  switch (name) {
    case 'memory_save':
      return memorySave(args);
    case 'memory_search':
      return memorySearch(args);
    case 'memory_forget':
      return memoryForget(args);
    case 'memory_list':
      return memoryList(args);
    case 'memory_update':
      return memoryUpdate(args);
    default:
      return null;
  }
}
