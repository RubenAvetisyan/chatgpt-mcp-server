/**
 * Supabase Client Helper
 * 
 * Creates and exports a singleton Supabase client for database operations.
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY environment variables.
 * 
 * @module lib/supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Error thrown when required Supabase environment variables are missing.
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client instance.
 * 
 * @throws {SupabaseConfigError} If SUPABASE_URL or SUPABASE_ANON_KEY env vars are missing.
 * @returns {SupabaseClient} The Supabase client instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new SupabaseConfigError(
      'Missing SUPABASE_URL environment variable. Please set it to your Supabase project URL.'
    );
  }

  if (!supabaseAnonKey) {
    throw new SupabaseConfigError(
      'Missing SUPABASE_ANON_KEY environment variable. Please set it to your Supabase anon/public key.'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseInstance;
}

/**
 * Resets the Supabase client instance (useful for testing).
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
