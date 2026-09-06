'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, Send, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'Order & Sizing Inquiry',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col selection:bg-[#D4AF37] selection:text-black">
      <StoreHeader />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="border-b border-[#1F1F1F] pb-8 mb-10 text-center sm:text-left">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] font-bold">
            CLIENT CONCIERGE & OTC SERVICES
          </span>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white mt-1">
            Get in Touch
          </h1>
          <p className="text-xs sm:text-sm text-[#888] font-mono mt-1">
            VIP ORDER SUPPORT • SIZING INQUIRIES • BESPOKE OTC PRODUCTION
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT: CONTACT CARDS (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-2">
              <div className="w-8 h-8 rounded bg-[#161616] text-[#D4AF37] flex items-center justify-center mb-3">
                <Mail className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Client Concierge</h3>
              <p className="text-xs text-[#888]">Direct response within 2 hours during studio operations.</p>
              <a href="mailto:concierge@veritas-official.com" className="text-xs font-mono text-[#D4AF37] hover:underline block pt-1">
                concierge@veritas-official.com
              </a>
            </div>

            <div className="p-6 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-2">
              <div className="w-8 h-8 rounded bg-[#161616] text-[#D4AF37] flex items-center justify-center mb-3">
                <Phone className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">WhatsApp & Direct Line</h3>
              <p className="text-xs text-[#888]">Mon – Fri: 08:30 – 17:30 (SAST / GMT+2)</p>
              <span className="text-xs font-mono text-white font-bold block pt-1">
                +27 (0) 11 884 9200
              </span>
            </div>

            <div className="p-6 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-2">
              <div className="w-8 h-8 rounded bg-[#161616] text-[#D4AF37] flex items-center justify-center mb-3">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Johannesburg Atelier</h3>
              <p className="text-xs text-[#888]">
                Sandton Design District, Johannesburg, 2196, South Africa.
              </p>
            </div>
          </div>

          {/* RIGHT: INQUIRY FORM (7 cols on lg) */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 bg-[#0E0E0E] border border-[#1F1F1F] rounded-xs space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white border-b border-[#1A1A1A] pb-3">
                Send Concierge Message
              </h2>

              {submitted ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-950/50 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold uppercase text-white tracking-wider">Message Received</h4>
                  <p className="text-xs text-[#888] font-mono max-w-sm mx-auto">
                    Our concierge team has received your message and will respond to your email promptly.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', subject: 'Order & Sizing Inquiry', message: '' });
                    }}
                    className="mt-4 px-4 py-2 bg-[#1A1A1A] text-white text-xs font-mono uppercase hover:bg-[#222]"
                  >
                    Send Another Note
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Siyabonga Nkosi"
                        className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="client@domain.co.za"
                        className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                      Subject
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] font-mono"
                    >
                      <option value="Order & Sizing Inquiry">Order & Sizing Inquiry</option>
                      <option value="Nationwide Courier Tracking">Nationwide Courier Tracking</option>
                      <option value="Bespoke OTC Production">Bespoke OTC Production</option>
                      <option value="Press & VIP Lookbook">Press & VIP Lookbook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-[#888] mb-1">
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="How can our concierge assist your VERITAS experience today?"
                      className="w-full bg-[#141414] border border-[#2B2B2B] text-white px-3.5 py-3 text-xs rounded-xs focus:outline-hidden focus:border-[#D4AF37] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#B3932F] text-black font-bold uppercase text-xs tracking-widest rounded-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
