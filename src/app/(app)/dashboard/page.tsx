'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign, RefreshCw,
  ShoppingBag, Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { money, formatDate, today } from '../../../lib/utils';
import { Sale } from '../../../types';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';
import DatePicker from '../../../components/ui/DatePicker';
import Select from '../../../components/ui/Select';

type Preset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';
type Compare = 'previous_period' | 'previous_year' | 'custom' | 'none';
type ChartTab = 'both' | 'sales' | 'profit';

interface Period {
  from: string; to: string;
  sales: number; profit: number;
  collected: number; due: number;
  bills_count: number; avg_bill: number; items_sold: number;
}
interface SeriesPoint { bucket: string; sales: number; profit: number; bills_count: number; }
interface TopProduct { product_id: string; name: string; qty: number; revenue: number; }
interface PaymentMethodRow { method: string; total: number; count: number; }

interface Analytics {
  preset: Preset;
  granularity: 'day' | 'month' | 'year';
  compare: Compare;
  current: Period;
  previous: Period | null;
  series: SeriesPoint[];
  top_products: TopProduct[];
  by_payment_method: PaymentMethodRow[];
}

interface Stats {
  total_stock: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_dues: number;
  recent_bills: Sale[];
  stock_alerts: any[];
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

const COMPARES: { value: Compare; label: string }[] = [
  { value: 'previous_period', label: 'vs Previous Period' },
  { value: 'previous_year', label: 'vs Previous Year' },
  { value: 'custom', label: 'vs Custom Range' },
  { value: 'none', label: 'No Comparison' },
];

function daysBetween(fromStr: string, toStr: string): number {
  const f = new Date(fromStr);
  const t = new Date(toStr);
  return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PIE_COLORS = ['#237a59', '#3479e6', '#a55b00', '#b32642', '#798397', '#16804a', '#25d366'];

function pct(curr: number, prev: number): { value: number; up: boolean | null } {
  if (!prev && !curr) return { value: 0, up: null };
  if (!prev) return { value: 100, up: true };
  const v = ((curr - prev) / Math.abs(prev)) * 100;
  return { value: v, up: v > 0 ? true : v < 0 ? false : null };
}

function DeltaBadge({ curr, prev }: { curr: number; prev: number | undefined }) {
  if (prev === undefined || prev === null) return null;
  const { value, up } = pct(curr, prev);
  if (up === null) return <span className="text-[10px] font-semibold text-[#798397]">— no change</span>;
  const color = up ? 'text-[#16804a] bg-[#e6f5eb]' : 'text-[#b32642] bg-[#fff0f1]';
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${color}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label, value, icon: Icon, tone, current, previous,
}: {
  label: string; value: string; icon: React.ElementType; tone: string;
  current: number; previous?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e9f0] p-5 shadow-sm transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#798397] uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-black text-[#20283b] mt-1.5 tabular-nums truncate">{value}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-[#798397]">
            <DeltaBadge curr={current} prev={previous} />
            {previous !== undefined && previous !== null && (
              <span className="truncate">prev: <span className="font-semibold text-[#20283b] tabular-nums">
                {typeof previous === 'number' ? money(previous) : previous}
              </span></span>
            )}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#e5e9f0] p-5 shadow-sm animate-pulse">
      <div className="h-3 bg-[#f0f2f5] rounded w-24 mb-4" />
      <div className="h-8 bg-[#f0f2f5] rounded w-32" />
    </div>
  );
}

