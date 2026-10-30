'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useCartStore, BillableProduct } from '../store/cartStore';
import { showToast } from './ui/Toast';

// Barcode scanners act as HID keyboards: they fire keystrokes much faster than
// a human types and terminate with Enter. We detect a scan by requiring that
// the whole buffer accumulate in under BURST_MS and that it be at least
// MIN_LEN characters, then flush on Enter.
const BURST_MS = 300;
const MIN_LEN = 4;

export default function GlobalBarcodeScanner() {
  const router = useRouter();
  const pathname = usePathname();
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    }

    async function lookupAndAdd(code: string) {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const data = await api.get(`/api/products/barcode/${encodeURIComponent(code)}`);
        const product = data?.success?.data?.product as BillableProduct | undefined;
        if (!product?.id) {
          showToast(`Barcode not found: ${code}`, 'error');
          return;
        }
        if (!pathname?.startsWith('/billing')) {
          router.push('/billing');
        }
        useCartStore.getState().addItem(product);
        showToast(`Added: ${product.name}`);
      } catch {
        showToast(`Barcode not found: ${code}`, 'error');
      } finally {
        inFlightRef.current = false;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      // Ignore while user is actively typing in a form field — scanner-only input.
      if (isTypingTarget(e.target)) return;
      // Ignore modifier combos (Ctrl+F, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= MIN_LEN) {
          e.preventDefault();
          lookupAndAdd(code);
        }
        return;
      }

      // Reset buffer if there's a human-sized gap between keystrokes.
      if (gap > BURST_MS) bufferRef.current = '';

      // Only accept printable single characters.
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pathname, router]);

  return null;
}
