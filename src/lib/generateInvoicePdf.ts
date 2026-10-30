import jsPDF from 'jspdf';

export interface InvoiceItem {
  name: string;
  size: string;
  sku: string;
  qty: number;
  price: number;
}

export interface InvoiceData {
  invoice_no: string;
  date: string;
  time: string;
  customer_name: string;
  customer_phone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  payment_method: string;
  payment_status: string;
}

function fmt(n: number): string {
  return '₹' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d: string): string {
  const p = d?.split('-');
  return p?.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (d || '');
}

async function loadLogoBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url + '?t=' + Date.now();
  });
}

export async function generateInvoicePdf(data: InvoiceData): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210;
  const L = 15; // left margin
  const R = W - 15; // right margin
  const CW = R - L; // content width

  const GREEN: [number, number, number] = [35, 122, 89];
  const DARK: [number, number, number] = [32, 40, 59];
  const GRAY: [number, number, number] = [121, 131, 151];
  const LGRAY: [number, number, number] = [229, 233, 240];
  const LGREEN: [number, number, number] = [234, 245, 239];
  const WHITE: [number, number, number] = [255, 255, 255];

  let y = 0;

  // ── Header bar ──────────────────────────────────────────────
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 42, 'F');

  const logo = await loadLogoBase64('/logo.png');
  if (logo) {
    doc.addImage(logo, 'PNG', L, 7, 26, 26);
  }

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Tulshi Fashion', L + (logo ? 30 : 0), 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Quality Clothing & Textiles', L + (logo ? 30 : 0), 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', R, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(data.invoice_no, R, 25, { align: 'right' });

  y = 50;

  // ── Meta row ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text('Date:', L, y);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtDate(data.date), L + 10, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Time:', L + 48, y);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text(data.time || '', L + 58, y);

  // Status badge
  const statusLabel = data.payment_status.toUpperCase();
  const [sBg, sFg]: [[number, number, number], [number, number, number]] =
    data.payment_status === 'paid'
      ? [[234, 245, 239], [22, 128, 74]]
      : data.payment_status === 'partial'
      ? [[255, 243, 205], [161, 87, 0]]
      : [[255, 240, 241], [179, 38, 66]];

  const badgeW = 28;
  doc.setFillColor(...sBg);
  doc.roundedRect(R - badgeW, y - 5, badgeW, 7, 1.5, 1.5, 'F');
  doc.setTextColor(...sFg);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, R - badgeW / 2, y - 0.5, { align: 'center' });

  y += 8;

  // Divider
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);
  y += 7;

  // ── Bill To ──────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY);
  doc.text('BILL TO', L, y);
  y += 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(data.customer_name || 'Walk-in Customer', L, y);
  y += 5;

  if (data.customer_phone) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(data.customer_phone, L, y);
    y += 5;
  }

  y += 6;

  // ── Items table ───────────────────────────────────────────────
  const COL = { item: L + 2, sku: L + 82, qty: L + 118, rate: L + 142, amt: R - 1 };

  doc.setFillColor(...GREEN);
  doc.rect(L, y, CW, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('#  Item', COL.item, y + 5.5);
  doc.text('SKU', COL.sku, y + 5.5);
  doc.text('Qty', COL.qty, y + 5.5, { align: 'center' });
  doc.text('Rate', COL.rate, y + 5.5, { align: 'center' });
  doc.text('Amount', COL.amt, y + 5.5, { align: 'right' });
  y += 8;

  data.items.forEach((item, i) => {
    const rh = 9;
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(L, y, CW, rh, 'F');
    }
    doc.setTextColor(...DARK);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${i + 1}  ${item.name} (Size ${item.size})`, COL.item, y + 6);
    doc.text(item.sku || '', COL.sku, y + 6);
    doc.text(String(item.qty), COL.qty, y + 6, { align: 'center' });
    doc.text(fmt(item.price), COL.rate, y + 6, { align: 'center' });
    doc.text(fmt(item.qty * item.price), COL.amt, y + 6, { align: 'right' });
    y += rh;
  });

  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);
  y += 10;

  // ── Totals ────────────────────────────────────────────────────
  const TX = R - 72;
  const VX = R;

  const row = (label: string, value: string, color?: [number, number, number]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(label, TX, y);
    doc.setTextColor(...(color || DARK));
    doc.text(value, VX, y, { align: 'right' });
    y += 6;
  };

  row('Subtotal:', fmt(data.subtotal));
  if (data.discount > 0) row('Discount:', `- ${fmt(data.discount)}`, [179, 38, 66]);

  y += 1;
  doc.setFillColor(...LGREEN);
  doc.rect(TX - 4, y - 4, VX - TX + 8, 11, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  doc.text('TOTAL:', TX, y + 3);
  doc.text(fmt(data.total), VX, y + 3, { align: 'right' });
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Amount Paid:', TX, y);
  doc.setTextColor(22, 128, 74);
  doc.text(fmt(data.amount_paid), VX, y, { align: 'right' });
  y += 6;

  if (data.amount_due > 0) {
    doc.setTextColor(...GRAY);
    doc.text('Amount Due:', TX, y);
    doc.setTextColor(179, 38, 66);
    doc.text(fmt(data.amount_due), VX, y, { align: 'right' });
    y += 6;
  }

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Payment Method: ${data.payment_method}`, L, y);
  y += 14;

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(...LGRAY);
  doc.line(L, y, R, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text('Thank you for shopping with Tulshi Fashion!', W / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('This is a computer-generated invoice. No signature required.', W / 2, y, { align: 'center' });

  // Return base64 (without the data URI prefix)
  return doc.output('datauristring').split(',')[1];
}
