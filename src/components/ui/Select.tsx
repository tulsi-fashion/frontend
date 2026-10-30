'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, SearchX } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string; // small grey text on the right
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string; // applied to the trigger wrapper
  searchable?: boolean; // default true
}

const EXIT_MS = 160;
const MAX_H = 280;

/** Custom dropdown with search, keyboard support and animated open/close. Rendered in a portal so modals never clip it. */
export default function Select({
  value, onChange, options, placeholder = 'Select...', searchPlaceholder = 'Search...',
  disabled, className = '', searchable = true,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, up: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options;
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
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    setMounted(true);
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setTimeout(() => setMounted(false), EXIT_MS);
  }

  function pick(o: SelectOption) {
    onChange(o.value);
    hide();
    btnRef.current?.focus();
  }

  // keep the panel glued to the trigger, close on outside click
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
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open, searchable]);

  // keep the highlighted option in view
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
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); btnRef.current?.focus(); }
    else if (e.key === 'Tab') hide();
  }

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
        <span className={`truncate ${selected ? 'text-[#20283b]' : 'text-[#98a2b6]'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[#798397] transition-transform duration-300 ${open ? 'rotate-180 text-[#237a59]' : ''}`} />
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
          {searchable && (
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
          )}
          <div ref={listRef} role="listbox" style={{ maxHeight: MAX_H }} className="overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-[#98a2b6]">
                <SearchX className="w-5 h-5" />
                <span className="text-xs font-medium">No results</span>
              </div>
            ) : filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value + i}
                  data-i={i}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors duration-150 ${
                    i === active ? 'bg-[#eef6f2]' : ''
                  } ${isSel ? 'text-[#237a59] font-semibold' : 'text-[#20283b]'}`}
                >
                  <span className="truncate">{o.label}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {o.hint && <span className="text-xs text-[#98a2b6]">{o.hint}</span>}
                    {isSel && <Check className="w-4 h-4 text-[#237a59]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
