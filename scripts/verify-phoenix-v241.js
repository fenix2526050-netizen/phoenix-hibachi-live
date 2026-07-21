const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}
function includes(file, needle) {
  return read(file).includes(needle);
}
function matches(file, regex) {
  return regex.test(read(file));
}

const v2382 = 'src/phoenix-v2382-admin-lifecycle-bridge.js';
const v241 = 'src/phoenix-v241-order-modification.js';
const lifecycle = 'supabase/functions/booking-lifecycle/index.ts';
const script = 'script.js';
const pkg = 'package.json';

check('V241 frontend file exists', fs.existsSync(path.join(root, v241)));
check('V2382 loads V241 patch', includes(v2382, 'phoenix-v241-order-modification.js'));
check('V241 has single-run guard', includes(v241, '__PHX_V241_ORDER_MODIFICATION__'));
check('V241 customer edit window is 48 hours', includes(v241, 'EDIT_WINDOW_HOURS = 48'));
check('V241 injects Modify order button', includes(v241, 'data-v241-edit-order'));
check('V241 injects locked order button', includes(v241, 'data-v241-locked-order'));
check('V241 customer mode exists', includes(v241, 'data-v241-mode="customer"'));
check('V241 admin mode exists', includes(v241, 'data-v241-mode="admin"'));
check('V241 infers staff cards from existing admin controls', includes(v241, 'hasStaffControls') && includes(v241, 'assign chef') && includes(v241, 'payment\\s*\\/\\s*price'));
check('V241 enhances public lookup cards', includes(v241, '.lookup-card') && includes(v241, 'data-print-lookup') && includes(v241, 'lookup-actions-v103'));
check('V241 tracks public lookup orders', includes(v241, 'rememberLookupOrder') && includes(v241, '__PHX_LOOKUP_ORDER_CACHE__'));
check('V241 requests customer verification before public edits', includes(v241, 'Verification phone or email') && includes(v241, 'verificationContact'));
check('V241 fetches full editable order before public edit', includes(v241, 'customer_edit_order') && includes(v241, 'loadEditableCustomerOrder'));
check('V241 opens order modification modal', includes(v241, 'phxOrderModifyModalV241'));
check('V241 calls customer_modify_order', includes(v241, "action:'customer_modify_order'"));
check('V241 calls admin_modify_order', includes(v241, "'admin_modify_order'"));
check('V241 keeps customer Travel Fee hidden', includes(v241, 'travelWrap.hidden = true'));
check('V241 allows admin Travel Fee editing', includes(v241, 'travelWrap.hidden = false'));
check('V241 blocks customer save inside lock window', includes(v241, 'customerCanModify(order)'));
check('V241 tells customer to call support when locked', includes(v241, 'Please call'));
check('V241 saves date/time/package/guests/address', ['event_date', 'event_time', 'package_name', 'guest_count', 'address'].every(x => includes(v241, x)));
check('V241 recalculates final total and balance', includes(v241, 'final_total') && includes(v241, 'balance_due_cents'));
check('V241 keeps old schema compatibility retry', includes(v241, 'removeMissingColumn'));
check('V241 updates local and remote caches', includes(v241, 'patchLocal') && includes(v241, 'remoteOrdersCache'));
check('Lifecycle type includes booking_modified', includes(lifecycle, "'booking_modified'"));
check('Lifecycle has customer edit lookup action', includes(lifecycle, "action === 'customer_edit_order'") && includes(lifecycle, 'editableCustomerOrder'));
check('Lifecycle order-number lookup no longer requires verification', !includes(lifecycle, 'order-number search'));
check('Lifecycle has customer modify action', includes(lifecycle, "action === 'customer_modify_order'"));
check('Lifecycle has admin modify action', includes(lifecycle, "action === 'admin_modify_order'"));
check('Lifecycle verifies customer phone/email', includes(lifecycle, 'verifyCustomerForModify'));
check('Lifecycle enforces 48-hour lock for customers', includes(lifecycle, 'customerCanModify') && includes(lifecycle, '48 * 60 * 60 * 1000'));
check('Lifecycle requires admin for admin modify', matches(lifecycle, /action === 'admin_modify_order'[\s\S]*?await requireAdmin\(req\)/));
check('Lifecycle writes without schema migration', includes(lifecycle, 'updateBookingCompat') && includes(lifecycle, 'removeMissingColumn'));
check('Lifecycle dispatches booking_modified notification', includes(lifecycle, "dispatchMake(data as Row, 'booking_modified'"));
check('Lifecycle notification copy includes order updated', includes(lifecycle, 'Your Phoenix Hibachi order was updated'));
check('Public lookup frontend no longer blocks order-number-only search', !includes(script, 'Enter the booking phone or email to verify an order-number search'));
check('Package exposes test:v241', includes(pkg, '"test:v241"'));

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
}
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} V241 checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} V241 checks passed.`);
