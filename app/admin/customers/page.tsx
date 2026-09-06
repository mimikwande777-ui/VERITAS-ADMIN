'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Mail, Phone, ShoppingBag, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchFullOrdersFromSupabase } from '@/lib/supabase/orders';
import { OrderRecord } from '@/lib/mock-data';
import { formatZAR } from '@/lib/utils';
import { getAdminAuthHeaders } from '@/lib/auth-context';

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCustomerData = async () => {
    setLoading(true);
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
          setLoading(false);
          return;
        }
      }
      const { records } = await fetchFullOrdersFromSupabase();
      setOrders(records);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomerData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Extract unique customer records from actual orders in the database
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

    // Key by email if available, otherwise by name
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

  const customers = Array.from(customerMap.values());

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* HONEST DERIVATION BANNER */}
      <div className="bg-[#121212] border border-[#262626] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-[#D4AF37]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong className="text-white">DERIVED FROM ORDERS:</strong> Customer entities are compiled in real-time from verified checkout entries and shipping manifests in Supabase.
          </span>
        </div>
        <button 
          onClick={loadCustomerData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1A1A] hover:bg-[#262626] text-white rounded border border-[#333] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-[#D4AF37]' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Customers</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            IDENTIFIED PATRONS & BUYERS ACROSS VERIFIED VERITAS ORDERS
          </p>
        </div>
      </div>

      <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
        <div className="p-4 border-b border-[#1F1F1F] flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#151515]">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customers by name, email, or customer ID..."
              className="w-full pl-10 pr-4 py-2 text-xs font-mono bg-[#0A0A0A] text-white border border-[#333] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="text-xs font-mono text-[#888]">
            {customers.length} Unique Customer{customers.length === 1 ? '' : 's'} Identified
          </div>
        </div>

        {/* 1. MOBILE RESPONSIVE STACKED CARDS (< md) */}
        <div className="block md:hidden divide-y divide-[#1F1F1F]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#888] font-mono">
              <RefreshCw className="w-5 h-5 animate-spin text-[#D4AF37] mx-auto mb-2" />
              Querying Supabase order records...
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] font-mono">
              NO CUSTOMER RECORDS YET
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#666] font-mono">
              NO CUSTOMERS MATCH THE SEARCH QUERY
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id + customer.name} className="p-4 space-y-2.5 bg-[#111]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-white uppercase block">{customer.name}</span>
                    <span className="text-[10px] text-[#D4AF37] font-mono">{customer.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#D4AF37] block">{formatZAR(customer.totalSpent)}</span>
                    <span className="text-[10px] text-[#777] font-mono">{customer.ordersCount} order{customer.ordersCount === 1 ? '' : 's'}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#161616] rounded border border-[#222] text-xs font-mono space-y-1">
                  {customer.email && (
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <Mail className="w-3 h-3 text-[#777]" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-1.5 text-[#888]">
                      <Phone className="w-3 h-3 text-[#666]" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-[#666] pt-0.5">
                    Location: {customer.city || 'South Africa'}{customer.province ? `, ${customer.province}` : ''}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[#777] pt-1">
                  <span>Latest Order: {customer.lastOrderDate}</span>
                  <span>ID: {customer.lastOrderId}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 2. DESKTOP TABULAR VIEW (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="text-xs text-[#888] uppercase bg-[#111] tracking-wider border-b border-[#1F1F1F]">
              <tr>
                <th className="px-6 py-4 font-bold">Customer ID & Name</th>
                <th className="px-6 py-4 font-bold">Contact Coordinates</th>
                <th className="px-6 py-4 font-bold">Location</th>
                <th className="px-6 py-4 font-bold text-right">Orders</th>
                <th className="px-6 py-4 font-bold text-right">Total Spent (ZAR)</th>
                <th className="px-6 py-4 font-bold">Latest Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-[#888] font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37] mx-auto mb-2" />
                    Querying Supabase order records...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#777]">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO CUSTOMER RECORDS YET</h3>
                      <p className="text-xs text-[#888] font-mono">
                        Customer profiles and purchase histories are automatically compiled when orders are submitted.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-[#666] font-mono">
                    NO CUSTOMERS MATCH THE SEARCH QUERY
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id + customer.name} className="hover:bg-[#151515] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white tracking-wide">{customer.name}</div>
                      <div className="text-[11px] text-[#D4AF37] font-mono">{customer.id}</div>
                    </td>
                    <td className="px-6 py-4 text-[#BBB] text-xs">
                      {customer.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-[#666]" />
                          <span>{customer.email}</span>
                        </div>
                      ) : (
                        <span className="text-[#555]">No email provided</span>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#777] mt-0.5">
                          <Phone className="w-3 h-3 text-[#555]" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#AAA]">
                      {customer.city || customer.province ? (
                        <span>{customer.city}{customer.city && customer.province ? ', ' : ''}{customer.province}</span>
                      ) : (
                        <span className="text-[#555]">South Africa</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-right text-white">{customer.ordersCount}</td>
                    <td className="px-6 py-4 font-medium text-right text-[#D4AF37] font-bold">{formatZAR(customer.totalSpent)}</td>
                    <td className="px-6 py-4 text-xs text-[#888]">
                      <div>{customer.lastOrderDate}</div>
                      <div className="text-[10px] text-[#555]">{customer.lastOrderId}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

