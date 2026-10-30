import { money, formatDate } from '../lib/utils';

export interface InvoiceItem { name: string; sku: string; size: string; qty: number; price: number; }
export interface InvoiceSettlement { id: string; amount: number; date: string; created_at: string; notes?: string; }
export interface InvoiceSale {
  invoice_no: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  payment_method: string;
  payment_status: 'paid' | 'partial' | 'due';
  date: string;
  time?: string;
  items: InvoiceItem[];
}
export interface InvoiceShop {
  name: string;
  phone?: string;
  phone_code?: string;
  address?: string;
  gstin?: string;
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function InvoiceBody({
  sale, shop, settlements,
}: {
  sale: InvoiceSale;
  shop: InvoiceShop | null;
  settlements: InvoiceSettlement[];
}) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const statusColor =
    sale.payment_status === 'paid'
      ? { bg: 'bg-[#e6f5eb]', text: 'text-[#16804a]' }
      : sale.payment_status === 'partial'
        ? { bg: 'bg-[#fef3cd]', text: 'text-[#8a6d1e]' }
        : { bg: 'bg-[#fff0f1]', text: 'text-[#b32642]' };

  const totalSettled = settlements.reduce((s, x) => s + x.amount, 0);
  const paidAtSale = Math.max(0, Number(sale.amount_paid) - totalSettled);

