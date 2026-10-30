'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, Search, X, ChevronDown, Tag, Package, CheckCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import { Product } from '../../../types';
import { showToast } from '../../../components/ui/Toast';

interface BarcodeVariant {
  id: string; product_id: string; barcode: string; size: string;
  selling_price: number; stock: number; photo_url?: string;
}
interface LabelItem { variant: BarcodeVariant; productName: string; sku: string; }
interface ProductGroup {
  baseSku: string; name: string; category: string;
  variants: BarcodeVariant[]; photo_url?: string;
}

/* ── Label sticker ───────────────────────────────────────────── */
function BarcodeLabel({ item, shopName }: { item: LabelItem; shopName: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svgRef.current || !item.variant.barcode) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(svgRef.current, item.variant.barcode, {
          format: 'CODE128', width: 1.6, height: 40,
          displayValue: true, fontSize: 9, margin: 3,
        });
      } catch { /* silent */ }
    });
  }, [item.variant.barcode]);

  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-2 text-center bg-white break-inside-avoid" style={{ width: 156 }}>
      <p className="font-black text-[11px] text-gray-900 leading-snug">{shopName}</p>
      <p className="text-[9px] text-gray-400 font-mono truncate">{item.sku}</p>
      <p className="text-[10px] font-bold text-gray-600">SIZE: {item.variant.size}</p>
      <p className="text-[15px] font-black text-gray-900">₹{item.variant.selling_price}</p>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

const SHOP_NAME = 'Tulshi Fashion';
const LIMIT = 20;

