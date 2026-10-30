'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Barcode, ShoppingCart,
  CreditCard, Users, TrendingUp, Settings, LogOut, Tags, Ruler, FileText,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Products & Stock', icon: Package },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/sizes', label: 'Sizes', icon: Ruler },
  { href: '/barcodes', label: 'Barcodes & Labels', icon: Barcode },
  { href: '/billing', label: 'New Bill', icon: ShoppingCart },
  { href: '/bills', label: 'Bill History', icon: FileText },
  { href: '/partial-payments', label: 'Partial Payments', icon: CreditCard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reports', label: 'Reports', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [profilePic, setProfilePic] = useState('');

  useEffect(() => {
    api.get('/api/settings').then(res => {
      const pic = res?.success?.data?.user?.profile_pic;
      if (pic) setProfilePic(pic);
    }).catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <aside className="hidden lg:flex flex-col w-[244px] min-h-screen bg-[#20273d] flex-shrink-0">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          {profilePic ? (
            <img src={profilePic} alt="Profile" className="w-10 h-10 rounded-xl object-cover shadow-lg flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 bg-[#237a59] rounded-xl flex items-center justify-center shadow-lg shadow-[#237a59]/30 flex-shrink-0">
              <span className="text-white font-black text-sm tracking-tight">TF</span>
            </div>
          )}
          <div>
            <p className="text-white font-bold text-sm tracking-tight leading-none">Tulshi Fashion</p>
            <p className="text-[#798397] text-[10px] tracking-[1.5px] uppercase mt-1">INVOICE · INVENTORY</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group ${
                active
                  ? 'bg-[#3479e6] text-white shadow-md shadow-[#3479e6]/25'
                  : 'text-[#c2cbdb] hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-[#798397] group-hover:text-[#c2cbdb]'}`} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-2 border-t border-white/[0.07] mt-auto">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#798397] hover:bg-white/[0.07] hover:text-white transition-colors duration-150 group"
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:text-[#c2cbdb]" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
