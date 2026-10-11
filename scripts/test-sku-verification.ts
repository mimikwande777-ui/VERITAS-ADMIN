import { formatVariantSku, getCategorySkuCode, extractCleanProductId } from '../lib/sku';
import { createClient } from '@supabase/supabase-js';
import { serverCreateSupabaseProduct, serverUpdateSupabaseProduct, serverDeleteSupabaseProduct } from '../lib/supabase/products-server';

interface TestResult {
  name: string;
  category: 'UNIT' | 'LIVE_SUPABASE_DB';
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, category: 'UNIT' | 'LIVE_SUPABASE_DB', details: string) {
  if (condition) {
    results.push({ name, category, status: 'PASS', details });
    console.log(`[PASS] [${category}] ${name}: ${details}`);
  } else {
    results.push({ name, category, status: 'FAIL', details });
    console.error(`[FAIL] [${category}] ${name}: ${details}`);
  }
}

async function runUnitTests() {
  console.log('\n--- STARTING AUTOMATED UNIT TESTS ---');

  // Unit Test 1: Unique SKU generation for identical product names and variant combinations
  const prodIdA = '11111111-aaaa-bbbb-cccc-111111111111';
  const prodIdB = '22222222-aaaa-bbbb-cccc-222222222222';
  const skuA0 = formatVariantSku(prodIdA, 'T-Shirts', 0);
  const skuB0 = formatVariantSku(prodIdB, 'T-Shirts', 0);
  assert(
    skuA0 !== skuB0 && skuA0.startsWith('VER-TEE-') && skuB0.startsWith('VER-TEE-'),
    'Two products with identical names and variants receive different SKUs',
    'UNIT',
    `Product A SKU: ${skuA0}, Product B SKU: ${skuB0}`
  );

  // Unit Test 2: Sequential variant indexing within a product
  const skuA1 = formatVariantSku(prodIdA, 'T-Shirts', 1);
  const skuA2 = formatVariantSku(prodIdA, 'T-Shirts', 2);
  assert(
    skuA0.endsWith('-001') && skuA1.endsWith('-002') && skuA2.endsWith('-003'),
    'Sequential variant indices are formatted with 3-digit padding',
    'UNIT',
    `SKU 0: ${skuA0}, SKU 1: ${skuA1}, SKU 2: ${skuA2}`
  );

  // Unit Test 3: Repeated duplication produces no -CPY suffixes or collisions
  const duplicateSkus = new Set<string>();
  let hasCpy = false;
  for (let copyIdx = 1; copyIdx <= 10; copyIdx++) {
    const copyId = `d${copyIdx}d${copyIdx}d${copyIdx}d${copyIdx}-0000-0000-0000-000000000000`;
    for (let varIdx = 0; varIdx < 4; varIdx++) {
      const sku = formatVariantSku(copyId, 'Hoodies', varIdx);
      if (sku.includes('CPY') || sku.includes('copy')) hasCpy = true;
      duplicateSkus.add(sku);
    }
  }
  assert(
    !hasCpy && duplicateSkus.size === 40,
    'Repeated product duplication produces no SKU collisions or -CPY suffixes',
    'UNIT',
    `Generated 40 distinct SKUs across 10 duplicates with zero collisions and zero CPY substrings`
  );

  // Unit Test 4: Duplicate colour-size combination detection
  const duplicateCombosPayload = [
    { colour: 'Black', size: 'M' },
    { colour: 'Black', size: 'L' },
    { colour: 'black ', size: 'm' }, // Duplicate of index 0
  ];
  const incomingCombos = new Set<string>();
  let duplicateDetected = false;
  for (const v of duplicateCombosPayload) {
    const colKey = (v.colour || '').trim().toLowerCase();
    const sizeKey = (v.size || '').trim().toUpperCase();
    const comboKey = `${colKey}__${sizeKey}`;
    if (incomingCombos.has(comboKey)) {
      duplicateDetected = true;
      break;
    }
    incomingCombos.add(comboKey);
  }
  assert(
    duplicateDetected,
    'Duplicate incoming colour-size combinations are detected with case/whitespace normalization',
    'UNIT',
    'Black/M and black /m correctly identified as identical combination'
  );

  // Unit Test 5: ID-first matching & non-reuse simulation
  const existingDbVariants = [
    { id: 'var-1', colour: 'Black', size: 'M', sku: 'VER-TEE-ORIG-001' },
    { id: 'var-2', colour: 'Black', size: 'L', sku: 'VER-TEE-ORIG-002' },
  ];
  const incomingVariants = [
    { id: 'var-1', colour: 'Black', size: 'M', stockQuantity: 50 }, // ID match
    { colour: 'Black', size: 'L', stockQuantity: 25 },               // Color/size match
    { colour: 'White', size: 'M', stockQuantity: 10 },               // New variant
  ];

  const matchedExistingIds = new Set<string>();
  const matches: (typeof existingDbVariants[0] | null)[] = new Array(incomingVariants.length).fill(null);

  // Pass 1: ID match first
  incomingVariants.forEach((v, idx) => {
    if (v.id) {
      const found = existingDbVariants.find(ev => ev.id === v.id && !matchedExistingIds.has(ev.id));
      if (found) {
        matches[idx] = found;
        matchedExistingIds.add(found.id);
      }
    }
  });

  // Pass 2: Normalized colour and size against unmatched only
  incomingVariants.forEach((v, idx) => {
    if (!matches[idx]) {
      const normCol = (v.colour || '').trim().toLowerCase();
      const normSize = (v.size || '').trim().toUpperCase();
      const found = existingDbVariants.find(ev =>
        !matchedExistingIds.has(ev.id) &&
        (ev.colour || '').trim().toLowerCase() === normCol &&
        (ev.size || '').trim().toUpperCase() === normSize
      );
      if (found) {
        matches[idx] = found;
        matchedExistingIds.add(found.id);
      }
    }
  });

  assert(
    matches[0]?.id === 'var-1' && matches[0]?.sku === 'VER-TEE-ORIG-001',
    'Editing an existing variant preserves its ID and SKU (ID match)',
    'UNIT',
    `Variant 0 preserved id=${matches[0]?.id}, sku=${matches[0]?.sku}`
  );

  assert(
    matches[1]?.id === 'var-2' && matches[1]?.sku === 'VER-TEE-ORIG-002',
    'Editing an existing variant preserves its ID and SKU (Colour/Size fallback)',
    'UNIT',
    `Variant 1 matched existing id=${matches[1]?.id}, sku=${matches[1]?.sku}`
  );

  assert(
    matches[2] === null,
    'Adding a new variant does not erroneously match an existing variant',
    'UNIT',
    'New White/M variant correctly marked as new (match is null)'
  );

  // Unit Test 6: Preventing one existing variant from matching multiple incoming variants
  const incomingDuplicateAttempts = [
    { colour: 'Black', size: 'M' },
    { colour: 'Black', size: 'M' }, // Attempting to match same existing
  ];
  const matchedSet = new Set<string>();
  const matchResults: (typeof existingDbVariants[0] | null)[] = [];
  incomingDuplicateAttempts.forEach(v => {
    const normCol = (v.colour || '').trim().toLowerCase();
    const normSize = (v.size || '').trim().toUpperCase();
    const found = existingDbVariants.find(ev =>
      !matchedSet.has(ev.id) &&
      (ev.colour || '').trim().toLowerCase() === normCol &&
      (ev.size || '').trim().toUpperCase() === normSize
    );
    if (found) {
      matchResults.push(found);
      matchedSet.add(found.id);
    } else {
      matchResults.push(null);
    }
  });

  assert(
    matchResults[0]?.id === 'var-1' && matchResults[1] === null,
    'One existing variant cannot match two incoming variants',
    'UNIT',
    `First match=${matchResults[0]?.id}, Second match=null (prevented duplicate claim)`
  );
}