function buildGroups(products: Product[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const p of products) {
    if (!map.has(p.sku)) map.set(p.sku, { baseSku: p.sku, name: p.name, category: p.category_info?.name || '', variants: [], photo_url: p.photo_url || undefined });
    const g = map.get(p.sku)!;
    for (const v of p.variants || []) {
      if (!g.variants.find(ev => ev.id === v.id))
        g.variants.push({ id: v.id, product_id: p.id, barcode: v.barcode, size: v.size_info?.name || '—', selling_price: v.selling_price ?? p.selling_price, stock: v.stock, photo_url: p.photo_url || undefined });
    }
  }
  return Array.from(map.values());
}
function mergeGroups(existing: ProductGroup[], products: Product[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>(existing.map(g => [g.baseSku, { ...g, variants: [...g.variants] }]));
  for (const ng of buildGroups(products)) {
    if (!map.has(ng.baseSku)) { map.set(ng.baseSku, ng); }
    else { const eg = map.get(ng.baseSku)!; for (const v of ng.variants) if (!eg.variants.find(ev => ev.id === v.id)) eg.variants.push(v); }
  }
  return Array.from(map.values());
}

export default function BarcodesPage() {
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [labels, setLabels] = useState<LabelItem[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activeSearchRef = useRef('');

  const fetchProducts = useCallback(async (term: string, pageNum: number, reset = false) => {
    activeSearchRef.current = term;
    if (pageNum === 1) setLoadingInitial(true); else setLoadingMore(true);
    try {
      const res = await api.get(`/api/products?search=${encodeURIComponent(term)}&page=${pageNum}&limit=${LIMIT}`);
      if (activeSearchRef.current !== term) return;
      if (res?.error) { showToast(res.error.message || 'Failed', 'error'); return; }
      const data = res?.success?.data;
      setGroups(prev => reset ? mergeGroups([], data?.products || []) : mergeGroups(prev, data?.products || []));
      setHasMore(pageNum < (data?.totalPages || 1));
      setCurrentPage(pageNum);
    } catch { showToast('Failed to load products', 'error'); }
    finally { setLoadingInitial(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchProducts('', 1, true); }, [fetchProducts]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setGroups([]); fetchProducts(value, 1, true); }, 300);
  };

  const handleListScroll = useCallback(() => {
    if (!listRef.current || loadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 60) fetchProducts(searchTerm, currentPage + 1);
  }, [loadingMore, hasMore, fetchProducts, searchTerm, currentPage]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId || !groups.length) return;
    for (const g of groups) { if (g.variants.find(v => v.product_id === productId)) { selectGroup(g); break; } }
  }, [searchParams, groups]);

  function selectGroup(g: ProductGroup) {
    setSelectedGroup(g); setSearchTerm(g.name); setIsOpen(false);
    setSelectedIds(new Set()); setQtyMap({}); setLabels([]);
  }
  function clearAll() {
    setSelectedGroup(null); setSearchTerm(''); setSelectedIds(new Set());
    setQtyMap({}); setLabels([]); setGroups([]); fetchProducts('', 1, true);
  }
  function toggleVariant(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!qtyMap[id]) {
          const v = selectedGroup?.variants.find(x => x.id === id);
          const def = Math.max(1, v?.stock ?? 1);
          setQtyMap(q => ({ ...q, [id]: def }));
        }
      }
      return next;
    });
    setLabels([]);
  }
  function setQty(id: string, val: number) {
    setQtyMap(q => ({ ...q, [id]: Math.min(999, Math.max(1, isNaN(val) ? 1 : val)) }));
    setLabels([]);
  }

  function generate() {
    if (!selectedGroup || !selectedIds.size) { showToast('Select at least one size', 'error'); return; }
    const result: LabelItem[] = [];
    for (const v of selectedGroup.variants) {
      if (!selectedIds.has(v.id)) continue;
      const qty = qtyMap[v.id] ?? 1;
      for (let i = 0; i < qty; i++) result.push({ variant: v, productName: selectedGroup.name, sku: selectedGroup.baseSku });
    }
    setLabels(result);
    showToast(`${result.length} label${result.length !== 1 ? 's' : ''} ready`);
  }

  const totalLabels = [...selectedIds].reduce((s, id) => s + (qtyMap[id] ?? 1), 0);
  const selectedVariants = selectedGroup?.variants.filter(v => selectedIds.has(v.id)) || [];

  return (
    <div className="flex flex-col h-full">
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-area { display: flex !important; flex-wrap: wrap; gap: 6px; padding: 10px; }
        }
        #print-area { display: none; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>

      <div className="flex flex-1 overflow-hidden gap-0">

        {/* ── LEFT PANEL ─────────────────────────────────────────── */}
        <div className="w-90 shrink-0 flex flex-col border-r border-[#e5e9f0] bg-[#fafbfc] overflow-y-auto">

          {/* Search */}
          <div className="p-4 border-b border-[#e5e9f0] bg-white">
            <p className="text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-2">Select Product</p>
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setIsOpen(true)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-white cursor-text transition-all duration-150 ${isOpen ? 'border-[#237a59] ring-2 ring-[#237a59]/15' : 'border-[#e5e9f0] hover:border-[#c5cdd8]'}`}
              >
                <Search className="w-4 h-4 text-[#98a2b6] shrink-0" />
                <input
                  type="text" placeholder="Search product…"
                  value={searchTerm} onChange={e => handleSearch(e.target.value)} onFocus={() => setIsOpen(true)}
                  className="flex-1 text-sm text-[#20283b] bg-transparent outline-none placeholder-[#c2cad6]"
                />
                {(selectedGroup || searchTerm) ? (
                  <button onClick={e => { e.stopPropagation(); clearAll(); }} className="text-[#b0bac9] hover:text-[#5b6b82] transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                ) : <ChevronDown className={`w-4 h-4 text-[#b0bac9] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />}
              </div>

              {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e9f0] rounded-xl shadow-2xl overflow-hidden">
                  <div ref={listRef} onScroll={handleListScroll} className="max-h-64 overflow-y-auto">
                    {loadingInitial ? (
                      <div className="py-8 flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#237a59] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-[#98a2b6]">Loading…</span>
                      </div>
                    ) : groups.length === 0 ? (
                      <div className="py-8 text-center text-sm text-[#98a2b6]">No products found</div>
                    ) : (
                      <>
                        {groups.map(g => (
                          <button key={g.baseSku} onMouseDown={e => e.preventDefault()} onClick={() => selectGroup(g)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-[#f5f7fb] last:border-0 transition-colors ${selectedGroup?.baseSku === g.baseSku ? 'bg-[#eaf5ef]' : 'hover:bg-[#f5f7fb]'}`}>
                            {g.photo_url
                              ? <img src={g.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[#e5e9f0]" />
                              : <div className="w-8 h-8 rounded-lg bg-[#f0f3f8] flex items-center justify-center shrink-0"><Tag className="w-3.5 h-3.5 text-[#98a2b6]" /></div>
                            }
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#20283b] truncate">{g.name}</p>
                              <p className="text-[11px] text-[#98a2b6] font-mono">{g.baseSku} · {g.variants.length} sizes</p>
                            </div>
                            {selectedGroup?.baseSku === g.baseSku && <div className="w-1.5 h-1.5 rounded-full bg-[#237a59] shrink-0 ml-auto" />}
                          </button>
                        ))}
                        {loadingMore && <div className="py-3 flex justify-center"><div className="w-4 h-4 border-2 border-[#237a59] border-t-transparent rounded-full animate-spin" /></div>}
                        {!hasMore && !loadingMore && groups.length > 0 && <p className="py-2 text-center text-[11px] text-[#c2cad6]">All {groups.length} products loaded</p>}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product info + variant selector */}
          {selectedGroup ? (
            <>
              {/* Product card */}
              <div className="mx-4 mt-4 p-3 bg-white rounded-xl border border-[#e5e9f0] flex items-center gap-3">
                {selectedGroup.photo_url
                  ? <img src={selectedGroup.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#e5e9f0] shrink-0" />
                  : <div className="w-12 h-12 rounded-lg bg-[#f0f3f8] flex items-center justify-center shrink-0"><Package className="w-5 h-5 text-[#98a2b6]" /></div>
                }
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#20283b] truncate">{selectedGroup.name}</p>
                  <p className="text-[11px] text-[#98a2b6] mt-0.5">
                    <span className="font-mono text-[#3479e6]">{selectedGroup.baseSku}</span>
                    {selectedGroup.category && <span> · {selectedGroup.category}</span>}
                  </p>
                </div>
              </div>

              {/* Size picker */}
              <div className="px-4 mt-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest">Select Sizes</p>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const ids = new Set(selectedGroup.variants.map(v => v.id));
                      setSelectedIds(ids);
                      setQtyMap(q => { const n = { ...q }; selectedGroup.variants.forEach(v => { if (!n[v.id]) n[v.id] = Math.max(1, v.stock ?? 1); }); return n; });
                      setLabels([]);
                    }} className="text-[11px] font-semibold text-[#237a59] hover:underline">All</button>
                    <span className="text-[#d0d8e4] text-xs">·</span>
                    <button onClick={() => { setSelectedIds(new Set()); setLabels([]); }} className="text-[11px] font-semibold text-[#98a2b6] hover:underline">None</button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedGroup.variants.map(v => {
                    const isSel = selectedIds.has(v.id);
                    return (
                      <button
                        key={v.id}
                        onClick={() => toggleVariant(v.id)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-150 active:scale-95 ${isSel
                          ? 'bg-[#237a59] border-[#237a59] text-white shadow-sm'
                          : 'bg-white border-[#e5e9f0] text-[#5b6b82] hover:border-[#237a59]/40'
                        } ${v.stock === 0 ? 'opacity-50' : ''}`}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Qty controls for selected variants */}
              {selectedIds.size > 0 && (
                <div className="px-4 mt-4">
                  <p className="text-[10px] font-bold text-[#98a2b6] uppercase tracking-widest mb-2.5">Quantity per Size</p>
                  <div className="space-y-2">
                    {selectedGroup.variants.filter(v => selectedIds.has(v.id)).map(v => (
                      <div key={v.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#e5e9f0] px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#237a59] flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-black text-white">{v.size.slice(0, 3)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#20283b]">{v.size}</p>
                          <p className="text-[10px] text-[#98a2b6] font-mono truncate">{v.barcode}</p>
                        </div>
                        <p className="text-sm font-black text-[#237a59] shrink-0">₹{v.selling_price}</p>
                        {/* Qty */}
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setQty(v.id, (qtyMap[v.id] ?? 1) - 1)}
                            className="w-7 h-7 rounded-lg border border-[#e5e9f0] bg-[#f5f7fb] hover:bg-[#eef0f5] text-[#5b6b82] font-bold text-base flex items-center justify-center transition-colors active:scale-90 leading-none">
                            −
                          </button>
                          <input
                            type="number" min="1" max="999"
                            value={qtyMap[v.id] ?? 1}
                            onChange={e => setQty(v.id, parseInt(e.target.value))}
                            className="w-12 py-1 rounded-lg border border-[#e5e9f0] text-sm text-center font-bold text-[#20283b] focus:outline-none focus:border-[#237a59] transition-colors"
                          />
                          <button onClick={() => setQty(v.id, (qtyMap[v.id] ?? 1) + 1)}
                            className="w-7 h-7 rounded-lg border border-[#e5e9f0] bg-[#f5f7fb] hover:bg-[#eef0f5] text-[#5b6b82] font-bold text-base flex items-center justify-center transition-colors active:scale-90 leading-none">
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary + generate */}
              <div className="p-4 mt-4 border-t border-[#e5e9f0] bg-white sticky bottom-0">
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs text-[#98a2b6]">
                      <span className="font-bold text-[#20283b]">{selectedIds.size}</span> size{selectedIds.size !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-[#98a2b6]">
                      <span className="font-bold text-[#20283b]">{totalLabels}</span> total label{totalLabels !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                <button
                  onClick={generate}
                  disabled={selectedIds.size === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#237a59] hover:bg-[#1d6649] disabled:bg-[#e5e9f0] disabled:text-[#b0bac9] disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all duration-150 active:scale-[0.98]"
                >
                  <CheckCheck className="w-4 h-4" />
                  {selectedIds.size === 0 ? 'Select sizes to continue' : `Generate ${totalLabels} Label${totalLabels !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-16">
              <div className="w-14 h-14 rounded-2xl bg-[#f0f3f8] flex items-center justify-center">
                <Tag className="w-6 h-6 text-[#c2cad6]" />
              </div>
              <p className="text-sm font-semibold text-[#98a2b6]">Search and select a product above to get started</p>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Preview ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-[#f5f7fb] overflow-hidden">
          {labels.length > 0 ? (
            <>
              {/* Preview header */}
              <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#e5e9f0]">
                <div>
                  <p className="font-bold text-[#20283b] text-sm">Label Preview</p>
                  <p className="text-xs text-[#98a2b6] mt-0.5">{labels.length} sticker{labels.length !== 1 ? 's' : ''} ready to print</p>
                </div>
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white text-sm font-bold rounded-xl transition-all duration-150 active:scale-95 shadow-sm shadow-[#237a59]/20">
                  <Printer className="w-4 h-4" /> Print All ({labels.length})
                </button>
              </div>

              {/* Labels grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-wrap gap-3">
                  {labels.map((item, i) => (
                    <BarcodeLabel key={`${item.variant.id}-${i}`} item={item} shopName={SHOP_NAME} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-10">
              <div className="w-16 h-16 rounded-2xl bg-white border border-[#e5e9f0] shadow-sm flex items-center justify-center">
                <Printer className="w-7 h-7 text-[#c2cad6]" />
              </div>
              <div>
                <p className="font-bold text-[#5b6b82] text-base">No labels generated yet</p>
                <p className="text-sm text-[#98a2b6] mt-1">Select a product and sizes on the left, then click Generate</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden print area */}
      <div id="print-area">
        {labels.map((item, i) => (
          <BarcodeLabel key={`print-${item.variant.id}-${i}`} item={item} shopName={SHOP_NAME} />
        ))}
      </div>
    </div>
  );
}
