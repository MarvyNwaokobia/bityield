'use client';

import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  label: string;
}

/**
 * "On this page" table of contents with scroll-spy: highlights the section
 * currently in view (via IntersectionObserver) and smooth-scrolls on click.
 */
export function DocsToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Of the sections intersecting the top reading band, highlight the
        // topmost one.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      // Band sits just below the fixed nav and covers the upper third of the
      // viewport, so a heading becomes "active" as it scrolls into reading view.
      { rootMargin: '-96px 0px -66% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
    setActiveId(id);
  };

  return (
    <nav className="flex flex-col text-sm border-l border-zinc-800">
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            aria-current={isActive ? 'true' : undefined}
            className={`-ml-px border-l-2 pl-3 py-1.5 transition-colors duration-200 ${
              isActive
                ? 'border-bitcoin text-white font-medium'
                : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
