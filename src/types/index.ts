export interface ProductVariant {
  id: string;
  product_id: string;
  size_id: string;
  size_info?: { id: string; name: string; code: string };
  barcode: string;
  purchase_price: number | null;
  selling_price: number | null;
  stock: number;
  reorder_level: number;
  photo_url?: string;
  is_active: boolean;
  is_deleted: boolean;
  files?: ProductImage[];
}

export interface ProductImage {
  id: string;
  file_url: string;
  file_type: string;
  sort_order: number;
}

export interface Product {
  id: string;
  shop_id: string;
  sku: string;
  name: string;
  category_id: string;
  category_info?: { id: string; name: string; code: string };
  purchase_price: number;
  selling_price: number;
  notes: string;
  photo_url: string;
  product_sequence: number;
  is_active: boolean;
  is_deleted: boolean;
  variants?: ProductVariant[];
  files?: ProductImage[];
}

export interface Customer {
  id: string; name: string; phone: string; phone_code: string; email: string; company: string; address: string; notes: string;
}
export interface Shop {
  id: string; name: string; logo_url?: string; owner_email: string;
  phone?: string; phone_code?: string; address?: string; gstin?: string;
}
export interface SaleItem {
  product_id: string; sku: string; barcode: string; name: string; size: string; qty: number; price: number; cost: number;
}
export interface Sale {
  id: string; invoice_no: string; customer_id?: string; customer_name: string; customer_phone: string;
  subtotal: number; discount: number; total: number; amount_paid: number; amount_due: number;
  cogs: number; gross_profit: number; payment_method: string; payment_status: 'paid' | 'partial' | 'due';
  invoice_pdf_url: string; date: string; time: string; items: SaleItem[];
}
export interface Credit {
  id: string; customer_name: string; customer_phone: string; type: string; amount: number; reference: string; notes: string; date: string;
}
export interface PartialPayment {
  id: string; customer_name: string; customer_phone: string; invoice_no: string;
  bill_total: number; amount_paid: number; amount_due: number; date: string; status: 'open' | 'settled';
}
export interface DashboardStats {
  today_sales: number; today_profit: number; total_stock: number;
  low_stock_count: number; out_of_stock_count: number; total_dues: number;
  recent_bills: Sale[]; stock_alerts: Product[];
}
