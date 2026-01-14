"use client";

import { Shell } from '@/components/layout/Shell';
import { DashboardView } from '@/views/DashboardView';

export default function Home() {
  return (
    <Shell>
      <DashboardView />
    </Shell>
  );
}
