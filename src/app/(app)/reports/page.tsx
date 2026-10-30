'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import {
  Download, TrendingUp, TrendingDown, Filter, RotateCcw, ChevronDown, ChevronUp,
  Calendar, Users, Package, CreditCard, BarChart3, PieChart as PieIcon, Receipt,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { money, formatDate, today } from '../../../lib/utils';
import { Sale } from '../../../types';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';
import DatePicker from '../../../components/ui/DatePicker';
import Select from '../../../components/ui/Select';
import MultiSelect from '../../../components/ui/MultiSelect';

/* ────────── Types ────────── */
interface Summary {
  total_sales: number; total_cogs: number; gross_profit: number;
  gross_margin_pct: number;
  total_discount: number; total_paid: number; total_due: number;
  invoice_count: number;
  avg_invoice_value: number; min_invoice_value: number; max_invoice_value: number;
}
interface Comparison {
  prev_from: string; prev_to: string;
  prev_sales: number; prev_profit: number; prev_invoice_count: number;
  sales_change_pct: number | null;
  profit_change_pct: number | null;
  invoices_change_pct: number | null;
}
interface Breakdown {
  date?: string; period?: string; period_start?: string;
  sales: number; gross_profit: number; invoice_count: number;
}
interface BestSeller {
  product_id: string; sku: string; name: string; size: string; barcode: string;
  units_sold: number; revenue: number; profit: number;
}
interface CategoryWise { category: string; units_sold: number; revenue: number; profit: number; }
interface PaymentWise { payment_method: string; count: number; total: number; }
interface StatusWise { payment_status: string; count: number; total: number; due_amount: number; }
interface TopCustomer { customer_name: string; customer_phone: string; invoice_count: number; total_spent: number; total_profit: number; }

interface ReportData {
  summary: Summary;
  comparison: Comparison;
  group_by: 'day' | 'week' | 'month';
  daily_breakdown: Breakdown[];
  weekly_breakdown: Breakdown[];
  monthly_breakdown: Breakdown[];
  best_selling: BestSeller[];
  category_wise: CategoryWise[];
  payment_wise: PaymentWise[];
  status_wise: StatusWise[];
  top_customers: TopCustomer[];
  invoices_list: Sale[];
  date_range: { from: string; to: string };
  available_payment_methods: string[];
}

/* ────────── Date helpers ────────── */
function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function shift(d: string, days: number) { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + days); return dt.toISOString().slice(0, 10); }
function startOfWeek() {
  const d = new Date(); const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10);
}
function monthsAgo(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function endOfLastMonth() { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10); }
function startOfYear() { const d = new Date(); return `${d.getFullYear()}-01-01`; }

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7', label: 'Last 7 Days' },
  { value: 'last_30', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];
function presetRange(key: string): { from: string; to: string } {
  const t = today();
  switch (key) {
    case 'today': return { from: t, to: t };
    case 'yesterday': { const y = shift(t, -1); return { from: y, to: y }; }
    case 'this_week': return { from: startOfWeek(), to: t };
    case 'last_7': return { from: shift(t, -6), to: t };
    case 'last_30': return { from: shift(t, -29), to: t };
    case 'this_month': return { from: firstOfMonth(), to: t };
    case 'last_month': return { from: monthsAgo(1), to: endOfLastMonth() };
    case 'this_year': return { from: startOfYear(), to: t };
    default: return { from: firstOfMonth(), to: t };
  }
}

