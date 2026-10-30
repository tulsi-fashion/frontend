'use client';
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Search, Layers, CheckCircle2, PauseCircle, Inbox, Undo2, Archive, X, Loader2, SlidersHorizontal, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { showToast } from './Toast';
import Modal from './Modal';
import Select from './Select';
import DatePicker from './DatePicker';
import TopBar from '../layout/TopBar';

export interface MasterRow {
  id: string;
  name: string;
  slug?: string;
  sort_order?: number;
  is_active: boolean;
  is_deleted?: boolean;
  created_at?: string;
}

interface Props {
  title: string; // "Categories"
  singular: string; // "Category"
  basePath: string; // "/api/categories"
  hasSortOrder?: boolean;
}

type Filter = 'all' | 'active' | 'inactive' | 'deleted';
type Sort = 'default' | 'name_asc' | 'name_desc' | 'newest' | 'oldest';
type Counts = { all: number; active: number; inactive: number; deleted: number };

type RowState = 'active' | 'inactive' | 'deleted';
const stateOf = (r: Pick<MasterRow, 'is_active' | 'is_deleted'>): RowState =>
  r.is_deleted ? 'deleted' : r.is_active ? 'active' : 'inactive';

// move one row between state buckets without refetching
function bump(c: Counts, from: RowState | null, to: RowState | null): Counts {
  const n = { ...c };
  const adj = (s: RowState | null, d: number) => {
    if (!s) return;
    n[s] += d;
    if (s !== 'deleted') n.all += d;
  };
  adj(from, -1);
  adj(to, 1);
  return n;
}

const matchesFilter = (r: MasterRow, f: Filter) => (f === 'all' ? !r.is_deleted : stateOf(r) === f);

function sortRows(list: MasterRow[], sort: Sort, hasSortOrder?: boolean): MasterRow[] {
  const byName = (a: MasterRow, b: MasterRow) => a.name.localeCompare(b.name);
  const time = (r: MasterRow) => (r.created_at ? new Date(r.created_at).getTime() : 0);
  const out = [...list];
  if (sort === 'name_asc') return out.sort(byName);
  if (sort === 'name_desc') return out.sort((a, b) => byName(b, a));
  if (sort === 'newest') return out.sort((a, b) => time(b) - time(a));
  if (sort === 'oldest') return out.sort((a, b) => time(a) - time(b));
  return out.sort((a, b) => (hasSortOrder ? (a.sort_order ?? 0) - (b.sort_order ?? 0) || byName(a, b) : byName(a, b)));
}

// number that eases to its new value
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min((now - t0) / 450, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <>{shown}</>;
}

const input =
  'w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder:text-[#c2cad6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]';
const label = 'block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5';

