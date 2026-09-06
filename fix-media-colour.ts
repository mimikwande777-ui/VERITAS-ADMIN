import fs from 'fs';
let content = fs.readFileSync('lib/supabase/products.ts', 'utf-8');

// Replace in createSupabaseProduct
content = content.replace(
  "colour_id: m.colourId || undefined,",
  "colour_id: m.colourId || (m.colourName ? colourMap[m.colourName] : undefined),"
);

// Replace in updateSupabaseProduct
content = content.replace(
  "let mColourId = m.colourId || undefined;",
  "let mColourId = m.colourId || (m.colourName ? colourMap[m.colourName] : undefined);"
);

fs.writeFileSync('lib/supabase/products.ts', content);
console.log('Fixed media colour ID lookup');
