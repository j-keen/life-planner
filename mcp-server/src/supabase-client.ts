import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 웹앱의 .env.local에서 자격증명 읽기
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!url || !key) {
    throw new Error(
      'Supabase credentials not found. Make sure .env.local exists in the project root with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  if (!supabase) {
    supabase = createClient(url, key);
  }

  return supabase;
};
