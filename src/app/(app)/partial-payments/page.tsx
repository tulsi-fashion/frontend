'use client';
import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, MessageCircle, ChevronDown, ChevronLeft, ChevronRight, Phone, FileText, Clock } from 'lucide-react';
import { api } from '../../../lib/api';
import { money, formatDate, today } from '../../../lib/utils';
import { showToast } from '../../../components/ui/Toast';
import Modal from '../../../components/ui/Modal';
import TopBar from '../../../components/layout/TopBar';
import DatePicker from '../../../components/ui/DatePicker';
import Select from '../../../components/ui/Select';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

interface BillItem { id: string; name: string; sku: string; size: string; qty: number; price: number; line_total: number; }
interface Settlement { id: string; amount: number; date: string; created_at: string; notes?: string; }
interface Bill {
  id: string; sale_id: string; invoice_no: string; date: string;
  bill_total: number; amount_paid: number; amount_due: number;
  status: 'open' | 'settled'; payment_method?: string;
  items: BillItem[]; items_count: number; settlements: Settlement[];
}
interface CustomerGroup {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  total_due: number;
  open_bills: number;
  bills_count: number;
  bills: Bill[];
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PartialPaymentsPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [totalOpenDue, setTotalOpenDue] = useState(0);
  const [totalEverPaidServer, setTotalEverPaidServer] = useState(0);
  const [totalBillsServer, setTotalBillsServer] = useState(0);
  const [openBillsCountServer, setOpenBillsCountServer] = useState(0);
  const [settledBillsCountServer, setSettledBillsCountServer] = useState(0);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [totalPagesServer, setTotalPagesServer] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'settled'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState<Bill | null>(null);
  const [settleCustomer, setSettleCustomer] = useState<CustomerGroup | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [settleDate, setSettleDate] = useState(today());
  const [settleNotes, setSettleNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      const res = await api.get(`/api/partial-payments/by-customer?${params.toString()}`);
      const data = res?.success?.data;
      setGroups(Array.isArray(data?.customers) ? data.customers : []);
      setTotalOpenDue(Number(data?.total_open_due) || 0);
      setTotalEverPaidServer(Number(data?.total_ever_paid) || 0);
      setTotalBillsServer(Number(data?.total_bills) || 0);
      setOpenBillsCountServer(Number(data?.open_bills_count) || 0);
      setSettledBillsCountServer(Number(data?.settled_bills_count) || 0);
      setCustomersTotal(Number(data?.total) || 0);
      setTotalPagesServer(Number(data?.totalPages) || 1);
    } catch {
      showToast('Failed to load dues', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);

  function keyOf(g: CustomerGroup) { return g.customer_id || g.customer_phone || g.customer_name; }

  function toggleGroup(g: CustomerGroup) {
    const k = keyOf(g);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function openSettle(bill: Bill, customer: CustomerGroup) {
    setSettling(bill);
    setSettleCustomer(customer);
    setSettleAmount(String(bill.amount_due.toFixed(2)));
    setSettleMethod('Cash');
    setSettleDate(today());
    setSettleNotes('');
  }

  async function handleSettle() {
    if (!settling) return;
    const amt = Number(settleAmount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (amt > settling.amount_due) {
      showToast(`Cannot pay more than remaining due of ${money(settling.amount_due)}`, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/api/partial-payments/${settling.id}/settle`, {
        amount: amt,
        payment_method: settleMethod,
        date: settleDate,
        notes: settleNotes || undefined,
      });
      if (res?.error) {
        showToast(res.error.message || 'Failed to settle', 'error');
        return;
      }
      showToast('Payment recorded');
      setSettling(null);
      setSettleCustomer(null);
      await load();
    } catch {
      showToast('Failed to settle payment', 'error');
    } finally {
      setSaving(false);
    }
  }

  function sendWhatsApp(c: CustomerGroup) {
    const phone = c.customer_phone?.replace(/\D/g, '');
    if (!phone) { showToast('No phone number', 'error'); return; }
    if (!c.customer_id) { showToast('Customer link unavailable', 'error'); return; }
    const origin = window.location.origin;
    const openBills = c.bills.filter(b => b.status === 'open');
    const lines = openBills.map(b =>
`*Date:* ${formatDate(b.date)}
*Invoice:* ${b.invoice_no}

*View your bill:*
${origin}/invoice/${encodeURIComponent(b.invoice_no)}/${c.customer_id}`
    ).join('\n\n━━━━━━━━━━━━━━━━\n\n');
    const msg =
`*Tulshi Fashion*
━━━━━━━━━━━━━━━━
Hi ${c.customer_name || 'there'}

A gentle reminder about your pending balance.

${lines}

━━━━━━━━━━━━━━━━
Kindly settle at your earliest convenience. Thank You!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  const settleRemainingPreview = settling ? Math.max(0, settling.amount_due - (Number(settleAmount) || 0)) : 0;

  // Filter groups by status: a group matches "open" if it has any open bills,
  // "settled" if ALL its bills are settled (i.e. historical only).
  const filteredGroups = groups
    .map(g => {
      if (statusFilter === 'all') return g;
      const bills = g.bills.filter(b => b.status === statusFilter);
      if (bills.length === 0) return null;
      return { ...g, bills, bills_count: bills.length, open_bills: bills.filter(b => b.status === 'open').length };
    })
    .filter(Boolean) as CustomerGroup[];

  // Server-computed aggregates (always reflect the full filtered set, regardless of page)
  const totalEverPaid = totalEverPaidServer;
  const totalBills = totalBillsServer;
  const openBillsCount = openBillsCountServer;
  const settledBillsCount = settledBillsCountServer;

  const totalPages = Math.max(1, totalPagesServer);
  const safePage = Math.min(page, totalPages);
  const pagedGroups = filteredGroups;

  return (
    <div>
      <TopBar title="Dues & Payments" />

      <div className="p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="bg-[#fff0f1] border border-[#f5c2c7] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#b32642] uppercase tracking-wide">Open Dues</p>
            <p className="text-2xl font-black text-[#b32642] mt-1 tabular-nums">{money(totalOpenDue)}</p>
            <p className="text-[11px] text-[#b32642]/80 font-semibold mt-0.5">{openBillsCount} bill{openBillsCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-[#eaf5ef] border border-[#c3e6cf] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#16804a] uppercase tracking-wide">Total Paid (history)</p>
            <p className="text-2xl font-black text-[#16804a] mt-1 tabular-nums">{money(totalEverPaid)}</p>
            <p className="text-[11px] text-[#16804a]/80 font-semibold mt-0.5">{settledBillsCount} settled bill{settledBillsCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-[#e5e9f0] rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-[#798397] uppercase tracking-wide">Customers With History</p>
            <p className="text-2xl font-black text-[#20283b] mt-1 tabular-nums">{customersTotal}</p>
            <p className="text-[11px] text-[#798397] font-semibold mt-0.5">{totalBills} bill{totalBills !== 1 ? 's' : ''} total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#798397]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, phone or invoice…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e5e9f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
            />
          </div>
          <div className="flex gap-1 bg-white border border-[#e5e9f0] rounded-lg p-1">
            {(['all', 'open', 'settled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  statusFilter === s ? 'bg-[#237a59] text-white shadow-sm' : 'text-[#798397] hover:text-[#20283b]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2.5 border border-[#e5e9f0] rounded-lg hover:bg-[#f5f7fb] text-[#798397] bg-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Customer groups */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#f5f7fb] rounded-xl animate-pulse" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-20 text-center text-[#798397] bg-white rounded-xl border border-[#e5e9f0]">
            <p className="text-sm">No {statusFilter !== 'all' ? statusFilter + ' ' : ''}dues found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pagedGroups.map(g => {
              const k = keyOf(g);
              const isOpen = expanded.has(k);
              const openDue = g.bills.filter(b => b.status === 'open').reduce((s, b) => s + b.amount_due, 0);
              const paidInView = g.bills.reduce((s, b) => s + b.amount_paid, 0);
              return (
                <div key={k} className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm overflow-hidden transition-all">
                  <button
                    onClick={() => toggleGroup(g)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#f9fafb] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-[#20283b] truncate">{g.customer_name || 'Walk-in'}</p>
                        {g.open_bills > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#fff0f1] text-[#b32642] text-[10px] font-bold uppercase tracking-wide">
                            {g.open_bills} open
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-[#798397]">
                        {g.customer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />+91 {g.customer_phone}</span>}
                        <span>{g.bills_count} bill{g.bills_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {openDue > 0 ? (
                        <>
                          <p className="text-[10px] font-bold text-[#798397] uppercase tracking-wide">Open Due</p>
                          <p className="text-xl font-black tabular-nums text-[#b32642]">{money(openDue)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold text-[#798397] uppercase tracking-wide">Total Paid</p>
                          <p className="text-xl font-black tabular-nums text-[#16804a]">{money(paidInView)}</p>
                          <p className="text-[10px] font-semibold text-[#16804a]/70">All settled</p>
                        </>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#798397] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <div
                    className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-[#eef1f6] px-5 pt-4 pb-5 space-y-3 bg-[#fafbfd]">
                        {g.customer_phone && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => sendWhatsApp(g)}
                              disabled={openDue <= 0}
                              className="flex items-center gap-1.5 text-xs font-semibold text-[#25d366] hover:underline disabled:text-[#798397] disabled:no-underline disabled:cursor-not-allowed disabled:opacity-60"
                              title={openDue <= 0 ? 'No open dues to remind about' : 'Send WhatsApp reminder'}
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp reminder for all dues
                            </button>
                          </div>
                        )}

                        {g.bills.map(bill => (
                          <div key={bill.id} className="bg-white border border-[#e5e9f0] rounded-xl p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-[#3479e6]" />
                                  <span className="font-mono text-sm font-bold text-[#3479e6]">{bill.invoice_no}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${bill.status === 'settled' ? 'bg-[#e6f5eb] text-[#16804a]' : 'bg-[#fff0f1] text-[#b32642]'}`}>
                                    {bill.status}
                                  </span>
                                </div>
                                <p className="text-xs text-[#798397] mt-1">{formatDate(bill.date)} · {bill.items_count} items</p>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                <div>
                                  <p className="text-[10px] font-bold text-[#798397] uppercase">Total</p>
                                  <p className="text-sm font-bold text-[#20283b] tabular-nums">{money(bill.bill_total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-[#798397] uppercase">Paid</p>
                                  <p className="text-sm font-bold text-[#16804a] tabular-nums">{money(bill.amount_paid)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-[#798397] uppercase">Due</p>
                                  <p className={`text-sm font-black tabular-nums ${bill.amount_due > 0 ? 'text-[#b32642]' : 'text-[#16804a]'}`}>{money(bill.amount_due)}</p>
                                </div>
                                {bill.status === 'open' && (
                                  <button
                                    onClick={() => openSettle(bill, g)}
                                    className="px-3 py-1.5 bg-[#237a59] hover:bg-[#1d6649] text-white text-xs font-bold rounded-lg transition-colors"
                                  >
                                    Pay
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Items */}
                            {bill.items.length > 0 && (
                              <div className="bg-[#f9fafb] rounded-lg border border-[#eef1f6] overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-[#f5f7fb]">
                                      <th className="px-3 py-2 text-left font-bold text-[#798397] uppercase tracking-wide">Item</th>
                                      <th className="px-3 py-2 text-left font-bold text-[#798397] uppercase tracking-wide">Size</th>
                                      <th className="px-3 py-2 text-right font-bold text-[#798397] uppercase tracking-wide">Qty</th>
                                      <th className="px-3 py-2 text-right font-bold text-[#798397] uppercase tracking-wide">Price</th>
                                      <th className="px-3 py-2 text-right font-bold text-[#798397] uppercase tracking-wide">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bill.items.map(it => (
                                      <tr key={it.id} className="border-t border-[#eef1f6]">
                                        <td className="px-3 py-2 font-semibold text-[#20283b]">{it.name}</td>
                                        <td className="px-3 py-2 text-[#798397]">{it.size || '—'}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{money(it.price)}</td>
                                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(it.line_total)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Payment history */}
                            {bill.settlements.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-[#798397] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Payment history
                                </p>
                                <ul className="space-y-1.5">
                                  {bill.settlements.map((s, idx) => {
                                    const paidSoFar = bill.settlements.slice(0, idx + 1).reduce((sum, x) => sum + x.amount, 0);
                                    const remainingAfter = Math.max(0, bill.bill_total - paidSoFar);
                                    return (
                                      <li key={s.id} className="flex items-center justify-between gap-3 bg-[#eaf5ef] border border-[#c3e6cf] rounded-lg px-3 py-2 text-xs">
                                        <div>
                                          <span className="font-bold text-[#16804a]">+{money(s.amount)}</span>
                                          <span className="text-[#798397] ml-2">{fmtDateTime(s.created_at)}</span>
                                          {s.notes && <p className="text-[#798397] mt-0.5 italic">{s.notes}</p>}
                                        </div>
                                        <span className="text-[#798397]">
                                          Due after: <span className="font-bold text-[#20283b] tabular-nums">{money(remainingAfter)}</span>
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {customersTotal > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-3 bg-[#fafbfd] border border-[#e5e9f0] rounded-xl px-5 py-3 text-sm">
                <span className="text-xs text-[#798397]">
                  Showing <span className="font-bold text-[#20283b] tabular-nums">{Math.min((safePage - 1) * pageSize + 1, customersTotal)}–{Math.min(safePage * pageSize, customersTotal)}</span>
                  {' '}of <span className="font-bold text-[#20283b] tabular-nums">{customersTotal}</span> customers
                </span>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={safePage <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-90"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
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
                              safePage === n
                                ? 'bg-[#237a59] text-white shadow-sm'
                                : 'text-[#798397] hover:bg-[#f1f3f7] hover:text-[#20283b]'
                            }`}
                          >
                            {n}
                          </button>
                        )
                      )}
                    <button
                      disabled={safePage >= totalPages}
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
                        value={String(pageSize)}
                        onChange={v => setPageSize(Number(v))}
                        options={[10, 25, 50, 100].map(n => ({ value: String(n), label: String(n) }))}
                        searchable={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settle Modal */}
      <Modal
        open={!!settling}
        onClose={() => { setSettling(null); setSettleCustomer(null); }}
        title="Record Payment"
      >
        {settling && settleCustomer && (
          <div className="space-y-4">
            <div className="p-4 bg-[#f9fafb] rounded-xl border border-[#e5e9f0] space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#798397]">Customer</span><span className="font-semibold">{settleCustomer.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-[#798397]">Invoice</span><span className="font-mono font-semibold text-[#3479e6]">{settling.invoice_no}</span></div>
              <div className="flex justify-between"><span className="text-[#798397]">Bill Total</span><span className="font-semibold tabular-nums">{money(settling.bill_total)}</span></div>
              <div className="flex justify-between"><span className="text-[#798397]">Already Paid</span><span className="font-semibold text-[#16804a] tabular-nums">{money(settling.amount_paid)}</span></div>
              <div className="flex justify-between pt-2 border-t border-[#e5e9f0]"><span className="font-bold text-[#20283b]">Amount Due</span><span className="font-black text-[#b32642] tabular-nums">{money(settling.amount_due)}</span></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Amount Received (₹)</label>
              <input
                type="number"
                min="0.01"
                max={settling.amount_due}
                step="0.01"
                value={settleAmount}
                onChange={e => {
                  const v = e.target.value;
                  const n = Number(v);
                  if (n > settling.amount_due) { setSettleAmount(String(settling.amount_due.toFixed(2))); return; }
                  setSettleAmount(v);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
              />
              <p className="mt-1 text-[11px] text-[#798397]">Maximum: {money(settling.amount_due)}. Overpayment is not allowed.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Payment Method</label>
                <Select
                  value={settleMethod}
                  onChange={setSettleMethod}
                  options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Date</label>
                <DatePicker value={settleDate} onChange={v => setSettleDate(v)} placeholder="Select date" clearable={false} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Notes (optional)</label>
              <input
                value={settleNotes}
                onChange={e => setSettleNotes(e.target.value)}
                placeholder="e.g. received at counter"
                className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
              />
            </div>

            <div className="flex justify-between px-3 py-2.5 rounded-lg bg-[#eaf5ef] border border-[#c3e6cf]">
              <span className="text-sm font-bold text-[#237a59]">Remaining After Payment</span>
              <span className="text-sm font-black text-[#237a59] tabular-nums">{money(settleRemainingPreview)}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setSettling(null); setSettleCustomer(null); }}
                className="flex-1 py-2.5 border border-[#e5e9f0] text-[#798397] font-semibold rounded-lg text-sm hover:bg-[#f5f7fb] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSettle}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
