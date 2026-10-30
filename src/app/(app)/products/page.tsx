'use client';
import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, Printer, Plus, Trash2, RefreshCw, Package, X, ImageIcon, Eye, Filter,
  CheckCircle2, ScanBarcode, ChevronLeft, ChevronRight, ChevronDown, Pencil,
  Loader2 as Loader2Icon,
} from 'lucide-react';
import ImageUpload from '../../../components/ui/ImageUpload';
import Modal from '../../../components/ui/Modal';
import { api } from '../../../lib/api';
import { money, today } from '../../../lib/utils';
import { Product, ProductVariant } from '../../../types';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';
import Select from '../../../components/ui/Select';
import MultiSelect from '../../../components/ui/MultiSelect';
import { useMasterDropdown } from '../../../lib/useMasterDropdown';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type SizeVariant = { size_id: string; size_name: string; qty: string; purchase_price: string; selling_price: string; useSharedPrice: boolean; useMainPhoto: boolean; photo_urls: string[] };
type CreatedVariant = { id: string; size: string; size_id: string; barcode: string; stock: number; purchase_price: number | null; selling_price: number | null };
type CreatedResult = { name: string; sku: string; variants: CreatedVariant[] };
type DrawerMode = 'add' | 'edit';
type FlatRow = {
  product: Product;
  variant: ProductVariant;
  size_name: string;
  category_name: string;
  effective_purchase_price: number;
  effective_selling_price: number;
};

const EMPTY_FORM = { name: '', category_id: '', purchase_price: '', selling_price: '', notes: '', photo_url: '', photo_urls: [] as string[] };
const EMPTY_EDIT = { name: '', category_id: '', purchase_price: '', selling_price: '', notes: '', photo_url: '', photo_urls: [] as string[] };

type EditVariant = {
  id: string;
  size_id: string;
  size_name: string;
  barcode: string;
  stock: number;
  purchase_price: string;
  selling_price: string;
  useSharedPrice: boolean;
  photo_urls: string[];
  useMainPhoto: boolean;
  isNew?: boolean;
};

const BLOCKED_KEYS = new Set(['e', 'E', '+', '-']);
const onPriceKey = (e: React.KeyboardEvent<HTMLInputElement>) => { if (BLOCKED_KEYS.has(e.key)) e.preventDefault(); };
const cleanPrice = (v: string) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

function Switch({ on, busy, onClick, title }: { on: boolean; busy?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy}
      disabled={busy}
      title={title}
      onClick={onClick}
      className={`relative w-10 h-[22px] rounded-full flex-shrink-0 transition-colors duration-300 ease-out ${on ? 'bg-[#237a59]' : 'bg-[#cfd6e2]'} ${busy ? 'cursor-wait' : 'active:scale-95'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${on ? 'translate-x-[18px]' : ''}`}
      >
        {busy && <Loader2Icon className={`w-3 h-3 animate-spin ${on ? 'text-[#237a59]' : 'text-[#98a2b6]'}`} />}
      </span>
    </button>
  );
}

function AnimatedCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={10} className="!p-0 !border-0">
        <div
          style={{
            display: 'grid',
            gridTemplateRows: open ? '1fr' : '0fr',
            opacity: open ? 1 : 0,
            transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease',
          }}
        >
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            <table className="w-full">
              <tbody>{children}</tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

