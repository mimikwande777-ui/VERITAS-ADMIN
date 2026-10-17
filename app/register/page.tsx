'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Phone, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Sliders, 
  AlertCircle, 
  Sparkles,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

const DRAFT_STORAGE_KEY = 'veritas_contact_registration_draft_v1';

function getInitialDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function RegisterContactPage() {
  const [phoneNumber, setPhoneNumber] = useState(() => getInitialDraft()?.phoneNumber || '');
  const [countryPrefix, setCountryPrefix] = useState(() => getInitialDraft()?.countryPrefix || '+27');
  const [isWhatsApp, setIsWhatsApp] = useState(() => {
    const draft = getInitialDraft();
    return typeof draft?.isWhatsApp === 'boolean' ? draft.isWhatsApp : true;
  });
  const [email, setEmail] = useState(() => getInitialDraft()?.email || '');
  const [firstName, setFirstName] = useState(() => getInitialDraft()?.firstName || '');
  const [lastName, setLastName] = useState(() => getInitialDraft()?.lastName || '');
  
  // SEPARATE, OPTIONAL, UNCHECKED BY DEFAULT MARKETING CONSENTS
  const [emailMarketingConsent, setEmailMarketingConsent] = useState(() => Boolean(getInitialDraft()?.emailMarketingConsent));
  const [whatsAppMarketingConsent, setWhatsAppMarketingConsent] = useState(() => Boolean(getInitialDraft()?.whatsAppMarketingConsent));

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    preferenceToken: string;
    isExisting: boolean;
    phoneNumber: string;
    email?: string | null;
  } | null>(null);

  // Safely persist form progress on change
  useEffect(() => {
    try {
      const draft = {
        phoneNumber,
        countryPrefix,
        isWhatsApp,
        email,
        firstName,
        lastName,
        emailMarketingConsent,
        whatsAppMarketingConsent
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors
    }
  }, [phoneNumber, countryPrefix, isWhatsApp, email, firstName, lastName, emailMarketingConsent, whatsAppMarketingConsent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Combine prefix if user didn't enter full international number
    let fullPhone = phoneNumber.trim();
    if (!fullPhone.startsWith('+')) {
      if (fullPhone.startsWith('0') && countryPrefix === '+27') {
        fullPhone = '+27' + fullPhone.substring(1);
      } else {
        fullPhone = countryPrefix + fullPhone;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/contacts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          isWhatsApp,
          email: email.trim() || undefined,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          emailMarketingConsent,
          whatsAppMarketingConsent,
          consentSource: 'web_registration'
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to complete registration. Please check your details.');
        setLoading(false);
        return;
      }

      // Clear draft on successful submission
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);

      setSuccessData({
        preferenceToken: data.data.preferenceToken,
        isExisting: data.isExisting,
        phoneNumber: data.data.phoneNumber,
        email: data.data.email
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
        {/* NON-BLOCKING BROWSING OPTION BANNER */}
        <div className="mb-8 p-3.5 bg-[#121212] border border-[#222] rounded-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#888]">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Browsing the storefront is unrestricted and does not require registration.</span>
          </div>
          <Link
            href="/shop"
            className="text-white hover:text-[#D4AF37] font-mono uppercase tracking-wider flex items-center gap-1 shrink-0 font-bold"
          >
            <span>Continue Browsing Storefront</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* HERO TITLE */}
        <div className="border-b border-[#1F1F1F] pb-6 mb-8 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-[#D4AF37] text-[10px] font-mono uppercase tracking-[0.3em] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CLIENT PRIVILEGES & OTC RECORD</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white mt-1">
            Client Contact Registration
          </h1>
          <p className="text-xs sm:text-sm text-[#888] font-mono mt-1">
            VERITAS PRIVATE CLIENT IDENTIFIER • SECURE SOUTH AFRICAN REGISTRY
          </p>
        </div>

        {successData ? (
          /* SUCCESS CONFIRMATION VIEW */
          <div className="p-8 sm:p-12 bg-[#0E0E0E] border border-[#222] rounded-xs text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-600/50 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37] font-bold">
                REGISTRATION CONFIRMED
              </span>
              <h2 className="text-2xl font-bold uppercase tracking-wide text-white">
                {successData.isExisting ? 'Contact Details Updated' : 'Welcome to the VERITAS Registry'}
              </h2>
              <p className="text-xs text-[#888] leading-relaxed">
                Your contact details for <strong className="text-white font-mono">{successData.phoneNumber}</strong> have been securely recorded in our private registry.
              </p>
            </div>

            {/* PREFERENCE MANAGEMENT LINK */}
            <div className="max-w-md mx-auto p-4 bg-[#141414] border border-[#2B2B2B] rounded-xs text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
                  Your Privacy & Preference Center
                </span>
                <Sliders className="w-3.5 h-3.5 text-[#888]" />
              </div>
              <p className="text-[11px] text-[#777] leading-normal">
                You retain complete autonomy. You can view, modify, or withdraw your marketing consents at any time without entering a password.
              </p>
              <Link
                href={`/preferences?token=${successData.preferenceToken}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#D4AF37] hover:underline pt-1"
              >
                <span>Manage Marketing Preferences</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/shop"
                className="w-full sm:w-auto px-8 py-3.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Explore Current Collection</span>
              </Link>
              <button
                onClick={() => setSuccessData(null)}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#161616] hover:bg-[#222] text-white border border-[#333] text-xs font-mono uppercase tracking-wider"
              >
                Register Another Number
              </button>
            </div>
          </div>
        ) : (
          /* REGISTRATION FORM VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: EXPLANATION & PURPOSE (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <Lock className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Why Contact Details Are Collected
                  </h3>
                </div>
                <p className="text-xs text-[#888] leading-relaxed">
                  VERITAS produces limited, high-GSM garments and bespoke OTC (Over-The-Counter) editions in Johannesburg and Cape Town. Registering your contact enables:
                </p>
                <ul className="space-y-2.5 text-xs text-[#AAA]">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                    <span><strong>Order & Delivery Dispatch:</strong> Instant courier dispatch tracking via SMS or WhatsApp for nationwide logistics.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                    <span><strong>Bespoke Sizing Verification:</strong> Direct studio atelier consultation for tailor-fit OTC requests.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                    <span><strong>Security & Fraud Prevention:</strong> Protecting high-value transactions against unauthorized order placement.</span>
                  </li>
                </ul>
              </div>

              <div className="p-5 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] font-bold block">
                  POPIA & PRIVACY TRANSPARENCY
                </span>
                <p className="text-[11px] text-[#777] leading-relaxed">
                  We process personal data in strict compliance with the Protection of Personal Information Act (POPIA) and international standards. Your information is never sold or shared with bulk third-party ad brokers.
                </p>
                <Link
                  href="/preferences"
                  className="text-[11px] font-mono text-[#D4AF37] hover:underline block"
                >
                  Lookup or update existing preferences →
                </Link>
              </div>
            </div>

            {/* RIGHT COLUMN: REGISTRATION FORM (7 cols) */}
            <div className="lg:col-span-7">
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-6">
                {errorMsg && (
                  <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Registration Error</p>
                      <p className="text-[11px] text-red-400 mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {/* NAME FIELDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                      First Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Siyabonga"
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                      Last Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Nkosi"
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* REQUIRED PHONE NUMBER WITH WHATSAPP CONFIRMATION */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
                      Phone Number <span className="text-red-400">* (REQUIRED)</span>
                    </label>
                    <span className="text-[10px] text-[#666] font-mono">E.164 Standard</span>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={countryPrefix}
                      onChange={(e) => setCountryPrefix(e.target.value)}
                      className="bg-[#141414] border border-[#2B2B2B] text-white px-3 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] font-mono shrink-0"
                    >
                      <option value="+27">🇿🇦 +27 (South Africa)</option>
                      <option value="+1">🇺🇸 +1 (USA / Canada)</option>
                      <option value="+44">🇬🇧 +44 (United Kingdom)</option>
                      <option value="+264">🇳🇦 +264 (Namibia)</option>
                      <option value="+267">🇧🇼 +267 (Botswana)</option>
                      <option value="+254">🇰🇪 +254 (Kenya)</option>
                      <option value="+234">🇳🇬 +234 (Nigeria)</option>
                      <option value="+971">🇦🇪 +971 (UAE)</option>
                      <option value="+49">🇩🇪 +49 (Germany)</option>
                      <option value="+33">🇫🇷 +33 (France)</option>
                    </select>

                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 082 123 4567"
                      className="flex-1 bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-[#666] font-mono">
                    Local South African format (082...) or international standard (+27...) are both accepted.
                  </p>

                  {/* WHATSAPP ACTIVE CONFIRMATION */}
                  <div className="p-3 bg-[#121212] border border-[#242424] rounded-xs flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">WhatsApp Availability</span>
                      <span className="text-[10px] text-[#888] block">Does this phone number have an active WhatsApp account?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isWhatsApp}
                        onChange={(e) => setIsWhatsApp(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#262626] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>

                {/* OPTIONAL EMAIL ADDRESS */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888]">
                      Email Address <span className="text-[#666]">(OPTIONAL)</span>
                    </label>
                    <span className="text-[10px] text-[#666] font-mono">For digital invoices & dispatch</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@domain.co.za"
                    className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                  />
                </div>

                {/* CRITICAL: SEPARATE, OPTIONAL, UNCHECKED MARKETING CONSENTS */}
                <div className="border-t border-[#1F1F1F] pt-5 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                      <span>Marketing Preferences</span>
                      <span className="text-[10px] font-mono text-[#D4AF37] font-normal">(STRICT OPT-IN)</span>
                    </div>
                    <p className="text-[11px] text-[#777] leading-relaxed">
                      Registration or providing your phone number <strong>does NOT constitute consent</strong> to receive promotional marketing. Choose channels you wish to join below:
                    </p>
                  </div>

                  {/* CHANNEL 1: EMAIL MARKETING CONSENT (UNCHECKED BY DEFAULT) */}
                  <label className="flex items-start gap-3 p-3.5 bg-[#121212] border border-[#262626] rounded-xs cursor-pointer hover:border-[#383838] transition-colors">
                    <input
                      type="checkbox"
                      checked={emailMarketingConsent}
                      onChange={(e) => setEmailMarketingConsent(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-[#D4AF37] focus:ring-0 focus:ring-offset-0 bg-[#1A1A1A] cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">
                        Email Marketing Consent
                      </span>
                      <span className="text-[11px] text-[#888] block leading-normal">
                        Receive private lookbooks, archive collection release invitations, and editorial newsletters via email. (Requires email address).
                      </span>
                    </div>
                  </label>

                  {/* CHANNEL 2: WHATSAPP MARKETING CONSENT (UNCHECKED BY DEFAULT) */}
                  <label className="flex items-start gap-3 p-3.5 bg-[#121212] border border-[#262626] rounded-xs cursor-pointer hover:border-[#383838] transition-colors">
                    <input
                      type="checkbox"
                      checked={whatsAppMarketingConsent}
                      onChange={(e) => setWhatsAppMarketingConsent(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-[#D4AF37] focus:ring-0 focus:ring-offset-0 bg-[#1A1A1A] cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">
                        WhatsApp Marketing Consent
                      </span>
                      <span className="text-[11px] text-[#888] block leading-normal">
                        Receive priority WhatsApp alerts for limited drop restocks, OTC waitlist announcements, and VIP early access passwords.
                      </span>
                    </div>
                  </label>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-[0.2em] rounded-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span>Registering Contact...</span>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-[#666] text-center font-mono">
                  By submitting, your details will be safely stored in the VERITAS customer database. You can adjust your channel preferences at any time.
                </p>
              </form>
            </div>
          </div>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
