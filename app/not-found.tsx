import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 bg-white flex items-center justify-center rounded-xs shadow mb-6">
        <div className="w-5 h-5 bg-black rotate-45"></div>
      </div>
      <h1 className="text-4xl font-bold tracking-widest text-white mb-2">404</h1>
      <p className="text-sm font-mono text-[#888] tracking-widest uppercase mb-8">Page Not Found</p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-2.5 bg-white text-black text-xs font-mono tracking-wider uppercase font-bold hover:bg-[#E0E0E0] transition-colors"
        >
          Return Home
        </Link>
        <Link
          href="/admin/dashboard"
          className="px-6 py-2.5 bg-[#161616] text-[#CCC] border border-[#333] text-xs font-mono tracking-wider uppercase hover:border-[#D4AF37] hover:text-white transition-colors"
        >
          Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
