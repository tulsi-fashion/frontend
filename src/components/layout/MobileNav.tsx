'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Barcode, ShoppingCart,
  CreditCard, Users, TrendingUp, Settings, LogOut, Tags, Ruler, FileText,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/sizes', label: 'Sizes', icon: Ruler },
  { href: '/barcodes', label: 'Barcodes', icon: Barcode },
  { href: '/billing', label: 'Billing', icon: ShoppingCart },
  { href: '/bills', label: 'Bills', icon: FileText },
  { href: '/partial-payments', label: 'Partial Pay', icon: CreditCard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reports', label: 'Reports', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="lg:hidden shrink-0 sticky top-0 z-30 bg-[#20273d] border-b border-white/[0.07]">
      {/* Brand bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#237a59] rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">TF</span>
          </div>
          <span className="text-white font-bold text-sm">Tulshi Fashion</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-[#798397] hover:text-white hover:bg-white/[0.07] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable nav */}
      <div className="flex overflow-x-auto gap-1 px-3 py-2 scrollbar-hide">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                active
                  ? 'bg-[#3479e6] text-white'
                  : 'text-[#c2cbdb] hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
