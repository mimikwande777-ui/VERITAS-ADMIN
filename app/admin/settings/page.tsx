'use client';

import { useState, useEffect } from 'react';
import { Save, Check, Sparkles, Shield, Database, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import { PWAInstallButton } from '@/components/pwa-install-button';

export default function SettingsPage() {
  const [brandName, setBrandName] = useState('VERITAS');
  const [supportEmail, setSupportEmail] = useState('support@veritas.co.za');
  const [businessEmail, setBusinessEmail] = useState('contact@veritas.co.za');
  const [announcement, setAnnouncement] = useState('COMPLIMENTARY EXPRESS SHIPPING ACROSS SOUTH AFRICA ON ALL ORDERS');
  const [shippingDisplay, setShippingDisplay] = useState('Standard Delivery via OTC Logistics (3-5 Business Days)');
  const [storeStatus, setStoreStatus] = useState('Online & Taking Orders');
  const [instagram, setInstagram] = useState('https://instagram.com/veritas.apparel');
  const [twitter, setTwitter] = useState('https://twitter.com/veritas_za');
  const [tiktok, setTiktok] = useState('https://tiktok.com/@veritas_za');

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('veritas_admin_settings');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.brandName) setBrandName(data.brandName);
          if (data.supportEmail) setSupportEmail(data.supportEmail);
          if (data.businessEmail) setBusinessEmail(data.businessEmail);
          if (data.announcement) setAnnouncement(data.announcement);
          if (data.shippingDisplay) setShippingDisplay(data.shippingDisplay);
          if (data.storeStatus) setStoreStatus(data.storeStatus);
          if (data.instagram) setInstagram(data.instagram);
          if (data.twitter) setTwitter(data.twitter);
          if (data.tiktok) setTiktok(data.tiktok);
        }
      } catch (e) {
        console.warn('Could not read settings from localStorage');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
    setSaving(true);
    const settings = {
      brandName,
      supportEmail,
      businessEmail,
      announcement,
      shippingDisplay,
      storeStatus,
      instagram,
      twitter,
      tiktok,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('veritas_admin_settings', JSON.stringify(settings));
      setTimeout(() => {
        setSaving(false);
        setToast('Store settings saved successfully');
        setTimeout(() => setToast(null), 3000);
      }, 500);
    } catch (e) {
      setSaving(false);
      alert('Failed to save settings to storage');
    }
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cdzvmnixlhjjrpyoaemg.supabase.co';

  return (
    <div className="space-y-6 pb-20">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161616] border border-[#D4AF37] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-3 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-xs font-medium font-mono">{toast}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white">Store Settings</h1>
          <p className="text-[11px] sm:text-xs text-[#888] font-mono mt-0.5 sm:mt-1">
            CONFIGURATION, BRAND PARAMETERS & BACKEND TELEMETRY
          </p>
        </div>
        <button 
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center px-6 py-2.5 bg-[#D4AF37] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#B3932F] transition-colors disabled:opacity-50 font-mono active:scale-95 cursor-pointer"
        >
          {saving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-2" />
              Save Settings
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* GENERAL DETAILS */}
          <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200 mb-4 sm:mb-6 border-b border-[#1F1F1F] pb-3 sm:pb-4 font-mono">
              General Brand Coordinates
            </h2>
            
            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">Brand Name</label>
                <input 
                  type="text" 
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase tracking-wider text-[#888] mb-2">Support Email</label>
                  <input 
                    type="email" 
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-[#888] mb-2">Business Email</label>
                  <input 
                    type="email" 
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STOREFRONT DISPLAY */}
          <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200 mb-4 sm:mb-6 border-b border-[#1F1F1F] pb-3 sm:pb-4 font-mono">
              Storefront Display & Announcement
            </h2>
            
            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">Store Announcement Banner</label>
                <input 
                  type="text" 
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                />
              </div>
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">Default Shipping Notice</label>
                <input 
                  type="text" 
                  value={shippingDisplay}
                  onChange={(e) => setShippingDisplay(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                />
              </div>
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">Store Operational Mode</label>
                <select 
                  value={storeStatus}
                  onChange={(e) => setStoreStatus(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option>Online & Taking Orders</option>
                  <option>Password Protected (Pre-Drop)</option>
                  <option>Offline / Maintenance Mode</option>
                </select>
              </div>
            </div>
          </div>

          {/* BACKEND INFRASTRUCTURE TELEMETRY */}
          <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200 mb-4 border-b border-[#1F1F1F] pb-4 font-mono flex items-center justify-between">
              <span>Connected Supabase Infrastructure</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                CONNECTED
              </span>
            </h2>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">Database URL:</span>
                <span className="text-[#D4AF37] truncate max-w-xs">{supabaseUrl}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">Connected Public Tables:</span>
                <span className="text-white font-bold">8 Tables (products, orders, categories, collections, ...)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#0A0A0A] border border-[#222]">
                <span className="text-[#888]">OTC Fulfilment Pipeline:</span>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
            </div>
          </div>

          {/* PROGRESSIVE WEB APP (PWA) SYSTEM STATUS & INSTALLATION */}
          <PWAInstallButton variant="settings" />
        </div>

        <div className="space-y-6">
          {/* SOCIAL LINKS */}
          <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200 mb-4 sm:mb-6 border-b border-[#1F1F1F] pb-3 sm:pb-4 font-mono">
              Social Links
            </h2>
            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">Instagram URL</label>
                <input 
                  type="text" 
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                />
              </div>
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">Twitter / X URL</label>
                <input 
                  type="text" 
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                />
              </div>
              <div>
                <label className="block uppercase tracking-wider text-[#888] mb-2">TikTok URL</label>
                <input 
                  type="text" 
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full min-h-[44px] bg-[#0A0A0A] border border-[#333] p-3 text-base sm:text-xs text-white focus:outline-none focus:border-[#D4AF37]" 
                />
              </div>
            </div>
          </div>
          
          {/* STORE CURRENCY */}
          <div className="bg-[#111] border border-[#1F1F1F] p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b border-[#1F1F1F] pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200 font-mono">Store Currency</h2>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">
                ENFORCED
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#888] mb-2 font-mono">Official Currency</label>
                <div className="bg-[#151515] border border-[#262626] p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white font-mono">South African Rand (ZAR)</div>
                    <div className="text-[11px] text-[#888] font-mono mt-0.5">Primary ISO 4217 Currency • en-ZA</div>
                  </div>
                  <span className="text-lg font-bold font-mono text-[#D4AF37] px-2.5 py-1 bg-[#222] border border-[#333] rounded">
                    R
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#666] font-mono leading-relaxed">
                VERITAS operates exclusively in South African Rand. All product catalogs, checkout receipts, and OTC manifests are processed in ZAR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