function Switch({ on, busy, onClick, title }: { on: boolean; busy?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy}
      disabled={busy}
      title={title}
      onClick={onClick}
      className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors duration-300 ease-out ${on ? 'bg-[#237a59]' : 'bg-[#cfd6e2]'} ${busy ? 'cursor-wait' : 'active:scale-95'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${on ? 'translate-x-[18px]' : ''}`}
      >
        {busy && <Loader2 className={`w-3 h-3 animate-spin ${on ? 'text-[#237a59]' : 'text-[#98a2b6]'}`} />}
      </span>
    </button>
  );
}

export default function MasterManager(p: Props) {
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true); // first load / any fetch
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [counts, setCounts] = useState<Counts>({ all: 0, active: 0, inactive: 0, deleted: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [busyId, setBusyId] = useState<string | null>(null); // row-level action loader
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [form, setForm] = useState({ name: '', sort_order: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({}); // switch position while the API call runs
  const [leaving, setLeaving] = useState<Set<string>>(new Set()); // rows animating out
  const [flash, setFlash] = useState<Record<string, 'create' | 'update'>>({}); // rows animating in / updated
  const [fresh, setFresh] = useState(false); // stagger rows right after a fetch
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reqId = useRef(0);

  // sliding highlight behind the active status tab
  useLayoutEffect(() => {
    const el = tabRefs.current[filter];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [filter, counts]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page), status: filter });
      if (search.trim()) params.set('search', search.trim());
      if (sort !== 'default') params.set('sort', sort);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await api.get(`${p.basePath}?${params}`);
      if (id !== reqId.current) return; // a newer request superseded this one
      if (res?.error) {
        showToast(res.error.message || `Failed to load ${p.title.toLowerCase()}`, 'error');
        setRows([]);
        return;
      }
      const d = res?.success?.data;
      setRows(Array.isArray(d?.items) ? d.items : []);
      if (d?.counts) setCounts(d.counts);
      if (d?.total != null) setTotal(d.total);
      if (d?.totalPages != null) setTotalPages(d.totalPages);
      if (d?.page != null) setPage(d.page);
      setFresh(true);
      setTimeout(() => setFresh(false), 900);
    } catch {
      if (id === reqId.current) showToast(`Failed to load ${p.title.toLowerCase()}`, 'error');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [p.basePath, p.title, filter, search, sort, from, to, page, limit]);

  // every filter change goes through the API; search is debounced
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // reset to page 1 when any filter changes
  useEffect(() => { setPage(1); }, [filter, search, sort, from, to, limit]);

  const filtersActive = search !== '' || filter !== 'all' || sort !== 'default' || from !== '' || to !== '';
  const advancedActive = sort !== 'default' || from !== '' || to !== '';
  function resetFilters() { setSearch(''); setFilter('all'); setSort('default'); setFrom(''); setTo(''); setPage(1); }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', sort_order: '' });
    setError('');
    setOpen(true);
  }

  function openEdit(r: MasterRow) {
    setEditing(r);
    setForm({ name: r.name, sort_order: r.sort_order != null ? String(r.sort_order) : '' });
    setError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setError('Name is required'); return; }

    const body: Record<string, unknown> = { name };
    if (p.hasSortOrder && form.sort_order !== '') body.sort_order = Number(form.sort_order);

    setSaving(true);
    try {
      const res = editing ? await api.put(`${p.basePath}/${editing.id}`, body) : await api.post(p.basePath, body);
      if (res?.error) { setError(res.error.message || 'Failed to save'); return; }
      showToast(editing ? `${p.singular} updated` : `${p.singular} added`);
      setOpen(false);
      applyChange(editing, res.success.data as MasterRow);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Apply a server-confirmed change to local state without a full page reload.
  function applyChange(prev: MasterRow | null, next: MasterRow | null) {
    setCounts(c => bump(c, prev ? stateOf(prev) : null, next ? stateOf(next) : null));

    const stillVisible = next && matchesFilter(next, filter);

    if (next && prev && next.id === prev.id && stillVisible) {
      // in-place update (toggle, edit) — just swap the row, no reload
      setRows(rs => rs.map(x => (x.id === next.id ? { ...x, ...next } : x)));
    } else if (next && prev && next.id === prev.id && !stillVisible) {
      // row no longer matches current filter — animate out, then silently reload
      const id = prev.id;
      setLeaving(s => new Set(s).add(id));
      setTimeout(() => {
        setRows(rs => rs.filter(x => x.id !== id));
        setLeaving(s => { const n = new Set(s); n.delete(id); return n; });
        load();
      }, 560);
    } else if (prev && !next) {
      // delete — animate out then reload
      const id = prev.id;
      setLeaving(s => new Set(s).add(id));
      setTimeout(() => {
        setRows(rs => rs.filter(x => x.id !== id));
        setLeaving(s => { const n = new Set(s); n.delete(id); return n; });
        load();
      }, 560);
    } else {
      // create — reload to get correct page position
      load();
    }
  }

  async function act(r: MasterRow, fn: () => Promise<any>, okMsg: string, failMsg: string, makeNext: (saved: MasterRow) => MasterRow) {
    setBusyId(r.id);
    try {
      const res = await fn();
      if (res?.error) { showToast(res.error.message || failMsg, 'error'); return; }
      showToast(okMsg);
      applyChange(r, makeNext({ ...r, ...(res?.success?.data || {}) }));
    } catch {
      showToast(failMsg, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(r: MasterRow) {
    const target = !r.is_active;
    setOptimistic(o => ({ ...o, [r.id]: target })); // knob moves right away
    setBusyId(r.id);
    try {
      const res = await api.patch(`${p.basePath}/${r.id}/status`, { is_active: target });
      if (res?.error) { showToast(res.error.message || 'Failed to update status', 'error'); return; }
      showToast(target ? `${r.name} activated` : `${r.name} deactivated`);
      applyChange(r, { ...r, ...(res?.success?.data || {}) });
    } catch {
      showToast('Failed to update status', 'error');
    } finally {
      setOptimistic(o => { const n = { ...o }; delete n[r.id]; return n; }); // falls back to real state (reverts on failure)
      setBusyId(null);
    }
  }

  const restore = (r: MasterRow) =>
    act(r, () => api.patch(`${p.basePath}/${r.id}/restore`, {}),
      `${r.name} restored (inactive, switch it on to use)`, 'Failed to restore', s => ({ ...s, is_deleted: false, is_active: false }));

  function remove(r: MasterRow) {
    if (!confirm(`Delete ${p.singular.toLowerCase()} "${r.name}"? Existing products keep their value.`)) return;
    act(r, () => api.delete(`${p.basePath}/${r.id}`), `${p.singular} deleted`, 'Failed to delete', s => ({ ...s, is_deleted: true, is_active: false }));
  }

  const stats = [
    { key: 'all', text: `Total ${p.title}`, icon: Layers, tone: 'bg-[#eaf1fd] text-[#3479e6]' },
    { key: 'active', text: 'Active', icon: CheckCircle2, tone: 'bg-[#e6f5eb] text-[#16804a]' },
    { key: 'inactive', text: 'Inactive', icon: PauseCircle, tone: 'bg-[#fff8e8] text-[#a55b00]' },
    { key: 'deleted', text: 'Deleted', icon: Archive, tone: 'bg-[#fff0f1] text-[#b32642]' },
  ] as const;

  const colCount = p.hasSortOrder ? 6 : 5;

  return (
    <div>
      <TopBar
        title={p.title}
        actions={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#237a59] text-white text-sm font-semibold shadow-md shadow-[#237a59]/20 hover:bg-[#1c6348] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add {p.singular}
          </button>
        }
      />
      {/* thin top progress bar while any request is running */}
      <div className={`h-0.5 overflow-hidden bg-transparent ${loading ? '' : 'opacity-0'}`}>
        <div className="h-full w-1/3 bg-[#237a59] animate-[slide_1s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
        @keyframes rowIn{0%{opacity:0;transform:translateY(-8px);background:#e6f5eb}60%{background:#e6f5eb}100%{opacity:1;transform:none;background:transparent}}
        @keyframes rowLoad{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes rowSlideOut{0%{opacity:1;transform:none;background:#fff0f1}45%{opacity:0;transform:translateX(28px);background:#fff0f1}100%{opacity:0;transform:translateX(28px)}}
        @keyframes cellCollapse{0%,45%{max-height:44px;padding-top:.875rem;padding-bottom:.875rem}100%{max-height:0;padding-top:0;padding-bottom:0}}
        .row-in{animation:rowIn .6s cubic-bezier(.2,.8,.2,1)}
        .row-out{animation:rowSlideOut .56s ease-in forwards;pointer-events:none}
        .row-out td{overflow:hidden;animation:cellCollapse .56s ease-in forwards}
        .row-out td>*{max-height:inherit}
        .row-load{animation:rowLoad .35s cubic-bezier(.2,.8,.2,1) both}
      `}</style>

      <div className="p-4 sm:p-6 w-full space-y-5">
        {/* Stats (click to filter) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(({ key, text, icon: Icon, tone }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-4 p-4 rounded-2xl bg-white border text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[.98] ${
                filter === key ? 'border-[#237a59] ring-2 ring-[#237a59]/15' : 'border-[#e5e9f0]'
              }`}
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-2xl font-extrabold text-[#20283b] leading-none tabular-nums"><CountUp value={counts[key]} /></span>
                <span className="block text-xs font-semibold text-[#798397] mt-1">{text}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white border border-[#e5e9f0] p-3 sm:p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#798397] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${p.title.toLowerCase()} by name...`}
                className={`${input} pl-10 pr-10`}
              />
              {loading && search && <Loader2 className="w-4 h-4 animate-spin text-[#237a59] absolute right-3.5 top-1/2 -translate-y-1/2" />}
            </div>

            <div className="relative flex items-center gap-1 p-1 rounded-xl bg-[#f1f3f7] self-start lg:self-auto overflow-x-auto max-w-full">
              <span
                className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-out"
                style={{ left: pill.left, width: pill.width }}
              />
              {(['all', 'active', 'inactive', 'deleted'] as Filter[]).map(f => (
                <button
                  key={f}
                  ref={el => { tabRefs.current[f] = el; }}
                  onClick={() => setFilter(f)}
                  className={`relative z-10 px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors duration-200 whitespace-nowrap ${
                    filter === f ? 'text-[#237a59]' : 'text-[#798397] hover:text-[#20283b]'
                  }`}
                >
                  {f} <span className="opacity-60">({counts[f]})</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAdvanced(v => !v)}
              className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold border transition-colors ${
                showAdvanced || advancedActive ? 'border-[#237a59] text-[#237a59] bg-[#f1faf5]' : 'border-[#e5e9f0] text-[#798397] hover:bg-[#f5f7fb]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" /> Advanced
              {advancedActive && <span className="w-1.5 h-1.5 rounded-full bg-[#237a59]" />}
            </button>

            {filtersActive && (
              <button onClick={resetFilters} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold text-[#b32642] bg-[#fff0f1] hover:bg-[#ffe3e6]">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* collapsible panel: animates height via grid rows */}
          <div className={`grid transition-all duration-300 ease-out ${showAdvanced ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#eef1f6]">
              <div>
                <label className={label}>Sort by</label>
                <Select
                  value={sort}
                  onChange={v => setSort(v as Sort)}
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'name_asc', label: 'Name A to Z' },
                    { value: 'name_desc', label: 'Name Z to A' },
                    { value: 'newest', label: 'Newest first' },
                    { value: 'oldest', label: 'Oldest first' },
                  ]}
                />
              </div>
              <div>
                <label className={label}>Created from</label>
                <DatePicker value={from} max={to || undefined} onChange={setFrom} placeholder="From date" />
              </div>
              <div>
                <label className={label}>Created to</label>
                <DatePicker value={to} min={from || undefined} onChange={setTo} placeholder="To date" />
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="relative rounded-2xl bg-white border border-[#e5e9f0] shadow-sm overflow-hidden">
          <div
            className={`absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center transition-opacity duration-200 ${
              loading && rows.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Loader2 className="w-7 h-7 animate-spin text-[#237a59]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed min-w-[640px]">
              <thead>
                <tr className="bg-[#f5f7fb] border-b border-[#e5e9f0] text-[11px] font-bold text-[#798397] uppercase tracking-wider">
                  <th className="pl-5 pr-2 py-3.5 text-left w-14">#</th>
                  <th className="px-4 py-3.5 text-left">{p.singular}</th>
                  {p.hasSortOrder && <th className="px-4 py-3.5 text-left w-24">Order</th>}
                  <th className="px-4 py-3.5 text-left w-36">Status</th>
                  <th className="px-4 py-3.5 text-left w-28">Active</th>
                  <th className="pl-4 pr-5 py-3.5 text-right w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f6]">
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-[#798397]">
                        <Loader2 className="w-8 h-8 animate-spin text-[#237a59]" />
                        <span className="text-sm font-medium">Loading {p.title.toLowerCase()}...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="py-14">
                      <div className="flex flex-col items-center text-center">
                        <span className="w-14 h-14 rounded-2xl bg-[#f5f7fb] flex items-center justify-center mb-3">
                          <Inbox className="w-7 h-7 text-[#98a2b6]" />
                        </span>
                        <p className="font-bold text-[#20283b]">No {p.title.toLowerCase()} found</p>
                        <p className="text-sm text-[#798397] mt-1 mb-4">
                          {!filtersActive ? `Add your first ${p.singular.toLowerCase()} to use it in products.` : 'Try another filter or search.'}
                        </p>
                        {!filtersActive && (
                          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#237a59] text-white text-sm font-semibold hover:bg-[#1c6348]">
                            <Plus className="w-4 h-4" /> Add {p.singular}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-[#f9fbfd] transition-colors ${
                      leaving.has(r.id) ? 'row-out' : flash[r.id] === 'create' ? 'row-in' : fresh ? 'row-load' : ''
                    }`}
                    style={fresh && !leaving.has(r.id) && !flash[r.id] ? { animationDelay: `${Math.min(i, 12) * 35}ms` } : undefined}
                  >
                    <td className="pl-5 pr-2 py-3.5 text-xs font-semibold text-[#98a2b6]">{(page - 1) * limit + i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold ${r.is_deleted ? 'bg-[#fff0f1] text-[#b32642]' : r.is_active ? 'bg-[#e6f5eb] text-[#237a59]' : 'bg-[#eef1f6] text-[#98a2b6]'}`}>
                          {r.name.charAt(0).toUpperCase()}
                        </span>
                        <span className={`truncate font-semibold ${r.is_active && !r.is_deleted ? 'text-[#20283b]' : 'text-[#98a2b6]'}`}>{r.name}</span>
                      </div>
                    </td>
                    {p.hasSortOrder && <td className="px-4 py-3.5 text-[#798397] font-medium">{r.sort_order}</td>}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${r.is_deleted ? 'bg-[#fff0f1] text-[#b32642]' : r.is_active ? 'bg-[#e6f5eb] text-[#16804a]' : 'bg-[#f1f3f7] text-[#798397]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.is_deleted ? 'bg-[#b32642]' : r.is_active ? 'bg-[#16804a]' : 'bg-[#98a2b6]'}`} />
                        {r.is_deleted ? 'Deleted' : r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.is_deleted
                        ? <span className="text-xs text-[#98a2b6]">-</span>
                        : <Switch on={optimistic[r.id] ?? r.is_active} busy={busyId === r.id} onClick={() => toggle(r)} title={r.is_active ? 'Deactivate' : 'Activate'} />}
                    </td>
                    <td className="pl-4 pr-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.is_deleted ? (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => restore(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#237a59] bg-[#e6f5eb] hover:bg-[#d3eddc] transition-colors disabled:opacity-60"
                          >
                            {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Restore
                          </button>
                        ) : (
                          <>
                            <button disabled={busyId === r.id} onClick={() => openEdit(r)} title="Edit" className="p-2 rounded-lg text-[#798397] hover:bg-[#eaf1fd] hover:text-[#3479e6] transition-all active:scale-90 disabled:opacity-50">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button disabled={busyId === r.id} onClick={() => remove(r)} title="Delete" className="p-2 rounded-lg text-[#798397] hover:bg-[#fff0f1] hover:text-[#b32642] transition-all active:scale-90 disabled:opacity-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#eef1f6] bg-[#fafbfd] flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-[#798397]">
              Showing <span className="font-bold text-[#20283b] tabular-nums">{rows.length ? (page - 1) * limit + 1 : 0}–{(page - 1) * limit + rows.length}</span> of <span className="font-bold text-[#20283b] tabular-nums">{total}</span>
            </span>
            <div className="flex items-center gap-4 flex-wrap">
            {total > 0 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-90"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | 'dots')[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('dots');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === 'dots' ? (
                      <span key={`d${i}`} className="px-1 text-xs text-[#98a2b6]">...</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`min-w-7 h-7 rounded-lg text-xs font-bold transition-all active:scale-90 ${
                          page === n
                            ? 'bg-[#237a59] text-white shadow-sm'
                            : 'text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b]'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-90"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
              <div className="flex items-center gap-2 text-xs text-[#798397]">
                <label className="font-semibold uppercase tracking-wide whitespace-nowrap">Rows per page</label>
                <div className="w-24">
                  <Select
                    value={String(limit)}
                    onChange={v => setLimit(Number(v))}
                    options={PAGE_SIZE_OPTIONS.map(n => ({ value: String(n), label: String(n) }))}
                    searchable={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? `Edit ${p.singular}` : `Add ${p.singular}`} maxWidth="max-w-md">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={label}>Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={input} />
          </div>
          {p.hasSortOrder && (
            <div>
              <label className={label}>Order</label>
              <input type="number" min={0} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className={input} />
            </div>
          )}
          {error && <p className="text-xs text-[#b32642]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-[#e5e9f0] text-sm font-semibold text-[#798397] hover:bg-[#f5f7fb] disabled:opacity-60">Cancel</button>
            <button disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#237a59] text-white text-sm font-semibold hover:bg-[#1c6348] disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
