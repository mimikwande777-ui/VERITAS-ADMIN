import fs from 'fs';
let content = fs.readFileSync('lib/supabase/products.ts', 'utf-8');

content = content.replaceAll(
  "generateSlug(col.name)",
  "col.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')"
);

fs.writeFileSync('lib/supabase/products.ts', content);
console.log('Fixed generateSlug');
