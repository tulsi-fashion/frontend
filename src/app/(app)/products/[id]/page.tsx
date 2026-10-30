'use client';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Package, ImageIcon, Tag, Barcode, IndianRupee,
  Box, Layers, Printer, ChevronRight, ChevronLeft, X,
  TrendingDown, AlertCircle, CheckCircle2, Hash,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { money } from '../../../../lib/utils';
import { Product, ProductVariant, ProductImage } from '../../../../types';
import TopBar from '../../../../components/layout/TopBar';

/* ── Carousel ─────────────────────────────────────────────────── */
function Carousel({ images, className = '' }: { images: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchRef = useRef(0);

  useEffect(() => { setIdx(0); }, [images]);

  const prev = useCallback(() => setIdx(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % images.length), [images.length]);

  if (images.length === 0) {
    return (
      <div className={`bg-[#f0f2f5] rounded-2xl flex items-center justify-center border border-[#e5e9f0] ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <ImageIcon className="w-12 h-12 text-[#c2cad6]" />
          <span className="text-xs text-[#b0bac9] font-medium">No photo</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative group rounded-2xl overflow-hidden bg-[#f0f2f5] border border-[#e5e9f0] ${className}`}>
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
          onTouchStart={e => { touchRef.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const diff = touchRef.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
          }}
        >
          {images.map((url, i) => (
            <img
              key={i} src={url} alt=""
              className="w-full h-full object-cover shrink-0 cursor-zoom-in"
              style={{ minWidth: '100%' }}
              onClick={() => setLightbox(true)}
              draggable={false}
            />
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
              <ChevronLeft className="w-4 h-4 text-[#20283b]" />
            </button>
            <button onClick={e => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
              <ChevronRight className="w-4 h-4 text-[#20283b]" />
            </button>
          </>
        )}

        {images.length > 1 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-bold backdrop-blur">
            {idx + 1} / {images.length}
          </span>
        )}

        {images.length > 1 && images.length <= 10 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className={`rounded-full transition-all ${i === idx ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox images={images} idx={idx} onClose={() => setLightbox(false)} onPrev={prev} onNext={next} onSelect={setIdx} />
      )}
    </>
  );
}

/* ── Lightbox ────────────────────────────────────────────────── */
function Lightbox({ images, idx, onClose, onPrev, onNext, onSelect }: {
  images: string[]; idx: number;
  onClose: () => void; onPrev: () => void; onNext: () => void; onSelect: (i: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => setVisible(true), 10);
    return () => { document.body.style.overflow = ''; clearTimeout(t); };
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onPrev, onNext]);

  const close = () => { setVisible(false); setTimeout(onClose, 180); };
  const hasMany = images.length > 1;

  const overlay = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
      onClick={close}
    >
      {/* Top bar */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
          {hasMany ? `${idx + 1} / ${images.length}` : ''}
        </span>
        <button
          onClick={close}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        >
          <X size={16} color="white" />
        </button>
      </div>

      {/* Image */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 56px', overflow: 'hidden' }} onClick={close}>
        <img
          src={images[idx]} alt=""
          draggable={false}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '100%', maxHeight: 'calc(100vh - 130px)',
            objectFit: 'contain', userSelect: 'none', borderRadius: 12,
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            transition: 'transform 0.18s ease',
          }}
        />
      </div>

      {/* Arrows */}
      {hasMany && (
        <>
          {[{ side: 'left', Icon: ChevronLeft, action: onPrev }, { side: 'right', Icon: ChevronRight, action: onNext }].map(({ side, Icon, action }) => (
            <button
              key={side}
              onClick={e => { e.stopPropagation(); action(); }}
              style={{
                position: 'absolute', top: '50%', [side]: 12, transform: 'translateY(-50%)',
                width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            >
              <Icon size={20} color="white" />
            </button>
          ))}
        </>
      )}

      {/* Thumbnail strip */}
      {hasMany && (
        <div
          style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 8, padding: '10px 16px' }}
          onClick={e => e.stopPropagation()}
        >
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              style={{
                width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: 'none', cursor: 'pointer', padding: 0,
                outline: i === idx ? '2px solid white' : 'none',
                outlineOffset: 2,
                opacity: i === idx ? 1 : 0.38,
                transition: 'opacity 0.15s, outline 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (i !== idx) e.currentTarget.style.opacity = '0.65'; }}
              onMouseLeave={e => { if (i !== idx) e.currentTarget.style.opacity = '0.38'; }}
            >
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ── Helpers ─────────────────────────────────────────────────── */
function collectPhotos(main: string | undefined, files: ProductImage[] | undefined): string[] {
  const urls: string[] = [];
  if (main) urls.push(main);
  if (files) for (const f of files) if (f.file_url && !urls.includes(f.file_url)) urls.push(f.file_url);
  return urls;
}

/* ── Sub-components ──────────────────────────────────────────── */
function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#e5e9f0] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-default">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[#98a2b6] uppercase font-bold tracking-wide truncate">{label}</p>
        <p className="text-base font-bold text-[#20283b] leading-tight">{value}</p>
      </div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#fff0f1] text-[#b32642]">
      <AlertCircle className="w-3 h-3" /> Out of Stock
    </span>
  );
  if (stock <= 5) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#fff8e8] text-[#a55b00]">
      <AlertCircle className="w-3 h-3" /> Low — {stock} left
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#e6f5eb] text-[#16804a]">
      <CheckCircle2 className="w-3 h-3" /> {stock} in stock
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#f0f2f5] last:border-0 hover:bg-[#fafbfc] transition-colors">
      <span className="text-xs font-semibold text-[#98a2b6] uppercase tracking-wide">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [heroVisible, setHeroVisible] = useState(false);

  const selectVariant = useCallback((v: ProductVariant) => {
    setPanelVisible(false);
    setTimeout(() => { setSelectedVariant(v); setPanelVisible(true); }, 160);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/products/${id}`);
        const p = res?.success?.data?.product;
        if (p) {
          setProduct(p);
          if (p.variants?.length) setSelectedVariant(p.variants[0]);
        }
      } catch { /* */ }
      setLoading(false);
      setTimeout(() => setHeroVisible(true), 40);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-[#237a59] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Package className="w-16 h-16 text-[#c2cad6]" />
        <p className="text-[#798397] text-lg">Product not found</p>
        <button onClick={() => router.push('/products')} className="px-4 py-2 bg-[#237a59] text-white rounded-lg text-sm font-semibold hover:bg-[#1d6649] transition-colors">
          Back to Products
        </button>
      </div>
    );
  }

  const variants = product.variants || [];
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);
  const productPhotos = collectPhotos(product.photo_url, product.files);

  const sv = selectedVariant;
  const svPhotos = sv ? collectPhotos(sv.photo_url || product.photo_url, sv.files) : productPhotos;
  const svSelling = sv?.selling_price ?? product.selling_price;
  const svPurchase = sv?.purchase_price ?? product.purchase_price;
  const svMargin = svSelling && svPurchase ? ((svSelling - svPurchase) / svSelling * 100).toFixed(1) : null;

  return (
    <>
      <TopBar
        title="Product Details"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/products')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e5e9f0] text-[#5b6b82] text-sm font-semibold hover:bg-[#f5f7fb] transition-all duration-150 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <a
              href={`/barcodes?product=${product.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#237a59] text-white text-sm font-semibold hover:bg-[#1d6649] transition-all duration-150 active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print Barcodes
            </a>
          </div>
        }
      />

      <div className={`px-4 md:px-6 pb-10 space-y-5 max-w-6xl mx-auto transition-all duration-500 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

        {/* ── Product Hero ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#e5e9f0] shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row">

            {/* Photo */}
            <div className="lg:w-90 shrink-0 p-6 bg-[#fafbfc] border-b lg:border-b-0 lg:border-r border-[#e5e9f0] flex flex-col items-center gap-4">
              <Carousel images={productPhotos} className="w-full aspect-square max-w-75" />
            </div>

            {/* Info */}
            <div className="flex-1 p-6 flex flex-col gap-5">
              {/* Title row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#20283b] leading-tight">{product.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="font-mono text-sm font-bold text-[#3479e6] bg-[#f0f4ff] px-2.5 py-1 rounded-lg">
                      {product.sku}
                    </span>
                    {product.category_info && (
                      <span className="text-sm text-[#798397] bg-[#f5f7fb] px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {product.category_info.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${product.is_active ? 'bg-[#e6f5eb] text-[#16804a]' : 'bg-[#f5f7fb] text-[#98a2b6]'}`}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard icon={<IndianRupee className="w-4 h-4" />} label="Selling Price" value={money(product.selling_price)} color="#237a59" bg="#e6f5eb" />
                <StatCard icon={<IndianRupee className="w-4 h-4" />} label="Purchase Price" value={money(product.purchase_price)} color="#3479e6" bg="#eef3ff" />
                <StatCard icon={<Box className="w-4 h-4" />} label="Total Stock" value={String(totalStock)} color="#a55b00" bg="#fff8e8" />
                <StatCard icon={<Layers className="w-4 h-4" />} label="Sizes" value={String(variants.length)} color="#7c3aed" bg="#f3eeff" />
              </div>

              {/* Notes */}
              {product.notes && (
                <div className="bg-[#f9fafb] rounded-xl p-4 border border-[#e5e9f0]">
                  <p className="text-[10px] font-bold text-[#98a2b6] uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-[#5b6b82] leading-relaxed">{product.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Variants Section ─────────────────────────────────── */}
        {variants.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e5e9f0] shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="px-6 py-4 border-b border-[#f0f2f5] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#20283b] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#237a59]" />
                Size Variants
                <span className="text-sm font-normal text-[#98a2b6]">({variants.length})</span>
              </h3>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Size Selector sidebar */}
              <div className="lg:w-48 shrink-0 border-b lg:border-b-0 lg:border-r border-[#f0f2f5]">
                <div className="p-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
                  {variants.map(v => {
                    const isSel = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => selectVariant(v)}
                        className={`shrink-0 flex lg:flex-row items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left active:scale-95 ${isSel
                          ? 'bg-[#237a59] text-white shadow-sm scale-[1.02]'
                          : 'text-[#5b6b82] hover:bg-[#f5f7fb] hover:scale-[1.01]'
                        }`}
                      >
                        <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold transition-colors duration-200 ${isSel ? 'bg-white/20' : 'bg-[#f0f2f5]'}`}>
                          {v.size_info?.code || v.size_info?.name?.slice(0, 2) || '?'}
                        </span>
                        <span className="whitespace-nowrap">{v.size_info?.name || '—'}</span>
                        {v.stock === 0 && (
                          <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors duration-200 ${isSel ? 'bg-white/20 text-white' : 'bg-[#fff0f1] text-[#b32642]'}`}>
                            OUT
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Variant detail panel */}
              {sv && (
                <div className={`flex-1 flex flex-col md:flex-row min-h-100 transition-all duration-200 ${panelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>

                  {/* Variant photo */}
                  <div className="md:w-70 shrink-0 p-5 bg-[#fafbfc] border-b md:border-b-0 md:border-r border-[#f0f2f5] flex flex-col items-center gap-4">
                    <Carousel images={svPhotos} className="w-full aspect-square" />
                    {/* Thumb strip */}
                    {svPhotos.length > 1 && (
                      <div className="flex gap-1.5 flex-wrap justify-center">
                        {svPhotos.map((url, i) => (
                          <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-[#e5e9f0]">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Variant info */}
                  <div className="flex-1 p-6 flex flex-col gap-5">
                    {/* Variant title */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xl font-bold text-[#20283b]">
                            {sv.size_info?.name || 'Unknown Size'}
                          </h4>
                          {sv.size_info?.code && (
                            <span className="px-2 py-0.5 rounded-md bg-[#f0f2f5] text-[#5b6b82] text-xs font-bold font-mono">
                              {sv.size_info.code}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <StockBadge stock={sv.stock} />
                        </div>
                      </div>
                      <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${sv.is_active ? 'bg-[#e6f5eb] text-[#16804a]' : 'bg-[#f5f7fb] text-[#98a2b6]'}`}>
                        {sv.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Pricing row */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-[#e6f5eb] border border-[#c3e6cf] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-default">
                        <p className="text-[10px] text-[#237a59] font-bold uppercase tracking-wide mb-1">Selling Price</p>
                        <p className="text-xl font-bold text-[#20283b]">{money(svSelling)}</p>
                        {sv.selling_price == null && (
                          <p className="text-[10px] text-[#5b6b82] mt-0.5">from product</p>
                        )}
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#eef3ff] border border-[#c7d9f5] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-default">
                        <p className="text-[10px] text-[#3479e6] font-bold uppercase tracking-wide mb-1">Purchase Price</p>
                        <p className="text-xl font-bold text-[#20283b]">{money(svPurchase)}</p>
                        {sv.purchase_price == null && (
                          <p className="text-[10px] text-[#5b6b82] mt-0.5">from product</p>
                        )}
                      </div>
                      {svMargin && (
                        <div className="p-3.5 rounded-xl bg-[#f9fafb] border border-[#e5e9f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-default">
                          <p className="text-[10px] text-[#98a2b6] font-bold uppercase tracking-wide mb-1">Margin</p>
                          <p className="text-xl font-bold text-[#20283b]">{svMargin}%</p>
                        </div>
                      )}
                    </div>

                    {/* Detail rows */}
                    <div className="rounded-xl border border-[#e5e9f0] overflow-hidden">
                      <DetailRow label="Barcode">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Barcode className="w-3.5 h-3.5 text-[#98a2b6]" />
                          <span className="font-mono text-sm font-bold text-[#20283b] tracking-widest">{sv.barcode || '—'}</span>
                        </div>
                      </DetailRow>
                      <DetailRow label="Stock">
                        <span className="text-sm font-bold text-[#20283b]">{sv.stock} units</span>
                      </DetailRow>
                      <DetailRow label="Reorder Level">
                        <div className="flex items-center gap-1.5 justify-end">
                          <TrendingDown className="w-3.5 h-3.5 text-[#98a2b6]" />
                          <span className="text-sm font-bold text-[#20283b]">{sv.reorder_level ?? '—'} units</span>
                        </div>
                      </DetailRow>
                      <DetailRow label="Size Code">
                        <span className="font-mono text-sm font-bold text-[#5b6b82]">{sv.size_info?.code || '—'}</span>
                      </DetailRow>
                      <DetailRow label="Variant ID">
                        <span className="font-mono text-[11px] text-[#98a2b6] select-all">{sv.id}</span>
                      </DetailRow>
                    </div>

                    {/* Low stock warning */}
                    {sv.reorder_level != null && sv.stock <= sv.reorder_level && sv.stock > 0 && (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#fff8e8] border border-[#f5d67a] text-[#a55b00] text-sm font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Stock is at or below the reorder level. Consider restocking soon.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No variants state */}
        {variants.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#e5e9f0] p-10 text-center">
            <Layers className="w-10 h-10 text-[#c2cad6] mx-auto mb-3" />
            <p className="text-[#798397] font-medium">No size variants added yet</p>
          </div>
        )}
      </div>
    </>
  );
}
