# Supabase 자동 동기화 구현 계획

## 목표

Life Planner 앱에서 Supabase 클라우드 동기화를 완전히 활성화하여, 회사/집 등 **다른 기기에서도 동일한 데이터**를 사용할 수 있게 한다.

---

## 구현 범위

### 1단계: Supabase 테이블 생성

- Supabase 대시보드에서 SQL 스키마 실행
- 테이블 생성 확인

### 2단계: 자동 동기화 로직 구현

- 앱 시작 시 클라우드에서 데이터 자동 로드
- 데이터 변경 시 자동으로 클라우드에 저장 (debounce 적용)
- 오프라인 모드 지원 (네트워크 끊김 시 로컬 저장)

### 3단계: 연간 기념일(Annual Events) 동기화 추가

- 현재 `sync.ts`에 누락된 `annualEvents` 동기화 로직 추가
- 스키마에 `annual_events` 테이블 추가

### 4단계: UI 개선

- 동기화 상태 실시간 표시 (동기화 중, 완료, 오류)
- 자동 동기화 On/Off 토글 추가

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `supabase-schema.sql` | `annual_events` 테이블 추가 |
| `src/lib/sync.ts` | `annualEvents` CRUD 함수 추가, 자동 동기화 로직 |
| `src/store/usePlanStore.ts` | 상태 변경 시 자동 동기화 트리거 |
| `src/components/CloudSync.tsx` | 자동 동기화 상태 표시, 토글 UI |
| `src/app/layout.tsx` 또는 `page.tsx` | 앱 시작 시 초기 데이터 로드 호출 |

---

## 구현 단계

### Step 1: Supabase 테이블 생성 (수동)

1. Supabase 대시보드 접속
2. SQL Editor에서 `supabase-schema.sql` 내용 실행
3. 테이블 생성 확인 (periods, records, settings)

### Step 2: annual_events 스키마 추가

