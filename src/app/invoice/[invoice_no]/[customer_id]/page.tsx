import type { Metadata } from 'next';
import { headers } from 'next/headers';
import PublicInvoiceView from './PublicInvoiceView';

type Params = { invoice_no: string; customer_id: string };

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3001';
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

function money(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const dt = new Date(d + 'T12:00:00');
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fallbackMeta(origin: string, note: string): Metadata {
  const title = 'Tulshi Fashion — Invoice';
  const description = note;
  const image = `${origin}/logo.png`;
  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Tulshi Fashion',
      url: origin,
      images: [{ url: image, width: 400, height: 400, alt: 'Tulshi Fashion' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { invoice_no, customer_id } = await params;
  const origin = await siteOrigin();

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/sales/public/${encodeURIComponent(invoice_no)}/${encodeURIComponent(customer_id)}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    const sale = data?.success?.data?.sale;
    const shop = data?.success?.data?.shop;

    if (!sale) {
      return fallbackMeta(origin, 'This invoice link is invalid or has been removed.');
    }

    const shopName = shop?.name || 'Tulshi Fashion';
    const title = `Invoice ${sale.invoice_no} — ${shopName}`;
    const amountLabel = Number(sale.amount_due) > 0 ? 'Amount Due' : 'Total';
    const amountValue = money(Number(sale.amount_due) > 0 ? sale.amount_due : sale.total);
    const description = `${formatDate(sale.date)} · ${amountLabel}: ${amountValue}.`;
    const image = `${origin}/logo.png`;
    const pageUrl = `${origin}/invoice/${encodeURIComponent(invoice_no)}/${encodeURIComponent(customer_id)}`;

    return {
      metadataBase: new URL(origin),
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        siteName: shopName,
        url: pageUrl,
        images: [{ url: image, width: 400, height: 400, alt: shopName }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return fallbackMeta(origin, 'View your bill from Tulshi Fashion.');
  }
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { invoice_no, customer_id } = await params;
  return <PublicInvoiceView invoice_no={invoice_no} customer_id={customer_id} />;
}
