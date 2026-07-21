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
const index = 'index.html';
const lifecycle = 'supabase/functions/booking-lifecycle/index.ts';
const script = 'script.js';
const pkg = 'package.json';

check('V241 frontend file exists', fs.existsSync(path.join(root, v241)));
check('V2382 loads V241 patch', includes(v2382, 'phoenix-v241-order-modification.js'));
check('Index directly loads V241 patch', includes(index, 'src/phoenix-v241-order-modification.js'));
check('V241 script is cache-busted to force latest modify UI', includes(index, 'phoenix-v241-order-modification.js?v=245') && includes(v2382, 'phoenix-v241-order-modification.js?v=245'));
check('V241 has single-run guard', includes(v241, '__PHX_V241_ORDER_MODIFICATION__'));
check('V241 customer edit window is 48 hours', includes(v241, 'EDIT_WINDOW_HOURS = 48'));
check('V241 injects Modify order button', includes(v241, 'data-v241-edit-order'));
check('V241 injects locked order button', includes(v241, 'data-v241-locked-order'));
check('V241 customer mode exists', includes(v241, 'data-v241-mode="customer"'));
check('V241 admin mode exists', includes(v241, 'data-v241-mode="admin"'));
check('V241 infers staff cards from existing admin controls', includes(v241, 'hasStaffControls') && includes(v241, 'assign chef') && includes(v241, 'payment\\s*\\/\\s*price'));
check('V241 enhances public lookup cards', includes(v241, '.lookup-card') && includes(v241, 'data-print-lookup') && includes(v241, 'lookup-actions-v103'));
check('V241 tracks public lookup orders', includes(v241, 'rememberLookupOrder') && includes(v241, '__PHX_LOOKUP_ORDER_CACHE__'));
check('V241 shows admin button even when cache misses', includes(v241, 'orderStubFromCard') && includes(v241, '__v241NeedsFullFetch'));
check('V241 fetches full admin order before editing fallback cards', includes(v241, 'loadFullAdminOrder') && includes(v241, ".from('bookings').select('*')"));
check('V241 requests customer verification before public edits', includes(v241, 'Verification phone or email') && includes(v241, 'verificationContact'));
check('V241 fetches full editable order before public edit', includes(v241, 'customer_edit_order') && includes(v241, 'loadEditableCustomerOrder'));
check('V241 installs order-number lookup fallback before legacy form handler', includes(v241, 'installOrderNumberLookupFallback') && includes(v241, 'ORDER_NUMBER_LOOKUP_FALLBACK'));
check('V241 has direct public order-number fallback', includes(v241, 'directPublicLookupByNumber') && includes(v241, "from('bookings').select(fields)"));
check('V241 replaces Edge Function non-2xx with friendly deployment message', includes(v241, 'friendlyFunctionError') && includes(v241, 'booking-lifecycle'));
check('V241 keeps edit modal within viewport with sticky actions', includes(v241, 'max-height:min(92vh,880px)') && includes(v241, 'position:sticky') && includes(v241, 'Save changes'));
check('V241 keeps public lookup result scrollable', includes(v241, '#orderLookupModal .order-lookup-result') && includes(v241, 'max-height:min(38dvh,360px)'));
check('V241 adds payment button to public/customer cards', includes(v241, 'Pay deposit / balance') && includes(v241, 'data-open-payment'));
check('V241 public payment button sets order payment context', includes(v241, 'setPaymentOrderContext') && includes(v241, 'lastSubmittedOrder'));
check('V241 payment modal supports card/cash option handling', includes(index, 'phx-card-option') && includes(index, 'phx-cash-option') && includes(v241, 'data-v241-card-payment'));
check('V241 opens payment options as top-layer dialog', includes(v241, 'phxPaymentTopDialogV241') && includes(v241, 'openPaymentDialog') && includes(v241, 'dialog.showModal()'));
check('V241 payment click stops legacy underlay handlers', includes(v241, 'stopImmediatePropagation') && includes(v241, 'openPaymentDialog(pay.getAttribute'));
check('V241 locked customer edit shows disabled Modify locked button', includes(v241, 'Modify locked') && includes(v241, 'disabled'));
check('V241 opens order modification modal', includes(v241, 'phxOrderModifyModalV241'));
check('V241 customer modify shows order summary instead of base-info reentry', includes(v241, 'data-v241-customer-summary') && includes(v241, 'setCustomerBasicMode') && includes(v241, 'data-v241-basic-field'));
check('V241 customer modify offers menu choice checkboxes', includes(v241, 'PROTEIN_CHOICES_V241') && includes(v241, 'ADDON_CHOICES_V241') && includes(v241, 'data-v241-protein-choices') && includes(v241, 'data-v241-addon-choices'));
check('V241 customer modify uses quantity inputs for proteins/add-ons', includes(v241, 'data-v241-protein-input') && includes(v241, 'data-v241-addon-input') && includes(v241, 'selectedProteinsFromForm'));
check('V241 modify UI no longer renders protein/add-on checkboxes', !includes(v241, 'type="checkbox"'));
check('V241 admin modify uses the same quantity/price editor', includes(v241, 'setupCustomerChoices(dialog, dialog.querySelector') && includes(v241, 'label.hidden = true') && includes(v241, 'selectedAddonsFromForm(form)'));
check('V241 customer modify enforces two protein portions per billable guest', includes(v241, 'billableGuests * 2') && includes(v241, 'validateProteinQuantities'));
check('V241 customer modify caps total protein pool, not each protein by guest count', includes(v241, 'maxTotal:required') && includes(v241, 'normalizeProteinTotal') && includes(v241, 'data-v241-protein-total') && includes(v241, 'cannot exceed ${rule.required} total portions') && !includes(v241, 'maxEach'));
check('V241 customer modify has live price preview', includes(v241, 'data-v241-price-preview') && includes(v241, 'updatePricePreview') && includes(v241, 'Minimum order adjustment'));
check('V241 mobile lookup modal is scrollable and usable', includes(v241, 'max-height:88dvh') && includes(v241, '#orderLookupModal input{font-size:16px}') && includes(v241, 'order:20') && includes(v241, 'position:sticky;bottom:0'));
check('V241 paid-in-full modifications never create refunds', includes(v241, 'No refund after order modification') && includes(v241, 'reductions do not create refunds') && includes(v241, 'noRefundCredit'));
check('V241 added guests/items only create additional unpaid balance', includes(v241, 'Additional balance due after order modification') && includes(v241, 'Previously paid') && includes(v241, 'additionalDue'));
check('V241 modification preserves paid amount and payment status', includes(v241, 'amountPaidForOrder') && includes(v241, 'paid_amount:paid') && includes(v241, 'payment_status:paymentStatus'));
check('V241 customer copy blocks event-time self edits', includes(v241, 'Event time changes must be handled by Phoenix customer service'));
check('V241 only lets admin submit date/time/address changes', includes(v241, "if (mode === 'admin')") && includes(v241, 'dbPatch.event_time = timeToDb(eventTime)') && includes(v241, 'dbPatch.address = address'));
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
check('V241 customer save reports notification status', includes(v241, 'Phoenix has been notified for review') && includes(v241, 'automatic SMS/email'));
check('Lifecycle type includes booking_modified', includes(lifecycle, "'booking_modified'"));
check('Lifecycle has customer edit lookup action', includes(lifecycle, "action === 'customer_edit_order'") && includes(lifecycle, 'editableCustomerOrder'));
check('Lifecycle order-number lookup no longer requires verification', !includes(lifecycle, 'order-number search'));
check('Lifecycle has customer modify action', includes(lifecycle, "action === 'customer_modify_order'"));
check('Lifecycle has admin modify action', includes(lifecycle, "action === 'admin_modify_order'"));
check('Lifecycle verifies customer phone/email', includes(lifecycle, 'verifyCustomerForModify'));
check('Lifecycle enforces 48-hour lock for customers', includes(lifecycle, 'customerCanModify') && includes(lifecycle, '48 * 60 * 60 * 1000'));
check('Lifecycle requires admin for admin modify', matches(lifecycle, /action === 'admin_modify_order'[\s\S]*?await requireAdmin\(req\)/));
check('Lifecycle writes without schema migration', includes(lifecycle, 'updateBookingCompat') && includes(lifecycle, 'removeMissingColumn'));
check('Lifecycle exposes paid amount to editable customer order', includes(lifecycle, 'paidAmount: Number(b.paid_amount || b.deposit_amount || 0)') && includes(lifecycle, 'balance_due: balanceDueDollars(b)'));
check('Lifecycle accepts modification payment status and paid amount', includes(lifecycle, "setNumber('paid_amount'") && includes(lifecycle, "setText('payment_status'"));
check('Lifecycle appends no-refund/additional-balance note', includes(lifecycle, 'paymentAdjustmentNote') && includes(lifecycle, 'Payment modification rule'));
check('Lifecycle dispatches booking_modified notification', includes(lifecycle, "dispatchMake(data as Row, 'booking_modified'"));
check('Lifecycle notification copy includes order updated', includes(lifecycle, 'Your Phoenix Hibachi order was updated'));
check('Public lookup frontend no longer blocks order-number-only search', !includes(script, 'Enter the booking phone or email to verify an order-number search'));
check('Package exposes test:v241', includes(pkg, '"test:v241"'));
check('Package exposes SMS V243 test', includes(pkg, '"test:sms:v243"') && fs.existsSync(path.join(root, 'scripts/test-sms-v243.mjs')));

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
}
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} V241 checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} V241 checks passed.`);
