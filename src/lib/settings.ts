import { getSupabase } from './supabase';

// 앱 설정 인터페이스
export interface AppSettings {
  geminiApiKey?: string;
}

const SETTINGS_STORAGE_KEY = 'life-planner-settings';

// 설정 저장 (Supabase + localStorage 백업)
export async function saveSettings(settings: AppSettings): Promise<boolean> {
  const supabase = getSupabase();

  // localStorage에 백업
  try {
    const existing = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const merged = { ...(existing ? JSON.parse(existing) : {}), ...settings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
  }

  // Supabase가 설정되어 있으면 DB에도 저장
  if (supabase) {
    try {
      if (settings.geminiApiKey !== undefined) {
        const { error } = await supabase.from('settings').upsert(
          {
            key: 'gemini_api_key',
            value: { apiKey: settings.geminiApiKey },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

        if (error) {
          console.error('Failed to save API key to Supabase:', error);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Settings save error:', error);
      return false;
    }
  }

  return true;
}

// 설정 로드 (Supabase 우선, localStorage 백업)
export async function loadSettings(): Promise<AppSettings> {
  const supabase = getSupabase();

  // localStorage에서 기본값 로드
  let localSettings: AppSettings = {};
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      localSettings = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e);
  }

  // Supabase가 설정되어 있으면 DB에서 로드 (우선)
  if (supabase) {
    try {
      const { data, error } = await supabase.from('settings').select('*');

      if (error) {
        console.error('Failed to load settings from Supabase:', error);
        return localSettings;
      }

      if (data) {
        const settings: AppSettings = { ...localSettings };

        for (const row of data) {
          if (row.key === 'gemini_api_key' && row.value?.apiKey) {
            settings.geminiApiKey = row.value.apiKey;
          }
        }

        // localStorage 동기화
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

        return settings;
      }
    } catch (error) {
      console.error('Settings load error:', error);
    }
  }

  return localSettings;
}

let cachedApiKey: string | null = null;

// API 키 캐시 초기화
export function clearApiKeyCache(): void {
  cachedApiKey = null;
}

// API 키 저장 및 캐시 업데이트
export async function setGeminiApiKey(apiKey: string): Promise<boolean> {
  const success = await saveSettings({ geminiApiKey: apiKey });
  if (success) {
    cachedApiKey = apiKey;
  }
  return success;
}
