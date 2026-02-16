'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { IconRenderer, IconsMap } from './IconRenderer';

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const icons = Object.keys(IconsMap).filter(icon => 
    icon.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <Button 
          type="button"
          variant="secondary" 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between flex items-center"
        >
          <span className="flex items-center gap-2">
            {value && <IconRenderer iconName={value} className="h-4 w-4" />}
            {value || 'Select icon...'}
          </span>
          <IconRenderer iconName={isOpen ? "ChevronUp" : "ChevronDown"} className="h-4 w-4 opacity-50 ml-2" />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-full min-w-[300px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-lg">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />
          <div className="grid grid-cols-6 gap-2 max-h-[200px] overflow-y-auto">
            {icons.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  value === icon ? 'bg-gray-200 dark:bg-gray-600' : ''
                }`}
                onClick={() => {
                  onChange(icon);
                  setIsOpen(false);
                }}
                title={icon}
              >
                <IconRenderer iconName={icon} className="h-4 w-4" />
              </button>
            ))}
            {icons.length === 0 && (
              <div className="col-span-6 py-4 text-center text-sm text-gray-500">
                No icons found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
