-- ═══════════════════════════════════════════════════════════════
-- Life Planner - Supabase Database Schema
-- ═══════════════════════════════════════════════════════════════

-- Periods 테이블 (계획 데이터)
CREATE TABLE IF NOT EXISTS periods (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  goal TEXT DEFAULT '',
  motto TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  todos JSONB DEFAULT '[]',
  routines JSONB DEFAULT '[]',
  slots JSONB DEFAULT '{}',
  time_slots JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Records 테이블 (기록 데이터)
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL UNIQUE,
  content TEXT DEFAULT '',
  mood TEXT,
  highlights JSONB DEFAULT '[]',
  gratitude JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings 테이블 (설정)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_periods_level ON periods(level);
CREATE INDEX IF NOT EXISTS idx_records_period_id ON records(period_id);
CREATE INDEX IF NOT EXISTS idx_periods_updated ON periods(updated_at);
CREATE INDEX IF NOT EXISTS idx_records_updated ON records(updated_at);

-- RLS (Row Level Security) 비활성화 (개인용이므로)
-- 만약 RLS를 사용하려면 아래 주석을 해제하고 정책을 추가하세요
-- ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 접근 허용 (익명 키 사용 시)
-- CREATE POLICY "Allow all" ON periods FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON records FOR ALL USING (true);
