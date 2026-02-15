'use client';

import { useTheme } from 'next-themes';
import { IconRenderer } from '@/components/ui/IconRenderer';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />; // Placeholder to avoid layout shift
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label="切换主题"
    >
      {theme === 'dark' ? <IconRenderer iconName="Sun" className="w-5 h-5" /> : <IconRenderer iconName="Moon" className="w-5 h-5" />}
    </button>
  );
}