  return (
    <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm print:shadow-none print:border-0 print:rounded-none">
      <div className="px-10 pt-10 pb-8">
        {/* Top: BILL FROM / Logo */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#20283b] tracking-wide">BILL FROM:</p>
            <p className="text-sm font-semibold text-[#20283b] mt-1">{shop?.name || 'Tulshi Fashion'}</p>
            {shop?.address && (
              <p className="text-sm text-[#20283b] mt-0.5 whitespace-pre-line leading-relaxed">{shop.address}</p>
            )}
            {shop?.phone && <p className="text-sm text-[#20283b] mt-0.5">+{shop.phone_code || '91'} {shop.phone}</p>}
            {shop?.gstin && <p className="text-xs text-[#798397] mt-0.5">GSTIN: {shop.gstin}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={shop?.name || 'Tulshi Fashion'} className="w-28 h-28 object-contain" />
        </div>

        <div className="h-px bg-[#eef1f6] my-8" />

        {/* BILL TO + Meta */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#20283b] tracking-wide">BILL TO:</p>
            <p className="text-sm font-semibold text-[#20283b] mt-1">{sale.customer_name || 'Walk-in Customer'}</p>
            {sale.customer_phone && <p className="text-sm text-[#20283b] mt-0.5">+91 {sale.customer_phone}</p>}
          </div>

          <div className="min-w-64">
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="pr-6 py-0.5 text-xs font-bold text-[#798397] uppercase tracking-wide">INVOICE #</td>
                  <td className="py-0.5 text-right font-semibold text-[#20283b]">{sale.invoice_no}</td>
                </tr>
                <tr>
                  <td className="pr-6 py-0.5 text-xs font-bold text-[#798397] uppercase tracking-wide">INVOICE DATE</td>
                  <td className="py-0.5 text-right font-semibold text-[#20283b]">{formatDate(sale.date)}</td>
                </tr>
                <tr>
                  <td className="pr-6 pt-1 text-xs font-bold text-[#798397] uppercase tracking-wide">AMOUNT {Number(sale.amount_due) > 0 ? 'DUE' : 'PAID'}</td>
                  <td className={`pt-1 text-right font-black tabular-nums ${Number(sale.amount_due) > 0 ? 'text-[#b32642]' : 'text-[#16804a]'}`}>
                    {money(Number(sale.amount_due) > 0 ? sale.amount_due : sale.total)}
                  </td>
                </tr>
                <tr>
                  <td className="pr-6 pt-1" />
                  <td className="pt-1 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusColor.bg} ${statusColor.text}`}>
                      {sale.payment_status}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items */}
        <div className="mt-8 overflow-hidden rounded-md">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#20283b] text-white">
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Item</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Description</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide w-20">Quantity</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide w-28">Unit Cost</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide w-28">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-[#eef1f6]">
                  <td className="px-3 py-3 font-semibold text-[#20283b] align-top">{it.name}</td>
                  <td className="px-3 py-3 text-[#798397] align-top">
                    {[it.size ? `Size ${it.size}` : null, it.sku].filter(Boolean).join(' · ')}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums align-top">{it.qty}</td>
                  <td className="px-3 py-3 text-right tabular-nums align-top">{money(it.price)}</td>
                  <td className="px-3 py-3 text-right font-bold text-[#20283b] tabular-nums align-top">{money(Number(it.price) * Number(it.qty))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes + Totals */}
        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-bold text-[#20283b] tracking-wide">NOTES / MEMO</p>
            <p className="text-sm text-[#798397] mt-1">Thank you for shopping with us. Items once sold are not returnable.</p>
          </div>

          <div className="min-w-64">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-xs font-bold text-[#798397] uppercase tracking-wide">SUBTOTAL</td>
                  <td className="py-1 text-right font-semibold text-[#20283b] tabular-nums">{money(sale.subtotal)}</td>
                </tr>
                {Number(sale.discount) > 0 && (
                  <tr>
                    <td className="py-1 text-xs font-bold text-[#798397] uppercase tracking-wide">DISCOUNT</td>
                    <td className="py-1 text-right font-semibold text-[#b32642] tabular-nums">− {money(sale.discount)}</td>
                  </tr>
                )}
                <tr className="border-t border-[#20283b]">
                  <td className="pt-2 text-sm font-black text-[#20283b] uppercase tracking-wide">TOTAL</td>
                  <td className="pt-2 text-right text-base font-black text-[#20283b] tabular-nums">{money(sale.total)}</td>
                </tr>
                <tr>
                  <td className="pt-2 text-xs font-bold text-[#798397] uppercase tracking-wide">PAID</td>
                  <td className="pt-2 text-right font-semibold text-[#16804a] tabular-nums">{money(sale.amount_paid)}</td>
                </tr>
                {Number(sale.amount_due) > 0 && (
                  <tr>
                    <td className="py-1 text-xs font-bold text-[#b32642] uppercase tracking-wide">DUE</td>
                    <td className="py-1 text-right font-black text-[#b32642] tabular-nums">{money(sale.amount_due)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        <div className="mt-10">
          <p className="text-[11px] font-bold text-[#20283b] tracking-wide mb-2">PAYMENT HISTORY</p>
          <div className="border border-[#eef1f6] rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f5f7fb]">
                  <th className="px-3 py-2 text-left font-bold text-[#798397] uppercase tracking-wide">Date / Time</th>
                  <th className="px-3 py-2 text-left font-bold text-[#798397] uppercase tracking-wide">Method / Note</th>
                  <th className="px-3 py-2 text-right font-bold text-[#798397] uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 text-right font-bold text-[#798397] uppercase tracking-wide">Balance After</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#eef1f6]">
                  <td className="px-3 py-2 text-[#798397]">
                    {formatDate(sale.date)}{sale.time ? ` · ${sale.time.slice(0, 5)}` : ''}
                  </td>
                  <td className="px-3 py-2 text-[#20283b]">{sale.payment_method || '—'} — initial payment at sale</td>
                  <td className="px-3 py-2 text-right font-bold text-[#16804a] tabular-nums">+{money(paidAtSale)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#20283b] tabular-nums">
                    {money(Math.max(0, Number(sale.total) - paidAtSale))}
                  </td>
                </tr>
                {settlements.map((s, idx) => {
                  const paidThroughIdx = paidAtSale + settlements.slice(0, idx + 1).reduce((sum, x) => sum + x.amount, 0);
                  const remainingAfter = Math.max(0, Number(sale.total) - paidThroughIdx);
                  return (
                    <tr key={s.id} className="border-t border-[#eef1f6] bg-[#f9fafb]">
                      <td className="px-3 py-2 text-[#798397]">{fmtDateTime(s.created_at)}</td>
                      <td className="px-3 py-2 text-[#20283b]">{s.notes || 'Due payment received'}</td>
                      <td className="px-3 py-2 text-right font-bold text-[#16804a] tabular-nums">+{money(s.amount)}</td>
                      <td className="px-3 py-2 text-right font-bold text-[#20283b] tabular-nums">{money(remainingAfter)}</td>
                    </tr>
                  );
                })}
                {settlements.length === 0 && Number(sale.amount_due) === 0 && (
                  <tr className="border-t border-[#eef1f6]">
                    <td colSpan={4} className="px-3 py-2 text-center text-[11px] text-[#16804a] font-semibold">
                      Bill fully paid at sale — no further payments needed.
                    </td>
                  </tr>
                )}
                {settlements.length === 0 && Number(sale.amount_due) > 0 && (
                  <tr className="border-t border-[#eef1f6]">
                    <td colSpan={4} className="px-3 py-2 text-center text-[11px] text-[#b32642] font-semibold">
                      Amount due remaining. No further payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-10 py-6 border-t border-[#eef1f6] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="w-7 h-7 mx-auto opacity-70 object-contain" />
        <p className="text-[11px] text-[#798397] mt-2">Invoice powered by {shop?.name || 'Tulshi Fashion'} POS</p>
      </div>
    </div>
  );
}
