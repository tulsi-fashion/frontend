'use client';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, Store, Save, X as XIcon } from 'lucide-react';
import { api } from '../../../lib/api';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';
import { Shop } from '../../../types';

const inputCls =
  'w-full px-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm text-[#20283b] placeholder:text-[#c2cad6] focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]';
const labelCls = 'block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1.5';

export default function SettingsPage() {
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });

  // Shop branding form
  const [shopLoaded, setShopLoaded] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shop, setShop] = useState({ name: '', phone: '', address: '', gstin: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/settings');
        const s: Shop | undefined = res?.success?.data?.shop;
        if (s) {
          setShop({
            name: s.name || '',
            phone: s.phone || '',
            address: s.address || '',
            gstin: s.gstin || '',
          });
        }
      } catch { /* non-fatal */ }
      finally { setShopLoaded(true); }
    })();
  }, []);

  async function handleShopSave(e: React.FormEvent) {
    e.preventDefault();
    if (!shop.name.trim()) { showToast('Shop name is required', 'error'); return; }
    setShopSaving(true);
    try {
      const res = await api.put('/api/settings/branding', {
        name: shop.name.trim(),
        phone: shop.phone.trim(),
        address: shop.address.trim(),
        gstin: shop.gstin.trim(),
      });
      if (res?.error) { showToast(res.error.message || 'Failed to save', 'error'); return; }
      showToast('Shop details saved');
    } catch {
      showToast('Failed to save shop details', 'error');
    } finally {
      setShopSaving(false);
    }
  }

  // Strip spaces at input time — passwords never contain whitespace.
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value.replace(/\s/g, '') }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.current) { showToast('Enter your current password', 'error'); return; }
    if (form.newPw.length < 8) { showToast('New password must be at least 8 characters', 'error'); return; }
    if (/\s/.test(form.newPw)) { showToast('New password cannot contain spaces', 'error'); return; }
    if (form.newPw === form.current) { showToast('New password must be different from current password', 'error'); return; }
    if (form.newPw !== form.confirm) { showToast('New passwords do not match', 'error'); return; }

    setSaving(true);
    try {
      const res = await api.post('/api/settings/change-password', {
        current_password: form.current,
        new_password: form.newPw,
      });
      if (res?.error) {
        showToast(res.error.message || 'Failed to change password', 'error');
        return;
      }
      showToast('Password changed successfully');
      setForm({ current: '', newPw: '', confirm: '' });
    } catch {
      showToast('Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  }

  function eyeBtn(field: keyof typeof show) {
    const Icon = show[field] ? EyeOff : Eye;
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[#98a2b6] hover:text-[#20283b] transition-colors"
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div>
      <TopBar title="Settings" />

      <div className="p-6 flex flex-col lg:flex-row gap-5 items-start">
        {/* Shop Branding */}
        <div className="flex-1 w-full max-w-lg bg-white rounded-2xl border border-[#e5e9f0] shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 bg-[#f9fafc] border-b border-[#eef1f6]">
            <span className="w-10 h-10 rounded-xl bg-[#eaf5ef] text-[#237a59] flex items-center justify-center">
              <Store className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#20283b]">Shop Details</h2>
              <p className="text-xs text-[#798397]">Appears on bills and invoices</p>
            </div>
          </div>

          <form onSubmit={handleShopSave} className="p-6 space-y-4">
            <div>
              <label className={labelCls}>Shop Name *</label>
              <input
                value={shop.name}
                onChange={e => setShop(s => ({ ...s, name: e.target.value }))}
                placeholder="Tulshi Fashion"
                disabled={!shopLoaded}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Phone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#798397] select-none pointer-events-none">+91</span>
                <input
                  value={shop.phone}
                  onChange={e => setShop(s => ({ ...s, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="10-digit number"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  disabled={!shopLoaded}
                  className={`${inputCls} pl-11`}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Shop Address</label>
              <textarea
                value={shop.address}
                onChange={e => setShop(s => ({ ...s, address: e.target.value }))}
                placeholder={`Street / Building\nCity, State PIN\nCountry`}
                disabled={!shopLoaded}
                rows={4}
                className={`${inputCls} resize-none leading-relaxed`}
              />
              <p className="text-[11px] text-[#798397] mt-1">Shown as "BILL FROM" on invoices. Line breaks are preserved.</p>
            </div>

            <div>
              <label className={labelCls}>GSTIN</label>
              <input
                value={shop.gstin}
                onChange={e => setShop(s => ({ ...s, gstin: e.target.value }))}
                placeholder="22AAAAA0000A1Z5"
                disabled={!shopLoaded}
                className={inputCls}
              />
            </div>

            <div className="pt-2">
              <button
                disabled={shopSaving || !shopLoaded || !shop.name.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#237a59] text-white text-sm font-semibold hover:bg-[#1c6348] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[.98]"
              >
                {shopSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Shop Details</>}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="flex-1 w-full max-w-lg bg-white rounded-2xl border border-[#e5e9f0] shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 bg-[#f9fafc] border-b border-[#eef1f6]">
            <span className="w-10 h-10 rounded-xl bg-[#eaf1fd] text-[#3479e6] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#20283b]">Change Password</h2>
              <p className="text-xs text-[#798397]">Update your account password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className={labelCls}>Current Password *</label>
              <div className="relative">
                <input
                  type={show.current ? 'text' : 'password'}
                  value={form.current}
                  onChange={set('current')}
                  placeholder="Enter current password"
                  className={`${inputCls} pr-10`}
                />
                {eyeBtn('current')}
              </div>
            </div>

            <div>
              <label className={labelCls}>New Password *</label>
              <div className="relative">
                <input
                  type={show.newPw ? 'text' : 'password'}
                  value={form.newPw}
                  onChange={set('newPw')}
                  placeholder="At least 8 characters"
                  className={`${inputCls} pr-10`}
                />
                {eyeBtn('newPw')}
              </div>
              {form.newPw && (() => {
                const rules = [
                  { ok: form.newPw.length >= 8, label: 'At least 8 characters' },
                  { ok: !/\s/.test(form.newPw), label: 'No spaces' },
                  { ok: form.current.length === 0 || form.newPw !== form.current, label: 'Different from current password' },
                ];
                const firstFail = rules.find(r => !r.ok);
                if (!firstFail) return null;
                return (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#b32642]">
                    <XIcon className="w-3.5 h-3.5" />
                    <span>{firstFail.label}</span>
                  </p>
                );
              })()}
            </div>

            <div>
              <label className={labelCls}>Confirm New Password *</label>
              <div className="relative">
                <input
                  type={show.confirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={set('confirm')}
                  placeholder="Re-enter new password"
                  className={`${inputCls} pr-10`}
                />
                {eyeBtn('confirm')}
              </div>
              {form.confirm && form.newPw !== form.confirm && (
                <p className="text-xs text-[#b32642] mt-1">Passwords do not match</p>
              )}
              {form.confirm && form.newPw === form.confirm && form.confirm.length >= 8 && (
                <p className="text-xs text-[#16804a] mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Passwords match
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                disabled={
                  saving ||
                  !form.current ||
                  form.newPw.length < 8 ||
                  /\s/.test(form.newPw) ||
                  form.newPw === form.current ||
                  form.newPw !== form.confirm
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#237a59] text-white text-sm font-semibold hover:bg-[#1c6348] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[.98]"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing...</> : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
