'use client';

import { useRef, useEffect } from 'react';
import { COLORS } from '../types/plan';

interface ColorMenuProps {
  onSelect: (color: string) => void;
  onClose: () => void;
}

export function ColorMenu({ onSelect, onClose }: ColorMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border shadow-lg rounded-lg p-2 flex gap-1"
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="색상 선택"
    >
      {COLORS.map((color) => (
        <button
          key={color}
          role="menuitem"
          aria-label={`색상 선택: ${color}`}
          className={`w-6 h-6 rounded-full border-2 border-gray-300 hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${color}`}
          onClick={() => {
            onSelect(color);
            onClose();
          }}
        />
      ))}
    </div>
  );
}
