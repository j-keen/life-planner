'use client';

import { useState, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// 아이템 추가 입력 컴포넌트 (간소화)
// ═══════════════════════════════════════════════════════════════
export function AddItemInput({
  onAdd,
  placeholder,
}: {
  onAdd: (content: string, count?: number) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;

    // "운동 / 3" 형식 파싱
    const match = value.match(/^(.+?)\s*\/\s*(\d+)$/);
    if (match) {
      onAdd(match[1].trim(), parseInt(match[2]));
    } else {
      onAdd(value.trim());
    }
    setValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="done"
        className="w-full px-2 py-1 text-xs bg-transparent border-b border-dashed border-gray-200 focus:outline-none focus:border-gray-400 placeholder-gray-300"
      />
    </form>
  );
}
