'use client';

import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, CheckCircle2, Copy, Check, ChevronDown, ChevronUp, RefreshCw, Server } from 'lucide-react';
import { isSupabaseConfigured, testSupabaseConnection } from '@/lib/supabase/config';

export function SupabaseStatusBanner() {
  const [configured, setConfigured] = useState(isSupabaseConfigured());
  const [connectionState, setConnectionState] = useState<'testing' | 'success' | 'failed'>('testing');
  const [statusMessage, setStatusMessage] = useState<string>('Testing Supabase connection...');
  const [productCount, setProductCount] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkConnection() {
      const isConfig = isSupabaseConfigured();
      setConfigured(isConfig);

      if (!isConfig) {
        if (isMounted) {
          setConnectionState('failed');
          setStatusMessage('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables missing.');
        }
        return;
      }

      const res = await testSupabaseConnection();
      if (!isMounted) return;

      if (res.success) {
        setConnectionState('success');
        setStatusMessage(res.message);
        if (res.details?.productCount !== undefined) {
          setProductCount(res.details.productCount);
        }
      } else {
        setConnectionState('failed');
        setStatusMessage(res.message);
      }
    }

    checkConnection();

    return () => {
      isMounted = false;
    };
  }, []);

  const runConnectionTest = async () => {
    setConnectionState('testing');
    setStatusMessage('Pinging Supabase database...');
    
    const isConfig = isSupabaseConfigured();
    setConfigured(isConfig);

    if (!isConfig) {
      setConnectionState('failed');
      setStatusMessage('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables missing.');
      return;
    }

    const res = await testSupabaseConnection();
    if (res.success) {
      setConnectionState('success');
      setStatusMessage(res.message);
      if (res.details?.productCount !== undefined) {
        setProductCount(res.details.productCount);
      }
    } else {
      setConnectionState('failed');
      setStatusMessage(res.message);
    }
  };

  const copySql = () => {
    const sqlCode = `-- SQL Migration command for Supabase:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(10,2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft',
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);`;
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If Supabase connection is SUCCESSFUL, automatically remove the warning notice and show green connection bar
  if (connectionState === 'success') {
    return (
      <div className="bg-[#0B120E] border-b border-emerald-500/20 px-4 py-2 text-xs text-emerald-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-mono uppercase tracking-wider text-[11px] font-bold text-emerald-300">
            CONNECTED TO VERITAS SUPABASE
          </span>
          {productCount !== null && (
            <span className="hidden sm:inline bg-emerald-950/80 border border-emerald-800/40 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-mono">
              {productCount} {productCount === 1 ? 'Product' : 'Products'} in DB
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-zinc-400">
          <span className="hidden md:inline text-zinc-500">URL: https://cdzvmnixlhjjrpyoaemg.supabase.co</span>
          <button
            onClick={runConnectionTest}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#16221B] hover:bg-[#1E3025] text-emerald-300 border border-emerald-800/40 transition-colors"
            title="Re-test database connection"
          >
            <RefreshCw className="w-3 h-3 text-emerald-400" />
            <span>Test Connection</span>
          </button>
        </div>
      </div>
    );
  }

  // If variables are configured and initial ping is testing, do not show false missing warning
  if (configured && connectionState === 'testing') {
    return null;
  }

  // Unconfigured or failed notice
  return (
    <div className="bg-[#161616] border-b border-amber-500/30 px-4 py-3 text-xs text-zinc-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-amber-300 uppercase tracking-wider text-[11px]">
                {configured ? 'Database Sync Notice' : 'Database Configuration Notice'}
              </span>
              <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-amber-500/20">
                {configured ? 'Sync Notice' : 'Configuration Required'}
              </span>
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">
              {!configured ? (
                <>
                  <code className="text-amber-200 bg-[#222] px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-amber-200 bg-[#222] px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> must be set in platform environment variables.
                </>
              ) : (
                <>Supabase credentials configured. Verifying connection status with project.</>
              )}
            </p>
            {statusMessage && (
              <p className="text-amber-400/90 text-[11px] font-mono mt-1">
                Status: {statusMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end md:self-auto">
          <button
            onClick={runConnectionTest}
            disabled={connectionState === 'testing'}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#222] hover:bg-[#2b2b2b] text-zinc-300 border border-[#333] transition-colors font-mono text-[11px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${connectionState === 'testing' ? 'animate-spin' : ''}`} />
            <span>{connectionState === 'testing' ? 'Testing...' : 'Test Connection'}</span>
          </button>

          {!configured && (
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#222] hover:bg-[#2b2b2b] text-zinc-300 border border-[#333] transition-colors font-mono text-[11px]"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Setup Instructions</span>
              {showGuide ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </button>
          )}
        </div>
      </div>

      {!configured && showGuide && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-[#262626] space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <h4 className="font-semibold text-zinc-200 text-xs flex items-center space-x-1.5">
                <span>1. Add Environment Variables in Settings</span>
              </h4>
              <p className="text-zinc-400 text-[11px]">
                In AI Studio platform settings, declare your Supabase credentials:
              </p>
              <pre className="bg-[#0c0c0c] border border-[#222] p-2 rounded text-[10px] font-mono text-amber-300/90 overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://cdzvmnixlhjjrpyoaemg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here`}
              </pre>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-zinc-200 text-xs">2. Database Target Tables</h4>
                <button
                  onClick={copySql}
                  className="flex items-center space-x-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-mono"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>
              <p className="text-zinc-400 text-[11px]">
                Tables connected: <code className="text-zinc-200 font-mono">products</code>, <code className="text-zinc-200 font-mono">product_variants</code>, <code className="text-zinc-200 font-mono">product_media</code>, <code className="text-zinc-200 font-mono">categories</code>, <code className="text-zinc-200 font-mono">collections</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

