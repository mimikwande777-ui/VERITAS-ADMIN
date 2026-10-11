import { createClient } from '@supabase/supabase-js';
import { serverCreateSupabaseProduct, serverUpdateSupabaseProduct, serverFetchSupabaseProductById, serverDeleteSupabaseProduct } from '../lib/supabase/products-server';
import { ProductItem } from '../lib/mock-data';

const url = process.env.SUPABASE_URL || 'https://cdzvmnixlhjjrpyoaemg.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not configured. Exiting.');
  process.exit(1);
}

const client = createClient(url, key);

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRegressionSuite() {
  console.log('====================================================');
  console.log('VERITAS ADMIN — PRODUCT MEDIA IDEMPOTENCY REGRESSION SUITE');
  console.log('====================================================\n');

  let testProductId: string | null = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Database constraint inspection
    // ----------------------------------------------------
    console.log('--- TEST 1: Confirm product_media_one_primary_per_product unique constraint ---');
    const dummyId = '00000000-0000-0000-0000-000000000001';
    
    // Test duplicate primary insert failure
    const batchWithTwoPrimaries = [
      { product_id: dummyId, storage_path: 'p1.jpg', is_primary: true, media_type: 'front' },
      { product_id: dummyId, storage_path: 'p2.jpg', is_primary: true, media_type: 'detail' }
    ];
    const { error: dupErr } = await client.from('product_media').insert(batchWithTwoPrimaries);
    assert(
      dupErr !== null && (dupErr.code === '23505' || dupErr.message.includes('product_media_one_primary_per_product') || dupErr.code === '23503'),
      'Database rejects multiple primary media records for the same product via constraint'
    );

    // ----------------------------------------------------
    // TEST 2: Create a product as DRAFT with multiple media
    // (Simulates multi-colour form state where multiple images have isPrimary: true)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Create product draft with multi-colour media ---');
    const draftPayload: Partial<ProductItem> = {
      name: `Media Regression Product ${Date.now()}`,
      slug: `media-reg-${Date.now()}`,
      description: 'Regression testing for product media idempotency and uniqueness.',
      price: 650,
      costPrice: 220,
      category: 'T-Shirts',
      collection: 'Core',
      status: 'DRAFT',
      published: false,
      colours: [
        { name: 'Pitch Black', code: '#000000' },
        { name: 'Chalk White', code: '#FFFFFF' }
      ],
      variants: [
        { colour: 'Pitch Black', size: 'M', stockQuantity: 20, lowStockThreshold: 5 },
        { colour: 'Pitch Black', size: 'L', stockQuantity: 15, lowStockThreshold: 5 },
        { colour: 'Chalk White', size: 'M', stockQuantity: 10, lowStockThreshold: 5 }
      ] as any,
      images: [
        {
          url: 'products/test/pitch_black_front.jpg',
          role: 'main' as any,
          isPrimary: true, // Primary for Pitch Black
          alt: 'Pitch Black Front',
          colourName: 'Pitch Black'
        },
        {
          url: 'products/test/pitch_black_back.jpg',
          role: 'gallery' as any,
          isPrimary: false,
          alt: 'Pitch Black Back',
          colourName: 'Pitch Black'
        },
        {
          url: 'products/test/chalk_white_front.jpg',
          role: 'main' as any,
          isPrimary: true, // Primary for Chalk White in multi-colour form state!
          alt: 'Chalk White Front',
          colourName: 'Chalk White'
        }
      ] as any
    };

    const createRes = await serverCreateSupabaseProduct(draftPayload, client);
    assert(createRes.error === null, `Draft created successfully without media error: ${createRes.error}`);
    assert(createRes.product !== null && !!createRes.product.id, 'Draft product returned with valid ID');

    testProductId = createRes.product!.id;
    console.log(`Created draft product: ${testProductId}`);

    // Verify media in database
    const { data: dbMediaAfterCreate, error: fetchMedia1Err } = await client
      .from('product_media')
      .select('*')
      .eq('product_id', testProductId)
      .order('sort_order', { ascending: true });

    assert(!fetchMedia1Err && dbMediaAfterCreate !== null, 'Fetched database media records after draft creation');
    assert(dbMediaAfterCreate!.length === 3, `Expected 3 media records in database, got ${dbMediaAfterCreate!.length}`);

    const primaryRecords = dbMediaAfterCreate!.filter(m => m.is_primary === true);
    assert(primaryRecords.length === 1, `Exactly ONE media record has is_primary=true in database (found: ${primaryRecords.length})`);
    assert(primaryRecords[0].sort_order === 0, 'First primary image is designated as the authoritative primary media');

    const draftMediaIds = dbMediaAfterCreate!.map(m => m.id);
    console.log('Original draft media IDs:', draftMediaIds);

    // ----------------------------------------------------
    // TEST 3: Publish the Draft to Store
    // (This was the EXACT step that threw "Failed to save product media: Validation Error: A record with duplicate unique fields already exists.")
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Publish Draft to Store (Idempotent Update) ---');
    const publishPayload: Partial<ProductItem> = {
      name: draftPayload.name,
      slug: draftPayload.slug,
      status: 'ACTIVE',
      published: true,
      price: 650,
      colours: draftPayload.colours,
      variants: createRes.product!.variants,
      images: dbMediaAfterCreate!.map((m, idx) => ({
        id: m.id,
        url: m.storage_path,
        role: m.media_type as any,
        isPrimary: idx === 0,
        alt: m.alt_text
      }))
    };

    const publishRes = await serverUpdateSupabaseProduct(testProductId, publishPayload, client);
    assert(publishRes.error === null, `Publish to store succeeded without error: ${publishRes.error}`);
    assert(publishRes.product !== null, 'Published product returned from serverUpdateSupabaseProduct');
    assert(publishRes.product?.status === 'ACTIVE', 'Product status is now ACTIVE');
    assert(publishRes.product?.published === true, 'Product published is now true');

    // Verify media in database after publishing
    const { data: dbMediaAfterPublish } = await client
      .from('product_media')
      .select('*')
      .eq('product_id', testProductId)
      .order('sort_order', { ascending: true });

    assert(dbMediaAfterPublish!.length === 3, `Media record count is still 3 (no duplicate records created)`);
    const publishedMediaIds = dbMediaAfterPublish!.map(m => m.id);
    console.log('Media IDs after publish:', publishedMediaIds);

    const idsPreserved = draftMediaIds.every((id, idx) => id === publishedMediaIds[idx]);
    assert(idsPreserved, 'Existing media IDs were preserved and reused (not deleted and recreated)');

    const publishPrimaries = dbMediaAfterPublish!.filter(m => m.is_primary === true);
    assert(publishPrimaries.length === 1, `Exactly ONE primary media record exists after publish`);

    // ----------------------------------------------------
    // TEST 4: Retry Publication Immediately (Idempotency Test)
    // (Simulates user clicking "Publish to Store" again or automated retry)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Immediate Retry of Publication (Idempotency) ---');
    const retryRes = await serverUpdateSupabaseProduct(testProductId, publishPayload, client);
    assert(retryRes.error === null, `Publication retry succeeded with 0 errors: ${retryRes.error}`);
    assert(retryRes.product !== null, 'Product returned on retry');

    const { data: dbMediaAfterRetry } = await client
      .from('product_media')
      .select('*')
      .eq('product_id', testProductId)
      .order('sort_order', { ascending: true });

    assert(dbMediaAfterRetry!.length === 3, 'Media count remains exactly 3 on retry (no duplicates created)');
    const retryMediaIds = dbMediaAfterRetry!.map(m => m.id);
    const retryIdsPreserved = draftMediaIds.every((id, idx) => id === retryMediaIds[idx]);
    assert(retryIdsPreserved, 'Media IDs remain identical on retry');

    // ----------------------------------------------------
    // TEST 5: Modify Media on Existing Product
    // (Add 1 new image, remove 1 image, change primary to index 1)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Modify Media on Existing Published Product ---');
    const modifiedImagesPayload: any[] = [
      {
        id: publishedMediaIds[0],
        url: 'products/test/pitch_black_front.jpg',
        role: 'gallery' as any,
        isPrimary: false, // Changed from primary to gallery
        alt: 'Pitch Black Front (Updated)'
      },
      {
        id: publishedMediaIds[1],
        url: 'products/test/pitch_black_back.jpg',
        role: 'main' as any,
        isPrimary: true, // Now the new primary!
        alt: 'Pitch Black Back (New Primary)'
      },
      // Note: publishedMediaIds[2] (Chalk White) is removed from payload!
      {
        // Brand new image added without an ID
        url: 'products/test/pitch_black_detail.jpg',
        role: 'gallery' as any,
        isPrimary: false,
        alt: 'Pitch Black Detail Shot'
      }
    ];

    const modifyRes = await serverUpdateSupabaseProduct(
      testProductId,
      {
        ...publishPayload,
        images: modifiedImagesPayload
      },
      client
    );

    assert(modifyRes.error === null, `Modifying media succeeded without error: ${modifyRes.error}`);

    const { data: dbMediaAfterModify } = await client
      .from('product_media')
      .select('*')
      .eq('product_id', testProductId)
      .order('sort_order', { ascending: true });

    assert(dbMediaAfterModify!.length === 3, 'New total media count is 3 (2 retained + 1 added - 1 removed)');

    const newPrimaries = dbMediaAfterModify!.filter(m => m.is_primary === true);
    assert(newPrimaries.length === 1, 'Exactly ONE record is primary after modification');
    assert(newPrimaries[0].id === publishedMediaIds[1], 'New primary matches the updated image ID');

    const retained0 = dbMediaAfterModify!.find(m => m.id === publishedMediaIds[0]);
    assert(retained0 !== undefined && retained0.alt_text === 'Pitch Black Front (Updated)', 'Retained image was updated in place with new alt text');

    const removedCheck = dbMediaAfterModify!.find(m => m.id === publishedMediaIds[2]);
    assert(removedCheck === undefined, 'Removed image was safely deleted from database');

    const newRecord = dbMediaAfterModify!.find(m => m.id !== publishedMediaIds[0] && m.id !== publishedMediaIds[1]);
    assert(newRecord !== undefined && newRecord.storage_path === 'products/test/pitch_black_detail.jpg', 'Newly added image was successfully inserted');

    // ----------------------------------------------------
    // TEST 6: Publish with unmatched URLs (match by storage_path)
    // (Simulates frontend sending images without preserving ID, e.g. after draft reload)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Match Existing Media by storage_path when ID is missing ---');
    const currentMediaIds = dbMediaAfterModify!.map(m => m.id);
    const noIdPayload: any[] = dbMediaAfterModify!.map((m, idx) => ({
      // No id property provided!
      url: m.storage_path,
      role: m.media_type as any,
      isPrimary: idx === 0,
      alt: m.alt_text
    }));

    const noIdRes = await serverUpdateSupabaseProduct(testProductId, { ...publishPayload, images: noIdPayload }, client);
    assert(noIdRes.error === null, `Update matching by storage_path succeeded: ${noIdRes.error}`);

    const { data: dbMediaAfterNoId } = await client
      .from('product_media')
      .select('*')
      .eq('product_id', testProductId)
      .order('sort_order', { ascending: true });

    assert(dbMediaAfterNoId!.length === 3, 'No duplicate records created when matching by storage_path');
    const matchedByPathIds = dbMediaAfterNoId!.map(m => m.id);
    const pathsMatchedOriginal = currentMediaIds.every((id, idx) => id === matchedByPathIds[idx]);
    assert(pathsMatchedOriginal, 'Matched existing records by storage_path and preserved original IDs');

  } finally {
    // Clean up test product
    if (testProductId) {
      console.log(`\nCleaning up test product ${testProductId}...`);
      await serverDeleteSupabaseProduct(testProductId, client);
      console.log('Cleanup completed.');
    }
  }

  console.log('\n========================================');
  console.log(`TEST SUMMARY:`);
  console.log(`Total Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('========================================\n');
}

runRegressionSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
