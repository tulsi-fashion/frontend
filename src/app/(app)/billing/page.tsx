'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Trash2, X, ShoppingCart, CheckCircle, Copy, Printer, Check } from 'lucide-react';
import { api } from '../../../lib/api';
import { money, today, formatDate } from '../../../lib/utils';
import { Product, Sale, Customer } from '../../../types';
import { useCartStore, BillableProduct } from '../../../store/cartStore';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';
import Select from '../../../components/ui/Select';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit/Due'];

export default function BillingPage() {
  const { items, addItem, removeItem, updateQty, clearCart, subtotal, totalCogs } = useCartStore();
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BillableProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLookupState, setCustomerLookupState] = useState<'idle' | 'searching' | 'found' | 'new'>('idle');
  const phoneLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [customerSuggestOpen, setCustomerSuggestOpen] = useState<null | 'name' | 'phone'>(null);
  const [customerSuggestIdx, setCustomerSuggestIdx] = useState(-1);
  const customerSuggestRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerSearchIdRef = useRef(0);
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [paidTouched, setPaidTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // All totals are live-derived from cart items + discount — any change updates everything.
  const sub = subtotal();
  const cogs = totalCogs();
  const disc = Math.min(Math.max(Number(discount) || 0, 0), sub);
  const total = sub - disc;
  const estProfit = sub - disc - cogs;

  // Derive the Amount Paid displayed value & numeric paid in a single render pass
  // (no setState inside useEffect — avoids the two-render flicker that made the
  // Complete Sale button jump when quantity changed).
  const defaultPaidStr = paymentMethod === 'Credit/Due' ? '0' : total.toFixed(2);
  const paidStr = paidTouched ? amountPaid : defaultPaidStr;
  const paid = Number(paidStr) || 0;
  const remaining = Math.max(0, total - paid);

  // When a sale lands, the dialog is first mounted in its closed state so
  // transition classes have an "off" frame to animate from. Two rAFs is more
  // reliable than one across browsers.
  useEffect(() => {
    if (!completedSale) return;
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setPopupOpen(true));
      cleanupRef.current = () => cancelAnimationFrame(r2);
    });
    return () => { cancelAnimationFrame(r1); cleanupRef.current?.(); };
  }, [completedSale]);

  // Click outside the Product Search panel → close results and clear query
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!searchBoxRef.current) return;
      if (searchBoxRef.current.contains(e.target as Node)) return;
      if (!searchQuery && searchResults.length === 0) return;
      setSearchQuery('');
      setSearchResults([]);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [searchQuery, searchResults.length]);

  async function lookupCustomerByPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setCustomerLookupState('idle'); return; }
    setCustomerLookupState('searching');
    try {
      const res = await api.get(`/api/customers?search=${encodeURIComponent(digits)}&limit=1`);
      const customers = res?.success?.data?.customers;
      if (Array.isArray(customers) && customers.length > 0) {
        const found = customers[0];
        setCustomerName(found.name);
        setCustomerLookupState('found');
      } else {
        setCustomerLookupState('new');
      }
    } catch {
      setCustomerLookupState('idle');
    }
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setCustomerPhone(digits);
    setCustomerLookupState('idle');
    if (phoneLookupRef.current) clearTimeout(phoneLookupRef.current);
    phoneLookupRef.current = setTimeout(() => lookupCustomerByPhone(digits), 500);
    scheduleCustomerSuggest(digits, 'phone');
  }

  function handleNameChange(value: string) {
    const clean = value.replace(/[^a-zA-Z0-9 ]/g, '');
    setCustomerName(clean);
    scheduleCustomerSuggest(clean, 'name');
  }

  function scheduleCustomerSuggest(query: string, field: 'name' | 'phone') {
    if (customerSuggestRef.current) clearTimeout(customerSuggestRef.current);
    const q = query.trim();
    if (q.length < 2) { setCustomerSuggestions([]); setCustomerSuggestOpen(null); setCustomerSuggestIdx(-1); return; }
    setCustomerSuggestOpen(field);
    setCustomerSuggestIdx(-1);
    customerSuggestRef.current = setTimeout(() => fetchCustomerSuggestions(q), 250);
  }

  function handleCustomerKeyDown(e: React.KeyboardEvent<HTMLInputElement>, field: 'name' | 'phone') {
    if (customerSuggestOpen !== field || customerSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCustomerSuggestIdx(i => (i + 1) % customerSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCustomerSuggestIdx(i => (i <= 0 ? customerSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (customerSuggestIdx >= 0) {
        e.preventDefault();
        pickCustomer(customerSuggestions[customerSuggestIdx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCustomerSuggestOpen(null);
      setCustomerSuggestIdx(-1);
    }
  }

  async function fetchCustomerSuggestions(q: string) {
    const id = ++customerSearchIdRef.current;
    try {
      const res = await api.get(`/api/customers?search=${encodeURIComponent(q)}&limit=6`);
      if (id !== customerSearchIdRef.current) return;
      const list: Customer[] = Array.isArray(res?.success?.data?.customers) ? res.success.data.customers : [];
      setCustomerSuggestions(list);
    } catch {
      if (id !== customerSearchIdRef.current) return;
      setCustomerSuggestions([]);
    }
  }

  function pickCustomer(c: Customer) {
    setCustomerName(c.name || '');
    setCustomerPhone(c.phone || '');
    setCustomerLookupState('found');
    setCustomerSuggestions([]);
    setCustomerSuggestOpen(null);
    setCustomerSuggestIdx(-1);
  }


  const searchIdRef = useRef(0);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const id = ++searchIdRef.current;
    try {
      const data = await api.get(`/api/products?search=${encodeURIComponent(q)}`);
      if (id !== searchIdRef.current) return; // stale response — a newer request is in flight
      const products: Product[] = Array.isArray(data?.success?.data?.products) ? data.success.data.products : [];
      const flat: BillableProduct[] = [];
      for (const p of products) {
        if (p.variants && p.variants.length > 0) {
          for (const v of p.variants) {
            flat.push({
              id: v.id,
              product_id: p.id,
              sku: p.sku,
              barcode: v.barcode,
              name: p.name,
              size: v.size_info?.name || '—',
              purchase_price: v.purchase_price ?? p.purchase_price,
              selling_price: v.selling_price ?? p.selling_price,
              stock: v.stock,
              photo_url: p.photo_url,
            });
          }
        }
      }
      setSearchResults(flat.slice(0, 10));
    } catch {
      if (id !== searchIdRef.current) return;
      setSearchResults([]);
    } finally {
      if (id === searchIdRef.current) setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  async function handleCompleteSale() {
    if (items.length === 0) { showToast('Cart is empty', 'error'); return; }
    if (total <= 0) { showToast('Total must be greater than 0', 'error'); return; }
    if (!customerName.trim()) { showToast('Customer name is required', 'error'); return; }
    if (customerPhone.length !== 10) { showToast('Enter a valid 10-digit phone number', 'error'); return; }

    let payStatus: 'paid' | 'partial' | 'due' = 'paid';
    if (paymentMethod === 'Credit/Due') {
      payStatus = 'due';
    } else if (paid < total) {
      payStatus = 'partial';
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const timeStr = now.toISOString().slice(11, 19); // HH:MM:SS (locale-safe)

      const saleData = {
        customer_name: customerName || 'Walk-in',
        customer_phone: customerPhone,
        items: items.map(i => ({ variant_id: i.variant_id, product_id: i.product_id, qty: i.qty, price: i.price })),
        discount: disc,
        amount_paid: paymentMethod === 'Credit/Due' ? 0 : paid,
        payment_method: paymentMethod,
        date: today(),
        time: timeStr,
      };

      const result = await api.post('/api/sales', saleData);
      const sale: Sale = result?.success?.data?.sale;

      if (!sale?.id) {
        showToast(result?.error?.message || 'Failed to create sale', 'error');
        return;
      }

      setCompletedSale(sale);
      setPopupOpen(false);
      setCopied(false);
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerLookupState('idle');
      setDiscount('0');
      setPaymentMethod('Cash');
      setAmountPaid('');
      setPaidTouched(false);
      showToast(`Bill ${sale.invoice_no} created!`);
    } catch (err: any) {
      console.error('[handleCompleteSale]', err);
      showToast(err?.message || 'Failed to create sale', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleWhatsApp() {
    if (!completedSale) return;
    const phone = completedSale.customer_phone?.replace(/\D/g, '');
    if (!phone) { showToast('No phone number to send WhatsApp', 'error'); return; }
    if (!completedSale.customer_id) {
      showToast('Customer link unavailable for this bill', 'error');
      return;
    }
    const link = `${window.location.origin}/invoice/${encodeURIComponent(completedSale.invoice_no)}/${completedSale.customer_id}`;
    const msg =
`*Tulshi Fashion*
━━━━━━━━━━━━━━━━
Hi ${completedSale.customer_name || 'there'}

*Date:* ${formatDate(completedSale.date)}
*Invoice:* ${completedSale.invoice_no}

*View your bill:*
${link}

━━━━━━━━━━━━━━━━
We truly appreciate your visit! Thank You!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function handleClosePopup() {
    setPopupOpen(false);
    // Clear sale after exit animation finishes
    setTimeout(() => { setCompletedSale(null); setCopied(false); }, 250);
  }

  async function handleCopyLink() {
    if (!completedSale?.customer_id) {
      showToast('Customer link unavailable for this bill', 'error');
      return;
    }
    const link = `${window.location.origin}/invoice/${encodeURIComponent(completedSale.invoice_no)}/${completedSale.customer_id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast('Link copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  }

  function handlePrint() {
    if (!completedSale?.customer_id) {
      showToast('Customer link unavailable for this bill', 'error');
      return;
    }
    const link = `/invoice/${encodeURIComponent(completedSale.invoice_no)}/${completedSale.customer_id}?print=1`;
    window.open(link, '_blank');
  }

  return (
    <div>
      <TopBar title="New Bill / POS" />

      {/* Bill Generated Popup */}
      {completedSale && (
        <div
          onClick={handleClosePopup}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out ${popupOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`relative w-full max-w-md bg-white rounded-2xl border border-[#e5e9f0] shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${popupOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-6'}`}
          >
            {/* Close */}
            <button
              onClick={handleClosePopup}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-lg text-[#798397] hover:bg-[#f5f7fb] hover:text-[#20283b] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="pt-8 pb-5 px-6 text-center bg-linear-to-b from-[#eaf5ef] to-white">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#237a59]/15 ring-4 ring-[#237a59]/10">
                <CheckCircle className="w-9 h-9 text-[#237a59]" />
              </div>
              <h2 className="text-xl font-bold text-[#20283b]">Bill Generated!</h2>
              <p className="text-sm text-[#798397] mt-1">
                Invoice <span className="font-mono font-semibold text-[#3479e6]">{completedSale.invoice_no}</span>
              </p>
            </div>

            {/* Summary */}
            <div className="px-6 pb-4">
              <div className="bg-[#f9fafb] rounded-xl p-4 text-sm space-y-2 border border-[#eef1f6]">
                <div className="flex justify-between"><span className="text-[#798397]">Customer</span><span className="font-semibold text-[#20283b]">{completedSale.customer_name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[#798397]">Total</span><span className="font-bold text-[#20283b] tabular-nums">{money(completedSale.total)}</span></div>
                <div className="flex justify-between"><span className="text-[#798397]">Paid</span><span className="font-semibold text-[#16804a] tabular-nums">{money(completedSale.amount_paid)}</span></div>
                {completedSale.amount_due > 0 && (
                  <div className="flex justify-between"><span className="text-[#798397]">Due</span><span className="font-bold text-[#b32642] tabular-nums">{money(completedSale.amount_due)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-[#798397]">Payment</span><span className="font-semibold text-[#20283b]">{completedSale.payment_method}</span></div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6">
              <p className="text-[11px] font-bold text-[#798397] uppercase tracking-wider mb-2.5">Share Bill</p>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={handleWhatsApp}
                  className="group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-[#25d366]/10 hover:bg-[#25d366] border border-[#25d366]/30 hover:border-[#25d366] text-[#1a8a44] hover:text-white transition-all duration-150 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" aria-hidden="true">
                    <path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.49 0 .14 5.33.13 11.88a11.8 11.8 0 0 0 1.6 5.94L0 24l6.33-1.65a11.9 11.9 0 0 0 5.72 1.45h.01c6.57 0 11.92-5.33 11.93-11.88a11.8 11.8 0 0 0-3.47-8.44ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.75.98 1-3.65-.24-.37A9.84 9.84 0 0 1 2.13 11.88C2.14 6.44 6.6 2 12.07 2a9.86 9.86 0 0 1 7.03 2.91 9.78 9.78 0 0 1 2.9 7A9.9 9.9 0 0 1 12.06 21.8Zm5.45-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47a9.05 9.05 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.49-.5-.67-.5l-.57-.01a1.1 1.1 0 0 0-.8.37c-.27.3-1.04 1.02-1.04 2.47 0 1.46 1.07 2.86 1.22 3.06.15.2 2.1 3.2 5.08 4.48.71.3 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
                  </svg>
                  <span className="text-[11px] font-bold">WhatsApp</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-[#3479e6]/10 hover:bg-[#3479e6] border border-[#3479e6]/30 hover:border-[#3479e6] text-[#2a65c4] hover:text-white transition-all duration-150 active:scale-95"
                >
                  <span className="relative w-6 h-6">
                    <Copy className={`w-6 h-6 absolute inset-0 transition-all duration-200 ${copied ? 'opacity-0 scale-50 rotate-45' : 'opacity-100 scale-100 rotate-0'}`} />
                    <Check className={`w-6 h-6 absolute inset-0 transition-all duration-200 ${copied ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-45'}`} />
                  </span>
                  <span className="text-[11px] font-bold">{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="group flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-[#20283b]/5 hover:bg-[#20283b] border border-[#20283b]/15 hover:border-[#20283b] text-[#20283b] hover:text-white transition-all duration-150 active:scale-95"
                >
                  <Printer className="w-6 h-6" />
                  <span className="text-[11px] font-bold">Print Bill</span>
                </button>
              </div>

              <button
                onClick={handleClosePopup}
                className="w-full mt-4 py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white font-semibold rounded-lg text-sm transition-colors shadow-sm shadow-[#237a59]/20"
              >
                New Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {(
        <div className="p-6 grid lg:grid-cols-[1fr_380px] gap-6">
          {/* LEFT: Cart & Products */}
          <div className="space-y-4">
            {/* Customer info */}
            <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#20283b]">Customer <span className="text-[#b32642]">*</span></h3>
                {customerLookupState === 'found' && (
                  <span className="text-xs font-semibold text-[#16804a] bg-[#e6f5eb] px-2 py-0.5 rounded-full">Existing customer found</span>
                )}
                {customerLookupState === 'new' && (
                  <span className="text-xs font-semibold text-[#3479e6] bg-[#e8f0fd] px-2 py-0.5 rounded-full">New customer — will be saved</span>
                )}
                {customerLookupState === 'searching' && (
                  <span className="text-xs text-[#798397] flex items-center gap-1">
                    <span className="w-3 h-3 border border-[#798397] border-t-transparent rounded-full animate-spin inline-block" />
                    Looking up…
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 relative">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#798397] select-none pointer-events-none">+91</span>
                  <input
                    value={customerPhone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    onKeyDown={e => handleCustomerKeyDown(e, 'phone')}
                    onFocus={() => { if (customerPhone.trim().length >= 2 && customerSuggestions.length > 0) setCustomerSuggestOpen('phone'); }}
                    onBlur={() => setTimeout(() => setCustomerSuggestOpen(cur => cur === 'phone' ? null : cur), 150)}
                    placeholder="10-digit number"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    className="w-full pl-11 pr-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                  />
                  {customerSuggestOpen === 'phone' && customerSuggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#e5e9f0] rounded-lg shadow-lg max-h-56 overflow-y-auto transition-opacity opacity-100">
                      {customerSuggestions.map((c, i) => (
                        <li
                          key={c.id}
                          onMouseDown={e => { e.preventDefault(); pickCustomer(c); }}
                          onMouseEnter={() => setCustomerSuggestIdx(i)}
                          className={`px-3 py-2 text-sm cursor-pointer border-b last:border-b-0 border-[#eef1f6] transition-colors ${i === customerSuggestIdx ? 'bg-[#eaf5ef]' : 'hover:bg-[#f5f7fb]'}`}
                        >
                          <p className="font-semibold text-[#20283b]">{c.name || '—'}</p>
                          <p className="text-xs text-[#798397] font-mono">{c.phone || '—'}{c.company ? ' · ' + c.company : ''}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="relative">
                  <input
                    value={customerName}
                    onChange={e => handleNameChange(e.target.value)}
                    onKeyDown={e => handleCustomerKeyDown(e, 'name')}
                    onFocus={() => { if (customerName.trim().length >= 2 && customerSuggestions.length > 0) setCustomerSuggestOpen('name'); }}
                    pattern="[A-Za-z0-9 ]*"
                    maxLength={60}
                    onBlur={() => setTimeout(() => setCustomerSuggestOpen(cur => cur === 'name' ? null : cur), 150)}
                    placeholder={customerLookupState === 'searching' ? 'Looking up name…' : 'Customer name'}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] ${customerLookupState === 'found' ? 'border-[#237a59] bg-[#f0faf5]' : 'border-[#e5e9f0]'}`}
                  />
                  {customerSuggestOpen === 'name' && customerSuggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#e5e9f0] rounded-lg shadow-lg max-h-56 overflow-y-auto transition-opacity opacity-100">
                      {customerSuggestions.map((c, i) => (
                        <li
                          key={c.id}
                          onMouseDown={e => { e.preventDefault(); pickCustomer(c); }}
                          onMouseEnter={() => setCustomerSuggestIdx(i)}
                          className={`px-3 py-2 text-sm cursor-pointer border-b last:border-b-0 border-[#eef1f6] transition-colors ${i === customerSuggestIdx ? 'bg-[#eaf5ef]' : 'hover:bg-[#f5f7fb]'}`}
                        >
                          <p className="font-semibold text-[#20283b]">{c.name || '—'}</p>
                          <p className="text-xs text-[#798397] font-mono">{c.phone || '—'}{c.company ? ' · ' + c.company : ''}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Product Search */}
            <div ref={searchBoxRef} className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#20283b] mb-3">Search & Add Products</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#798397]" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, SKU, barcode…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                />
              </div>
              {searchLoading && <p className="text-xs text-[#798397] mt-2">Searching…</p>}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {searchResults.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e5e9f0] hover:border-[#237a59]/30">
                      <div>
                        <p className="text-sm font-semibold text-[#20283b]">{p.name} <span className="text-[#798397] font-normal">·</span> <span className="text-[#798397]">Size {p.size}</span></p>
                        <p className="text-xs text-[#798397] font-mono">{p.sku} · {money(p.selling_price)}</p>
                        {p.stock === 0 && <p className="text-xs text-[#b32642] font-semibold">OUT OF STOCK</p>}
                      </div>
                      <button
                        onClick={() => { addItem(p); }}
                        disabled={p.stock === 0}
                        className="px-3 py-1.5 bg-[#237a59] hover:bg-[#1d6649] text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#20283b]">Cart ({items.length} item{items.length !== 1 ? 's' : ''})</h3>
                {items.length > 0 && (
                  <button
                    onClick={() => { if (confirm('Clear cart?')) clearCart(); }}
                    className="text-xs text-[#b32642] hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="py-10 text-center text-[#798397]">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Cart is empty. Scan or search a product to begin.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.product_id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f9fafb] border border-[#e5e9f0]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#20283b] truncate">{item.name}</p>
                        <p className="text-xs text-[#798397]">{item.sku} · Size {item.size} · {money(item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQty(item.variant_id, item.qty - 1)}
                          className="w-7 h-7 rounded-lg border border-[#e5e9f0] bg-white hover:bg-[#f5f7fb] text-[#20283b] font-bold text-sm flex items-center justify-center transition-colors"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.max_stock}
                          value={item.qty}
                          onChange={e => updateQty(item.variant_id, Number(e.target.value))}
                          className="w-12 text-center px-1 py-1 rounded-lg border border-[#e5e9f0] text-sm font-semibold focus:outline-none focus:border-[#237a59]"
                        />
                        <button
                          onClick={() => updateQty(item.variant_id, item.qty + 1)}
                          disabled={item.qty >= item.max_stock}
                          className="w-7 h-7 rounded-lg border border-[#e5e9f0] bg-white hover:bg-[#f5f7fb] text-[#20283b] font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                          +
                        </button>
                        <span className="w-20 text-right text-sm font-bold text-[#20283b]">{money(item.qty * item.price)}</span>
                        <button
                          onClick={() => removeItem(item.variant_id)}
                          className="p-1.5 rounded-lg hover:bg-[#fff0f1] text-[#b32642] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Payment */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#20283b]">Payment Summary</h3>
                <span className="text-[10px] font-semibold text-[#237a59] bg-[#eaf5ef] px-2 py-0.5 rounded-full uppercase tracking-wide transition-opacity">Live</span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-[#798397]">
                  <span>Items</span>
                  <span className="font-semibold text-[#20283b] transition-all">{items.length} ({items.reduce((n, i) => n + i.qty, 0)} qty)</span>
                </div>
                <div className="flex justify-between text-[#798397]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#20283b] tabular-nums">{money(sub)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#798397]">Discount (₹)</span>
                  <input
                    type="number"
                    min="0"
                    max={sub}
                    step="0.01"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    className="w-28 px-3 py-1.5 text-right rounded-lg border border-[#e5e9f0] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                  />
                </div>

                <div className="flex justify-between pt-2 border-t border-[#e5e9f0]">
                  <span className="font-bold text-[#20283b]">Total</span>
                  <span className="text-xl font-black text-[#20283b] tabular-nums">{money(total)}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Payment Method</label>
                  <Select
                    value={paymentMethod}
                    onChange={v => { setPaymentMethod(v); setPaidTouched(false); }}
                    options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                  />
                </div>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${paymentMethod === 'Credit/Due' ? 'max-h-0 opacity-0' : 'max-h-32 opacity-100'}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#798397] uppercase tracking-wide">Amount Paid (₹)</label>
                    {paidTouched && (
                      <button
                        type="button"
                        onClick={() => { setPaidTouched(false); setAmountPaid(''); }}
                        className="text-[10px] font-semibold text-[#3479e6] hover:underline uppercase tracking-wide"
                      >
                        Reset to total
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidStr}
                    onChange={e => { setPaidTouched(true); setAmountPaid(e.target.value); }}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm font-semibold text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                  />
                </div>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${(remaining > 0 && paymentMethod !== 'Credit/Due') ? 'max-h-20 opacity-100 mt-0' : 'max-h-0 opacity-0 -mt-3'}`}
                >
                  <div className="flex justify-between px-3 py-2.5 rounded-lg bg-[#fff0f1] border border-[#f5c2c7]">
                    <span className="text-sm font-bold text-[#b32642]">Remaining Due</span>
                    <span className="text-sm font-black text-[#b32642] tabular-nums">{money(remaining)}</span>
                  </div>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${paymentMethod === 'Credit/Due' ? 'max-h-20 opacity-100 mt-0' : 'max-h-0 opacity-0 -mt-3'}`}
                >
                  <div className="flex justify-between px-3 py-2.5 rounded-lg bg-[#fff0f1] border border-[#f5c2c7]">
                    <span className="text-sm font-bold text-[#b32642]">Full Amount Due</span>
                    <span className="text-sm font-black text-[#b32642] tabular-nums">{money(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCompleteSale}
                  disabled={submitting || items.length === 0 || total <= 0 || !customerName.trim() || customerPhone.length !== 10}
                  className="w-full py-3.5 bg-[#237a59] hover:bg-[#1d6649] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-[#237a59]/20"
                >
                  {submitting ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                  ) : (
                    'Complete Sale & Generate Bill'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
