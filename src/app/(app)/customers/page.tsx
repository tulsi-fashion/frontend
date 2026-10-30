'use client';
import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, Users, X, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { money, formatDate } from '../../../lib/utils';
import { Customer, Sale, Credit } from '../../../types';
import { showToast } from '../../../components/ui/Toast';
import TopBar from '../../../components/layout/TopBar';

interface CustomerStats {
  customer: Customer;
  total_purchases: number;
  invoice_count: number;
  balance_due: number;
}

interface CustomerProfile {
  stats: CustomerStats;
  invoices: Sale[];
  credits: Credit[];
}

const EMPTY_EDIT = { name: '', phone: '', email: '', company: '', address: '', notes: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editSaving, setEditSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/customers?search=${encodeURIComponent(search)}`);
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
    const t = setTimeout(() => loadCustomers(), 300);
    return () => clearTimeout(t);
  }, [search, loadCustomers]);

  async function viewCustomer(c: CustomerStats) {
    setSelected(null);
    setEditMode(false);
    setProfileLoading(true);
    try {
      const [invoices, credits] = await Promise.all([
        api.get(`/api/sales?customer_phone=${encodeURIComponent(c.customer.phone || '')}`),
        api.get(`/api/credits?customer_phone=${encodeURIComponent(c.customer.phone || '')}`),
      ]);
      setSelected({
        stats: c,
        invoices: Array.isArray(invoices) ? invoices : [],
        credits: Array.isArray(credits) ? credits : [],
      });
      setEditForm({
        name: c.customer.name || '',
        phone: c.customer.phone || '',
        email: c.customer.email || '',
        company: c.customer.company || '',
        address: c.customer.address || '',
        notes: c.customer.notes || '',
      });
    } catch {
      showToast('Failed to load customer details', 'error');
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveEdit() {
    if (!selected) return;
    setEditSaving(true);
    try {
      await api.put(`/api/customers/${selected.stats.customer.id}`, editForm);
      showToast('Customer updated');
      setEditMode(false);
      loadCustomers();
    } catch {
      showToast('Failed to update customer', 'error');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      <TopBar title="Customers" />

      <div className="p-6 grid lg:grid-cols-[1fr_420px] gap-6">
        {/* Customer List */}
        <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#798397]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
              />
            </div>
            <button onClick={() => loadCustomers()} className="p-2.5 border border-[#e5e9f0] rounded-lg hover:bg-[#f5f7fb] text-[#798397] transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-[#f5f7fb] rounded animate-pulse" />)}
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center text-[#798397]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f5f7fb] border-b border-[#e5e9f0]">
                    {['Name', 'Company', 'Phone', 'Total Purchases', 'Balance Due', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-[#798397] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {customers.map(c => (
                    <tr key={c.customer.id} className={`hover:bg-[#f9fafb] cursor-pointer ${selected?.stats.customer.id === c.customer.id ? 'bg-[#eaf5ef]' : ''}`}
                      onClick={() => viewCustomer(c)}>
                      <td className="px-3 py-3 font-semibold text-[#20283b]">{c.customer.name}</td>
                      <td className="px-3 py-3 text-[#798397]">{c.customer.company || '—'}</td>
                      <td className="px-3 py-3 text-[#798397]">{c.customer.phone || '—'}</td>
                      <td className="px-3 py-3 font-semibold text-[#20283b]">{money(c.total_purchases)}</td>
                      <td className="px-3 py-3">
                        {c.balance_due > 0
                          ? <span className="font-bold text-[#b32642]">{money(c.balance_due)}</span>
                          : <span className="text-[#16804a] font-semibold">Clear</span>}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); viewCustomer(c); }}
                          className="px-3 py-1.5 bg-[#20273d] hover:bg-[#2d3650] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Profile */}
        <div className="bg-white rounded-xl border border-[#e5e9f0] shadow-sm p-5">
          {profileLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-[#f5f7fb] rounded animate-pulse" />)}
            </div>
          ) : !selected ? (
            <div className="py-16 text-center text-[#798397]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a customer to view their profile</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#20283b]">{selected.stats.customer.name}</h3>
                  {selected.stats.customer.company && <p className="text-sm text-[#798397]">{selected.stats.customer.company}</p>}
                  {selected.stats.customer.phone && <p className="text-sm text-[#798397]">{selected.stats.customer.phone}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="p-2 text-[#798397] hover:text-[#20283b] hover:bg-[#f5f7fb] rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-[#eaf5ef] rounded-xl p-3 text-center">
                  <p className="text-xs font-bold text-[#237a59] uppercase">Purchases</p>
                  <p className="text-lg font-black text-[#20283b] mt-1">{money(selected.stats.total_purchases)}</p>
                </div>
                <div className="bg-[#eef3ff] rounded-xl p-3 text-center">
                  <p className="text-xs font-bold text-[#3479e6] uppercase">Invoices</p>
                  <p className="text-lg font-black text-[#20283b] mt-1">{selected.stats.invoice_count}</p>
                </div>
                <div className={`${selected.stats.balance_due > 0 ? 'bg-[#fff0f1]' : 'bg-[#f9fafb]'} rounded-xl p-3 text-center`}>
                  <p className={`text-xs font-bold uppercase ${selected.stats.balance_due > 0 ? 'text-[#b32642]' : 'text-[#798397]'}`}>Balance Due</p>
                  <p className={`text-base font-black mt-1 ${selected.stats.balance_due > 0 ? 'text-[#b32642]' : 'text-[#16804a]'}`}>
                    {selected.stats.balance_due > 0 ? money(selected.stats.balance_due) : 'Clear'}
                  </p>
                </div>
              </div>

              {/* New Bill button */}
              <Link
                href={`/billing?customer=${encodeURIComponent(selected.stats.customer.name)}&phone=${encodeURIComponent(selected.stats.customer.phone || '')}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white text-sm font-semibold rounded-lg transition-colors mb-5"
              >
                <ShoppingCart className="w-4 h-4" />
                New Bill for {selected.stats.customer.name}
              </Link>

              {/* Edit Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="text-sm text-[#3479e6] hover:underline font-semibold"
                >
                  {editMode ? 'Cancel Edit' : 'Edit Customer'}
                </button>
              </div>

              {editMode && (
                <div className="space-y-3 mb-5 p-4 bg-[#f9fafb] rounded-xl border border-[#e5e9f0]">
                  {(['name', 'phone', 'email', 'company', 'address', 'notes'] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-[#798397] uppercase tracking-wide mb-1 capitalize">{field}</label>
                      <input
                        value={editForm[field]}
                        onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[#e5e9f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#237a59]/25 focus:border-[#237a59]"
                      />
                    </div>
                  ))}
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="w-full py-2.5 bg-[#237a59] hover:bg-[#1d6649] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* Invoice History */}
              <h4 className="text-sm font-bold text-[#20283b] mb-2">Invoice History</h4>
              {selected.invoices.length === 0 ? (
                <p className="text-sm text-[#798397] mb-4">No invoices</p>
              ) : (
                <div className="space-y-1.5 mb-5 max-h-40 overflow-y-auto">
                  {selected.invoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e5e9f0] text-xs">
                      <span className="font-mono font-semibold text-[#3479e6]">{inv.invoice_no}</span>
                      <span className="text-[#798397]">{formatDate(inv.date)}</span>
                      <span className="font-bold text-[#20283b]">{money(inv.total)}</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        inv.payment_status === 'paid' ? 'bg-[#e6f5eb] text-[#16804a]' :
                        inv.payment_status === 'partial' ? 'bg-[#fff8e8] text-[#a55b00]' :
                        'bg-[#fff0f1] text-[#b32642]'
                      }`}>{inv.payment_status.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Credit History */}
              <h4 className="text-sm font-bold text-[#20283b] mb-2">Credit / Payment History</h4>
              {selected.credits.length === 0 ? (
                <p className="text-sm text-[#798397]">No credit records</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selected.credits.map(cr => (
                    <div key={cr.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#f9fafb] border border-[#e5e9f0] text-xs">
                      <span className="capitalize text-[#798397]">{cr.type}</span>
                      <span className="text-[#798397]">{formatDate(cr.date)}</span>
                      <span className="font-bold text-[#20283b]">{money(cr.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
