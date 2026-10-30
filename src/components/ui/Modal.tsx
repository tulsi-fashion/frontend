'use client';
import { useEffect, useState, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  disableBackdropClose?: boolean;
}

const EXIT_MS = 220;

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', disableBackdropClose }: ModalProps) {
  // stay mounted while the exit animation plays
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => { setMounted(false); setClosing(false); }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !disableBackdropClose) onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm ${closing ? 'tf-fade-out' : 'tf-fade-in'}`} onClick={disableBackdropClose ? undefined : onClose} />

      {/* Close button — fixed to top-right of the screen, outside the modal */}
      <button
        onClick={onClose}
        className={`fixed top-4 right-4 z-60 p-2 rounded-full bg-white/90 shadow-lg border border-[#e5e9f0] text-[#798397] hover:text-[#20283b] hover:bg-white transition-colors ${closing ? 'tf-fade-out' : 'tf-fade-in'}`}
      >
        <X className="w-5 h-5" />
      </button>

      <div className={`relative bg-white rounded-2xl shadow-xl border border-[#e5e9f0] w-full ${maxWidth} max-h-[90vh] overflow-y-auto tf-modal-scroll ${closing ? 'tf-pop-out' : 'tf-pop-in'}`}>
        <div className="sticky top-0 z-10 flex items-center p-6 pb-5 border-b border-[#e5e9f0] bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-[#20283b]">{title}</h2>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