export default function DashboardPage() {
  // Filters
  const [preset, setPreset] = useState<Preset>('today');
  const [compare, setCompare] = useState<Compare>('none');
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());
  const [compareFrom, setCompareFrom] = useState(today());
  const [compareTo, setCompareTo] = useState(today());
  const [compareError, setCompareError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [chartTab, setChartTab] = useState<ChartTab>('both');

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const params = new URLSearchParams({ preset, compare });
      if (preset === 'custom') {
        params.set('from', customFrom);
        params.set('to', customTo);
      }
      if (compare === 'custom') {
        params.set('compare_from', compareFrom);
        params.set('compare_to', compareTo);
      }
      const res = await api.get(`/api/dashboard/analytics?${params.toString()}`);
      if (res?.error) {
        setAnalyticsError(res.error.message || 'Analytics endpoint unavailable');
        setAnalytics(null);
        return;
      }
      const d = res?.success?.data;
      if (d) setAnalytics(d);
      else { setAnalyticsError('No data returned'); setAnalytics(null); }
    } catch {
      setAnalyticsError('Could not reach analytics endpoint');
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [preset, compare, customFrom, customTo, compareFrom, compareTo]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/api/dashboard/stats');
      const d = res?.success?.data;
      if (d) {
        setStats({
          total_stock: d.inventory?.total_stock ?? 0,
          low_stock_count: d.inventory?.low_stock_count ?? 0,
          out_of_stock_count: d.inventory?.out_of_stock_count ?? 0,
          total_dues: d.total_dues ?? 0,
          recent_bills: d.recent_bills ?? [],
          stock_alerts: d.stock_alerts ?? [],
        });
      }
    } catch {
      showToast('Failed to load stats', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Keep compare range span >= period span whenever either side changes.
  useEffect(() => {
    if (compare !== 'custom') { setCompareError(null); return; }
    const periodFrom = analytics?.current?.from;
    const periodTo = analytics?.current?.to;
    if (!periodFrom || !periodTo) return;
    const periodSpan = daysBetween(periodFrom, periodTo);
    const compareSpan = daysBetween(compareFrom, compareTo);
    if (compareSpan < periodSpan) {
      const needed = addDays(compareFrom, periodSpan - 1);
      setCompareTo(needed);
      setCompareError(`Compare range extended to ${periodSpan} days to match the period.`);
    } else {
      setCompareError(null);
    }
  }, [compare, compareFrom, compareTo, analytics?.current?.from, analytics?.current?.to]);

  const ZERO_PERIOD: Period = {
    from: today(), to: today(),
    sales: 0, profit: 0,
    collected: 0, due: 0,
    bills_count: 0, avg_bill: 0, items_sold: 0,
  };
  const curr: Period = analytics?.current || ZERO_PERIOD;
  const prev: Period | null = analytics?.previous || null;
  const series = analytics?.series || [];
  const topProducts = analytics?.top_products || [];
  const paymentMethods = analytics?.by_payment_method || [];

  const paymentPieData = useMemo(
    () => paymentMethods.filter(p => p.total > 0).map(p => ({ name: p.method, value: p.total })),
    [paymentMethods]
  );

  function refreshAll() { loadAnalytics(); loadStats(); }

  return (
    <div>
      <TopBar
        title="Dashboard"
        actions={
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#798397] hover:text-[#20283b] border border-[#e5e9f0] rounded-lg bg-white hover:bg-[#f5f7fb] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* ── Filter bar ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <label className="block text-[11px] font-bold text-[#798397] uppercase tracking-wide mb-1.5">Period</label>
              <Select
                value={preset}
                onChange={v => setPreset(v as Preset)}
                options={PRESETS}
                searchable={false}
              />
            </div>
            {preset === 'custom' && (
              <>
                <div className="min-w-40">
                  <label className="block text-[11px] font-bold text-[#798397] uppercase tracking-wide mb-1.5">From</label>
                  <DatePicker value={customFrom} onChange={v => setCustomFrom(v)} placeholder="From date" clearable={false} />
                </div>
                <div className="min-w-40">
                  <label className="block text-[11px] font-bold text-[#798397] uppercase tracking-wide mb-1.5">To</label>
                  <DatePicker value={customTo} onChange={v => setCustomTo(v)} placeholder="To date" clearable={false} />
                </div>
              </>
            )}
            <div className="flex-1 min-w-48">
              <label className="block text-[11px] font-bold text-[#798397] uppercase tracking-wide mb-1.5">Compare</label>
              <Select
                value={compare}
                onChange={v => setCompare(v as Compare)}
                options={COMPARES}
                searchable={false}
              />
            </div>
            {compare === 'custom' && (
              <>
                <div className="min-w-40">
                  <label className="block text-[11px] font-bold text-[#798397] uppercase tracking-wide mb-1.5">Compare From</label>
                  <DatePicker value={compareFrom} onChange={v => setCompareFrom(v)} placeholder="From date" clearable={false} />
                </div>
                <div className="min-w-40">
                  <label className="block text-[11px] font-bold text-[#798397] uppercase tracking-wide mb-1.5">Compare To</label>
                  <DatePicker value={compareTo} onChange={v => setCompareTo(v)} placeholder="To date" clearable={false} />
                </div>
              </>
            )}
          </div>
          {compareError && (
            <div className="mt-2 text-[11px] text-[#8a6d1e] bg-[#fff8e8] border border-[#f5e3a1] rounded-md px-2.5 py-1.5 transition-all">
              {compareError}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-[#eef1f6] flex items-center justify-between gap-3 flex-wrap text-xs text-[#798397]">
            <span>
              Showing <span className="font-semibold text-[#20283b]">{formatDate(curr.from)}</span>{' '}
              → <span className="font-semibold text-[#20283b]">{formatDate(curr.to)}</span>
              {prev && (
                <>
                  {' · compared to '}
                  <span className="font-semibold text-[#20283b]">{formatDate(prev.from)}</span>{' '}
                  → <span className="font-semibold text-[#20283b]">{formatDate(prev.to)}</span>
                </>
              )}
            </span>
            {analytics?.granularity && (
              <span className="uppercase tracking-wide">Granularity: <span className="font-bold text-[#20283b]">{analytics.granularity}</span></span>
            )}
          </div>
        </div>

        {analyticsError && (
          <div className="bg-[#fff8e8] border border-[#f5e3a1] rounded-xl px-4 py-3 text-xs text-[#8a6d1e] flex items-center justify-between gap-3 flex-wrap">
            <span><span className="font-bold">Analytics unavailable:</span> {analyticsError}. Showing zero defaults — restart the backend if you just added the endpoint.</span>
            <button onClick={loadAnalytics} className="px-2.5 py-1 text-[#8a6d1e] font-semibold hover:underline">Retry</button>
          </div>
        )}

        {/* ── KPI cards ────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {analyticsLoading ? (
            [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard
                label="Sales"
                value={money(curr.sales)}
                icon={DollarSign}
                tone="bg-[#237a59]"
                current={curr.sales}
                previous={prev?.sales}
              />
              <KpiCard
                label="Gross Profit"
                value={money(curr.profit)}
                icon={TrendingUp}
                tone="bg-[#3479e6]"
                current={curr.profit}
                previous={prev?.profit}
              />
              <KpiCard label="Bills Issued" value={String(curr.bills_count)} icon={ShoppingBag} tone="bg-[#5b6b82]" current={curr.bills_count} previous={prev?.bills_count} />
              <KpiCard label="Avg Bill" value={money(curr.avg_bill)} icon={ShoppingBag} tone="bg-[#5b6b82]" current={curr.avg_bill} previous={prev?.avg_bill} />
            </>
          )}
        </div>

        {/* ── Secondary KPIs row ────────────────────────── */}
        {!analyticsLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Items Sold" value={String(curr.items_sold)} icon={Package} tone="bg-[#5b6b82]" current={curr.items_sold} previous={prev?.items_sold} />
            <KpiCard label="Collected" value={money(curr.collected)} icon={Wallet} tone="bg-[#5b6b82]" current={curr.collected} previous={prev?.collected} />
          </div>
        )}

        {/* ── Charts ─────────────────────────────────── */}
        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-base font-bold text-[#20283b]">Trend</h2>
              <div className="flex gap-1 bg-[#f5f7fb] border border-[#e5e9f0] rounded-lg p-0.5">
                {([
                  { k: 'both', label: 'Both' },
                  { k: 'sales', label: 'Sales' },
                  { k: 'profit', label: 'Gross Profit' },
                ] as { k: ChartTab; label: string }[]).map(t => (
                  <button
                    key={t.k}
                    onClick={() => setChartTab(t.k)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      chartTab === t.k ? 'bg-white text-[#237a59] shadow-sm' : 'text-[#798397] hover:text-[#20283b]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {analyticsLoading ? (
              <div className="h-64 bg-[#f5f7fb] rounded animate-pulse" />
            ) : series.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#798397] text-sm">No sales in this period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(chartTab === 'sales' || chartTab === 'both') && (
                    <Bar dataKey="sales" name="Sales" fill="#237a59" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  )}
                  {(chartTab === 'profit' || chartTab === 'both') && (
                    <Bar dataKey="profit" name="Gross Profit" fill="#3479e6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment method pie */}
          <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
            <h2 className="text-base font-bold text-[#20283b] mb-4">Payment Methods</h2>
            {analyticsLoading ? (
              <div className="h-64 bg-[#f5f7fb] rounded animate-pulse" />
            ) : paymentPieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#798397] text-sm">No payments yet.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={paymentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                      {paymentPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {paymentMethods.map((p, i) => (
                    <li key={p.method} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[#20283b]">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {p.method}
                      </span>
                      <span className="font-semibold tabular-nums">{money(p.total)} <span className="text-[#798397] font-normal">· {p.count}</span></span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ── Top products + Stock alerts ───────────── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
            <h2 className="text-base font-bold text-[#20283b] mb-4">Top Products <span className="text-xs text-[#798397] font-normal">(by qty, in period)</span></h2>
            {analyticsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[#f5f7fb] rounded animate-pulse" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-[#798397] text-sm">No sales in this period.</div>
            ) : (
              <ul className="space-y-2">
                {topProducts.map((p, i) => (
                  <li key={p.product_id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f9fafb] border border-[#e5e9f0]">
                    <span className="w-6 h-6 shrink-0 rounded-md bg-[#237a59] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#20283b] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#798397]">{p.qty} units · {money(p.revenue)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
            <h2 className="text-base font-bold text-[#20283b] mb-4">Stock Alerts</h2>
            {statsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[#f5f7fb] rounded animate-pulse" />)}
              </div>
            ) : !stats?.stock_alerts?.length ? (
              <div className="h-24 flex items-center justify-center text-[#798397] text-sm">All stock levels are healthy.</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.stock_alerts.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#f9fafb] border border-[#e5e9f0]">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#20283b] truncate">{v.product?.name}</p>
                      <p className="text-xs text-[#798397]">{v.product?.sku} · {v.size_info?.name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${v.stock === 0 ? 'bg-[#fff0f1] text-[#b32642]' : 'bg-[#fff8e8] text-[#a55b00]'}`}>
                      {v.stock === 0 ? 'OUT' : `${v.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Outstanding dues banner ─────────────── */}
        {!statsLoading && stats && stats.total_dues > 0 && (
          <div className="bg-[#fff0f1] border border-[#f5c2c7] rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#b32642] uppercase tracking-wide">Outstanding Dues (all time)</p>
              <p className="text-2xl font-black text-[#b32642] mt-1 tabular-nums">{money(stats.total_dues)}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-[#b32642] opacity-60" />
          </div>
        )}

        {/* ── Recent bills ───────────────────────── */}
        <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
          <h2 className="text-base font-bold text-[#20283b] mb-4">Recent Bills</h2>
          {statsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-[#f5f7fb] rounded animate-pulse" />)}
            </div>
          ) : !stats?.recent_bills?.length ? (
            <p className="text-center text-[#798397] text-sm py-8">No recent bills.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e9f0]">
                    {['Invoice', 'Customer', 'Date', 'Total', 'Paid', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {(stats.recent_bills as Sale[]).map(bill => (
                    <tr key={bill.id} className="hover:bg-[#f9fafb]">
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {bill.customer_id ? (
                          <Link
                            href={`/invoice/${bill.invoice_no}/${bill.customer_id}`}
                            className="text-[#3479e6] font-semibold hover:underline"
                          >
                            {bill.invoice_no}
                          </Link>
                        ) : (
                          <span className="text-[#3479e6] font-semibold">{bill.invoice_no}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[#20283b]">{bill.customer_name || '—'}</td>
                      <td className="px-3 py-2.5 text-[#798397] whitespace-nowrap">{formatDate(bill.date)}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#20283b] tabular-nums">{money(bill.total)}</td>
                      <td className="px-3 py-2.5 text-[#20283b] tabular-nums">{money(bill.amount_paid)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          bill.payment_status === 'paid' ? 'bg-[#e6f5eb] text-[#16804a]'
                            : bill.payment_status === 'partial' ? 'bg-[#fff8e8] text-[#a55b00]'
                              : 'bg-[#fff0f1] text-[#b32642]'
                        }`}>
                          {bill.payment_status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
