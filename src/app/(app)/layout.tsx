'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import Sidebar from '../../components/layout/Sidebar';
import MobileNav from '../../components/layout/MobileNav';
import Header from '../../components/layout/Header';
import Toast from '../../components/ui/Toast';
import GlobalBarcodeScanner from '../../components/GlobalBarcodeScanner';

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="tf-page-in">
      {children}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !token) router.replace('/login');
  }, [mounted, token, router]);

  if (!mounted || !token) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#237a59]/30 border-t-[#237a59] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <MobileNav />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Header />
          <Suspense fallback={<div className="tf-page-in">{children}</div>}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </main>
      </div>
      <Toast />
      <GlobalBarcodeScanner />
    </div>
  );
}