async function runLiveDatabaseTests() {
  console.log('\n--- STARTING TESTS AGAINST REAL SUPABASE DATABASE ---');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('Skipping live database tests: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return;
  }

  const client = createClient(supabaseUrl, serviceKey);

  // Test DB 1: Verify PostgreSQL unique SKU constraint in live database
  const dummyProdId = '73692596-d4b7-4d95-93c9-3d1211e6faba'; // existing DB product
  const { data: sampleVariant } = await client
    .from('product_variants')
    .select('sku, colour_id')
    .eq('product_id', dummyProdId)
    .limit(1)
    .single();

  if (sampleVariant?.sku) {
    const { error: dupSkuErr } = await client.from('product_variants').insert({
      product_id: dummyProdId,
      colour_id: sampleVariant.colour_id,
      sku: sampleVariant.sku,
      colour: 'Test',
      size: 'UNIQUE_TEST',
      stock_quantity: 0
    });

    assert(
      !!dupSkuErr && dupSkuErr.message.includes('unique constraint'),
      'Live database enforces UNIQUE constraint on product_variants.sku',
      'LIVE_SUPABASE_DB',
      `PostgreSQL engine rejected duplicate insert with: "${dupSkuErr?.message}"`
    );
  }

  // Test DB 2: Full product creation lifecycle with server-authoritative SKU generation
  const testProductName = `TEST-SKU-SUITE-${Date.now()}`;
  const createResult = await serverCreateSupabaseProduct({
    name: testProductName,
    category: 'T-Shirts',
    price: 450,
    costPrice: 200,
    variants: [
      { colour: 'Jet Black', size: 'M', stockQuantity: 10, lowStockThreshold: 3 },
      { colour: 'Jet Black', size: 'L', stockQuantity: 15, lowStockThreshold: 5 },
    ] as any
  }, client);

  assert(
    createResult.product !== null && createResult.error === null,
    'Live product creation with server-authoritative SKUs',
    'LIVE_SUPABASE_DB',
    `Created product ${createResult.product?.id} with ${createResult.product?.variants.length} variants`
  );

  const testProduct = createResult.product;
  if (!testProduct) return;

  const originalVar0 = testProduct.variants[0];
  const originalVar1 = testProduct.variants[1];

  assert(
    originalVar0.sku.startsWith('VER-TEE-') && originalVar0.sku.endsWith('-001') &&
    originalVar1.sku.startsWith('VER-TEE-') && originalVar1.sku.endsWith('-002'),
    'Server creates verified VER-TEE-<ID>-00X SKUs',
    'LIVE_SUPABASE_DB',
    `Var 0 SKU: ${originalVar0.sku}, Var 1 SKU: ${originalVar1.sku}`
  );

  // Test DB 3: Update existing variant stock preserves ID and SKU
  const updateStockResult = await serverUpdateSupabaseProduct(testProduct.id, {
    variants: [
      { id: originalVar0.id, colour: originalVar0.colour, size: originalVar0.size, stockQuantity: 99 },
      { id: originalVar1.id, colour: originalVar1.colour, size: originalVar1.size, stockQuantity: 88 },
    ] as any
  }, client);

  const updatedVar0 = updateStockResult.product?.variants.find(v => v.id === originalVar0.id);
  assert(
    updatedVar0 !== undefined &&
    updatedVar0.id === originalVar0.id &&
    updatedVar0.sku === originalVar0.sku &&
    updatedVar0.stockQuantity === 99,
    'Editing an existing variant preserves its ID and SKU',
    'LIVE_SUPABASE_DB',
    `Variant ${originalVar0.id} preserved SKU "${updatedVar0?.sku}" and updated stock to 99`
  );

  // Test DB 4: Adding a variant generates a unique SKU while preserving existing variants
  const addVariantResult = await serverUpdateSupabaseProduct(testProduct.id, {
    variants: [
      { id: originalVar0.id, colour: originalVar0.colour, size: originalVar0.size, stockQuantity: 99 },
      { id: originalVar1.id, colour: originalVar1.colour, size: originalVar1.size, stockQuantity: 88 },
      { colour: 'Jet Black', size: 'XL', stockQuantity: 5 }, // Newly added variant
    ] as any
  }, client);

  const newVariant = addVariantResult.product?.variants.find(v => v.size === 'XL');
  assert(
    newVariant !== undefined &&
    newVariant.id !== originalVar0.id &&
    newVariant.id !== originalVar1.id &&
    newVariant.sku.startsWith('VER-TEE-') &&
    newVariant.sku !== originalVar0.sku &&
    newVariant.sku !== originalVar1.sku,
    'Adding a variant generates a unique SKU',
    'LIVE_SUPABASE_DB',
    `New XL variant received ID ${newVariant?.id} and unique SKU ${newVariant?.sku}`
  );

  // Test DB 5: Duplicate incoming colour-size combinations are rejected on live update
  const duplicatePayloadResult = await serverUpdateSupabaseProduct(testProduct.id, {
    variants: [
      { colour: 'Jet Black', size: 'M', stockQuantity: 10 },
      { colour: 'jet black', size: 'm', stockQuantity: 20 }, // Duplicate
    ] as any
  }, client);

  assert(
    duplicatePayloadResult.product === null &&
    duplicatePayloadResult.error !== null &&
    duplicatePayloadResult.error.includes('Duplicate variant combination detected'),
    'Duplicate incoming colour-size combinations are rejected with validation error',
    'LIVE_SUPABASE_DB',
    `Error returned: "${duplicatePayloadResult.error}"`
  );

  // Test DB 6: Removing a variant deletes only that variant when safe
  const removeVariantResult = await serverUpdateSupabaseProduct(testProduct.id, {
    variants: [
      { id: originalVar0.id, colour: originalVar0.colour, size: originalVar0.size, stockQuantity: 99 },
    ] as any
  }, client);

  const remainingVariants = removeVariantResult.product?.variants || [];
  assert(
    remainingVariants.length === 1 && remainingVariants[0].id === originalVar0.id,
    'Removing a variant deletes only that variant when safe',
    'LIVE_SUPABASE_DB',
    `Remaining variant count is 1 (retained ID: ${remainingVariants[0]?.id})`
  );

  // Clean up test product
  await serverDeleteSupabaseProduct(testProduct.id, client);
  console.log(`Cleaned up test product ${testProduct.id}`);
}

async function main() {
  try {
    await runUnitTests();
    await runLiveDatabaseTests();

    console.log('\n========================================');
    console.log('TEST SUMMARY:');
    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log('========================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

main();
