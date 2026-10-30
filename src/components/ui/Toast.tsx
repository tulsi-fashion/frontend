'use client';
import { useState, useEffect } from 'react';

let _showToast: ((msg: string, type?: 'success' | 'error') => void) | null = null;

export function showToast(msg: string, type: 'success' | 'error' = 'success') {
  _showToast?.(msg, type);
}

const VISIBLE_MS = 2700;
const EXIT_MS = 250;

export default function Toast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string; closing?: boolean }[]>([]);

  useEffect(() => {
    _showToast = (msg, type = 'success') => {
      const id = Date.now() + Math.random();
      setToasts(t => [...t, { id, msg, type }]);
      setTimeout(() => {
        setToasts(t => t.map(x => (x.id === id ? { ...x, closing: true } : x)));
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), EXIT_MS);
      }, VISIBLE_MS);
    };
    return () => { _showToast = null; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${t.closing ? 'tf-toast-out' : 'tf-toast-in'} px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${t.type === 'error' ? 'bg-[#b32642]' : 'bg-[#20273d]'}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
