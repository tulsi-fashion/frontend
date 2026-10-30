'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, SearchX, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

const EXIT_MS = 160;
const MAX_H = 280;

export default function MultiSelect({
  values, onChange, options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled, className = '',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, up: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < MAX_H + 60 && r.top > below;
    setPos({ left: r.left, width: r.width, top: up ? r.top : r.bottom, up });
  }

  function show() {
    if (disabled) return;
    place();
    setQuery('');
    setActive(0);
    setMounted(true);
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setTimeout(() => setMounted(false), EXIT_MS);
  }

  function toggle(o: MultiSelectOption) {
    const next = values.includes(o.value)
      ? values.filter(v => v !== o.value)
      : [...values, o.value];
    onChange(next);
  }

  useLayoutEffect(() => {
    if (!mounted) return;
    const onMove = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      hide();
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [mounted]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, filtered]);

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) toggle(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); btnRef.current?.focus(); }
    else if (e.key === 'Tab') hide();
  }

  const label = values.length === 0
    ? null
    : values.length === 1
      ? (options.find(o => o.value === values[0])?.label ?? null)
      : `${values.length} selected`;

  return (
    <div className={`relative ${className}`} onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? hide() : show())}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-white text-sm text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] disabled:opacity-60 disabled:cursor-not-allowed ${
          open ? 'border-[#237a59] ring-2 ring-[#237a59]/25' : 'border-[#e5e9f0] hover:border-[#c9d1de]'
        }`}
      >
        <span className={`truncate flex-1 ${label ? 'text-[#20283b] font-medium' : 'text-[#98a2b6]'}`}>
          {label ?? placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {values.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
              className="p-0.5 rounded hover:bg-[#f0f2f5] text-[#98a2b6] hover:text-[#20283b] transition-colors"
              title="Clear"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-[#798397] transition-transform duration-300 ${open ? 'rotate-180 text-[#237a59]' : ''}`} />
        </span>
      </button>

      {mounted && createPortal(
        <div
          ref={panelRef}
          onKeyDown={onKey}
          style={{
            position: 'fixed', left: pos.left, width: pos.width, zIndex: 100,
            ...(pos.up ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }),
          }}
          className={`rounded-xl bg-white border border-[#e5e9f0] shadow-xl shadow-black/10 overflow-hidden ${
            open ? (pos.up ? 'tf-drop-up-in' : 'tf-drop-in') : (pos.up ? 'tf-drop-up-out' : 'tf-drop-out')
          }`}
        >
          <div className="relative p-2 border-b border-[#eef1f6]">
            <Search className="w-4 h-4 text-[#98a2b6] absolute left-5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActive(0); }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#f5f7fb] text-sm text-[#20283b] placeholder:text-[#98a2b6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/20"
            />
          </div>
          <div ref={listRef} role="listbox" aria-multiselectable="true" style={{ maxHeight: MAX_H }} className="overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-[#98a2b6]">
                <SearchX className="w-5 h-5" />
                <span className="text-xs font-medium">No results</span>
              </div>
            ) : filtered.map((o, i) => {
              const isSel = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  data-i={i}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => toggle(o)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors duration-150 ${
                    i === active ? 'bg-[#eef6f2]' : ''
                  } ${isSel ? 'text-[#237a59] font-semibold' : 'text-[#20283b]'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="w-4 h-4 text-[#237a59] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          {values.length > 0 && (
            <div className="p-2 border-t border-[#eef1f6]">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full py-1.5 text-xs font-semibold text-[#b32642] hover:bg-[#fff0f1] rounded-lg transition-colors"
              >
                Clear all ({values.length})
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
