'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, Eye, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { money, formatDate, today } from '../../../lib/utils';
import { Sale } from '../../../types';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';
import DatePicker from '../../../components/ui/DatePicker';
import Select from '../../../components/ui/Select';

const PAYMENT_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'due', label: 'Due' },
];

export default function BillsHistoryPage() {
  const [bills, setBills] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);

  // Filters
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [advOpen, setAdvOpen] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (paymentStatus) params.set('payment_status', paymentStatus);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, from, to, paymentStatus, page, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/sales?${query}`);
      const data = res?.success?.data;
      setBills(Array.isArray(data?.sales) ? data.sales : []);
      setTotal(Number(data?.total) || 0);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch {
      showToast('Failed to load bills', 'error');
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Debounce search; reset page on filter change
  useEffect(() => { setPage(1); }, [search, from, to, paymentStatus, limit]);
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function clearFilters() {
    setSearch('');
    setFrom('');
    setTo('');
    setPaymentStatus('');
    setAdvOpen(false);
  }

  const activeFilterCount = [search.trim(), from, to, paymentStatus].filter(Boolean).length;

  function statusChip(s: Sale['payment_status']) {
    const cfg = {
      paid: { bg: 'bg-[#e6f5eb]', text: 'text-[#16804a]' },
      partial: { bg: 'bg-[#fef3cd]', text: 'text-[#8a6d1e]' },
      due: { bg: 'bg-[#fff0f1]', text: 'text-[#b32642]' },
    }[s] || { bg: 'bg-[#f5f7fb]', text: 'text-[#798397]' };
    return (
      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
        {s}
      </span>
    );
  }

  const totalRevenue = bills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalDue = bills.reduce((s, b) => s + Number(b.amount_due || 0), 0);

  return (
    <div>
      <TopBar title="Bill History" />

      <div className="p-6 space-y-5">
        {/* Quick stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="bg-white border border-[#e5e9f0] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#798397] uppercase tracking-wide">Bills (in view)</p>
            <p className="text-2xl font-black text-[#20283b] mt-1 tabular-nums">{bills.length} / {total}</p>
          </div>
          <div className="bg-[#eaf5ef] border border-[#c3e6cf] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#16804a] uppercase tracking-wide">Revenue (in view)</p>
            <p className="text-2xl font-black text-[#16804a] mt-1 tabular-nums">{money(totalRevenue)}</p>
          </div>
          <div className={`${totalDue > 0 ? 'bg-[#fff0f1] border-[#f5c2c7]' : 'bg-white border-[#e5e9f0]'} border rounded-xl px-4 py-3`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${totalDue > 0 ? 'text-[#b32642]' : 'text-[#798397]'}`}>Due (in view)</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${totalDue > 0 ? 'text-[#b32642]' : 'text-[#20283b]'}`}>{money(totalDue)}</p>
          </div>
        </div>

        {/* Search + advanced filter toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#798397]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice no, customer name, or phone…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e5e9f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
            />
          </div>
          <button
            onClick={() => setAdvOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition-colors ${advOpen || activeFilterCount > 1 ? 'bg-[#237a59] text-white border-[#237a59]' : 'bg-white text-[#20283b] border-[#e5e9f0] hover:bg-[#f5f7fb]'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Advanced
            {activeFilterCount > 1 && (
              <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black ${advOpen ? 'bg-white text-[#237a59]' : 'bg-[#237a59] text-white'}`}>
                {activeFilterCount - (search.trim() ? 1 : 0)}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2.5 text-xs text-[#b32642] font-semibold hover:underline">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          <button onClick={load} className="p-2.5 border border-[#e5e9f0] rounded-lg hover:bg-[#f5f7fb] text-[#798397] bg-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Advanced filter panel */}
        <div className={`grid transition-all duration-200 ease-out ${advOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="bg-white border border-[#e5e9f0] rounded-xl p-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">From Date</label>
                <DatePicker value={from} onChange={v => setFrom(v)} placeholder="Any" clearable />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">To Date</label>
                <DatePicker value={to} onChange={v => setTo(v)} placeholder="Any" clearable />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Payment Status</label>
                <Select value={paymentStatus} onChange={setPaymentStatus} options={PAYMENT_STATUSES} />
              </div>
              <div className="sm:col-span-3 flex items-center gap-2 flex-wrap pt-1">
                <button
                  onClick={() => { setFrom(today()); setTo(today()); }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#3479e6] bg-[#eaf0fc] hover:bg-[#d9e5f9]"
                >Today</button>
                <button
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 7);
                    setFrom(d.toISOString().slice(0, 10)); setTo(today());
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#3479e6] bg-[#eaf0fc] hover:bg-[#d9e5f9]"
                >Last 7 days</button>
                <button
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() - 30);
                    setFrom(d.toISOString().slice(0, 10)); setTo(today());
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#3479e6] bg-[#eaf0fc] hover:bg-[#d9e5f9]"
                >Last 30 days</button>
                <button
                  onClick={() => {
                    const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth(), 1);
                    setFrom(first.toISOString().slice(0, 10)); setTo(today());
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#3479e6] bg-[#eaf0fc] hover:bg-[#d9e5f9]"
                >This month</button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-[#f5f7fb] rounded animate-pulse" />)}
            </div>
          ) : bills.length === 0 ? (
            <div className="py-16 text-center text-[#798397]">
              <p className="text-sm">No bills found{activeFilterCount > 0 ? ' for the current filters' : ''}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f7fb] border-b border-[#e5e9f0]">
                    {['Invoice', 'Date', 'Customer', 'Phone', 'Items', 'Total', 'Paid', 'Due', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {bills.map(b => (
                    <tr key={b.id} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#3479e6] whitespace-nowrap">{b.invoice_no}</td>
                      <td className="px-4 py-3 text-[#798397] whitespace-nowrap">{formatDate(b.date)}</td>
                      <td className="px-4 py-3 font-semibold text-[#20283b]">{b.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-[#798397]">{b.customer_phone ? `+91 ${b.customer_phone}` : '—'}</td>
                      <td className="px-4 py-3 text-[#798397] text-center tabular-nums">{Array.isArray(b.items) ? b.items.length : '—'}</td>
                      <td className="px-4 py-3 font-bold text-[#20283b] tabular-nums whitespace-nowrap">{money(b.total)}</td>
                      <td className="px-4 py-3 text-[#16804a] tabular-nums whitespace-nowrap">{money(b.amount_paid)}</td>
                      <td className={`px-4 py-3 font-bold tabular-nums whitespace-nowrap ${Number(b.amount_due) > 0 ? 'text-[#b32642]' : 'text-[#798397]'}`}>{money(b.amount_due)}</td>
                      <td className="px-4 py-3">{statusChip(b.payment_status)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/bills/${b.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3479e6] hover:bg-[#2a65c4] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 border-t border-[#eef1f6] bg-[#fafbfd] text-sm">
              <span className="text-xs text-[#798397]">
                Showing <span className="font-bold text-[#20283b] tabular-nums">{Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)}</span>
                {' '}of <span className="font-bold text-[#20283b] tabular-nums">{total}</span>
              </span>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-90"
                    aria-label="Previous page"
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
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#798397]">
                  <label className="font-semibold uppercase tracking-wide whitespace-nowrap">Rows per page</label>
                  <div className="w-24">
                    <Select
                      value={String(limit)}
                      onChange={v => setLimit(Number(v))}
                      options={[10, 25, 50, 100].map(n => ({ value: String(n), label: String(n) }))}
                      searchable={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
