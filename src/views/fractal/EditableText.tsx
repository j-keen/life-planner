'use client';

import { useState, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// 편집 가능한 텍스트
// ═══════════════════════════════════════════════════════════════
export function EditableText({
  value,
  onSave,
  className = '',
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          setIsEditing(false);
          if (localValue !== value) {
            onSave(localValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setIsEditing(false);
            onSave(localValue);
          }
          if (e.key === 'Escape') {
            setIsEditing(false);
            setLocalValue(value);
          }
        }}
        className={`w-full px-1 border-b-2 border-blue-500 outline-none bg-transparent ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`cursor-text hover:bg-gray-100 rounded px-1 block overflow-hidden text-ellipsis whitespace-nowrap ${className}`}
    >
      {value || <span className="text-gray-400">클릭하여 편집...</span>}
    </span>
  );
}
