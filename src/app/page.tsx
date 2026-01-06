"use client";

import { Shell } from '@/components/layout/Shell';
import FractalView from '@/views/FractalView';
import { RecordView } from '@/views/RecordView';
import { usePlanStore } from '@/store/usePlanStore';

export default function Home() {
  const viewMode = usePlanStore((state) => state.viewMode);

  return (
    <Shell>
      {viewMode === 'plan' ? <FractalView /> : <RecordView />}
    </Shell>
  );
}