function StockPill({ stock }: { stock: number }) {
  if (stock === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#fff0f1] text-[#b32642]">OUT</span>;
  if (stock <= 2)  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#fff8e8] text-[#a55b00]">{stock}</span>;
  return                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#e6f5eb] text-[#16804a]">{stock}</span>;
}

function flattenProducts(products: Product[]): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const p of products) {
    const categoryName = p.category_info?.name || '—';
    if (!p.variants || p.variants.length === 0) {
      rows.push({
        product: p,
        variant: { id: '', product_id: p.id, size_id: '', barcode: '—', purchase_price: null, selling_price: null, stock: 0, reorder_level: 0, is_active: p.is_active, is_deleted: false },
        size_name: '—',
        category_name: categoryName,
        effective_purchase_price: p.purchase_price,
        effective_selling_price: p.selling_price,
      });
    } else {
      for (const v of p.variants) {
        rows.push({
          product: p,
          variant: v,
          size_name: v.size_info?.name || '—',
          category_name: categoryName,
          effective_purchase_price: v.purchase_price ?? p.purchase_price,
          effective_selling_price: v.selling_price ?? p.selling_price,
        });
      }
    }
  }
  return rows;
}

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [limit, setLimit]           = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingVariantId, setTogglingVariantId] = useState<string | null>(null);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSizes, setFilterSizes] = useState<string[]>([]);
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [filterStock, setFilterStock] = useState<'' | 'in_stock' | 'low_stock' | 'out_of_stock'>('');
  const [filterStatus, setFilterStatus] = useState<'' | 'active' | 'inactive'>('');

  function toggleExpand(productId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [drawerMode, setDrawerMode]     = useState<DrawerMode>('add');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { items: categoryOptions } = useMasterDropdown('/api/categories');
  const { items: sizeOptions }     = useMasterDropdown('/api/sizes');
  const [form, setForm]           = useState(EMPTY_FORM);
  const [variants, setVariants]   = useState<SizeVariant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [createdResult, setCreatedResult] = useState<CreatedResult | null>(null);

  const [editForm, setEditForm]   = useState(EMPTY_EDIT);
  const [editVariants, setEditVariants] = useState<EditVariant[]>([]);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const loadProducts = useCallback(async (q = '', p = 1, l = limit) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: q,
        page: String(p),
        limit: String(l),
        show_inactive: 'true',
      });
      const res = await api.get(`/api/products?${params}`);
      if (res?.error) {
        showToast(res.error.message || 'Failed to load products', 'error');
        setProducts([]);
        return;
      }
      const data = res?.success?.data;
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch {
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => { loadProducts('', 1, limit); }, [loadProducts, limit]);

  useEffect(() => {
    if (categoryOptions.length && !form.category_id) {
      setForm(f => ({ ...f, category_id: categoryOptions[0].id }));
    }
  }, [categoryOptions, form.category_id]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadProducts(search, 1, limit); }, 300);
    return () => clearTimeout(t);
  }, [search, limit, loadProducts]);

  function goToPage(p: number) {
    setPage(p);
    loadProducts(search, p, limit);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function changeLimit(l: number) {
    setLimit(l);
    setPage(1);
    // loadProducts will fire via the limit effect
  }

  function openAddDrawer() {
    setDrawerMode('add');
    setForm({ ...EMPTY_FORM, category_id: categoryOptions[0]?.id || '' });
    setVariants([]);
    setErrors({});
    setCreatedResult(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(product: Product) {
    setDrawerMode('edit');
    setEditingProduct(product);
    const existingPhotos: string[] = [];
    if (product.photo_url) existingPhotos.push(product.photo_url);
    if (product.files) product.files.forEach(f => { if (f.file_url && f.file_url !== product.photo_url) existingPhotos.push(f.file_url); });
    setEditForm({
      name: product.name,
      category_id: product.category_id,
      purchase_price: String(product.purchase_price),
      selling_price: String(product.selling_price),
      notes: product.notes || '',
      photo_url: product.photo_url || '',
      photo_urls: existingPhotos,
    });
    setEditVariants(
      (product.variants || []).map(v => {
        const variantPhotos: string[] = [];
        if (v.photo_url) variantPhotos.push(v.photo_url);
        if (v.files) v.files.forEach(f => { if (f.file_url && f.file_url !== v.photo_url) variantPhotos.push(f.file_url); });
        return {
          id: v.id,
          size_id: v.size_id,
          size_name: v.size_info?.name || '—',
          barcode: v.barcode,
          stock: v.stock,
          purchase_price: v.purchase_price != null ? String(v.purchase_price) : '',
          selling_price: v.selling_price != null ? String(v.selling_price) : '',
          useSharedPrice: v.purchase_price == null && v.selling_price == null,
          photo_urls: variantPhotos,
          useMainPhoto: variantPhotos.length === 0,
        };
      })
    );
    setEditErrors({});
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingProduct(null);
    setCreatedResult(null);
    setEditVariants([]);
  }

  function updateEditVariant(sizeId: string, field: keyof EditVariant, value: string | boolean | number | string[]) {
    setEditVariants(vs => vs.map(v => v.size_id === sizeId ? { ...v, [field]: value } : v));
  }

  function toggleEditSize(sizeId: string, sizeName: string) {
    const exists = editVariants.find(v => v.size_id === sizeId);
    if (exists) {
      if (!exists.isNew) return;
      setEditVariants(vs => vs.filter(v => v.size_id !== sizeId));
    } else {
      setEditVariants(vs => [...vs, {
        id: '',
        size_id: sizeId,
        size_name: sizeName,
        barcode: '',
        stock: 0,
        purchase_price: '',
        selling_price: '',
        useSharedPrice: true,
        photo_urls: [],
        useMainPhoto: true,
        isNew: true,
      }]);
    }
  }

  function toggleSize(sizeId: string, sizeName: string) {
    const exists = variants.find(v => v.size_id === sizeId);
    if (exists) {
      setVariants(vs => vs.filter(v => v.size_id !== sizeId));
    } else {
      setVariants(vs => [...vs, { size_id: sizeId, size_name: sizeName, qty: '', purchase_price: '', selling_price: '', useSharedPrice: true, useMainPhoto: true, photo_urls: [] }]);
    }
  }

  function updateVariant(sizeId: string, field: keyof SizeVariant, value: string | boolean | string[]) {
    setVariants(vs => vs.map(v => v.size_id === sizeId ? { ...v, [field]: value } : v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.purchase_price || isNaN(Number(form.purchase_price))) errs.purchase_price = 'Valid cost required';
    if (!form.selling_price || isNaN(Number(form.selling_price))) errs.selling_price = 'Valid price required';
    if (!form.category_id) errs.category_id = 'Category is required';
    if (variants.length === 0) errs.variants = 'Add at least one size';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await api.post('/api/products', {
        name: form.name,
        category_id: form.category_id,
        purchase_price: Number(form.purchase_price),
        selling_price: Number(form.selling_price),
        notes: form.notes || undefined,
        photo_url: form.photo_url || undefined,
        photo_urls: form.photo_urls.length > 0 ? form.photo_urls : undefined,
        variants: variants.map(v => ({
          size_id: v.size_id,
          qty: Number(v.qty) || 0,
          purchase_price: v.useSharedPrice ? undefined : (Number(v.purchase_price) || undefined),
          selling_price: v.useSharedPrice ? undefined : (Number(v.selling_price) || undefined),
          photo_url: v.useMainPhoto ? undefined : (v.photo_urls[0] || undefined),
          photo_urls: v.useMainPhoto ? undefined : (v.photo_urls.length > 0 ? v.photo_urls : undefined),
        })),
      });
      if (res?.error) {
        showToast(res.error.message || 'Failed to add product', 'error');
        return;
      }
      const data = res?.success?.data;
      const createdVariants: CreatedVariant[] = data?.product?.variants ?? [];
      const sku: string = data?.sku ?? '';
      setCreatedResult({ name: form.name, sku, variants: createdVariants });
      setPage(1);
      loadProducts(search, 1);
    } catch {
      showToast('Failed to add product', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    const errs: Record<string, string> = {};
    if (!editForm.name.trim()) errs.name = 'Name is required';
    if (!editForm.category_id) errs.category_id = 'Category is required';
    if (!editForm.purchase_price || isNaN(Number(editForm.purchase_price))) errs.purchase_price = 'Valid cost required';
    if (!editForm.selling_price || isNaN(Number(editForm.selling_price))) errs.selling_price = 'Valid price required';
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    setEditErrors({});
    setSubmitting(true);
    try {
      await api.put(`/api/products/${editingProduct.id}`, {
        name: editForm.name,
        category_id: editForm.category_id,
        purchase_price: Number(editForm.purchase_price),
        selling_price: Number(editForm.selling_price),
        notes: editForm.notes || undefined,
        photo_url: editForm.photo_url || undefined,
        photo_urls: editForm.photo_urls,
      });

      for (const ev of editVariants) {
        if (ev.isNew) continue;
        await api.put(`/api/products/variant/${ev.id}`, {
          purchase_price: ev.useSharedPrice ? null : (ev.purchase_price ? Number(ev.purchase_price) : null),
          selling_price: ev.useSharedPrice ? null : (ev.selling_price ? Number(ev.selling_price) : null),
          photo_url: ev.useMainPhoto ? null : (ev.photo_urls[0] || null),
          photo_urls: ev.useMainPhoto ? undefined : (ev.photo_urls.length > 0 ? ev.photo_urls : undefined),
        });
      }

      const newVariants = editVariants.filter(ev => ev.isNew);
      if (newVariants.length > 0) {
        await api.post('/api/products/add-variants', {
          product_id: editingProduct.id,
          variants: newVariants.map(ev => ({
            size_id: ev.size_id,
            qty: ev.stock || 0,
            purchase_price: ev.useSharedPrice ? undefined : (ev.purchase_price ? Number(ev.purchase_price) : undefined),
            selling_price: ev.useSharedPrice ? undefined : (ev.selling_price ? Number(ev.selling_price) : undefined),
            photo_url: ev.useMainPhoto ? undefined : (ev.photo_urls[0] || undefined),
            photo_urls: ev.useMainPhoto ? undefined : (ev.photo_urls.length > 0 ? ev.photo_urls : undefined),
          })),
        });
      }

      showToast('Product updated');
      closeDrawer();
      loadProducts(search, page);
    } catch {
      showToast('Failed to update product', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(product: Product) {
    const target = !product.is_active;
    setTogglingId(product.id);
    try {
      const res = await api.put(`/api/products/${product.id}`, { is_active: target });
      if (res?.error) { showToast(res.error.message || 'Failed to update status', 'error'); return; }
      showToast(target ? 'Product activated' : 'Product deactivated');
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, is_active: target } : p));
    } catch {
      showToast('Failed to update status', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleToggleVariantActive(variant: ProductVariant, product: Product) {
    const target = !variant.is_active;
    setTogglingVariantId(variant.id);
    try {
      const res = await api.put(`/api/products/variant/${variant.id}`, { is_active: target });
      if (res?.error) { showToast(res.error.message || 'Failed to update status', 'error'); return; }
      showToast(target ? 'Variant activated' : 'Variant deactivated');
      setProducts(ps => ps.map(p => p.id === product.id
        ? { ...p, variants: (p.variants || []).map(v => v.id === variant.id ? { ...v, is_active: target } : v) }
        : p
      ));
    } catch {
      showToast('Failed to update variant status', 'error');
    } finally {
      setTogglingVariantId(null);
    }
  }

  async function handleDeleteVariant(variantId: string, productId: string) {
    if (!confirm('Remove this variant? It will be hidden from all lists.')) return;
    setDeletingVariantId(variantId);
    try {
      const res = await api.delete(`/api/products/variant/${variantId}`);
      if (res?.error) { showToast(res.error.message || 'Failed to delete variant', 'error'); return; }
      showToast('Variant removed');
      setProducts(ps => ps.map(p => p.id === productId
        ? { ...p, variants: (p.variants || []).filter(v => v.id !== variantId) }
        : p
      ));
    } catch {
      showToast('Failed to delete variant', 'error');
    } finally {
      setDeletingVariantId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product and all its variants?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      showToast('Product deleted');
      loadProducts(search, page);
    } catch {
      showToast('Failed to delete product', 'error');
    }
  }

  function updateVariantStock(variantId: string, newStock: number) {
    setProducts(prev => prev.map(p => ({
      ...p,
      variants: p.variants?.map(v => v.id === variantId ? { ...v, stock: newStock } : v),
    })));
  }

  async function handleAddStock(row: FlatRow) {
    const qty = Number(stockInputs[row.variant.id]);
    if (!qty || qty < 1) { showToast('Enter a valid quantity', 'error'); return; }
    try {
      const res = await api.put(`/api/products/variant/${row.variant.id}/stock`, {
        qty,
        unit_cost: row.effective_purchase_price,
        date: today(),
      });
      const newStock = res?.success?.data?.new_stock ?? (row.variant.stock + qty);
      showToast(`Added ${qty} units to ${row.product.name} (${row.size_name})`);
      setStockInputs(prev => ({ ...prev, [row.variant.id]: '' }));
      updateVariantStock(row.variant.id, newStock);
    } catch {
      showToast('Failed to add stock', 'error');
    }
  }

  async function handleReduceStock(row: FlatRow) {
    const qty = Number(stockInputs[row.variant.id]);
    if (!qty || qty < 1) { showToast('Enter a valid quantity', 'error'); return; }
    if (qty > row.variant.stock) { showToast(`Cannot reduce more than current stock (${row.variant.stock})`, 'error'); return; }
    try {
      const res = await api.put(`/api/products/variant/${row.variant.id}/reduce-stock`, { qty });
      if (res?.error) { showToast(res.error.message || 'Failed to reduce stock', 'error'); return; }
      const newStock = res?.success?.data?.new_stock ?? (row.variant.stock - qty);
      showToast(`Removed ${qty} units from ${row.product.name} (${row.size_name})`);
      setStockInputs(prev => ({ ...prev, [row.variant.id]: '' }));
      updateVariantStock(row.variant.id, newStock);
    } catch {
      showToast('Failed to reduce stock', 'error');
    }
  }

  const selectedSizeIds = variants.map(v => v.size_id);

  const activeFilterCount = [filterCategory, filterSizes.length > 0, filterPriceMin, filterPriceMax, filterStock, filterStatus].filter(Boolean).length;

  const filteredProducts = products.filter(p => {
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (filterStatus === 'active' && !p.is_active) return false;
    if (filterStatus === 'inactive' && p.is_active) return false;
    const pvs = p.variants || [];
    if (filterSizes.length > 0) {
      const hasSome = pvs.some(v => filterSizes.includes(v.size_id));
      if (!hasSome) return false;
    }
    const priceMin = filterPriceMin ? Number(filterPriceMin) : null;
    const priceMax = filterPriceMax ? Number(filterPriceMax) : null;
    if (priceMin !== null && p.selling_price < priceMin) return false;
    if (priceMax !== null && p.selling_price > priceMax) return false;
    if (filterStock) {
      const totalStock = pvs.reduce((s, v) => s + v.stock, 0);
      if (filterStock === 'out_of_stock' && totalStock > 0) return false;
      if (filterStock === 'low_stock' && (totalStock === 0 || totalStock > 5)) return false;
      if (filterStock === 'in_stock' && totalStock === 0) return false;
    }
    return true;
  });

  function clearFilters() {
    setFilterCategory('');
    setFilterSizes([]);
    setFilterPriceMin('');
    setFilterPriceMax('');
    setFilterStock('');
    setFilterStatus('');
  }

  return (
    <div>
      <TopBar title="Products & Stock" />

      <div className="p-6">
        <div ref={tableRef} className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-6">

          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#798397]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, SKU, barcode..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
              />
            </div>

            <button
              onClick={() => setShowFilters(f => !f)}
              className={`relative p-2.5 border rounded-lg transition-colors ${showFilters || activeFilterCount ? 'border-[#237a59] bg-[#237a59]/5 text-[#237a59]' : 'border-[#e5e9f0] text-[#798397] hover:bg-[#f5f7fb] hover:text-[#20283b]'}`}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#237a59] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>

            <button
              onClick={() => loadProducts(search, page)}
              className="p-2.5 border border-[#e5e9f0] rounded-lg hover:bg-[#f5f7fb] text-[#798397] hover:text-[#20283b] transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={openAddDrawer}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          {/* Advanced Filters Panel */}
          <div style={{ display: 'grid', gridTemplateRows: showFilters ? '1fr' : '0fr', opacity: showFilters ? 1 : 0, transition: 'grid-template-rows 300ms cubic-bezier(0.4,0,0.2,1), opacity 250ms ease' }}>
            <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div className="bg-[#f9fafb] rounded-xl border border-[#e5e9f0] p-4 mb-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#798397] uppercase tracking-wide">Advanced Filters</p>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-xs text-[#b32642] font-semibold hover:underline">Clear all</button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Category */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#798397] uppercase tracking-wide mb-1.5 block">Category</label>
                    <Select
                      value={filterCategory}
                      onChange={setFilterCategory}
                      placeholder="All Categories"
                      searchPlaceholder="Search categories..."
                      options={[
                        { value: '', label: 'All Categories' },
                        ...categoryOptions.map(c => ({ value: c.id, label: c.name })),
                      ]}
                    />
                  </div>

                  {/* Size Multi-Select */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#798397] uppercase tracking-wide mb-1.5 block">Sizes</label>
                    <MultiSelect
                      values={filterSizes}
                      onChange={setFilterSizes}
                      options={sizeOptions.map(s => ({ value: s.id, label: s.name }))}
                      placeholder="All Sizes"
                      searchPlaceholder="Search sizes..."
                    />
                  </div>

                  {/* Price Range */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#798397] uppercase tracking-wide mb-1.5 block">Price Range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" step="1"
                        value={filterPriceMin}
                        onChange={e => setFilterPriceMin(cleanPrice(e.target.value))}
                        onKeyDown={onPriceKey}
                        placeholder="Min"
                        className="w-full px-3 py-2 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                      />
                      <span className="text-[#b0bac9] text-xs">–</span>
                      <input
                        type="number" min="0" step="1"
                        value={filterPriceMax}
                        onChange={e => setFilterPriceMax(cleanPrice(e.target.value))}
                        onKeyDown={onPriceKey}
                        placeholder="Max"
                        className="w-full px-3 py-2 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                      />
                    </div>
                  </div>

                  {/* Stock Status */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#798397] uppercase tracking-wide mb-1.5 block">Stock Status</label>
                    <Select
                      value={filterStock}
                      onChange={v => setFilterStock(v as any)}
                      searchPlaceholder="Search stock status..."
                      options={[
                        { value: '', label: 'All' },
                        { value: 'in_stock', label: 'In Stock' },
                        { value: 'low_stock', label: 'Low Stock (1-5)' },
                        { value: 'out_of_stock', label: 'Out of Stock' },
                      ]}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-[11px] font-semibold text-[#798397] uppercase tracking-wide mb-1.5 block">Status</label>
                    <Select
                      value={filterStatus}
                      onChange={v => setFilterStatus(v as any)}
                      searchPlaceholder="Search status..."
                      options={[
                        { value: '', label: 'All' },
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!loading && (
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4 text-xs text-[#798397]">
              <p>
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} on this page
                {activeFilterCount > 0 ? ` (filtered from ${total})` : ''} · <span className="font-semibold text-[#20283b] tabular-nums">{total}</span> total
              </p>
              <div className="flex items-center gap-2 min-w-40">
                <label className="font-semibold uppercase tracking-wide whitespace-nowrap">Rows per page</label>
                <div className="w-24">
                  <Select
                    value={String(limit)}
                    onChange={v => changeLimit(Number(v))}
                    options={PAGE_SIZE_OPTIONS.map(n => ({ value: String(n), label: String(n) }))}
                    searchable={false}
                  />
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-[#f5f7fb] rounded animate-pulse" />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-[#798397]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs mt-1 opacity-70">
                {search ? 'Try a different search term' : 'Add your first product to get started'}
              </p>
              {!search && (
                <button
                  onClick={openAddDrawer}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#237a59] text-white text-sm font-semibold rounded-lg hover:bg-[#1d6649] transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f7fb] rounded-lg">
                    <th className="w-8 px-2 py-2.5 rounded-l-lg" />
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Photo</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Product</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">SKU</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Category</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Sizes</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Total Stock</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Price</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide">Active</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-bold text-[#798397] uppercase tracking-wide rounded-r-lg">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {filteredProducts.map(p => {
                    const expanded = expandedIds.has(p.id);
                    const variantList = p.variants || [];
                    const totalStock = variantList.reduce((s, v) => s + v.stock, 0);
                    const categoryName = p.category_info?.name || '—';

                    return (
                      <Fragment key={p.id}>
                        {/* Parent product row */}
                        <tr
                          className={`hover:bg-[#f9fafb] transition-colors cursor-pointer ${!p.is_active ? 'bg-[#f9fafc]' : ''}`}
                          onClick={() => toggleExpand(p.id)}
                        >
                          <td className="px-2 py-2.5">
                            <ChevronDown className={`w-4 h-4 text-[#798397] transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                          </td>
                          <td className="px-3 py-2.5">
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.name} className={`w-10 h-10 rounded-lg object-cover border border-[#e5e9f0] ${!p.is_active ? 'opacity-40 grayscale' : ''}`} />
                            ) : (
                              <div className={`w-10 h-10 rounded-lg bg-[#f0f2f5] flex items-center justify-center ${!p.is_active ? 'opacity-40' : ''}`}>
                                <ImageIcon className="w-4 h-4 text-[#c2cad6]" />
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2.5 max-w-40">
                            <p className={`font-semibold truncate ${p.is_active ? 'text-[#20283b]' : 'text-[#98a2b6]'}`}>{p.name}</p>
                          </td>

                          <td className="px-3 py-2.5">
                            <span className={`font-mono text-xs font-semibold whitespace-nowrap ${p.is_active ? 'text-[#3479e6]' : 'text-[#b0bac9]'}`}>{p.sku}</span>
                          </td>

                          <td className="px-3 py-2.5">
                            <span className={`text-xs ${p.is_active ? 'text-[#798397]' : 'text-[#b0bac9]'}`}>{categoryName}</span>
                          </td>

                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {variantList.map(v => (
                                <span key={v.id} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f0f4f8] text-[#20283b]">{v.size_info?.name || '—'}</span>
                              ))}
                            </div>
                          </td>

                          <td className="px-3 py-2.5">
                            <StockPill stock={totalStock} />
                          </td>

                          <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${p.is_active ? 'text-[#20283b]' : 'text-[#98a2b6]'}`}>
                            {money(p.selling_price)}
                          </td>

                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <Switch
                              on={p.is_active}
                              busy={togglingId === p.id}
                              onClick={() => handleToggleActive(p)}
                              title={p.is_active ? 'Deactivate' : 'Activate'}
                            />
                          </td>

                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 justify-end">
                              <a
                                href={`/products/${p.id}`}
                                className="p-1.5 rounded hover:bg-[#f0f4ff] text-[#5b6b82] transition-colors"
                                title="View product"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => openEditDrawer(p)}
                                className="p-1.5 rounded hover:bg-[#f0f4ff] text-[#3479e6] transition-colors"
                                title="Edit product"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={`/barcodes?product=${p.id}`}
                                className="p-1.5 rounded hover:bg-[#eaf5ef] text-[#237a59] transition-colors"
                                title="Print barcodes"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1.5 rounded hover:bg-[#fff0f1] text-[#b32642] transition-colors"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Animated variant sub-rows */}
                        <AnimatedCollapse open={expanded}>
                          {variantList.map(v => {
                            const vActive = p.is_active && v.is_active;
                            const effectivePrice = v.selling_price ?? p.selling_price;
                            const effectiveCost = v.purchase_price ?? p.purchase_price;
                            const fRow: FlatRow = {
                              product: p,
                              variant: v,
                              size_name: v.size_info?.name || '—',
                              category_name: categoryName,
                              effective_purchase_price: effectiveCost,
                              effective_selling_price: effectivePrice,
                            };
                            return (
                              <tr key={v.id} className={`bg-[#f8faf9] hover:bg-[#f0f5f2] transition-colors ${!vActive ? 'opacity-60' : ''}`}>
                                <td className="px-2 py-2" style={{ width: 32 }}>
                                  <div className="w-4 h-4 border-l-2 border-b-2 border-[#d0d8e4] rounded-bl ml-1" />
                                </td>
                                <td className="px-3 py-2">
                                  {(v.photo_url || p.photo_url) ? (
                                    <img src={v.photo_url || p.photo_url} alt="" className="w-8 h-8 rounded-md object-cover border border-[#e5e9f0]" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-md bg-[#e8ecf1] flex items-center justify-center">
                                      <ImageIcon className="w-3 h-3 text-[#c2cad6]" />
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <p className="text-xs text-[#798397] font-mono tracking-wider">{v.barcode}</p>
                                </td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#237a59]/10 text-[#237a59]">{v.size_info?.name || '—'}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <StockPill stock={v.stock} />
                                </td>
                                <td className="px-3 py-2 font-semibold text-[#20283b] whitespace-nowrap text-xs">
                                  {money(effectivePrice)}
                                </td>
                                <td className="px-3 py-2" colSpan={2}>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleReduceStock(fRow)}
                                      disabled={!vActive || v.stock === 0}
                                      className="px-2 py-1 bg-[#b32642] text-white text-xs rounded hover:bg-[#9a1f37] transition-colors disabled:opacity-40"
                                      title="Reduce stock"
                                    >−</button>
                                    <input
                                      type="number" min="1"
                                      value={stockInputs[v.id] || ''}
                                      onChange={e => setStockInputs(s => ({ ...s, [v.id]: e.target.value }))}
                                      placeholder="Qty"
                                      className="w-16 px-2 py-1 text-xs rounded border border-[#e5e9f0] focus:outline-none focus:border-[#237a59]"
                                      disabled={!vActive}
                                    />
                                    <button
                                      onClick={() => handleAddStock(fRow)}
                                      disabled={!vActive}
                                      className="px-2 py-1 bg-[#237a59] text-white text-xs rounded hover:bg-[#1d6649] transition-colors disabled:opacity-40"
                                      title="Add stock"
                                    >+</button>

                                    <div className="w-px h-4 bg-[#e5e9f0] mx-1" />

                                    <div onClick={e => e.stopPropagation()} className="flex items-center gap-1">
                                      <Switch
                                        on={v.is_active}
                                        busy={togglingVariantId === v.id}
                                        onClick={() => handleToggleVariantActive(v, p)}
                                        title={v.is_active ? 'Deactivate variant' : 'Activate variant'}
                                      />

                                      <button
                                        onClick={() => handleDeleteVariant(v.id, p.id)}
                                        disabled={deletingVariantId === v.id}
                                        className="p-1.5 rounded hover:bg-[#fff0f1] text-[#b32642] transition-colors disabled:opacity-40"
                                        title="Remove variant (soft delete)"
                                      >
                                        {deletingVariantId === v.id
                                          ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                          : <Trash2 className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </AnimatedCollapse>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > 0 && (
            <div className="mt-5 flex items-center justify-between flex-wrap gap-3 border-t border-[#e5e9f0] pt-4 text-sm">
              <span className="text-[#798397]">
                Showing <span className="font-bold text-[#20283b] tabular-nums">{Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)}</span>
                {' '}of <span className="font-bold text-[#20283b] tabular-nums">{total}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-[#e5e9f0] hover:bg-[#f5f7fb] disabled:opacity-40 disabled:cursor-not-allowed text-[#798397]"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {(() => {
                  // Compact windowed page list: 1 … (page-1) page (page+1) … totalPages
                  const pages: (number | 'dots')[] = [];
                  const push = (n: number | 'dots') => pages.push(n);
                  const window = 1;
                  const start = Math.max(2, page - window);
                  const end = Math.min(totalPages - 1, page + window);
                  push(1);
                  if (start > 2) push('dots');
                  for (let i = start; i <= end; i++) push(i);
                  if (end < totalPages - 1) push('dots');
                  if (totalPages > 1) push(totalPages);
                  return pages.map((pg, i) =>
                    pg === 'dots' ? (
                      <span key={`d-${i}`} className="px-1 text-[#b0bac9] select-none">…</span>
                    ) : (
                      <button
                        key={pg}
                        onClick={() => goToPage(pg)}
                        className={`w-8 h-8 rounded text-xs font-semibold transition-colors ${
                          page === pg
                            ? 'bg-[#237a59] text-white'
                            : 'border border-[#e5e9f0] text-[#798397] hover:bg-[#f5f7fb]'
                        }`}
                      >
                        {pg}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded border border-[#e5e9f0] hover:bg-[#f5f7fb] disabled:opacity-40 disabled:cursor-not-allowed text-[#798397]"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={drawerOpen}
        onClose={closeDrawer}
        title={drawerMode === 'add' ? 'Add New Product' : `Edit — ${editingProduct?.name}`}
        maxWidth="max-w-4xl"
        disableBackdropClose
      >
              {drawerMode === 'add' && (
                <>
                  {createdResult && (
                    <div className="rounded-xl border border-[#237a59]/30 overflow-hidden">
                      <div className="bg-[#237a59] px-5 py-4 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{createdResult.name}</p>
                          <p className="text-white/70 text-xs font-mono mt-0.5">SKU: {createdResult.sku}</p>
                        </div>
                        <a
                          href={`/barcodes?sku=${createdResult.sku}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print All
                        </a>
                      </div>

                      <div className="p-4">
                        <p className="text-xs font-bold text-[#798397] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <ScanBarcode className="w-3.5 h-3.5" />
                          Barcodes per size
                        </p>
                        <div className="space-y-2">
                          {createdResult.variants.map(cv => (
                            <div key={cv.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#f5f7fb] border border-[#e5e9f0]">
                              <div className="flex items-center gap-3">
                                <span className="w-14 text-center px-2 py-0.5 rounded-md bg-[#237a59]/10 text-[#237a59] text-xs font-bold shrink-0">
                                  {cv.size}
                                </span>
                                <span className="font-mono text-sm font-bold text-[#20283b] tracking-wider">{cv.barcode}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <StockPill stock={cv.stock} />
                                <a
                                  href={`/barcodes?product=${cv.id}`}
                                  className="p-1.5 rounded hover:bg-[#eaf5ef] text-[#237a59] transition-colors"
                                  title={`Print barcode for ${cv.size}`}
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="px-4 pb-4">
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...EMPTY_FORM, category_id: categoryOptions[0]?.id || '' });
                            setVariants([]);
                            setErrors({});
                            setCreatedResult(null);
                          }}
                          className="w-full py-2.5 border-2 border-dashed border-[#237a59]/30 hover:border-[#237a59] text-[#237a59] text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Another Product
                        </button>
                      </div>
                    </div>
                  )}

                  {!createdResult && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Product Name *</label>
                        <input
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. Banarasi Silk Saree"
                          className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder:text-[#c2cad6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                        />
                        {errors.name && <p className="text-xs text-[#b32642] mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Category *</label>
                        <Select
                          value={form.category_id}
                          onChange={v => setForm(f => ({ ...f, category_id: v }))}
                          placeholder="Select category"
                          searchPlaceholder="Search categories..."
                          options={categoryOptions.map(c => ({ value: c.id, label: c.name }))}
                        />
                        {errors.category_id && <p className="text-xs text-[#b32642] mt-1">{errors.category_id}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Purchase Price (₹) *</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={form.purchase_price}
                            onKeyDown={onPriceKey}
                            onChange={e => setForm(f => ({ ...f, purchase_price: cleanPrice(e.target.value) }))}
                            placeholder="0.00"
                            className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                          />
                          {errors.purchase_price && <p className="text-xs text-[#b32642] mt-1">{errors.purchase_price}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Selling Price (₹) *</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={form.selling_price}
                            onKeyDown={onPriceKey}
                            onChange={e => setForm(f => ({ ...f, selling_price: cleanPrice(e.target.value) }))}
                            placeholder="0.00"
                            className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                          />
                          {errors.selling_price && <p className="text-xs text-[#b32642] mt-1">{errors.selling_price}</p>}
                        </div>
                      </div>

                      <ImageUpload
                        label="Product Photos"
                        value=""
                        existingUrls={form.photo_urls}
                        onRemoveExisting={url => setForm(f => ({
                          ...f,
                          photo_urls: f.photo_urls.filter(u => u !== url),
                          photo_url: f.photo_url === url ? (f.photo_urls.filter(u => u !== url)[0] || '') : f.photo_url,
                        }))}
                        onChange={url => setForm(f => ({
                          ...f,
                          photo_url: f.photo_url || url,
                          photo_urls: [...f.photo_urls, url],
                        }))}
                        multiple
                        onMultipleChange={urls => setForm(f => ({
                          ...f,
                          photo_url: f.photo_url || urls[0] || '',
                          photo_urls: [...f.photo_urls, ...urls],
                        }))}
                        folder="products"
                      />

                      <div>
                        <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Notes</label>
                        <textarea
                          value={form.notes}
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Optional notes..."
                          rows={2}
                          className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder:text-[#c2cad6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] resize-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-[#798397] uppercase tracking-wide">Sizes & Stock *</label>
                          {variants.length > 0 && (
                            <span className="text-xs text-[#237a59] font-semibold">{variants.length} size{variants.length > 1 ? 's' : ''} selected</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {sizeOptions.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleSize(s.id, s.name)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                selectedSizeIds.includes(s.id)
                                  ? 'bg-[#237a59] text-white border-[#237a59]'
                                  : 'bg-white text-[#798397] border-[#e5e9f0] hover:border-[#237a59] hover:text-[#237a59]'
                              }`}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>

                        {errors.variants && <p className="text-xs text-[#b32642] mb-2">{errors.variants}</p>}

                        {variants.length > 0 && (
                          <div className="space-y-2">
                            {variants.map(v => (
                              <div key={v.size_id} className="border border-[#e5e9f0] rounded-lg p-3 bg-[#f9fafc]">
                                <div className="flex items-center gap-3">
                                  <span className="w-16 shrink-0 text-center px-2 py-1 rounded-md bg-[#237a59]/10 text-[#237a59] text-xs font-bold">{v.size_name}</span>

                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-xs text-[#798397] whitespace-nowrap">Opening Qty</span>
                                    <input
                                      type="number" min="0"
                                      value={v.qty}
                                      onChange={e => updateVariant(v.size_id, 'qty', e.target.value)}
                                      placeholder="0"
                                      className="w-20 px-2 py-1.5 rounded-md border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] bg-white"
                                    />
                                  </div>

                                  <span className="flex items-center gap-1 text-[11px] text-[#b0bac9] font-mono">
                                    <ScanBarcode className="w-3 h-3" />
                                    auto
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => toggleSize(v.size_id, v.size_name)}
                                    className="p-1 rounded hover:bg-[#fff0f1] text-[#b32642] transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="mt-2 flex items-center gap-3 pl-1">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={v.useSharedPrice}
                                      onChange={e => updateVariant(v.size_id, 'useSharedPrice', e.target.checked)}
                                      className="w-3.5 h-3.5 accent-[#237a59] cursor-pointer"
                                    />
                                    <span className="text-xs text-[#798397]">Use main price</span>
                                  </label>
                                  {!v.useSharedPrice && (
                                    <div className="flex items-center gap-1.5 flex-1">
                                      <span className="text-xs text-[#798397] whitespace-nowrap">₹ Sell</span>
                                      <input
                                        type="number" min="0" step="0.01"
                                        value={v.selling_price}
                                        onKeyDown={onPriceKey}
                                        onChange={e => updateVariant(v.size_id, 'selling_price', cleanPrice(e.target.value))}
                                        placeholder={form.selling_price || '0.00'}
                                        className="w-24 px-2 py-1.5 rounded-md border border-[#237a59]/40 text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] bg-white font-semibold"
                                      />
                                      <span className="text-xs text-[#798397] whitespace-nowrap">₹ Buy</span>
                                      <input
                                        type="number" min="0" step="0.01"
                                        value={v.purchase_price}
                                        onKeyDown={onPriceKey}
                                        onChange={e => updateVariant(v.size_id, 'purchase_price', cleanPrice(e.target.value))}
                                        placeholder={form.purchase_price || '0.00'}
                                        className="w-24 px-2 py-1.5 rounded-md border border-[#237a59]/40 text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] bg-white font-semibold"
                                      />
                                    </div>
                                  )}
                                  {v.useSharedPrice && form.selling_price && (
                                    <span className="text-xs font-semibold text-[#20283b]">₹ {form.selling_price}</span>
                                  )}
                                </div>

                                <div className="mt-2 pl-1">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={v.useMainPhoto}
                                      onChange={e => updateVariant(v.size_id, 'useMainPhoto', e.target.checked)}
                                      className="w-3.5 h-3.5 accent-[#237a59] cursor-pointer"
                                    />
                                    <span className="text-xs text-[#798397]">Use main photos</span>
                                  </label>
                                  {!v.useMainPhoto && (
                                    <div className="mt-2">
                                      <ImageUpload
                                        label=""
                                        multiple
                                        existingUrls={v.photo_urls}
                                        onRemoveExisting={url => updateVariant(v.size_id, 'photo_urls', v.photo_urls.filter(u => u !== url))}
                                        onMultipleChange={urls => updateVariant(v.size_id, 'photo_urls', [...v.photo_urls, ...urls])}
                                        folder="products/variants"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-[#237a59] hover:bg-[#1d6649] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {submitting
                          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...</>
                          : <><Plus className="w-4 h-4" /> Add Product</>
                        }
                      </button>
                    </form>
                  )}
                </>
              )}

              {drawerMode === 'edit' && editingProduct && (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="p-3 rounded-lg bg-[#f5f7fb] border border-[#e5e9f0]">
                    <p className="text-[10px] font-bold text-[#798397] uppercase tracking-wide mb-0.5">SKU</p>
                    <p className="font-mono text-xs font-semibold text-[#3479e6]">{editingProduct.sku}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Product Name *</label>
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                    />
                    {editErrors.name && <p className="text-xs text-[#b32642] mt-1">{editErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Category *</label>
                    <Select
                      value={editForm.category_id}
                      onChange={v => setEditForm(f => ({ ...f, category_id: v }))}
                      placeholder="Select category"
                      searchPlaceholder="Search categories..."
                      options={categoryOptions.map(c => ({ value: c.id, label: c.name }))}
                    />
                    {editErrors.category_id && <p className="text-xs text-[#b32642] mt-1">{editErrors.category_id}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Purchase Price (₹) *</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={editForm.purchase_price}
                        onKeyDown={onPriceKey}
                        onChange={e => setEditForm(f => ({ ...f, purchase_price: cleanPrice(e.target.value) }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                      />
                      {editErrors.purchase_price && <p className="text-xs text-[#b32642] mt-1">{editErrors.purchase_price}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Selling Price (₹) *</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={editForm.selling_price}
                        onKeyDown={onPriceKey}
                        onChange={e => setEditForm(f => ({ ...f, selling_price: cleanPrice(e.target.value) }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                      />
                      {editErrors.selling_price && <p className="text-xs text-[#b32642] mt-1">{editErrors.selling_price}</p>}
                    </div>
                  </div>

                  <ImageUpload
                    label="Product Photos"
                    value=""
                    existingUrls={editForm.photo_urls}
                    onRemoveExisting={url => setEditForm(f => ({
                      ...f,
                      photo_urls: f.photo_urls.filter(u => u !== url),
                      photo_url: f.photo_url === url ? (f.photo_urls.filter(u => u !== url)[0] || '') : f.photo_url,
                    }))}
                    onChange={url => setEditForm(f => ({
                      ...f,
                      photo_url: f.photo_url || url,
                      photo_urls: [...f.photo_urls, url],
                    }))}
                    multiple
                    onMultipleChange={urls => setEditForm(f => ({
                      ...f,
                      photo_url: f.photo_url || urls[0] || '',
                      photo_urls: [...f.photo_urls, ...urls],
                    }))}
                    folder="products"
                  />

                  <div>
                    <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder:text-[#c2cad6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] resize-none"
                    />
                  </div>

                  {/* Variants editing */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-[#798397] uppercase tracking-wide">Sizes & Variants</label>
                      {editVariants.length > 0 && (
                        <span className="text-xs text-[#237a59] font-semibold">{editVariants.length} size{editVariants.length > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Add new sizes */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {sizeOptions.map(s => {
                        const exists = editVariants.find(ev => ev.size_id === s.id);
                        const isExisting = exists && !exists.isNew;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => !isExisting && toggleEditSize(s.id, s.name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              exists
                                ? 'bg-[#237a59] text-white border-[#237a59]'
                                : 'bg-white text-[#798397] border-[#e5e9f0] hover:border-[#237a59] hover:text-[#237a59]'
                            } ${isExisting ? 'cursor-default' : ''}`}
                            title={isExisting ? `${s.name} already exists` : undefined}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>

                    {editVariants.length > 0 && (
                      <div className="space-y-2">
                        {editVariants.map(ev => (
                          <div key={ev.size_id} className="border border-[#e5e9f0] rounded-lg p-3 bg-[#f9fafc]">
                            <div className="flex items-center gap-3">
                              <span className="w-16 shrink-0 text-center px-2 py-1 rounded-md bg-[#237a59]/10 text-[#237a59] text-xs font-bold">{ev.size_name}</span>

                              {ev.isNew ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-xs text-[#798397] whitespace-nowrap">Opening Qty</span>
                                  <input
                                    type="number" min="0"
                                    value={ev.stock || ''}
                                    onChange={e => updateEditVariant(ev.size_id, 'stock', Number(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-20 px-2 py-1.5 rounded-md border border-[#e5e9f0] text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] bg-white"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="font-mono text-xs text-[#798397]">{ev.barcode}</span>
                                  <StockPill stock={ev.stock} />
                                </div>
                              )}

                              <span className="flex items-center gap-1 text-[11px] text-[#b0bac9] font-mono">
                                <ScanBarcode className="w-3 h-3" />
                                {ev.isNew ? 'auto' : ''}
                              </span>

                              {ev.isNew && (
                                <button
                                  type="button"
                                  onClick={() => toggleEditSize(ev.size_id, ev.size_name)}
                                  className="p-1 rounded hover:bg-[#fff0f1] text-[#b32642] transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="mt-2 flex items-center gap-3 pl-1">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ev.useSharedPrice}
                                  onChange={e => updateEditVariant(ev.size_id, 'useSharedPrice', e.target.checked)}
                                  className="w-3.5 h-3.5 accent-[#237a59] cursor-pointer"
                                />
                                <span className="text-xs text-[#798397]">Use main price</span>
                              </label>
                              {!ev.useSharedPrice && (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-xs text-[#798397] whitespace-nowrap">₹ Sell</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={ev.selling_price}
                                    onKeyDown={onPriceKey}
                                    onChange={e => updateEditVariant(ev.size_id, 'selling_price', cleanPrice(e.target.value))}
                                    placeholder={editForm.selling_price || '0.00'}
                                    className="w-24 px-2 py-1.5 rounded-md border border-[#237a59]/40 text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] bg-white font-semibold"
                                  />
                                  <span className="text-xs text-[#798397] whitespace-nowrap">₹ Buy</span>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={ev.purchase_price}
                                    onKeyDown={onPriceKey}
                                    onChange={e => updateEditVariant(ev.size_id, 'purchase_price', cleanPrice(e.target.value))}
                                    placeholder={editForm.purchase_price || '0.00'}
                                    className="w-24 px-2 py-1.5 rounded-md border border-[#237a59]/40 text-sm text-[#20283b] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59] bg-white font-semibold"
                                  />
                                </div>
                              )}
                              {ev.useSharedPrice && editForm.selling_price && (
                                <span className="text-xs font-semibold text-[#20283b]">₹ {editForm.selling_price}</span>
                              )}
                            </div>

                            <div className="mt-2 pl-1">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ev.useMainPhoto}
                                  onChange={e => updateEditVariant(ev.size_id, 'useMainPhoto', e.target.checked)}
                                  className="w-3.5 h-3.5 accent-[#237a59] cursor-pointer"
                                />
                                <span className="text-xs text-[#798397]">Use main photos</span>
                              </label>
                              {!ev.useMainPhoto && (
                                <div className="mt-2">
                                  <ImageUpload
                                    label=""
                                    multiple
                                    existingUrls={ev.photo_urls}
                                    onRemoveExisting={url => updateEditVariant(ev.size_id, 'photo_urls', ev.photo_urls.filter(u => u !== url))}
                                    onMultipleChange={urls => updateEditVariant(ev.size_id, 'photo_urls', [...ev.photo_urls, ...urls])}
                                    folder="products/variants"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="flex-1 py-2.5 border border-[#e5e9f0] text-[#798397] font-semibold rounded-lg text-sm hover:bg-[#f5f7fb] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {submitting
                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                        : 'Save Changes'
                      }
                    </button>
                  </div>
                </form>
              )}
      </Modal>
    </div>
  );
}
