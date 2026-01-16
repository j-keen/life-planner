'use client';

import { useEffect, useState } from 'react';
import { initializeFromCloud } from '../store/usePlanStore';

export function CloudInitializer({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        initializeFromCloud().then(() => {
            setIsReady(true);
        });
    }, []);

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" role="status" aria-label="로딩 중">
                <div className="text-center">
                    <div className="animate-spin motion-reduce:animate-none rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" aria-hidden="true"></div>
                    <p className="text-gray-600">데이터 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
