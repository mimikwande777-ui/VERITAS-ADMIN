'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Search,
  MessageSquare
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

function PreferenceCenterContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  
  const [contactData, setContactData] = useState<{
    phoneNumber: string;
    rawPhone?: string;
    email: string | null;
    rawEmail?: string | null;
    isWhatsApp: boolean;
    emailMarketingConsent: boolean;
    whatsAppMarketingConsent: boolean;
    emailConsentUpdatedAt: string | null;
    whatsAppConsentUpdatedAt: string | null;
    marketingStatus: string;
    preferenceToken: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const lookupContact = useCallback(async (prefToken?: string, phone?: string) => {
    const qToken = prefToken || token;
    const qPhone = phone || phoneNumberInput;

    if (!qToken && !qPhone) {
      setErrorMsg('Please enter your phone number or provide your preference link.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const queryStr = qToken 
        ? `token=${encodeURIComponent(qToken)}` 
        : `phone=${encodeURIComponent(qPhone)}`;

      const res = await fetch(`/api/contacts/preferences?${queryStr}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Could not find a contact record matching your query.');
        setContactData(null);
      } else {
        setContactData(data.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred while fetching preferences.');
    } finally {
      setLoading(false);
    }
  }, [token, phoneNumberInput]);

  // Auto-fetch if token in URL
  useEffect(() => {
    if (tokenFromUrl) {
      queueMicrotask(() => {
        void lookupContact(tokenFromUrl, '');
      });
    }
  }, [tokenFromUrl, lookupContact]);

  const handleUpdate = async () => {
    if (!contactData) return;

    setSaving(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/contacts/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: contactData.preferenceToken,
          phoneNumber: contactData.rawPhone,
          emailMarketingConsent: contactData.emailMarketingConsent,
          whatsAppMarketingConsent: contactData.whatsAppMarketingConsent
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to update preferences.');
      } else {
        setSaveSuccessMsg('Your marketing communication preferences have been saved successfully.');
        setContactData(prev => prev ? ({
          ...prev,
          emailMarketingConsent: data.data.emailMarketingConsent,
          whatsAppMarketingConsent: data.data.whatsAppMarketingConsent,
          emailConsentUpdatedAt: data.data.emailConsentUpdatedAt,
          whatsAppConsentUpdatedAt: data.data.whatsAppConsentUpdatedAt
        }) : null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* HEADER */}
      <div className="border-b border-[#1F1F1F] pb-6 mb-8 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 text-[#D4AF37] text-[10px] font-mono uppercase tracking-[0.3em] font-bold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PRIVACY AUTONOMY & POPIA COMPLIANCE</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1">
          Marketing Preference Center
        </h1>
        <p className="text-xs sm:text-sm text-[#888] font-mono mt-1">
          MANAGE YOUR VERITAS CHANNELS • INDEPENDENT UNSUBSCRIBE MANAGEMENT
        </p>
      </div>

      {/* LOOKUP SEARCH FORM (IF NO RECORD LOADED YET) */}
      {!contactData && (
        <div className="p-6 sm:p-8 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-5">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Lookup Your Preferences
            </h3>
            <p className="text-xs text-[#888] leading-relaxed">
              Enter the phone number registered with VERITAS to review and adjust your communication options.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="tel"
              value={phoneNumberInput}
              onChange={(e) => setPhoneNumberInput(e.target.value)}
              placeholder="Enter phone number (e.g. 082 123 4567)"
              className="flex-1 bg-[#141414] border border-[#2B2B2B] text-white px-4 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] font-mono"
            />
            <button
              onClick={() => lookupContact('', phoneNumberInput)}
              disabled={loading}
              className="px-6 py-3 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-wider rounded-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Searching...</span>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Lookup Record</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] text-[#666] pt-2 border-t border-[#181818] flex items-center justify-between">
            <span>Don&apos;t have a registered contact yet?</span>
            <Link href="/register" className="text-[#D4AF37] hover:underline font-mono">
              Register Contact Now →
            </Link>
          </div>
        </div>
      )}

      {/* ACTIVE RECORD PREFERENCE CONTROLS */}
      {contactData && (
        <div className="p-6 sm:p-8 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-6">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-700 text-emerald-300 text-xs rounded-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* RECORD SUMMARY */}
          <div className="p-4 bg-[#141414] border border-[#242424] rounded-xs space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] font-bold block">
              IDENTIFIED CONTACT
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#AAA]">
                <Phone className="w-3.5 h-3.5 text-[#888]" />
                <span className="font-mono text-white">{contactData.phoneNumber}</span>
                {contactData.isWhatsApp && (
                  <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-mono rounded">
                    WHATSAPP ACTIVE
                  </span>
                )}
              </div>
              {contactData.email && (
                <div className="flex items-center gap-2 text-[#AAA]">
                  <Mail className="w-3.5 h-3.5 text-[#888]" />
                  <span className="font-mono text-white">{contactData.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* CHANNEL PREFERENCES */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-[#1C1C1C] pb-2">
              Granular Channel Preferences
            </h3>

            {/* EMAIL MARKETING TOGGLE */}
            <div className="p-4 bg-[#121212] border border-[#242424] rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-bold text-white uppercase">Email Marketing</span>
                  <span className={`px-2 py-0.5 text-[9px] font-mono rounded ${
                    contactData.emailMarketingConsent 
                      ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800' 
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                  }`}>
                    {contactData.emailMarketingConsent ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}
                  </span>
                </div>
                <p className="text-[11px] text-[#888] leading-normal">
                  Private drop lookbooks, bespoke OTC atelier invitations, and editorial notices.
                </p>
                {contactData.emailConsentUpdatedAt && (
                  <p className="text-[10px] text-[#666] font-mono">
                    Last updated: {new Date(contactData.emailConsentUpdatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setContactData({
                  ...contactData,
                  emailMarketingConsent: !contactData.emailMarketingConsent
                })}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
                  contactData.emailMarketingConsent
                    ? 'bg-red-950/40 text-red-300 border-red-800/60 hover:bg-red-900/60'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                }`}
              >
                {contactData.emailMarketingConsent ? 'Opt Out (Unsubscribe)' : 'Opt In (Subscribe)'}
              </button>
            </div>

            {/* WHATSAPP MARKETING TOGGLE */}
            <div className="p-4 bg-[#121212] border border-[#242424] rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-bold text-white uppercase">WhatsApp Marketing</span>
                  <span className={`px-2 py-0.5 text-[9px] font-mono rounded ${
                    contactData.whatsAppMarketingConsent 
                      ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800' 
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                  }`}>
                    {contactData.whatsAppMarketingConsent ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}
                  </span>
                </div>
                <p className="text-[11px] text-[#888] leading-normal">
                  Instant drop restock alerts, priority reservation passwords, and studio concierge messages.
                </p>
                {contactData.whatsAppConsentUpdatedAt && (
                  <p className="text-[10px] text-[#666] font-mono">
                    Last updated: {new Date(contactData.whatsAppConsentUpdatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setContactData({
                  ...contactData,
                  whatsAppMarketingConsent: !contactData.whatsAppMarketingConsent
                })}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-xs border transition-colors shrink-0 cursor-pointer ${
                  contactData.whatsAppMarketingConsent
                    ? 'bg-red-950/40 text-red-300 border-red-800/60 hover:bg-red-900/60'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                }`}
              >
                {contactData.whatsAppMarketingConsent ? 'Opt Out (Unsubscribe)' : 'Opt In (Subscribe)'}
              </button>
            </div>
          </div>

          {/* SAVE ACTIONS */}
          <div className="pt-4 border-t border-[#1C1C1C] flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={() => {
                setContactData(null);
                setPhoneNumberInput('');
                setSaveSuccessMsg(null);
                setErrorMsg(null);
              }}
              className="text-xs text-[#888] hover:text-white font-mono uppercase cursor-pointer"
            >
              ← Search Different Contact
            </button>

            <button
              onClick={handleUpdate}
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest rounded-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span>Saving Preferences...</span>
              ) : (
                <>
                  <span>Save Updated Preferences</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />
      <main className="flex-1">
        <Suspense fallback={
          <div className="max-w-3xl mx-auto py-20 text-center text-xs font-mono text-[#888]">
            Loading Preference Center...
          </div>
        }>
          <PreferenceCenterContent />
        </Suspense>
      </main>
      <StoreFooter />
    </div>
  );
}