/* ────────── UI atoms ────────── */
function KPI({
  label, value, sub, color, delta,
}: { label: string; value: string; sub?: string; color?: string; delta?: number | null }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-[#e5e9f0] p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold text-[#798397] uppercase tracking-wide">{label}</p>
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold rounded px-1.5 py-0.5 ${up ? 'bg-[#e6f5eb] text-[#16804a]' : 'bg-[#fff0f1] text-[#b32642]'}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-black mt-1.5 tracking-tight ${color || 'text-[#20283b]'}`}>{value}</p>
      {sub && <p className="text-xs text-[#798397] mt-0.5">{sub}</p>}
    </div>
  );
}
function Section({ title, icon: Icon, right, children }: { title: string; icon?: any; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#798397]" />}
          <h3 className="text-base font-bold text-[#20283b]">{title}</h3>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const PAYMENT_STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'due', label: 'Unpaid / Due' },
];
const SORT_FIELDS = [
  { value: 'date_asc', label: 'Date ↑' },
  { value: 'date_desc', label: 'Date ↓' },
  { value: 'total_desc', label: 'Total ↓' },
  { value: 'total_asc', label: 'Total ↑' },
  { value: 'profit_desc', label: 'Profit ↓' },
  { value: 'due_desc', label: 'Due ↓' },
];

/* ────────── Page ────────── */
export default function ReportsPage() {
  const [preset, setPreset] = useState<string>('this_month');
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(today());
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([]);
  const [customer, setCustomer] = useState('');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [sortBy, setSortBy] = useState('date_asc');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);

  // Apply preset
  useEffect(() => {
    if (preset === 'custom') return;
    const r = presetRange(preset);
    setFromDate(r.from); setToDate(r.to);
  }, [preset]);

  function buildQuery(): string {
    const p = new URLSearchParams();
    p.set('from', fromDate); p.set('to', toDate);
    if (paymentMethods.length) p.set('payment_methods', paymentMethods.join(','));
    if (paymentStatuses.length) p.set('payment_statuses', paymentStatuses.join(','));
    if (customer.trim()) p.set('customer', customer.trim());
    if (minTotal) p.set('min_total', minTotal);
    if (maxTotal) p.set('max_total', maxTotal);
    p.set('group_by', groupBy);
    return p.toString();
  }

  async function runReport() {
    if (!fromDate || !toDate) { showToast('Pick a date range first', 'error'); return; }
    if (fromDate > toDate) { showToast('"From" date must be before "To" date', 'error'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/api/reports?${buildQuery()}`);
      const payload: ReportData | undefined = res?.success?.data;
      if (!payload) { showToast(res?.error?.message || 'Failed to load report', 'error'); return; }
      setData(payload);
      if (payload.available_payment_methods?.length) setAvailableMethods(payload.available_payment_methods);
    } catch {
      showToast('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Auto run on first mount
  useEffect(() => { runReport(); /* eslint-disable-next-line */ }, []);

  function resetFilters() {
    setPreset('this_month');
    const r = presetRange('this_month');
    setFromDate(r.from); setToDate(r.to);
    setPaymentMethods([]); setPaymentStatuses([]);
    setCustomer(''); setMinTotal(''); setMaxTotal('');
    setGroupBy('day'); setSortBy('date_asc');
  }

  function exportCSV() {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reports/export-csv?${buildQuery()}`, '_blank');
  }

  function exportInvoicesCSV() {
    if (!data) return;
    const rows = [
      ['Invoice No', 'Date', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Total', 'Paid', 'Due', 'COGS', 'Profit', 'Method', 'Status'],
      ...sortedInvoices.map(inv => [
        inv.invoice_no, inv.date, inv.customer_name || '', inv.customer_phone || '',
        inv.items?.length ?? 0, inv.subtotal, inv.discount, inv.total,
        inv.amount_paid, inv.amount_due, inv.cogs, inv.gross_profit,
        inv.payment_method, inv.payment_status,
      ]),
    ];
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `tulshi-invoices-${fromDate}-${toDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Breakdown chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    const list = groupBy === 'month' ? data.monthly_breakdown
      : groupBy === 'week' ? data.weekly_breakdown
      : data.daily_breakdown;
    return list.map(d => ({
      label: d.date || d.period || '',
      sales: Number(d.sales || 0),
      profit: Number(d.gross_profit || 0),
    }));
  }, [data, groupBy]);

  // Sorted invoices
  const sortedInvoices = useMemo(() => {
    if (!data) return [] as Sale[];
    const arr = [...(data.invoices_list || [])];
    const cmp = (a: Sale, b: Sale): number => {
      switch (sortBy) {
        case 'date_desc': return b.date.localeCompare(a.date);
        case 'total_desc': return Number(b.total) - Number(a.total);
        case 'total_asc': return Number(a.total) - Number(b.total);
        case 'profit_desc': return Number(b.gross_profit) - Number(a.gross_profit);
        case 'due_desc': return Number(b.amount_due) - Number(a.amount_due);
        case 'date_asc':
        default: return a.date.localeCompare(b.date);
      }
    };
    return arr.sort(cmp);
  }, [data, sortBy]);

  const salesDonut = data ? [
    { name: 'COGS', value: data.summary.total_cogs, color: '#a55b00' },
    { name: 'Gross Profit', value: Math.max(0, data.summary.gross_profit), color: '#237a59' },
  ] : [];

  const methodOptions = (availableMethods.length ? availableMethods : ['cash', 'upi', 'card', 'credit', 'mixed'])
    .map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }));

  const hasActiveFilters =
    paymentMethods.length > 0 || paymentStatuses.length > 0 ||
    !!customer.trim() || !!minTotal || !!maxTotal;

  return (
    <div>
      <TopBar
        title="Reports & Analytics"
        actions={
          data ? (
            <div className="flex items-center gap-2">
              <button
                onClick={exportInvoicesCSV}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-[#e5e9f0] hover:bg-[#f5f7fb] text-[#20283b] text-sm font-semibold rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Export Invoices
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-[#237a59] hover:bg-[#1d6649] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="p-6 space-y-6">
        {/* ────────── Filter Panel ────────── */}
        <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm overflow-hidden transition-all duration-200">
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#f9fafb] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#237a59]" />
              <span className="font-bold text-[#20283b] text-sm">Filters & Options</span>
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 bg-[#237a59] text-white text-[10px] font-bold rounded">
                  {paymentMethods.length + paymentStatuses.length + (customer ? 1 : 0) + (minTotal ? 1 : 0) + (maxTotal ? 1 : 0)} ACTIVE
                </span>
              )}
            </div>
            {filtersOpen ? <ChevronUp className="w-4 h-4 text-[#798397]" /> : <ChevronDown className="w-4 h-4 text-[#798397]" />}
          </button>

          <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="p-5 border-t border-[#e5e9f0] space-y-5">
                {/* Preset row */}
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPreset(p.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                        preset === p.value
                          ? 'bg-[#237a59] border-[#237a59] text-white shadow-sm'
                          : 'bg-white border-[#e5e9f0] text-[#5b6b82] hover:border-[#237a59]/40'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Filter grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">From Date</label>
                    <DatePicker className="w-full" value={fromDate} onChange={v => { setFromDate(v); setPreset('custom'); }} placeholder="From" compact />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">To Date</label>
                    <DatePicker className="w-full" value={toDate} onChange={v => { setToDate(v); setPreset('custom'); }} placeholder="To" compact />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">Payment Methods</label>
                    <MultiSelect
                      values={paymentMethods}
                      onChange={setPaymentMethods}
                      options={methodOptions}
                      placeholder="All methods"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">Payment Status</label>
                    <MultiSelect
                      values={paymentStatuses}
                      onChange={setPaymentStatuses}
                      options={PAYMENT_STATUS_OPTIONS}
                      placeholder="All statuses"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">Customer / Invoice</label>
                    <input
                      type="text"
                      value={customer}
                      onChange={e => setCustomer(e.target.value)}
                      placeholder="Name, phone or invoice no."
                      className="w-full px-3 py-2 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder-[#c2cad6] focus:outline-none focus:border-[#237a59] focus:ring-2 focus:ring-[#237a59]/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">Min Invoice Total</label>
                    <input
                      type="number" min="0" value={minTotal}
                      onChange={e => setMinTotal(e.target.value)} placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder-[#c2cad6] focus:outline-none focus:border-[#237a59] focus:ring-2 focus:ring-[#237a59]/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">Max Invoice Total</label>
                    <input
                      type="number" min="0" value={maxTotal}
                      onChange={e => setMaxTotal(e.target.value)} placeholder="No limit"
                      className="w-full px-3 py-2 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder-[#c2cad6] focus:outline-none focus:border-[#237a59] focus:ring-2 focus:ring-[#237a59]/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-1.5">Group Chart By</label>
                    <Select
                      value={groupBy}
                      onChange={v => setGroupBy(v as 'day' | 'week' | 'month')}
                      options={[
                        { value: 'day', label: 'Day' },
                        { value: 'week', label: 'Week' },
                        { value: 'month', label: 'Month' },
                      ]}
                      searchable={false}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e5e9f0] hover:bg-[#f5f7fb] text-[#5b6b82] text-sm font-semibold rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                  <button
                    onClick={runReport}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2 bg-[#237a59] hover:bg-[#1d6649] text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60 active:scale-[0.98] shadow-sm"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : <>Run Report</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ────────── Loading skeleton ────────── */}
        {loading && !data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border border-[#e5e9f0] animate-pulse" />)}
          </div>
        )}

        {/* ────────── Results ────────── */}
        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI label="Total Sales" value={money(data.summary.total_sales)} delta={data.comparison.sales_change_pct} />
              <KPI label="Gross Profit" value={money(data.summary.gross_profit)} delta={data.comparison.profit_change_pct}
                color={data.summary.gross_profit >= 0 ? 'text-[#16804a]' : 'text-[#b32642]'}
                sub={`Margin ${(data.summary.gross_margin_pct || 0).toFixed(1)}%`} />
              <KPI label="Invoices" value={String(data.summary.invoice_count)} delta={data.comparison.invoices_change_pct}
                sub={`Avg ${money(data.summary.avg_invoice_value)}`} />
              <KPI label="COGS" value={money(data.summary.total_cogs)} color="text-[#a55b00]" />
              <KPI label="Collected" value={money(data.summary.total_paid)} color="text-[#16804a]" sub={`Due ${money(data.summary.total_due)}`} />
              <KPI label="Discount Given" value={money(data.summary.total_discount)} color="text-[#5b6b82]" />
            </div>

            {/* Comparison strip */}
            <div className="bg-linear-to-r from-[#eef5f1] to-[#eef3fa] border border-[#e5e9f0] rounded-xl p-4 text-xs text-[#5b6b82] flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="font-bold text-[#20283b]">Compared to previous period:</span>
              <span>{formatDate(data.comparison.prev_from)} → {formatDate(data.comparison.prev_to)}</span>
              <span>Sales <strong>{money(data.comparison.prev_sales)}</strong></span>
              <span>Profit <strong>{money(data.comparison.prev_profit)}</strong></span>
              <span>Invoices <strong>{data.comparison.prev_invoice_count}</strong></span>
            </div>

            {/* Trend chart */}
            {chartData.length > 0 && (
              <Section
                title={`Sales & Profit Trend (${groupBy === 'day' ? 'Daily' : groupBy === 'week' ? 'Weekly' : 'Monthly'})`}
                icon={BarChart3}
                right={
                  <div className="flex rounded-lg border border-[#e5e9f0] overflow-hidden">
                    <button onClick={() => setChartType('bar')}
                      className={`px-3 py-1 text-xs font-semibold transition-colors ${chartType === 'bar' ? 'bg-[#237a59] text-white' : 'bg-white text-[#5b6b82] hover:bg-[#f5f7fb]'}`}>
                      Bars
                    </button>
                    <button onClick={() => setChartType('line')}
                      className={`px-3 py-1 text-xs font-semibold transition-colors ${chartType === 'line' ? 'bg-[#237a59] text-white' : 'bg-white text-[#5b6b82] hover:bg-[#f5f7fb]'}`}>
                      Lines
                    </button>
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height={280}>
                  {chartType === 'bar' ? (
                    <BarChart data={chartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => money(Number(v))} />
                      <Legend />
                      <Bar dataKey="sales" name="Sales" fill="#237a59" radius={[3, 3, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="profit" name="Gross Profit" fill="#3479e6" radius={[3, 3, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#237a59" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#237a59" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3479e6" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#3479e6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickMargin={6} axisLine={{ stroke: '#e5e9f0' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => money(Number(v))} />
                      <Tooltip
                        formatter={(v) => money(Number(v))}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e9f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                        cursor={{ stroke: '#c2cad6', strokeDasharray: '3 3' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="#237a59"
                        strokeWidth={2.5}
                        fill="url(#salesFill)"
                        dot={{ r: 4, fill: '#fff', stroke: '#237a59', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#237a59', stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive
                        animationDuration={500}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        name="Gross Profit"
                        stroke="#3479e6"
                        strokeWidth={2.5}
                        fill="url(#profitFill)"
                        dot={{ r: 4, fill: '#fff', stroke: '#3479e6', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#3479e6', stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive
                        animationDuration={500}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Section>
            )}

            {/* Sales breakdown donut */}
            <Section title="Sales Breakdown" icon={PieIcon}>
              {data.summary.total_sales === 0 ? (
                <div className="h-40 flex items-center justify-center text-[#798397] text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={salesDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value">
                      {salesDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* Payment Method + Status */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Section title="Payment Method Breakdown" icon={CreditCard}>
                {data.payment_wise?.length === 0 ? (
                  <p className="text-sm text-[#798397]">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.payment_wise.map((pw, i) => {
                      const pct = data.summary.total_sales > 0 ? (pw.total / data.summary.total_sales) * 100 : 0;
                      return (
                        <div key={i} className="p-3 bg-[#f9fafb] rounded-lg border border-[#e5e9f0]">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-bold text-[#20283b] capitalize">{pw.payment_method}</p>
                              <p className="text-xs text-[#798397]">{pw.count} txn · {pct.toFixed(1)}%</p>
                            </div>
                            <span className="text-base font-black text-[#20283b]">{money(pw.total)}</span>
                          </div>
                          <div className="h-1.5 bg-[#e5e9f0] rounded-full overflow-hidden">
                            <div className="h-full bg-[#237a59] rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section title="Payment Status Breakdown" icon={Receipt}>
                {data.status_wise?.length === 0 ? (
                  <p className="text-sm text-[#798397]">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.status_wise.map((sw, i) => {
                      const colors: Record<string, string> = {
                        paid: 'bg-[#e6f5eb] text-[#16804a]',
                        partial: 'bg-[#fff8e8] text-[#a55b00]',
                        due: 'bg-[#fff0f1] text-[#b32642]',
                      };
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#f9fafb] rounded-lg border border-[#e5e9f0]">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${colors[sw.payment_status] || 'bg-[#f0f2f5] text-[#798397]'}`}>
                              {sw.payment_status}
                            </span>
                            <span className="text-xs text-[#798397]">{sw.count} invoice{sw.count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-black text-[#20283b]">{money(sw.total)}</p>
                            {sw.due_amount > 0 && (
                              <p className="text-xs text-[#b32642] font-semibold">Due: {money(sw.due_amount)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* Best Sellers + Category */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Section title="Best Sellers (Top 50)" icon={Package}>
                {data.best_selling?.length === 0 ? (
                  <p className="text-sm text-[#798397]">No data</p>
                ) : (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#f5f7fb] z-10">
                        <tr className="border-b border-[#e5e9f0]">
                          {['Product', 'Size', 'Qty', 'Revenue', 'Profit'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[11px] font-bold text-[#798397] uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f2f5]">
                        {data.best_selling.map((p, i) => (
                          <tr key={i} className="hover:bg-[#f9fafb]">
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-[#20283b] truncate max-w-40">{p.name}</p>
                              <p className="text-[11px] text-[#798397] font-mono">{p.sku}</p>
                            </td>
                            <td className="px-3 py-2.5 text-[#798397]">{p.size || '—'}</td>
                            <td className="px-3 py-2.5 font-bold text-[#20283b]">{Number(p.units_sold)}</td>
                            <td className="px-3 py-2.5 font-semibold text-[#237a59]">{money(p.revenue)}</td>
                            <td className="px-3 py-2.5 font-semibold text-[#3479e6]">{money(p.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Category-wise Sales" icon={Package}>
                {data.category_wise?.length === 0 ? (
                  <p className="text-sm text-[#798397]">No data</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {data.category_wise.map((c, i) => {
                      const pct = data.summary.total_sales > 0 ? (c.revenue / data.summary.total_sales) * 100 : 0;
                      return (
                        <div key={i} className="p-3 bg-[#f9fafb] rounded-lg border border-[#e5e9f0]">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-bold text-[#20283b]">{c.category}</p>
                              <p className="text-xs text-[#798397]">{Number(c.units_sold)} units · profit {money(c.profit)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-[#20283b]">{money(c.revenue)}</p>
                              <p className="text-xs text-[#798397]">{pct.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="h-1.5 bg-[#e5e9f0] rounded-full overflow-hidden">
                            <div className="h-full bg-[#3479e6] rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* Top customers */}
            {data.top_customers?.length > 0 && (
              <Section title={`Top Customers (${data.top_customers.length})`} icon={Users}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f5f7fb] border-b border-[#e5e9f0]">
                        {['Customer', 'Phone', 'Invoices', 'Spent', 'Profit'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[11px] font-bold text-[#798397] uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f5]">
                      {data.top_customers.map((c, i) => (
                        <tr key={i} className="hover:bg-[#f9fafb]">
                          <td className="px-3 py-2.5 font-semibold text-[#20283b]">{c.customer_name || '—'}</td>
                          <td className="px-3 py-2.5 text-[#798397] font-mono text-xs">{c.customer_phone || '—'}</td>
                          <td className="px-3 py-2.5 text-[#20283b]">{Number(c.invoice_count)}</td>
                          <td className="px-3 py-2.5 font-bold text-[#237a59]">{money(c.total_spent)}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#3479e6]">{money(c.total_profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Invoices */}
            {sortedInvoices.length > 0 && (
              <Section
                title={`Invoice List (${sortedInvoices.length})`}
                icon={Calendar}
                right={
                  <div className="w-44">
                    <Select
                      value={sortBy}
                      onChange={setSortBy}
                      options={SORT_FIELDS}
                      searchable={false}
                    />
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f5f7fb] border-b border-[#e5e9f0]">
                        {['Invoice', 'Date', 'Customer', 'Items', 'Total', 'Paid', 'Due', 'Profit', 'Method', 'Status'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[11px] font-bold text-[#798397] uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2f5]">
                      {sortedInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-[#f9fafb] transition-colors">
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#3479e6]">{inv.invoice_no}</td>
                          <td className="px-3 py-2.5 text-[#798397] whitespace-nowrap">{formatDate(inv.date)}</td>
                          <td className="px-3 py-2.5 text-[#20283b]">
                            <p className="font-semibold truncate max-w-40">{inv.customer_name || 'Walk-in'}</p>
                            {inv.customer_phone && <p className="text-[11px] text-[#798397] font-mono">{inv.customer_phone}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-[#5b6b82]">{inv.items?.length ?? 0}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#20283b]">{money(inv.total)}</td>
                          <td className="px-3 py-2.5 text-[#16804a]">{money(inv.amount_paid)}</td>
                          <td className="px-3 py-2.5 text-[#b32642]">{money(inv.amount_due)}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#237a59]">{money(inv.gross_profit)}</td>
                          <td className="px-3 py-2.5 text-[#798397] capitalize">{inv.payment_method}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              inv.payment_status === 'paid' ? 'bg-[#e6f5eb] text-[#16804a]' :
                              inv.payment_status === 'partial' ? 'bg-[#fff8e8] text-[#a55b00]' :
                              'bg-[#fff0f1] text-[#b32642]'
                            }`}>{inv.payment_status.toUpperCase()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {sortedInvoices.length === 0 && !loading && (
              <div className="py-16 text-center text-[#798397] bg-white rounded-xl border border-[#e5e9f0]">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-semibold">No invoices match the current filters</p>
                <p className="text-xs mt-1 opacity-70">Try widening the date range or clearing filters</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
