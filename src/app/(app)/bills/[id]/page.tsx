'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Link2, MessageCircle } from 'lucide-react';
import { api } from '../../../../lib/api';
import { money, formatDate } from '../../../../lib/utils';
import { Sale, Shop } from '../../../../types';
import { showToast } from '../../../../components/ui/Toast';
import TopBar from '../../../../components/layout/TopBar';
import InvoiceBody, { InvoiceSettlement as Settlement } from '../../../../components/InvoiceBody';

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/sales/${id}`);
        const s: Sale | undefined = res?.success?.data?.sale;
        const sh: Shop | undefined = res?.success?.data?.shop;
        const sl: Settlement[] = res?.success?.data?.settlements || [];
        if (!s?.id) {
          showToast('Bill not found', 'error');
          router.replace('/bills');
          return;
        }
        setSale(s);
        setShop(sh || null);
        setSettlements(Array.isArray(sl) ? sl : []);
      } catch {
        showToast('Failed to load bill', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  function sendWhatsApp() {
    if (!sale) return;
    const phone = sale.customer_phone?.replace(/\D/g, '');
    if (!phone) { showToast('No phone number on this bill', 'error'); return; }
    if (!sale.customer_id) { showToast('Customer link unavailable for this bill', 'error'); return; }
    const link = `${window.location.origin}/invoice/${encodeURIComponent(sale.invoice_no)}/${sale.customer_id}`;
    const msg =
`*${shop?.name || 'Tulshi Fashion'}*
━━━━━━━━━━━━━━━━
Hi ${sale.customer_name || 'there'}

*Date:* ${formatDate(sale.date)}
*Invoice:* ${sale.invoice_no}

*View your bill:*
${link}

━━━━━━━━━━━━━━━━
We truly appreciate your visit! Thank You!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  if (loading || !sale) {
    return (
      <div>
        <TopBar title="Bill Details" />
        <div className="p-6 space-y-4">
          <div className="h-32 bg-[#f5f7fb] rounded-xl animate-pulse" />
          <div className="h-96 bg-[#f5f7fb] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={`Invoice ${sale.invoice_no}`} />

      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        {/* Toolbar — hidden on print */}
        <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
          <Link href="/bills" className="flex items-center gap-1.5 text-sm font-semibold text-[#798397] hover:text-[#20283b] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Bill History
          </Link>
          <div className="flex gap-2 flex-wrap">
            {sale.customer_id && (
              <a
                href={`/invoice/${encodeURIComponent(sale.invoice_no)}/${sale.customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#3479e6] hover:bg-[#2a65c4] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Link2 className="w-4 h-4" /> Public Link
              </a>
            )}
            <button
              onClick={sendWhatsApp}
              disabled={!sale.customer_phone}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#25d366] hover:bg-[#1ebe59] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e5e9f0] hover:bg-[#f5f7fb] text-[#20283b] text-sm font-semibold rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        <InvoiceBody sale={sale as any} shop={shop as any} settlements={settlements} />
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
