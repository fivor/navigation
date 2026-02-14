'use client';
import { Category } from '@/types';
import * as LucideIcons from 'lucide-react';

interface Props {
  categories: Category[];
  hasRecommended: boolean;
}

const IconRenderer = ({ iconName, className }: { iconName: string | null; className?: string }) => {
  if (!iconName) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (LucideIcons as any)[iconName];
  if (!IconComponent) return null;
  return <IconComponent className={className} />;
};

export function CategoryNav({ categories, hasRecommended }: Props) {
  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, selector: string) => {
    e.preventDefault();
    const target = document.querySelector(selector) as HTMLElement | null;
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
  };

  return (
    <nav className="space-y-1">
      {hasRecommended && (
        <a
          href="#recommended"
          onClick={(e) => handleScrollTo(e, '#recommended')}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#2a2a2a] hover:text-white transition-all group"
        >
          <LucideIcons.Star className="w-4 h-4 text-gray-500 group-hover:text-yellow-400 transition-colors" />
          常用推荐
        </a>
      )}
      {categories.map((category) => (
        <a
          key={category.id}
          href={`#category-${category.id}`}
          onClick={(e) => handleScrollTo(e, `#category-${category.id}`)}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#2a2a2a] hover:text-white transition-all group"
        >
          <IconRenderer iconName={category.icon} className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
          {category.name}
        </a>
      ))}
    </nav>
  );
}
