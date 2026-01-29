/**
 * Memory System Types
 * 
 * TypeScript interfaces and Zod schemas for the Supabase-backed memory system.
 * 
 * @module types/memory
 */

import { z } from 'zod';

/**
 * Valid memory types for categorizing stored memories.
 */
export type MemoryType = 'preference' | 'profile' | 'task' | 'note' | 'fact';

/**
 * Zod schema for memory type validation.
 */
export const MemoryTypeSchema = z.enum(['preference', 'profile', 'task', 'note', 'fact']);

/**
 * Represents a memory record stored in Supabase.
 * Mirrors the database schema for the 'memories' table.
 */
export interface MemoryRecord {
  id: string;
  user_id: string;
  session_id?: string | null;
  type: MemoryType;
  content: string;
  tags?: string[] | null;
  importance?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Memory record as returned to MCP clients (camelCase).
 */
export interface MemoryOutput {
  id: string;
  userId: string;
  sessionId?: string | null;
  type: MemoryType;
  content: string;
  tags?: string[] | null;
  importance?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// memory_save Input/Output Schemas
// ============================================================================

/**
 * Zod schema for memory_save tool input validation.
 */
export const MemorySaveInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  content: z.string().min(1, 'content is required').max(50000, 'content too long'),
  type: MemoryTypeSchema.optional().default('note'),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(-10).max(10).optional().default(0),
  sessionId: z.string().optional(),
});

export type MemorySaveInput = z.infer<typeof MemorySaveInputSchema>;

/**
 * Output structure for memory_save tool.
 */
export interface MemorySaveOutput {
  id: string;
  saved: true;
}

// ============================================================================
// memory_search Input/Output Schemas
// ============================================================================

/**
 * Zod schema for memory_search tool input validation.
 */
export const MemorySearchInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  query: z.string().min(1, 'query is required').max(1000, 'query too long'),
  limit: z.number().int().min(1).max(100).optional().default(10),
  type: MemoryTypeSchema.optional(),
  sessionId: z.string().optional(),
});

export type MemorySearchInput = z.infer<typeof MemorySearchInputSchema>;

/**
 * Output structure for memory_search tool.
 */
export interface MemorySearchOutput {
  memories: MemoryOutput[];
}

// ============================================================================
// memory_forget Input/Output Schemas
// ============================================================================

/**
 * Zod schema for memory_forget tool input validation.
 * Requires either id OR contentMatch, but not both empty.
 */
export const MemoryForgetInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  id: z.string().optional(),
  contentMatch: z.string().optional(),
}).refine(
  (data) => data.id || data.contentMatch,
  { message: 'Either id or contentMatch must be provided' }
);

export type MemoryForgetInput = z.infer<typeof MemoryForgetInputSchema>;

/**
 * Output structure for memory_forget tool.
 */
export interface MemoryForgetOutput {
  deletedCount: number;
}

// ============================================================================
// memory_list Input/Output Schemas
// ============================================================================

/**
 * Zod schema for memory_list tool input validation.
 */
export const MemoryListInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  type: MemoryTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export type MemoryListInput = z.infer<typeof MemoryListInputSchema>;

/**
 * Output structure for memory_list tool.
 */
export interface MemoryListOutput {
  memories: MemoryOutput[];
  total: number;
}

// ============================================================================
// memory_update Input/Output Schemas
// ============================================================================

/**
 * Zod schema for memory_update tool input validation.
 */
export const MemoryUpdateInputSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  id: z.string().min(1, 'id is required'),
  content: z.string().min(1).max(50000).optional(),
  type: MemoryTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().int().min(-10).max(10).optional(),
});

export type MemoryUpdateInput = z.infer<typeof MemoryUpdateInputSchema>;

/**
 * Output structure for memory_update tool.
 */
export interface MemoryUpdateOutput {
  memory: MemoryOutput;
  updated: true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a database MemoryRecord to the client-facing MemoryOutput format.
 * 
 * @param record - The database record to convert.
 * @returns The converted MemoryOutput object.
 */
export function toMemoryOutput(record: MemoryRecord): MemoryOutput {
  return {
    id: record.id,
    userId: record.user_id,
    sessionId: record.session_id,
    type: record.type,
    content: record.content,
    tags: record.tags,
    importance: record.importance,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
