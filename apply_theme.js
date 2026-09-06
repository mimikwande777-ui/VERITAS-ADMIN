const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /bg-white/g, to: 'bg-[#111]' },
  { from: /bg-gray-50/g, to: 'bg-[#151515]' },
  { from: /bg-gray-100/g, to: 'bg-[#1A1A1A]' },
  { from: /bg-gray-200/g, to: 'bg-[#222]' },
  { from: /bg-\[#f5f5f5\]/g, to: 'bg-[#0A0A0A]' },
  
  { from: /text-gray-900/g, to: 'text-white' },
  { from: /text-gray-800/g, to: 'text-gray-200' },
  { from: /text-gray-700/g, to: 'text-gray-300' },
  { from: /text-gray-600/g, to: 'text-[#BBB]' },
  { from: /text-gray-500/g, to: 'text-[#888]' },
  { from: /text-gray-400/g, to: 'text-[#555]' },
  { from: /text-\[#1c1c1c\]/g, to: 'text-white' },
  
  { from: /border-gray-200/g, to: 'border-[#1F1F1F]' },
  { from: /border-gray-100/g, to: 'border-[#1F1F1F]' },
  { from: /border-gray-300/g, to: 'border-[#333]' },
  
  { from: /hover:bg-gray-50/g, to: 'hover:bg-[#1A1A1A]' },
  { from: /hover:bg-gray-200/g, to: 'hover:bg-[#333]' },
  { from: /hover:text-black/g, to: 'hover:text-white' },
  { from: /hover:bg-\[#c5a059\]/g, to: 'hover:bg-[#B3932F]' },
  
  { from: /\[#c5a059\]/g, to: '#D4AF37' },
  
  { from: /bg-black text-white/g, to: 'bg-[#D4AF37] text-[#0A0A0A]' },
  { from: /bg-black/g, to: 'bg-[#1A1A1A]' },
  { from: /accent-black/g, to: 'accent-[#D4AF37]' },
  
  { from: /text-black/g, to: 'text-white' },
  
  { from: /bg-green-100 text-green-800/g, to: 'bg-green-900/30 text-green-400' },
  { from: /bg-amber-100 text-amber-800/g, to: 'bg-amber-900/30 text-amber-400' },
  { from: /bg-red-100 text-red-800/g, to: 'bg-red-900/30 text-red-400' },
  { from: /bg-blue-100 text-blue-800/g, to: 'bg-blue-900/30 text-blue-400' },
  { from: /bg-purple-100 text-purple-800/g, to: 'bg-purple-900/30 text-purple-400' },
  { from: /bg-indigo-100 text-indigo-800/g, to: 'bg-indigo-900/30 text-indigo-400' },
];

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (fullPath.includes('admin/layout.tsx') || fullPath.includes('admin/dashboard/page.tsx') || fullPath.includes('admin-sidebar.tsx')) {
        continue;
      }
      
      for (const r of replacements) {
        content = content.replace(r.from, r.to);
      }
      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir('./app');
