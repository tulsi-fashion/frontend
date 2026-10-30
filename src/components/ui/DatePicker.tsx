'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD or ''
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean; // default true
  className?: string; // wrapper
  compact?: boolean; // smaller trigger for toolbars
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const EXIT_MS = 160;
const PANEL_W = 292;
const PANEL_H = 360;

const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
const todayStr = () => { const t = new Date(); return toStr(t.getFullYear(), t.getMonth(), t.getDate()); };
const pretty = (s: string) => {
  const p = parse(s);
  return p ? `${pad(p.d)} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '';
};

/** Custom date picker: animated calendar popup (portal), month/year quick jump, Today and Clear. */
export default function DatePicker({
  value, onChange, placeholder = 'Select date', min, max, disabled, clearable = true, className = '', compact,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<{ y: number; m: number }>({ y: 0, m: 0 });
  const [mode, setMode] = useState<'days' | 'months'>('days');
  const [dir, setDir] = useState<'next' | 'prev' | ''>('');
  const [pos, setPos] = useState({ left: 0, top: 0, up: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const sel = parse(value);
  const today = todayStr();

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < PANEL_H + 20 && r.top > below;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8));
    setPos({ left, top: up ? r.top : r.bottom, up });
  }

  function show() {
    if (disabled) return;
    const base = sel ?? parse(today)!;
    setView({ y: base.y, m: base.m });
    setMode('days');
    setDir('');
    place();
    setMounted(true);
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setTimeout(() => setMounted(false), EXIT_MS);
  }

  useLayoutEffect(() => {
    if (!mounted) return;
    const onMove = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      hide();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); hide(); } };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc, true);
    };
  }, [mounted]);

  // clear the slide direction once the animation has played
  useEffect(() => {
    if (!dir) return;
    const t = setTimeout(() => setDir(''), 260);
    return () => clearTimeout(t);
  }, [dir, view]);

  function step(delta: number) {
    setDir(delta > 0 ? 'next' : 'prev');
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const disabledDay = (s: string) => (min ? s < min : false) || (max ? s > max : false);

  function pickDay(s: string) {
    if (disabledDay(s)) return;
    onChange(s);
    hide();
  }

  // 6 weeks grid
  const first = new Date(view.y, view.m, 1).getDay();
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const prevDim = new Date(view.y, view.m, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const n = i - first + 1;
    if (n < 1) { const d = new Date(view.y, view.m - 1, prevDim + n); return { s: toStr(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), out: true }; }
    if (n > dim) { const d = new Date(view.y, view.m + 1, n - dim); return { s: toStr(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), out: true }; }
    return { s: toStr(view.y, view.m, n), day: n, out: false };
  });

  const years = Array.from({ length: 12 }, (_, i) => view.y - 5 + i);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          onClick={() => (open ? hide() : show())}
          className={`w-full flex items-center gap-2 rounded-lg border bg-white text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] disabled:opacity-60 disabled:cursor-not-allowed ${
            compact ? 'px-3 py-2 text-sm' : 'px-3 py-2.5 text-sm'
          } ${open ? 'border-[#237a59] ring-2 ring-[#237a59]/25' : 'border-[#e5e9f0] hover:border-[#c9d1de]'}`}
        >
          <CalendarDays className={`w-4 h-4 flex-shrink-0 transition-colors ${open || sel ? 'text-[#237a59]' : 'text-[#98a2b6]'}`} />
          <span className={`flex-1 truncate ${sel ? 'text-[#20283b]' : 'text-[#98a2b6]'}`}>{sel ? pretty(value) : placeholder}</span>
        </button>
        {clearable && sel && !disabled && (
          <button
            type="button"
            title="Clear"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#98a2b6] hover:bg-[#fff0f1] hover:text-[#b32642] transition-colors tf-fade-in"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {mounted && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed', left: pos.left, width: PANEL_W, zIndex: 100,
            ...(pos.up ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }),
          }}
          className={`rounded-2xl bg-white border border-[#e5e9f0] shadow-xl shadow-black/10 p-3 ${
            open ? (pos.up ? 'tf-drop-up-in' : 'tf-drop-in') : (pos.up ? 'tf-drop-up-out' : 'tf-drop-out')
          }`}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => (mode === 'days' ? step(-1) : setView(v => ({ ...v, y: v.y - 12 })))} className="p-1.5 rounded-lg text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b] active:scale-90 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMode(m => (m === 'days' ? 'months' : 'days'))}
              className="px-3 py-1 rounded-lg text-sm font-bold text-[#20283b] hover:bg-[#f1f3f7] transition-colors"
            >
              {mode === 'days' ? `${MONTHS[view.m]} ${view.y}` : `${years[0]} - ${years[years.length - 1]}`}
            </button>
            <button type="button" onClick={() => (mode === 'days' ? step(1) : setView(v => ({ ...v, y: v.y + 12 })))} className="p-1.5 rounded-lg text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b] active:scale-90 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {mode === 'days' ? (
            <div key={`${view.y}-${view.m}`} className={dir === 'next' ? 'tf-slide-next' : dir === 'prev' ? 'tf-slide-prev' : ''}>
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => <span key={d} className="text-center text-[11px] font-bold text-[#98a2b6] py-1">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map(c => {
                  const isSel = c.s === value;
                  const isToday = c.s === today;
                  const off = disabledDay(c.s);
                  return (
                    <button
                      key={c.s}
                      type="button"
                      disabled={off}
                      onClick={() => pickDay(c.s)}
                      className={`h-9 w-9 mx-auto rounded-full text-sm transition-all duration-150 ${
                        isSel
                          ? 'bg-[#237a59] text-white font-bold shadow-md shadow-[#237a59]/30 scale-105'
                          : off
                            ? 'text-[#d3d9e4] cursor-not-allowed'
                            : `hover:bg-[#e6f5eb] hover:text-[#237a59] active:scale-90 ${c.out ? 'text-[#b6bece]' : 'text-[#20283b]'} ${isToday ? 'ring-1 ring-[#237a59] font-bold text-[#237a59]' : ''}`
                      }`}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="tf-fade-in space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setView(v => ({ ...v, m: i })); setMode('days'); }}
                    className={`py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      i === view.m ? 'bg-[#237a59] text-white' : 'text-[#20283b] hover:bg-[#e6f5eb] hover:text-[#237a59]'
                    }`}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#eef1f6]">
                {years.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setView(v => ({ ...v, y }))}
                    className={`py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      y === view.y ? 'bg-[#237a59] text-white' : 'text-[#20283b] hover:bg-[#e6f5eb] hover:text-[#237a59]'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#eef1f6]">
            <button
              type="button"
              disabled={disabledDay(today)}
              onClick={() => pickDay(today)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#237a59] bg-[#e6f5eb] hover:bg-[#d3eddc] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Today
            </button>
            {clearable && (
              <button
                type="button"
                disabled={!sel}
                onClick={() => { onChange(''); hide(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#798397] hover:bg-[#fff0f1] hover:text-[#b32642] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
