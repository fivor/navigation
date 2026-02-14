'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [query, setQuery] = useState(initialSearch);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only update URL if it changed
    if (debouncedQuery !== initialSearch) {
       if (debouncedQuery) {
         router.push(`/?search=${encodeURIComponent(debouncedQuery)}`);
       } else {
         router.push('/');
       }
    }
  }, [debouncedQuery, router, initialSearch]);

  // Shortcut key Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      if(query) {
         // Open Google/Bing search in new tab if requested explicitly?
         // Requirement says "Integrate mainstream search engines".
         // Maybe just buttons below or simple Enter key logic if no local results?
         // For now, let's keep it simple: filter local is priority.
         // We can add "Search Google for X" links below results if we want.
      }
  }
  
  const searchEngines = [
      { name: 'Google', url: 'https://www.google.com/search?q=' },
      { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  ];

  return (
    <div className="relative w-full group">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder=""
          className="w-full pl-9 pr-9 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-gray-900 dark:text-gray-100 transition-all h-10 placeholder-gray-500"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* External Search Engine Suggestions */}
      {query && (
         <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 p-2 z-50 hidden group-focus-within:block">
             <div className="text-xs text-gray-400 px-2 py-1 mb-1">使用外部引擎搜索</div>
             <div className="flex gap-2">
                 {searchEngines.map(engine => (
                     <a 
                        key={engine.name}
                        href={`${engine.url}${encodeURIComponent(query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-center text-sm text-gray-700 dark:text-gray-200 transition-colors flex items-center justify-center gap-2"
                     >
                         <Search className="w-3 h-3" />
                         {engine.name}
                     </a>
                 ))}
             </div>
         </div>
      )}
    </div>
  );
}
