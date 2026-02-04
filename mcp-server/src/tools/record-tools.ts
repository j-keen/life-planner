import { getSupabase } from '../supabase-client.js';
import { DailyRecord, Mood } from '../types.js';
import { genId } from '../item-utils.js';

function rowToRecord(row: any): DailyRecord {
  return {
    id: row.id,
    periodId: row.period_id,
    content: row.content || '',
    mood: row.mood || undefined,
    highlights: row.highlights || [],
    gratitude: row.gratitude || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getRecord(periodId: string): Promise<DailyRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('period_id', periodId)
    .single();

  if (error || !data) return null;
  return rowToRecord(data);
}

export async function updateRecord(params: {
  periodId: string;
  content?: string;
  mood?: Mood;
  highlights?: string[];
  gratitude?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const existing = await getRecord(params.periodId);
    const now = new Date().toISOString();

    const record: any = {
      id: existing?.id || genId(),
      period_id: params.periodId,
      content: params.content ?? existing?.content ?? '',
      mood: params.mood ?? existing?.mood ?? null,
      highlights: params.highlights ?? existing?.highlights ?? [],
      gratitude: params.gratitude ?? existing?.gratitude ?? [],
      created_at: existing?.createdAt || now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('records')
      .upsert(record, { onConflict: 'id' });

    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
