import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    supabaseUrlPresent: Boolean(
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),

    supabaseAnonKeyPresent: Boolean(
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),

    serviceRolePresent: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),

    urlSource:
      process.env.SUPABASE_URL
        ? "SUPABASE_URL"
        : process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "NEXT_PUBLIC_SUPABASE_URL"
        : "MISSING",

    anonKeySource:
      process.env.SUPABASE_ANON_KEY
        ? "SUPABASE_ANON_KEY"
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        : "MISSING",

    vercelEnvironment:
      process.env.VERCEL_ENV || "unknown"
  });
}
