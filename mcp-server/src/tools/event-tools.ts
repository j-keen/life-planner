import { getSupabase } from '../supabase-client.js';
import { AnnualEvent, AnnualEventType } from '../types.js';
import { genId } from '../item-utils.js';

function rowToEvent(row: any): AnnualEvent {
  return {
    id: row.id,
    title: row.name,
    type: row.type,
    month: row.month,
    day: row.day,
    lunarDate: row.is_lunar || false,
    note: row.note || undefined,
    createdAt: row.created_at,
  };
}

export async function listEvents(params?: {
  month?: number;
  upcomingDays?: number;
}): Promise<AnnualEvent[]> {
  const supabase = getSupabase();
  let query = supabase.from('annual_events').select('*');

  if (params?.month) {
    query = query.eq('month', params.month);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let events = data.map(rowToEvent);

  if (params?.upcomingDays) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    events = events.filter(event => {
      let nextDate = new Date(today.getFullYear(), event.month - 1, event.day);
      if (nextDate < today) {
        nextDate = new Date(today.getFullYear() + 1, event.month - 1, event.day);
      }
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= params.upcomingDays!;
    });

    events.sort((a, b) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const getNext = (e: AnnualEvent) => {
        let d = new Date(today.getFullYear(), e.month - 1, e.day);
        if (d < today) d = new Date(today.getFullYear() + 1, e.month - 1, e.day);
        return d.getTime();
      };
      return getNext(a) - getNext(b);
    });
  }

  return events;
}

export async function addEvent(params: {
  title: string;
  type: AnnualEventType;
  month: number;
  day: number;
  lunarDate?: boolean;
  note?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const supabase = getSupabase();
    const id = genId();

    const { error } = await supabase
      .from('annual_events')
      .upsert({
        id,
        name: params.title,
        type: params.type,
        month: params.month,
        day: params.day,
        is_lunar: params.lunarDate || false,
        note: params.note || null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    return { success: !error, eventId: id, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
