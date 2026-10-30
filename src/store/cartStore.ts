import { create } from 'zustand';

export interface CartItem {
  product_id: string; variant_id: string; sku: string; barcode: string; name: string;
  size: string; qty: number; price: number; cost: number; photo_url?: string;
  max_stock: number;
}

export interface BillableProduct {
  id: string;
  product_id?: string;
  sku: string;
  barcode: string;
  name: string;
  size: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  photo_url?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: BillableProduct) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  totalCogs: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product) => {
    const items = get().items;
    const variantId = product.id;
    const existing = items.find(i => i.variant_id === variantId);
    if (existing) {
      const newQty = Math.min(existing.qty + 1, existing.max_stock);
      set({ items: items.map(i => i.variant_id === variantId ? { ...i, qty: newQty } : i) });
    } else {
      set({
        items: [...items, {
          product_id: product.product_id || product.id,
          variant_id: variantId,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          size: product.size,
          qty: 1,
          price: product.selling_price,
          cost: product.purchase_price,
          photo_url: product.photo_url,
          max_stock: product.stock,
        }],
      });
    }
  },
  removeItem: (variantId) => set({ items: get().items.filter(i => i.variant_id !== variantId) }),
  updateQty: (variantId, qty) => set({
    items: get().items.map(i => i.variant_id === variantId ? { ...i, qty: Math.max(1, Math.min(qty, i.max_stock)) } : i),
  }),
  clearCart: () => set({ items: [] }),
  subtotal: () => get().items.reduce((sum, i) => sum + i.qty * i.price, 0),
  totalCogs: () => get().items.reduce((sum, i) => sum + i.qty * i.cost, 0),
}));
