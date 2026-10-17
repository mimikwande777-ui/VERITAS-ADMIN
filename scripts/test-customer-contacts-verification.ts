import { normalizePhoneNumber, validateEmail } from '../lib/phone-utils';
import { 
  serverRegisterContact, 
  serverFetchContacts, 
  serverUpdateContactPreferences, 
  serverAdminUpdateContact, 
  serverAdminDeleteContact, 
  serverExportContactsCSV 
} from '../lib/supabase/contacts-server';
import { emailMarketingProvider } from '../lib/marketing/email-provider';
import { hasPermission } from '../lib/auth-types';
import { CustomerContact } from '../lib/contacts-types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runCustomerContactsSuite() {
  console.log('================================================================');
  console.log('VERITAS ADMIN — CUSTOMER CONTACTS & MARKETING SYSTEM TEST SUITE');
  console.log('================================================================\n');

  const testIdsToClean: string[] = [];

  try {
    // ----------------------------------------------------------------
    // TEST 1: Required Phone Number Validation & Normalization
    // ----------------------------------------------------------------
    console.log('--- TEST 1: Required Phone Number Validation & Normalization ---');
    const emptyPhoneRes = normalizePhoneNumber('');
    assert(!emptyPhoneRes.isValid, 'Empty phone number is correctly rejected');

    const invalidPhoneRes = normalizePhoneNumber('12345');
    assert(!invalidPhoneRes.isValid, 'Short invalid phone number is rejected');

    const textPhoneRes = normalizePhoneNumber('invalid-text');
    assert(!textPhoneRes.isValid, 'Non-digit phone input is rejected');

    const saLocalRes = normalizePhoneNumber('082 123 4567');
    assert(saLocalRes.isValid && saLocalRes.e164 === '+27821234567', 'South African local number (082...) normalized to E.164 (+27821234567)');

    const saIntlRes = normalizePhoneNumber('+27 82 987 6543');
    assert(saIntlRes.isValid && saIntlRes.e164 === '+27829876543', 'South African intl format (+27 82...) preserved as E.164');

    const usRes = normalizePhoneNumber('+1 (415) 555-2671');
    assert(usRes.isValid && usRes.e164 === '+14155552671', 'US international format normalized to E.164');

    // ----------------------------------------------------------------
    // TEST 2: Optional Email Handling & Validation
    // ----------------------------------------------------------------
    console.log('\n--- TEST 2: Optional Email Handling & Validation ---');
    const noEmailRes = validateEmail(undefined);
    assert(noEmailRes.isValid && (noEmailRes.normalized === undefined || noEmailRes.normalized === ''), 'Undefined email is treated as valid (optional)');

    const emptyEmailRes = validateEmail('');
    assert(emptyEmailRes.isValid && (emptyEmailRes.normalized === undefined || emptyEmailRes.normalized === ''), 'Empty string email is treated as valid (optional)');

    const invalidEmailRes = validateEmail('not-an-email');
    assert(!invalidEmailRes.isValid, 'Malformed email without @ is rejected');

    const validEmailRes = validateEmail(' Client@VERITAS-Official.CO.ZA ');
    assert(validEmailRes.isValid && validEmailRes.normalized === 'client@veritas-official.co.za', 'Valid email normalized to lowercase trimmed string');

    // ----------------------------------------------------------------
    // TEST 3: Unchecked Marketing Consent by Default
    // ----------------------------------------------------------------
    console.log('\n--- TEST 3: Unchecked Marketing Consent by Default ---');
    const testPhone1 = `082100${Math.floor(1000 + Math.random() * 9000)}`;
    const regRes1 = await serverRegisterContact({
      phoneNumber: testPhone1,
      isWhatsApp: true,
      email: 'client1@test-veritas.co.za'
      // Consents omitted = MUST be false
    });

    assert(regRes1.error === null && regRes1.contact !== null, 'Contact registered without error');
    assert(regRes1.contact?.emailMarketingConsent === false, 'Email marketing consent is FALSE by default');
    assert(regRes1.contact?.whatsAppMarketingConsent === false, 'WhatsApp marketing consent is FALSE by default');
    assert(regRes1.contact?.isWhatsApp === true, 'WhatsApp capability recorded correctly');
    testIdsToClean.push(regRes1.contact!.id);

    // ----------------------------------------------------------------
    // TEST 4: Duplicate Contact Handling (Idempotent Updates)
    // ----------------------------------------------------------------
    console.log('\n--- TEST 4: Duplicate Contact Handling (Deduplication) ---');
    const duplicateSubmission = await serverRegisterContact({
      phoneNumber: testPhone1, // Same phone number submitted again
      isWhatsApp: true,
      email: 'client1-updated@test-veritas.co.za',
      firstName: 'Thabo',
      lastName: 'Dlamini'
    });

    assert(duplicateSubmission.error === null, 'Resubmitting existing phone number succeeds with zero errors');
    assert(duplicateSubmission.isExisting === true, 'isExisting flag is TRUE on resubmission');
    assert(duplicateSubmission.contact?.id === regRes1.contact?.id, 'Existing contact ID was preserved (no duplicate record created)');
    assert(duplicateSubmission.contact?.email === 'client1-updated@test-veritas.co.za', 'Email was safely updated on existing record');
    assert(duplicateSubmission.contact?.firstName === 'Thabo', 'First name was updated');

    // ----------------------------------------------------------------
    // TEST 5: Separate Consent Records & Audit Trail
    // ----------------------------------------------------------------
    console.log('\n--- TEST 5: Separate Consent Records & Audit Trail ---');
    const testPhone2 = `083200${Math.floor(1000 + Math.random() * 9000)}`;
    const regResEmailOnly = await serverRegisterContact({
      phoneNumber: testPhone2,
      isWhatsApp: false,
      email: 'emailonly@test-veritas.co.za',
      emailMarketingConsent: true,
      whatsAppMarketingConsent: false,
      consentSource: 'vip_modal'
    });

    assert(regResEmailOnly.contact?.emailMarketingConsent === true, 'Email marketing consent explicitly recorded as TRUE');
    assert(regResEmailOnly.contact?.whatsAppMarketingConsent === false, 'WhatsApp marketing consent remains FALSE (independent)');
    assert(regResEmailOnly.contact?.emailConsentUpdatedAt !== null, 'Email consent timestamp recorded');
    assert(regResEmailOnly.contact?.whatsAppConsentUpdatedAt === null, 'WhatsApp consent timestamp is null');
    assert(regResEmailOnly.contact?.consentSource === 'vip_modal', 'Consent source recorded accurately');
    testIdsToClean.push(regResEmailOnly.contact!.id);

    // ----------------------------------------------------------------
    // TEST 6: Granular Unsubscription from Single Channel
    // ----------------------------------------------------------------
    console.log('\n--- TEST 6: Granular Unsubscription from Single Channel ---');
    // Start with dual opt-in
    const testPhone3 = `084300${Math.floor(1000 + Math.random() * 9000)}`;
    const dualContact = await serverRegisterContact({
      phoneNumber: testPhone3,
      isWhatsApp: true,
      email: 'dual@test-veritas.co.za',
      emailMarketingConsent: true,
      whatsAppMarketingConsent: true,
      consentSource: 'web_registration'
    });
    testIdsToClean.push(dualContact.contact!.id);

    assert(dualContact.contact?.emailMarketingConsent === true, 'Dual contact initially opted into Email');
    assert(dualContact.contact?.whatsAppMarketingConsent === true, 'Dual contact initially opted into WhatsApp');

    // Unsubscribe from Email ONLY via preference center
    const unsubEmailOnly = await serverUpdateContactPreferences({
      token: dualContact.contact?.preferenceToken,
      emailMarketingConsent: false, // Turn off email
      whatsAppMarketingConsent: true  // Keep WhatsApp ON
    });

    assert(unsubEmailOnly.error === null, 'Preference update succeeded');
    assert(unsubEmailOnly.contact?.emailMarketingConsent === false, 'Email consent changed to FALSE');
    assert(unsubEmailOnly.contact?.whatsAppMarketingConsent === true, 'WhatsApp consent REMAINS TRUE (channel separation preserved)');
    assert(unsubEmailOnly.contact?.emailUnsubscribedAt !== null, 'emailUnsubscribedAt timestamp recorded');
    assert(unsubEmailOnly.contact?.whatsAppUnsubscribedAt === null, 'whatsAppUnsubscribedAt is null');

    // ----------------------------------------------------------------
    // TEST 7: Admin RBAC & CSV Export Permissions
    // ----------------------------------------------------------------
    console.log('\n--- TEST 7: Admin RBAC & CSV Export Permissions ---');
    assert(hasPermission('super_admin', 'canViewCustomers') === true, 'Super Admin can view customers');
    assert(hasPermission('marketing', 'canViewCustomers') === true, 'Marketing partner can view customers');
    assert(hasPermission('super_admin', 'canExportContacts') === true, 'Super Admin has canExportContacts permission');
    assert(hasPermission('marketing', 'canExportContacts') === true, 'Marketing partner has canExportContacts permission');
    assert(hasPermission('operations', 'canExportContacts') === false, 'Operations partner CANNOT export customer contacts');
    assert(hasPermission('finance', 'canExportContacts') === false, 'Finance partner CANNOT export customer contacts');

    // Test CSV Generator output
    const csvContent = await serverExportContactsCSV({ limit: 10 });
    assert(csvContent.startsWith('Contact ID,Phone (E.164)'), 'CSV output begins with standard RFC 4180 header row');
    assert(csvContent.includes('Email Marketing Opt-In'), 'CSV includes Email Marketing column');
    assert(csvContent.includes('WhatsApp Marketing Opt-In'), 'CSV includes WhatsApp Marketing column');

    // ----------------------------------------------------------------
    // TEST 8: Marketing Provider Synchronization
    // ----------------------------------------------------------------
    console.log('\n--- TEST 8: External Marketing Provider Synchronization ---');
    // Test that unconsented contact is SKIPPED by provider
    const unconsentedSync = await emailMarketingProvider.syncContact({
      email: 'not-consented@domain.com',
      consented: false
    });
    assert(unconsentedSync.status === 'skipped', 'Marketing provider skips contacts without explicit consent');

    // Test consented contact synchronization
    const consentedSync = await emailMarketingProvider.syncContact({
      email: 'vip-client@domain.com',
      consented: true,
      firstName: 'Luxury',
      consentSource: 'web_registration'
    });
    assert(consentedSync.success === true, 'Consented contact synchronization executes successfully');

    // Test unsubscribe sync
    const unsubSync = await emailMarketingProvider.unsubscribeContact('vip-client@domain.com', 'User requested opt-out');
    assert(unsubSync.success === true, 'Unsubscribe sync handled cleanly');

    // ----------------------------------------------------------------
    // TEST 9: Suppression & Admin Correction Workflows
    // ----------------------------------------------------------------
    console.log('\n--- TEST 9: Suppression & Admin Correction Workflows ---');
    const suppressRes = await serverAdminUpdateContact(dualContact.contact!.id, {
      marketingStatus: 'suppressed',
      suppressionReason: 'Fraud investigation or user request',
      emailMarketingConsent: false,
      whatsAppMarketingConsent: false
    });

    assert(suppressRes.error === null, 'Contact suppressed successfully');
    assert(suppressRes.contact?.marketingStatus === 'suppressed', 'Status changed to suppressed');
    assert(suppressRes.contact?.suppressionReason === 'Fraud investigation or user request', 'Suppression reason recorded');
    assert(suppressRes.contact?.emailMarketingConsent === false, 'All consents revoked upon suppression');
    assert(suppressRes.contact?.whatsAppMarketingConsent === false, 'WhatsApp revoked upon suppression');

    // ----------------------------------------------------------------
    // TEST 10: Deletion Workflow (POPIA Right to be Forgotten)
    // ----------------------------------------------------------------
    console.log('\n--- TEST 10: Hard Deletion (POPIA Right to be Forgotten) ---');
    const deleteRes = await serverAdminDeleteContact(testIdsToClean[0]);
    assert(deleteRes.success === true, 'Contact deletion executed successfully');

    // Verify contact no longer returned
    const { contacts: postDeleteList } = await serverFetchContacts({ limit: 100 });
    const foundDeleted = postDeleteList.some(c => c.id === testIdsToClean[0]);
    assert(!foundDeleted, 'Deleted contact completely absent from contacts list');

  } finally {
    // Cleanup remaining test contacts
    for (const id of testIdsToClean.slice(1)) {
      try {
        await serverAdminDeleteContact(id);
      } catch {
        // ignore
      }
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');
}

runCustomerContactsSuite().catch(err => {
  console.error('Customer contacts verification suite encountered unhandled error:', err);
  process.exit(1);
});
