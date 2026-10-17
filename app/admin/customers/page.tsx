'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Mail, 
  Phone, 
  RefreshCw, 
  ShieldCheck, 
  Unlock, 
  Download, 
  Plus, 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Eye, 
  MessageSquare, 
  Filter,
  Check,
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { OrderRecord } from '@/lib/mock-data';
import { formatZAR } from '@/lib/utils';
import { getAdminAuthHeaders, useAdminAuth } from '@/lib/auth-context';
import { AdminAccessGuard } from '@/components/admin-access-guard';
import { maskEmail, maskPhone } from '@/lib/customer-privacy';
import { CustomerContact, ContactStatistics, ConsentSource, MarketingStatus } from '@/lib/contacts-types';

export default function CustomersPage() {
  const { isAuthenticated, openUnlockModal, role, hasAccess } = useAdminAuth();

  // Active view tab: 'contacts' (Customer Contacts & Marketing) | 'orders' (Order Spends & Customers)
  const [activeTab, setActiveTab] = useState<'contacts' | 'orders'>('contacts');

  // ==========================================
  // CONTACTS & MARKETING STATE
  // ==========================================
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [stats, setStats] = useState<ContactStatistics | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Filters
  const [contactSearch, setContactSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmailConsent, setFilterEmailConsent] = useState<string>('all');
  const [filterWhatsAppConsent, setFilterWhatsAppConsent] = useState<string>('all');
  const [filterWhatsAppAvailable, setFilterWhatsAppAvailable] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [auditContact, setAuditContact] = useState<CustomerContact | null>(null);
  const [editContact, setEditContact] = useState<CustomerContact | null>(null);
  const [suppressContact, setSuppressContact] = useState<CustomerContact | null>(null);
  const [suppressionReason, setSuppressionReason] = useState('User requested marketing pause');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Add Contact Form State
  const [newPhone, setNewPhone] = useState('');
  const [newIsWhatsApp, setNewIsWhatsApp] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmailConsent, setNewEmailConsent] = useState(false);
  const [newWhatsAppConsent, setNewWhatsAppConsent] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Export state
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // ==========================================
  // ORDERS CUSTOMER DATA STATE
  // ==========================================
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // ------------------------------------------
  // LOAD CONTACTS & METRICS
  // ------------------------------------------
  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    setContactsError(null);

    try {
      const authHeaders = await getAdminAuthHeaders();
      const params = new URLSearchParams();
      if (contactSearch.trim()) params.set('search', contactSearch.trim());
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterEmailConsent !== 'all') params.set('emailConsent', filterEmailConsent);
      if (filterWhatsAppConsent !== 'all') params.set('whatsAppConsent', filterWhatsAppConsent);
      if (filterWhatsAppAvailable !== 'all') params.set('whatsAppAvailable', filterWhatsAppAvailable);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/contacts?${params.toString()}&t=${Date.now()}`, {
        headers: authHeaders,
        cache: 'no-store'
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setContactsError('Authorization required to view customer contacts.');
        } else {
          setContactsError('Failed to load customer contacts from server.');
        }
        setContacts([]);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts || []);
        setStats(data.stats || null);
      } else {
        setContactsError(data.error || 'Failed to parse contacts data.');
      }
    } catch (err: any) {
      setContactsError(err.message || 'Network exception loading contacts.');
    } finally {
      setLoadingContacts(false);
    }
  }, [contactSearch, filterStatus, filterEmailConsent, filterWhatsAppConsent, filterWhatsAppAvailable]);

  // ------------------------------------------
  // LOAD ORDERS
  // ------------------------------------------
  const loadCustomerOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/orders?t=${Date.now()}`, { 
        headers: authHeaders,
        cache: 'no-store' 
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.records)) {
          setOrders(data.records);
          setLoadingOrders(false);
          return;
        }
      }
      const { records } = await fetchFullOrdersFromSupabase();
      setOrders(records);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadContacts();
        void loadCustomerOrders();
      }
    });

    const handleAuthChange = () => {
      if (active) {
        void loadContacts();
        void loadCustomerOrders();
      }
    };

    window.addEventListener('veritas_admin_auth_changed', handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener('veritas_admin_auth_changed', handleAuthChange);
    };
  }, [loadContacts, loadCustomerOrders]);

  // ------------------------------------------
  // CSV EXPORT HANDLER
  // ------------------------------------------
  const handleExportCSV = async () => {
    if (!hasAccess('canExportContacts')) {
      setExportNotice('Permission Denied: Your partner role cannot export customer contact files.');
      setTimeout(() => setExportNotice(null), 5000);
      return;
    }

    setExportingCsv(true);
    setExportNotice(null);

    try {
      const authHeaders = await getAdminAuthHeaders();
      const params = new URLSearchParams();
      if (contactSearch.trim()) params.set('search', contactSearch.trim());
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterEmailConsent !== 'all') params.set('emailConsent', filterEmailConsent);
      if (filterWhatsAppConsent !== 'all') params.set('whatsAppConsent', filterWhatsAppConsent);
      params.set('format', 'csv');

      const res = await fetch(`/api/admin/contacts?${params.toString()}`, {
        headers: authHeaders
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setExportNotice(errJson.error || 'Failed to export CSV.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veritas-customer-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setExportNotice('CSV export generated and downloaded successfully.');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      setExportNotice(err.message || 'CSV download failed.');
    } finally {
      setExportingCsv(false);
    }
  };

  // ------------------------------------------
  // ADD CONTACT (ADMIN MANUAL)
  // ------------------------------------------
  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/contacts/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          phoneNumber: newPhone,
          isWhatsApp: newIsWhatsApp,
          email: newEmail.trim() || undefined,
          firstName: newFirstName.trim() || undefined,
          lastName: newLastName.trim() || undefined,
          emailMarketingConsent: newEmailConsent,
          whatsAppMarketingConsent: newWhatsAppConsent,
          consentSource: 'admin_manual'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddError(data.error || 'Failed to create contact.');
      } else {
        setIsAddModalOpen(false);
        setNewPhone('');
        setNewEmail('');
        setNewFirstName('');
        setNewLastName('');
        setNewEmailConsent(false);
        setNewWhatsAppConsent(false);
        await loadContacts();
      }
    } catch (err: any) {
      setAddError(err.message || 'Error creating contact.');
    } finally {
      setAddLoading(false);
    }
  };

  // ------------------------------------------
  // EDIT CONTACT HANDLER
  // ------------------------------------------
  const handleSaveContactEdit = async (updates: Partial<CustomerContact>) => {
    if (!editContact) return;

    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/contacts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          id: editContact.id,
          ...updates
        })
      });

      const data = await res.json();
      if (data.success) {
        setEditContact(null);
        await loadContacts();
      } else {
        alert(data.error || 'Failed to update contact.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving contact.');
    }
  };

  // ------------------------------------------
  // TOGGLE CONSENT CHANNEL
  // ------------------------------------------
  const handleToggleChannel = async (contact: CustomerContact, channel: 'email' | 'whatsapp') => {
    const isEmail = channel === 'email';
    const currentVal = isEmail ? contact.emailMarketingConsent : contact.whatsAppMarketingConsent;
    const newVal = !currentVal;

    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/contacts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          id: contact.id,
          [isEmail ? 'emailMarketingConsent' : 'whatsAppMarketingConsent']: newVal
        })
      });

      const data = await res.json();
      if (data.success) {
        await loadContacts();
      } else {
        alert(data.error || 'Failed to update consent.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update channel consent.');
    }
  };

  // ------------------------------------------
  // SUPPRESS CONTACT
  // ------------------------------------------
  const handleApplySuppression = async () => {
    if (!suppressContact) return;

    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/contacts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          id: suppressContact.id,
          marketingStatus: 'suppressed',
          suppressionReason,
          emailMarketingConsent: false,
          whatsAppMarketingConsent: false
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuppressContact(null);
        await loadContacts();
      } else {
        alert(data.error || 'Failed to suppress contact.');
      }
    } catch (err: any) {
      alert(err.message || 'Error suppressing contact.');
    }
  };

  // ------------------------------------------
  // HARD DELETE CONTACT (POPIA RIGHT TO BE FORGOTTEN)
  // ------------------------------------------
  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to permanently erase this customer contact record? This action cannot be undone.')) {
      return;
    }

    try {
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/contacts?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      const data = await res.json();
      if (data.success) {
        setDeleteTargetId(null);
        await loadContacts();
      } else {
        alert(data.error || 'Failed to delete contact.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact.');
    }
  };

  // Group order customers
  const customerMap = new Map<string, {
    id: string;
    name: string;
    email: string;
    phone: string;
    city: string;
    province: string;
    ordersCount: number;
    totalSpent: number;
    lastOrderDate: string;
    lastOrderId: string;
  }>();

  orders.forEach(order => {
    const cust = order.customer;
    const name = typeof cust === 'string' ? cust : (cust?.name || 'Guest Customer');
    const email = typeof cust === 'string' ? '' : (cust?.email || '');
    const phone = typeof cust === 'string' ? '' : (cust?.phone || '');
    const city = typeof cust === 'object' && cust ? (cust.addressDetails?.city || (cust as any).city || '') : '';
    const province = typeof cust === 'object' && cust ? (cust.addressDetails?.province || (cust as any).province || '') : '';

    const customerKey = (email || name || order.id).toLowerCase().trim();
    const customerId = `CUS-${name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'VER'}`;

    if (!customerMap.has(customerKey)) {
      customerMap.set(customerKey, {
        id: customerId,
        name,
        email,
        phone,
        city,
        province,
        ordersCount: 1,
        totalSpent: order.total,
        lastOrderDate: order.date,
        lastOrderId: order.id
      });
    } else {
      const existing = customerMap.get(customerKey)!;
      existing.ordersCount += 1;
      existing.totalSpent += order.total;
      if (order.date > existing.lastOrderDate) {
        existing.lastOrderDate = order.date;
        existing.lastOrderId = order.id;
      }
    }
  });

  const orderCustomers = Array.from(customerMap.values()).filter(c => 
    c.name.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
    c.phone.includes(orderSearchTerm)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-white">
      {/* ACCESS GUARD */}
      <AdminAccessGuard requiredPermission="canViewCustomers" featureName="Customer Contacts & Marketing">
        {/* TOP VIEW NAVIGATION BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#222] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase tracking-widest font-bold">
              <Users className="w-4 h-4" />
              <span>CRM & MARKETING REPOSITORY</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
              Customer Contacts & Audience Management
            </h1>
            <p className="text-xs text-[#888] font-mono mt-0.5">
              POPIA COMPLIANT CONSENT EVIDENCE • DUAL-CHANNEL OPT-IN ENGINE
            </p>
          </div>

          {/* VIEW SWITCH TABS */}
          <div className="flex items-center bg-[#141414] border border-[#2B2B2B] p-1 rounded-xs">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-[#D4AF37] text-black font-bold'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              Contacts & Marketing ({stats ? stats.totalContacts : contacts.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#D4AF37] text-black font-bold'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              Order Spends ({orderCustomers.length})
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="p-3 bg-[#161616] border border-[#333] text-xs font-mono rounded-xs flex items-center justify-between text-white">
            <span>{exportNotice}</span>
            <button onClick={() => setExportNotice(null)} className="text-[#888] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: CUSTOMER CONTACTS & MARKETING CRM                 */}
        {/* ======================================================== */}
        {activeTab === 'contacts' && (
          <div className="space-y-6">
            {/* KPI STATS CARDS */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">Total Contacts</span>
                  <p className="text-xl font-bold font-mono text-white">{stats.totalContacts}</p>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">Email Opt-In</span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl font-bold font-mono text-emerald-400">{stats.emailSubscribersCount}</p>
                    <span className="text-[10px] text-emerald-500 font-mono">({stats.emailOptInRate}%)</span>
                  </div>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">WhatsApp Opt-In</span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl font-bold font-mono text-emerald-400">{stats.whatsAppSubscribersCount}</p>
                    <span className="text-[10px] text-emerald-500 font-mono">({stats.whatsAppOptInRate}%)</span>
                  </div>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">Dual Channel</span>
                  <p className="text-xl font-bold font-mono text-[#D4AF37]">{stats.bothChannelsOptedInCount}</p>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">WhatsApp Active</span>
                  <p className="text-xl font-bold font-mono text-blue-400">{stats.whatsAppAvailableCount}</p>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">Unsubscribed</span>
                  <p className="text-xl font-bold font-mono text-amber-400">{stats.unsubscribedCount}</p>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">Suppressed</span>
                  <p className="text-xl font-bold font-mono text-red-400">{stats.suppressedCount}</p>
                </div>
                <div className="p-3 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] font-mono text-[#888] uppercase block">New (7 Days)</span>
                  <p className="text-xl font-bold font-mono text-white">+{stats.recentRegistrations7d}</p>
                </div>
              </div>
            )}

            {/* CONTROLS & TOOLBAR */}
            <div className="p-4 bg-[#0E0E0E] border border-[#222] rounded-xs space-y-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search by phone, email, or customer name..."
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white pl-9 pr-4 py-2 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={loadContacts}
                    disabled={loadingContacts}
                    className="p-2 bg-[#141414] hover:bg-[#1E1E1E] border border-[#2B2B2B] text-[#AAA] hover:text-white rounded-xs transition-colors cursor-pointer"
                    title="Refresh Contacts"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingContacts ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleExportCSV}
                    disabled={exportingCsv}
                    className="px-3.5 py-2 bg-[#141414] hover:bg-[#1E1E1E] border border-[#2B2B2B] text-white text-xs font-mono uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
                  </button>

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold text-xs font-mono uppercase tracking-wider rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Contact</span>
                  </button>
                </div>
              </div>

              {/* Granular Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#181818] text-xs font-mono">
                <div>
                  <label className="text-[10px] text-[#777] uppercase block mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-[#141414] border border-[#282828] text-white px-2 py-1.5 text-xs rounded-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="unsubscribed">Unsubscribed</option>
                    <option value="suppressed">Suppressed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#777] uppercase block mb-1">Email Marketing</label>
                  <select
                    value={filterEmailConsent}
                    onChange={(e) => setFilterEmailConsent(e.target.value)}
                    className="w-full bg-[#141414] border border-[#282828] text-white px-2 py-1.5 text-xs rounded-xs"
                  >
                    <option value="all">All Email Consents</option>
                    <option value="opted_in">Opted In (Subscribed)</option>
                    <option value="opted_out">Opted Out</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#777] uppercase block mb-1">WhatsApp Marketing</label>
                  <select
                    value={filterWhatsAppConsent}
                    onChange={(e) => setFilterWhatsAppConsent(e.target.value)}
                    className="w-full bg-[#141414] border border-[#282828] text-white px-2 py-1.5 text-xs rounded-xs"
                  >
                    <option value="all">All WhatsApp Consents</option>
                    <option value="opted_in">Opted In (Subscribed)</option>
                    <option value="opted_out">Opted Out</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#777] uppercase block mb-1">WhatsApp Active</label>
                  <select
                    value={filterWhatsAppAvailable}
                    onChange={(e) => setFilterWhatsAppAvailable(e.target.value)}
                    className="w-full bg-[#141414] border border-[#282828] text-white px-2 py-1.5 text-xs rounded-xs"
                  >
                    <option value="all">All Numbers</option>
                    <option value="yes">WhatsApp Available</option>
                    <option value="no">SMS Only (No WhatsApp)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CONTACTS DATA TABLE */}
            <div className="bg-[#0E0E0E] border border-[#222] rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141414] border-b border-[#222] text-[#888] font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Contact Details</th>
                      <th className="py-3 px-4">Email Marketing</th>
                      <th className="py-3 px-4">WhatsApp Marketing</th>
                      <th className="py-3 px-4">Consent Source</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {loadingContacts ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#888] font-mono">
                          Loading customer contacts...
                        </td>
                      </tr>
                    ) : contacts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#888] font-mono">
                          No customer contacts found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-[#121212] transition-colors">
                          {/* DETAILS */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-white font-bold">{contact.phoneNumber}</span>
                                {contact.isWhatsApp ? (
                                  <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-mono rounded">
                                    WA ACTIVE
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 bg-zinc-900 text-zinc-500 border border-zinc-700 text-[9px] font-mono rounded">
                                    SMS ONLY
                                  </span>
                                )}
                              </div>
                              {contact.email && (
                                <p className="text-[11px] text-[#AAA] font-mono">{contact.email}</p>
                              )}
                              {(contact.firstName || contact.lastName) && (
                                <p className="text-[11px] text-[#777]">
                                  {[contact.firstName, contact.lastName].filter(Boolean).join(' ')}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* EMAIL MARKETING CONSENT */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {contact.emailMarketingConsent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-mono rounded">
                                  <Check className="w-3 h-3" />
                                  <span>SUBSCRIBED</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-700 text-[10px] font-mono rounded">
                                  <X className="w-3 h-3" />
                                  <span>OPTED OUT</span>
                                </span>
                              )}
                              {contact.emailConsentUpdatedAt && (
                                <p className="text-[10px] text-[#666] font-mono">
                                  {new Date(contact.emailConsentUpdatedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* WHATSAPP MARKETING CONSENT */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {contact.whatsAppMarketingConsent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-mono rounded">
                                  <Check className="w-3 h-3" />
                                  <span>SUBSCRIBED</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-700 text-[10px] font-mono rounded">
                                  <X className="w-3 h-3" />
                                  <span>OPTED OUT</span>
                                </span>
                              )}
                              {contact.whatsAppConsentUpdatedAt && (
                                <p className="text-[10px] text-[#666] font-mono">
                                  {new Date(contact.whatsAppConsentUpdatedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* CONSENT SOURCE */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 bg-[#181818] border border-[#2B2B2B] text-[#D4AF37] font-mono text-[9px] uppercase tracking-wider rounded">
                                {contact.consentSource}
                              </span>
                              <p className="text-[10px] text-[#666] font-mono">
                                {new Date(contact.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </td>

                          {/* MARKETING STATUS */}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded ${
                              contact.marketingStatus === 'active'
                                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                                : contact.marketingStatus === 'unsubscribed'
                                ? 'bg-amber-950/70 text-amber-300 border border-amber-800'
                                : 'bg-red-950/70 text-red-300 border border-red-800'
                            }`}>
                              {contact.marketingStatus}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Audit view */}
                              <button
                                onClick={() => setAuditContact(contact)}
                                className="p-1.5 bg-[#161616] hover:bg-[#242424] text-[#AAA] hover:text-white rounded transition-colors cursor-pointer"
                                title="View Evidentiary Audit Trail"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit contact */}
                              <button
                                onClick={() => setEditContact(contact)}
                                className="p-1.5 bg-[#161616] hover:bg-[#242424] text-[#AAA] hover:text-white rounded transition-colors cursor-pointer"
                                title="Edit Contact Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Suppress contact */}
                              {contact.marketingStatus !== 'suppressed' && (
                                <button
                                  onClick={() => setSuppressContact(contact)}
                                  className="p-1.5 bg-[#161616] hover:bg-amber-950 text-amber-400 rounded transition-colors cursor-pointer"
                                  title="Suppress Marketing"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Hard Delete (Super Admin only) */}
                              {role === 'super_admin' && (
                                <button
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="p-1.5 bg-[#161616] hover:bg-red-950 text-red-400 rounded transition-colors cursor-pointer"
                                  title="Erase Contact (Right to be Forgotten)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STORE ORDERS & LIFETIME SPENDS (EXISTING VIEW)     */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#0E0E0E] border border-[#222] rounded-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  placeholder="Filter by customer name, email or phone..."
                  className="w-full bg-[#141414] border border-[#2B2B2B] text-white pl-9 pr-4 py-2 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                />
              </div>
              <button
                onClick={loadCustomerOrders}
                disabled={loadingOrders}
                className="p-2 bg-[#141414] hover:bg-[#1E1E1E] border border-[#2B2B2B] text-[#AAA] hover:text-white rounded-xs transition-colors self-end sm:self-auto cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="bg-[#0E0E0E] border border-[#222] rounded-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141414] border-b border-[#222] text-[#888] font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Client ID & Name</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-right">Total Spent</th>
                      <th className="py-3 px-4 text-right">Last Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {loadingOrders ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#888] font-mono">
                          Loading order history...
                        </td>
                      </tr>
                    ) : orderCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#888] font-mono">
                          No order records found.
                        </td>
                      </tr>
                    ) : (
                      orderCustomers.map((cust) => (
                        <tr key={cust.id} className="hover:bg-[#121212] transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-[#D4AF37] block text-[10px]">{cust.id}</span>
                            <span className="font-bold text-white block">{cust.name}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-0.5 text-[#AAA] font-mono text-[11px]">
                              {cust.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-[#666]" /><span>{cust.email}</span></div>}
                              {cust.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-[#666]" /><span>{cust.phone}</span></div>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#AAA]">
                            {[cust.city, cust.province].filter(Boolean).join(', ') || 'Nationwide Courier'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-white">
                            {cust.ordersCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#D4AF37]">
                            {formatZAR(cust.totalSpent)}
                          </td>
                          <td className="py-3 px-4 text-right text-[#888] font-mono text-[11px]">
                            {cust.lastOrderDate}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: ADD CONTACT                                       */}
        {/* ======================================================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0E0E0E] border border-[#2B2B2B] rounded-xs max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Register Customer Contact (Admin Manual)
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-[#888] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xs">
                  {addError}
                </div>
              )}

              <form onSubmit={handleAddContactSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#D4AF37] mb-1">
                    Phone Number * (Required)
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="082 123 4567 or +27821234567"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-[#141414] border border-[#242424] rounded-xs">
                  <span className="text-[#AAA]">Number has active WhatsApp</span>
                  <input
                    type="checkbox"
                    checked={newIsWhatsApp}
                    onChange={(e) => setNewIsWhatsApp(e.target.checked)}
                    className="w-4 h-4 rounded text-[#D4AF37] bg-[#222]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="client@domain.co.za"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">First Name</label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. Siyabonga"
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">Last Name</label>
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="e.g. Nkosi"
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#141414] border border-[#242424] rounded-xs space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#D4AF37] block font-bold">
                    Explicit Marketing Opt-Ins (Never checked by default)
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEmailConsent}
                      onChange={(e) => setNewEmailConsent(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#D4AF37] bg-[#222]"
                    />
                    <span className="text-[#CCC]">Email Marketing Consent</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWhatsAppConsent}
                      onChange={(e) => setNewWhatsAppConsent(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#D4AF37] bg-[#222]"
                    />
                    <span className="text-[#CCC]">WhatsApp Marketing Consent</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-[#1A1A1A] text-white rounded-xs font-mono uppercase text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-5 py-2 bg-[#D4AF37] text-black font-bold rounded-xs font-mono uppercase text-xs disabled:opacity-50"
                  >
                    {addLoading ? 'Saving...' : 'Register Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: AUDIT EVIDENCE TRAIL                              */}
        {/* ======================================================== */}
        {auditContact && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0E0E0E] border border-[#2B2B2B] rounded-xs max-w-xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Consent & Evidentiary Audit Trail
                  </h3>
                </div>
                <button onClick={() => setAuditContact(null)} className="text-[#888] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-1">
                  <span className="text-[10px] text-[#777] uppercase block">Contact Identifier</span>
                  <p className="text-white font-bold">{auditContact.phoneNumber}</p>
                  <p className="text-[#AAA] text-[11px]">Database ID: {auditContact.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-1">
                    <span className="text-[10px] text-[#777] uppercase block">Consent Source</span>
                    <p className="text-[#D4AF37] font-bold">{auditContact.consentSource}</p>
                  </div>
                  <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-1">
                    <span className="text-[10px] text-[#777] uppercase block">Marketing Lifecycle</span>
                    <p className="text-white font-bold">{auditContact.marketingStatus.toUpperCase()}</p>
                  </div>
                </div>

                <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-2">
                  <span className="text-[10px] text-[#777] uppercase block font-bold">Channel Consent Details</span>
                  <div className="flex justify-between items-center py-1 border-b border-[#222]">
                    <span>Email Marketing:</span>
                    <span className={auditContact.emailMarketingConsent ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                      {auditContact.emailMarketingConsent ? 'OPTED IN' : 'OPTED OUT'}
                    </span>
                  </div>
                  {auditContact.emailConsentUpdatedAt && (
                    <div className="flex justify-between items-center text-[11px] text-[#777]">
                      <span>Email Consent Date:</span>
                      <span>{new Date(auditContact.emailConsentUpdatedAt).toISOString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1 border-b border-[#222]">
                    <span>WhatsApp Marketing:</span>
                    <span className={auditContact.whatsAppMarketingConsent ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                      {auditContact.whatsAppMarketingConsent ? 'OPTED IN' : 'OPTED OUT'}
                    </span>
                  </div>
                  {auditContact.whatsAppConsentUpdatedAt && (
                    <div className="flex justify-between items-center text-[11px] text-[#777]">
                      <span>WhatsApp Consent Date:</span>
                      <span>{new Date(auditContact.whatsAppConsentUpdatedAt).toISOString()}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#141414] border border-[#222] rounded-xs space-y-1 text-[11px]">
                  <span className="text-[10px] text-[#777] uppercase block">POPIA Evidentiary Hash</span>
                  <p className="text-[#AAA] break-all">IP Anonymized Hash: {auditContact.consentIpHash || 'SHA256-STORED-SALT'}</p>
                  <p className="text-[#777] break-all">Agent: {auditContact.consentUserAgent || 'Browser Secure Channel'}</p>
                  <p className="text-[#888] break-all pt-1">Preference Token: {auditContact.preferenceToken}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setAuditContact(null)}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#222] text-white rounded-xs font-mono uppercase text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: EDIT / CORRECT CONTACT                            */}
        {/* ======================================================== */}
        {editContact && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0E0E0E] border border-[#2B2B2B] rounded-xs max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Edit / Correct Customer Details
                </h3>
                <button onClick={() => setEditContact(null)} className="text-[#888] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editContact.phoneNumber}
                    onChange={(e) => setEditContact({ ...editContact, phoneNumber: e.target.value })}
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editContact.email || ''}
                    onChange={(e) => setEditContact({ ...editContact, email: e.target.value })}
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">First Name</label>
                    <input
                      type="text"
                      value={editContact.firstName || ''}
                      onChange={(e) => setEditContact({ ...editContact, firstName: e.target.value })}
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editContact.lastName || ''}
                      onChange={(e) => setEditContact({ ...editContact, lastName: e.target.value })}
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 rounded-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-[#141414] border border-[#242424] rounded-xs">
                  <span className="text-[#AAA]">Number has active WhatsApp</span>
                  <input
                    type="checkbox"
                    checked={editContact.isWhatsApp}
                    onChange={(e) => setEditContact({ ...editContact, isWhatsApp: e.target.checked })}
                    className="w-4 h-4 rounded text-[#D4AF37] bg-[#222]"
                  />
                </div>

                <div className="p-3 bg-[#141414] border border-[#242424] rounded-xs space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#D4AF37] block font-bold">
                    Marketing Channel Controls
                  </span>
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-[#CCC]">Email Marketing Consent</span>
                    <input
                      type="checkbox"
                      checked={editContact.emailMarketingConsent}
                      onChange={(e) => setEditContact({ ...editContact, emailMarketingConsent: e.target.checked })}
                      className="w-4 h-4 rounded text-[#D4AF37] bg-[#222]"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-[#CCC]">WhatsApp Marketing Consent</span>
                    <input
                      type="checkbox"
                      checked={editContact.whatsAppMarketingConsent}
                      onChange={(e) => setEditContact({ ...editContact, whatsAppMarketingConsent: e.target.checked })}
                      className="w-4 h-4 rounded text-[#D4AF37] bg-[#222]"
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditContact(null)}
                    className="px-4 py-2 bg-[#1A1A1A] text-white rounded-xs font-mono uppercase text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveContactEdit(editContact)}
                    className="px-5 py-2 bg-[#D4AF37] text-black font-bold rounded-xs font-mono uppercase text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL: SUPPRESS CONTACT                                  */}
        {/* ======================================================== */}
        {suppressContact && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0E0E0E] border border-amber-800/60 rounded-xs max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Suppress Marketing Communications
                </h3>
              </div>

              <p className="text-xs text-[#AAA] leading-relaxed">
                Suppressing <strong className="text-white font-mono">{suppressContact.phoneNumber}</strong> will revoke all promotional marketing consents on both Email and WhatsApp, adding this contact to the suppression list.
              </p>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#888] mb-1">
                  Suppression Reason
                </label>
                <input
                  type="text"
                  value={suppressionReason}
                  onChange={(e) => setSuppressionReason(e.target.value)}
                  placeholder="e.g. User requested complete marketing pause"
                  className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3 py-2 text-xs rounded-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSuppressContact(null)}
                  className="px-4 py-2 bg-[#1A1A1A] text-white rounded-xs font-mono uppercase text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplySuppression}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xs font-mono uppercase text-xs"
                >
                  Confirm Suppression
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminAccessGuard>
    </div>
  );
}
