'use client';
import { useEffect, useState } from 'react';
import InvoiceBody, { InvoiceSale, InvoiceShop, InvoiceSettlement } from '../../../../components/InvoiceBody';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function PublicInvoiceView({
  invoice_no, customer_id,
}: {
  invoice_no: string;
  customer_id: string;
}) {
  const [sale, setSale] = useState<InvoiceSale | null>(null);
  const [shop, setShop] = useState<InvoiceShop | null>(null);
  const [settlements, setSettlements] = useState<InvoiceSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice_no || !customer_id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/sales/public/${encodeURIComponent(invoice_no)}/${encodeURIComponent(customer_id)}`);
        const data = await res.json();
        if (data?.error) {
          setError(data.error.message || 'Invoice not found');
          return;
        }
        setSale(data?.success?.data?.sale || null);
        setShop(data?.success?.data?.shop || null);
        setSettlements(data?.success?.data?.settlements || []);
      } catch {
        setError('Could not load invoice');
      } finally {
        setLoading(false);
      }
    })();
  }, [invoice_no, customer_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#237a59]/30 border-t-[#237a59] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-8 text-center">
          <p className="text-base font-bold text-[#b32642]">Invoice Not Found</p>
          <p className="text-sm text-[#798397] mt-2">{error || 'This invoice link is invalid or has been removed.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <InvoiceBody sale={sale} shop={shop} settlements={settlements} />
      </div>
    </div>
  );
}