```sql
CREATE TABLE IF NOT EXISTS annual_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  type TEXT NOT NULL,
  emoji TEXT,
  note TEXT,
  is_lunar BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Step 3: sync.ts에 자동 동기화 함수 추가

- `saveAnnualEventToCloud()` / `loadAnnualEventsFromCloud()` 추가
- `autoSyncToCloud()` 함수 (debounce 300ms)
- `initSyncFromCloud()` 함수 (앱 시작 시 호출)

### Step 4: usePlanStore.ts 수정

- Zustand persist `onRehydrateStorage` 콜백에서 클라우드 동기화 초기화
- 상태 변경 구독 → 자동 저장 트리거

### Step 5: CloudSync.tsx 개선

- 동기화 상태 아이콘 (동기화 중 = 회전, 완료 = 체크, 오류 = 빨간색)
- 마지막 동기화 시간 표시
- 수동 새로고침 버튼

---

## 예상 리스크

| 리스크 | 대응 방안 |
|--------|----------|
| 네트워크 오류 시 데이터 손실 | 로컬 스토리지를 primary로 유지, 클라우드는 백업 |
| 동기화 충돌 (회사/집 동시 수정) | 최신 `updated_at` 기준 병합 또는 경고 표시 |
| Supabase 무료 티어 제한 | 동기화 빈도 조절 (debounce 적용) |
| RLS(Row Level Security) 미설정 | 개인 사용이므로 비활성화 유지, 필요시 추후 추가 |

---

## 완료 기준

- [ ] Supabase에 테이블(periods, records, settings, annual_events)이 생성됨
- [ ] 앱 시작 시 클라우드에서 데이터 자동 로드
- [ ] 데이터 변경 시 300ms debounce 후 자동 저장
- [ ] 다른 기기(회사/집)에서 동일한 데이터 확인 가능
- [ ] 네트워크 오류 시에도 로컬 저장 정상 작동
- [ ] CloudSync 컴포넌트에 동기화 상태 표시

---

## 검증 계획

### 자동 테스트

- 현재 프로젝트에 테스트 파일이 없으므로 수동 테스트로 대체

### 수동 테스트

1. **테이블 생성 확인**
   - Supabase 대시보드 → Table Editor에서 4개 테이블 존재 확인

2. **초기 로드 테스트**
   - `npm run dev`로 앱 실행
   - 브라우저 콘솔에서 "Cloud sync initialized" 로그 확인
   - Supabase에 저장된 데이터가 앱에 표시되는지 확인

3. **자동 저장 테스트**
   - 앱에서 새 Todo 항목 추가
   - 3초 후 Supabase Table Editor에서 해당 데이터 확인

4. **다중 기기 테스트**
   - 기기 A에서 데이터 추가
   - 기기 B에서 앱 새로고침 후 동일 데이터 확인

5. **오프라인 테스트**
   - 브라우저 개발자 도구에서 네트워크 끊기
   - 데이터 추가 → 로컬 저장 확인 (페이지 새로고침해도 유지)
   - 네트워크 복구 후 자동 동기화 확인

---

## 🔍 클로드 코드 검증 결과

- 검증 일시: 2026-01-14
- 검증 대상: v1 (초기 계획)

### 판정: ⚠️ 조건부 승인

### ✅ 승인 항목

- **목표 명확성**: 다중 기기 동기화라는 목표가 구체적이고 명확함
- **구현 범위**: 4단계로 나눈 점진적 구현 전략이 적절함
- **수정 대상 파일**: 영향 범위가 명확하게 정의됨
- **리스크 분석**: 네트워크 오류, 충돌, 무료 티어 제한 등 주요 리스크 식별됨
- **검증 계획**: 수동 테스트 시나리오가 구체적임

### ⚠️ 보완 필요

1. **충돌 해결 전략 구체화 필요**
   - "최신 `updated_at` 기준 병합"만으로는 부족
   - 동일 시간대 수정 시 어떻게 처리할지 명시 필요
   - 권장: Last-Write-Wins 또는 사용자에게 선택권 부여

2. **debounce 시간 불일치**
   - Step 3에서 "debounce 300ms"
   - 자동 저장 테스트에서 "3초 후" 확인
   - 일관된 시간 명시 필요 (300ms vs 3000ms?)

3. **`routines` 테이블 누락**
   - `usePlanStore.ts`에 `routines` 데이터 존재
   - 스키마에 `routines` 테이블 추가 필요

### ❌ 반드시 수정

- 없음

### 💡 권장 사항

1. **네트워크 복구 시 동기화 큐 구현**
   - 오프라인 중 변경사항을 큐에 저장
   - 복구 시 순차적으로 업로드

2. **동기화 버전 관리**
   - 클라우드/로컬 데이터 버전 비교 로직 추가
   - 불필요한 네트워크 요청 방지

3. **에러 재시도 로직**
   - 일시적 네트워크 오류 시 exponential backoff 적용

---

🔍 검증 결과: ⚠️ 조건부 승인
📁 피드백 위치: docs/workplans/20260114_supabase_auto_sync_plan.md 하단

👉 다음 행동:

- debounce 시간 통일 및 충돌 전략 구체화 후 구현 진행
- 또는 현재 계획으로 1차 구현 후 이슈 발생 시 개선

---

## 📌 v2 (수정본)

- 수정 일시: 2026-01-14 01:12
- 수정 사유: 클로드 코드 피드백 반영

### 변경 내용

#### 1. 충돌 해결 전략 구체화

**채택 전략: Last-Write-Wins (LWW)**

- 각 Period/Record의 `updated_at` 타임스탬프 비교
- 클라우드 데이터가 로컬보다 최신이면 → 클라우드 데이터로 덮어쓰기
- 로컬 데이터가 클라우드보다 최신이면 → 로컬 데이터를 클라우드에 업로드
- **동일 시간대(±1초 이내) 수정 시**: 로컬 데이터 우선 (사용자가 마지막으로 작업한 기기 우선)

**이유**: 개인용 앱이므로 복잡한 병합 UI보다 단순한 LWW가 적합

#### 2. debounce 시간 통일

- **적용 시간: 2000ms (2초)**
- 선정 이유:
  - 300ms는 너무 짧아서 네트워크 요청이 과도하게 발생
  - 사용자가 연속 입력 중에는 저장하지 않고, 입력 멈춤 후 2초 뒤 자동 저장
- 검증 테스트 시간도 "2초 후"로 수정

#### 3. routines 테이블 관련

**현재 스키마 확인 결과**: `routines`는 별도 테이블 불필요

- `supabase-schema.sql`의 `periods` 테이블에 이미 `routines JSONB DEFAULT '[]'` 컬럼 존재
- routines 데이터는 Period 내부에 포함되어 저장됨
- **추가 작업 불필요** (기존 스키마 유지)

### 이전 버전과의 차이

| 항목 | v1 | v2 |
|------|-----|-----|
| 충돌 전략 | "최신 updated_at 기준 병합" | Last-Write-Wins, 동시 수정 시 로컬 우선 |
| debounce | 300ms (Step 3) / 3초 (테스트) | 2000ms로 통일 |
| routines 테이블 | 언급 없음 | periods 테이블에 포함됨 확인 |

### 수정된 구현 단계 (Step 3 업데이트)

**Step 3: sync.ts에 자동 동기화 함수 추가** (수정)

- `saveAnnualEventToCloud()` / `loadAnnualEventsFromCloud()` 추가
- `autoSyncToCloud()` 함수 (**debounce 2000ms**)
- `initSyncFromCloud()` 함수 (앱 시작 시 호출)
- **충돌 해결 로직**: `updated_at` 비교 → LWW 적용

### 수정된 검증 계획

**3. 자동 저장 테스트** (수정)

- 앱에서 새 Todo 항목 추가
- **2초 후** Supabase Table Editor에서 해당 데이터 확인

---

## 🔍 클로드 코드 검증 결과 (v2)

- 검증 일시: 2026-01-14 01:15
- 검증 대상: v2 (수정본)

### 판정: ✅ 승인

### ✅ 승인 항목

- **충돌 해결 전략**: Last-Write-Wins 전략이 명확하게 정의됨
  - 타임스탬프 비교 로직 구체화
  - 동일 시간대(±1초) 처리 방안 명시
  - 개인용 앱 특성에 맞는 단순한 접근
- **debounce 시간 통일**: 2000ms로 일관성 확보
  - 선정 이유가 합리적 (과도한 요청 방지 + UX)
  - 검증 테스트 시간도 동기화됨
- **routines 테이블 해명**: 기존 스키마 분석 결과 반영
  - periods 테이블 내 JSONB로 이미 포함됨 확인
  - 불필요한 테이블 추가 방지

### ⚠️ 보완 필요

- 없음

### ❌ 반드시 수정

- 없음

### 💡 권장 사항 (구현 시 참고)

1. **v1 완료 기준 문서 내 불일치 정리**
   - 104번 줄: "300ms debounce" → 이제 2000ms가 정답
   - 구현 시 v2 기준으로 진행

2. **초기 로드 시 충돌 감지 로깅**
   - 클라우드 vs 로컬 데이터 불일치 시 콘솔 로그 출력
   - 디버깅 편의성 향상

---

🔍 검증 결과: ✅ 승인
📁 피드백 위치: docs/workplans/20260114_supabase_auto_sync_plan.md 하단

👉 다음 행동: 안티그래비티에게 v2 계획대로 코드 작성을 요청하세요.

---

## 🔍 클로드 코드 코드 검증 결과

- 검증 일시: 2026-01-14 01:20
- 검증 기준: v2 계획

### 판정: ✅ 승인

### ✅ 구현 완료 항목

| 계획 항목 | 구현 상태 | 위치 |
|----------|----------|------|
| **Step 1: Supabase 테이블** | ✅ 완료 | `supabase-schema.sql` |
| **Step 2: annual_events 스키마** | ✅ 완료 | `supabase-schema.sql:46-56` |
| **Step 3: sync.ts 자동 동기화** | ✅ 완료 | `src/lib/sync.ts` |
| - `saveAnnualEventToCloud()` | ✅ 구현됨 | `sync.ts:197-227` |
| - `loadAnnualEventsFromCloud()` | ✅ 구현됨 | `sync.ts:252-282` |
| - `autoSyncToCloud()` (debounce 2000ms) | ✅ 구현됨 | `sync.ts:363-379` |
| - `initSyncFromCloud()` (LWW) | ✅ 구현됨 | `sync.ts:385-452` |
| **Step 4: usePlanStore.ts 수정** | ✅ 완료 | `usePlanStore.ts` |
| - `onRehydrateStorage` 콜백 | ✅ 구현됨 | `usePlanStore.ts:2071-2092` |
| - 상태 변경 구독 → 자동 저장 | ✅ 구현됨 | `usePlanStore.ts:2101-2135` |
| **Step 5: CloudSync.tsx 개선** | ✅ 완료 | `src/components/CloudSync.tsx` |
| - 동기화 상태 아이콘 (회전/체크/빨강) | ✅ 구현됨 | `CloudSync.tsx:49-77` |
| - 마지막 동기화 시간 표시 | ✅ 구현됨 | `CloudSync.tsx:82` |
| - 수동 새로고침 버튼 | ✅ 구현됨 | `CloudSync.tsx:119-129` |

### ✅ v2 핵심 요구사항 충족 확인

| 요구사항 | 구현 상태 | 확인 위치 |
|---------|----------|----------|
| **debounce 2000ms** | ✅ 정확히 구현 | `sync.ts:378` - `}, 2000);` |
| **LWW 충돌 해결** | ✅ 구현됨 | `sync.ts:412-424` - 로컬 우선 병합 |
| **routines 별도 테이블 불필요** | ✅ 확인됨 | `supabase-schema.sql:15` - periods 내 JSONB |

### ⚠️ 보완 필요

- 없음

### ❌ 반드시 수정

- 없음

### 💡 개선 권장 사항 (선택)

1. **동기화 토글 UI 미구현**
   - 계획의 "자동 동기화 On/Off 토글" 미구현
   - 현재는 Supabase 설정 시 자동 활성화
   - 필요시 추후 구현 가능

2. **오프라인 감지 강화**
   - 현재 try-catch로 오류 처리
   - `navigator.onLine` 체크 추가 권장

---

🔍 검증 결과: ✅ 승인
📁 피드백 위치: docs/workplans/20260114_supabase_auto_sync_plan.md 하단

👉 다음 행동: 수동 테스트 진행 (테이블 생성 확인, 초기 로드, 자동 저장, 다중 기기, 오프라인)
