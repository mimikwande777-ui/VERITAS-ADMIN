'use client';

import { useState } from 'react';
import { TicketPercent, Plus, AlertCircle, Info, Lock } from 'lucide-react';
import { formatZAR } from '@/lib/utils';

export default function DiscountsPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-6 pb-20">
      {/* HONESTY STATUS BANNER */}
      <div className="bg-[#141414] border border-[#2B2B2B] p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs font-mono">
          <div className="font-bold text-white uppercase tracking-wider">
            FEATURE STATUS: PROMOTION & DISCOUNT CODES ENGINE — NOT YET PROVISIONED
          </div>
          <p className="text-[#888] leading-relaxed">
            The connected Supabase database currently does not include a <code className="text-[#D4AF37]">discounts</code> or <code className="text-[#D4AF37]">coupons</code> schema table. To adhere to the VERITAS Real Data & Honesty Policy, mock discount entries have been removed. When promotional voucher tables are migrated, real discount codes and usage redemptions will appear here.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white">Discounts & Promotions</h1>
          <p className="text-xs text-[#888] font-mono mt-1">
            CAMPAIGN PROMO CODES, VOUCHERS & BASKET REDUCTIONS
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-[#222] text-[#888] hover:text-white border border-[#333] text-xs font-bold uppercase tracking-wider transition-colors"
        >
          <Lock className="w-3.5 h-3.5 mr-2 text-amber-400" />
          Create Discount Code (Inactive)
        </button>
      </div>

      {/* MODAL EXPLAINING DATABASE PREREQUISITE */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#2B2B2B] max-w-md w-full p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase">
              <Info className="w-4 h-4" />
              <span>Database Table Required</span>
            </div>
            <p className="text-[#BBB] leading-relaxed">
              To activate promotional discount codes, create a <code className="text-white bg-[#1A1A1A] px-1 py-0.5 rounded">discounts</code> table in Supabase with fields for code, discount type (percentage/fixed), value, expiration date, and redemption limits.
            </p>
            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#D4AF37] text-[#0A0A0A] font-bold uppercase hover:bg-[#B3932F]"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#111] border border-[#1F1F1F] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="text-xs text-[#888] uppercase bg-[#151515] tracking-wider border-b border-[#1F1F1F]">
              <tr>
                <th className="px-6 py-4 font-bold">Code</th>
                <th className="px-6 py-4 font-bold">Type</th>
                <th className="px-6 py-4 font-bold text-right">Value</th>
                <th className="px-6 py-4 font-bold text-right">Redemptions</th>
                <th className="px-6 py-4 font-bold">Expiration</th>
                <th className="px-6 py-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded bg-[#1A1A1A] border border-[#262626] flex items-center justify-center mx-auto text-[#666]">
                      <TicketPercent className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">NO DISCOUNT CODES ACTIVE</h3>
                    <p className="text-xs text-[#777] font-mono">
                      No discount codes are active or configured in the database.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

