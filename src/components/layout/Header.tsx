'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Search, Camera, Loader2, User as UserIcon, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import Modal from '../ui/Modal';
import { showToast } from '../ui/Toast';

interface ProfileData {
  shopName: string;
  logoUrl: string;
  name: string;
  email: string;
  role: string;
  profilePic: string;
}

const EXIT_MS = 160;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder:text-[#c2cad6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]';
const labelCls = 'block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5';

export default function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', shopName: '', profilePic: '' });
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/api/settings');
        const d = res?.success?.data;
        if (!alive || !d) return;
        setProfile({
          shopName: d.shop?.name || '',
          logoUrl: d.shop?.logo_url || '',
          name: d.user?.name || '',
          email: d.user?.email || '',
          role: d.user?.role || '',
          profilePic: d.user?.profile_pic || '',
        });
      } catch {
        /* falls back to auth store */
      }
    })();
    return () => { alive = false; };
  }, []);

  const shopName = profile?.shopName || user?.shopName || 'My Shop';
  const name = profile?.name || user?.name || 'User';
  const email = profile?.email || user?.email || '';
  const role = profile?.role || '';
  const profilePic = profile?.profilePic || '';

  function show() { setMounted(true); setOpen(true); }
  function hide() { setOpen(false); setTimeout(() => setMounted(false), EXIT_MS); }

  useEffect(() => {
    if (!mounted) return;
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) hide(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [mounted]);

  function handleLogout() {
    hide();
    logout();
    router.replace('/login');
  }

  function openProfile() {
    hide();
    setForm({ name: profile?.name || name, shopName: profile?.shopName || shopName, profilePic: profilePic });
    setProfileOpen(true);
  }

  async function uploadPic(file: File) {
    setUploading(true);
    try {
      const presignRes = await api.post('/api/uploads/presign', {
        files: [{ filename: file.name, contentType: file.type, size: file.size }],
        folder: 'profiles',
      });
      if (presignRes?.error) { showToast(presignRes.error.message || 'Upload failed', 'error'); return; }

      const info = presignRes.success.data.files[0];
      await fetch(info.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

      setForm(f => ({ ...f, profilePic: info.publicUrl }));
      showToast('Photo uploaded');
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadPic(file);
    e.target.value = '';
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const [profileRes, brandingRes] = await Promise.all([
        api.put('/api/settings/profile', { name: form.name.trim(), profile_pic: form.profilePic }),
        api.put('/api/settings/branding', { name: form.shopName.trim() }),
      ]);
      if (profileRes?.error) { showToast(profileRes.error.message || 'Failed to update profile', 'error'); return; }
      if (brandingRes?.error) { showToast(brandingRes.error.message || 'Failed to update shop', 'error'); return; }

      setProfile(p => p ? {
        ...p,
        name: form.name.trim(),
        shopName: form.shopName.trim(),
        profilePic: form.profilePic,
      } : p);
      showToast('Profile updated');
      setProfileOpen(false);
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  const avatarEl = profilePic ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profilePic} alt="" className="w-9 h-9 rounded-full object-cover" />
  ) : (
    <span className="w-9 h-9 rounded-full bg-[#eef0f4] text-[#798397] flex items-center justify-center">
      <UserIcon className="w-5 h-5" />
    </span>
  );

  return (
    <>
      <header className="hidden lg:flex shrink-0 z-50 h-16 items-center justify-between px-6 bg-white">
        {/* left: search */}
        <div className="flex items-center flex-1 min-w-0">
          <div className={`relative flex items-center max-w-md w-full transition-all duration-200 ${searchFocused ? 'max-w-lg' : ''}`}>
            <Search className="absolute left-3.5 w-4 h-4 text-[#98a2b6] pointer-events-none" />
            <input
              type="text"
              placeholder="Search anything..." style={{ fontSize: '15px' }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f3f5f8] text-sm text-[#20283b] placeholder-[#98a2b6] border transition-all duration-200 focus:outline-none ${
                searchFocused
                  ? 'border-[#237a59]/30 bg-white ring-2 ring-[#237a59]/10 shadow-sm'
                  : 'border-transparent hover:bg-[#eef0f4]'
              }`}
            />
          </div>
        </div>

        {/* right: profile */}
        <div className="flex items-center ml-4">
          <div ref={wrapRef} className="relative">
            <button
              type="button"
              onClick={() => (open ? hide() : show())}
              aria-haspopup="menu"
              aria-expanded={open}
              className={`flex items-center gap-3 pl-1.5 pr-2.5 py-1.5 rounded-xl transition-all duration-200 active:scale-[.98] ${
                open ? 'bg-[#f1faf5]' : 'hover:bg-[#f3f5f8]'
              }`}
            >
              {avatarEl}
              <span className="text-left leading-tight hidden xl:block">
                <span className="block text-[15px] font-semibold text-[#20283b] max-w-[160px] truncate">{name}</span>
                <span className="block text-xs text-[#98a2b6] capitalize">{role || 'Owner'}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-[#98a2b6] transition-transform duration-300 ${open ? 'rotate-180 text-[#237a59]' : ''}`} />
            </button>

            {mounted && (
              <div
                role="menu"
                className={`absolute right-0 top-full mt-2 w-72 z-[60] rounded-2xl bg-white border border-[#e5e9f0] shadow-2xl shadow-black/12 overflow-hidden origin-top-right ${
                  open ? 'tf-drop-in' : 'tf-drop-out'
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={openProfile}
                  className="w-full flex items-center gap-3 p-4 bg-[#f9fafc] border-b border-[#eef1f6] hover:bg-[#eef6f2] transition-colors text-left"
                >
                  {profilePic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePic} alt="" className="w-11 h-11 rounded-full object-cover shadow-md" />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#237a59] to-[#2fa377] text-white font-extrabold flex items-center justify-center shadow-lg shadow-[#237a59]/25">
                      {initials(name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#20283b] truncate">{name}</p>
                    <p className="text-xs text-[#798397] truncate">{email}</p>
                    <p className="text-[11px] font-semibold text-[#237a59] mt-0.5 truncate">{shopName}</p>
                  </div>
                </button>

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openProfile}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#20283b] hover:bg-[#eef6f2] transition-colors group"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-[#f1f3f7] text-[#798397] flex items-center justify-center group-hover:bg-[#e6f5eb] group-hover:text-[#237a59] transition-colors">
                      <UserIcon className="w-4 h-4" />
                    </span>
                    <span className="font-semibold">Profile</span>
                  </button>
                </div>

                <div className="p-1.5 border-t border-[#eef1f6]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#b32642] hover:bg-[#fff0f1] transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#fff0f1] flex items-center justify-center">
                      <LogOut className="w-4 h-4" />
                    </span>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile edit modal */}
      <Modal open={profileOpen} onClose={() => !saving && setProfileOpen(false)} title="Edit Profile" maxWidth="max-w-md">
        <form onSubmit={saveProfile} className="space-y-5">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              {form.profilePic ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.profilePic} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-[#e6f5eb] shadow-lg" />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, profilePic: '' }))}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#b32642] text-white flex items-center justify-center shadow-md hover:bg-[#8f1e35] transition-colors tf-fade-in"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="w-24 h-24 rounded-full bg-gradient-to-br from-[#237a59] to-[#2fa377] text-white text-2xl font-extrabold flex items-center justify-center shadow-lg border-4 border-[#e6f5eb]">
                  {initials(form.name || name)}
                </span>
              )}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border-2 border-[#e5e9f0] flex items-center justify-center shadow-md hover:bg-[#f1faf5] hover:border-[#237a59] transition-all active:scale-90"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-[#237a59]" /> : <Camera className="w-4 h-4 text-[#798397]" />}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
            </div>
            <p className="text-xs text-[#98a2b6]">Click camera to upload profile photo</p>
          </div>

          <div>
            <label className={labelCls}>Your Name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className={labelCls}>Shop Name</label>
            <input
              value={form.shopName}
              onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))}
              className={inputCls}
              placeholder="Enter shop name"
            />
          </div>

          <div className="bg-[#f9fafc] -mx-6 -mb-6 px-6 py-4 border-t border-[#eef1f6] flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setProfileOpen(false)} className="px-4 py-2 rounded-lg border border-[#e5e9f0] text-sm font-semibold text-[#798397] hover:bg-[#f5f7fb] disabled:opacity-60 transition-colors">
              Cancel
            </button>
            <button disabled={saving || uploading} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#237a59] text-white text-sm font-semibold hover:bg-[#1c6348] disabled:opacity-60 transition-all active:scale-95">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
