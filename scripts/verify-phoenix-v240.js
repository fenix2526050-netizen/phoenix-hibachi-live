const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const checks = [];
function pass(name, detail = '') { checks.push({ ok: true, name, detail }); }
function fail(name, detail = '') { checks.push({ ok: false, name, detail }); }
function assert(name, condition, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

const index = read('index.html');
const v240Path = 'src/phoenix-v240-travel-fee-notifications.js';
const v240 = read(v240Path);
const lifecycle = read('supabase/functions/booking-lifecycle/index.ts');
const bookingCreated = read('supabase/functions/booking-created/index.ts');
const stripeWebhook = read('supabase/functions/stripe-webhook/index.ts');
const script = read('script.js');
const dispatch = read('src/orders-dispatch-v120.js');
const adminContent = read('src/admin-content.js');

assert('v240 script is loaded by index.html', index.includes(v240Path));
assert('v240 script loads after v239 stability layer',
  index.indexOf('src/phoenix-stability-v239.js') > -1 && index.indexOf(v240Path) > index.indexOf('src/phoenix-stability-v239.js'));

assert('existing base mileage threshold is preserved as 20 miles',
  /includedMiles:\s*20/.test(v240) && /max:\s*20,\s*fee:\s*0/.test(script),
  'The old tier system had max:20; v240 uses that as includedMiles.');
assert('travel fee base is $50', /baseFee:\s*50/.test(v240));
assert('extra miles are $2 per mile', /perExtraMile:\s*2/.test(v240));
assert('custom quote threshold stays 100 miles', /customQuoteAboveMiles:\s*100/.test(v240));
assert('NJ toll fee is $30', /njTollFee:\s*30/.test(v240));
['travelFeeBase', 'travelFeeIncludedMiles', 'travelFeePerExtraMile', 'njTollFee', 'travelFeeCustomQuoteMiles'].forEach(field => {
  assert(`default pricing includes ${field}`, script.includes(field));
  assert(`admin pricing form includes ${field}`, adminContent.includes(`moneyRules.${field}`));
});
assert('admin pricing form has Travel fee rules section', /Travel fee rules/.test(adminContent));
assert('v240 listens for pricing updates', /phoenix:pricing-updated/.test(v240) && /refreshAfterPricingUpdate/.test(v240));
assert('NJ toll is stored without a schema change', /NJ Toll Fee/.test(v240) && /upsertNote/.test(v240));
assert('old orders default NJ toll to zero', /return .*0/.test(v240) && /legacy orders without a toll marker/.test(v240));
assert('manual travel fee is still read from travel_fee', /travelFee:\s*Number\(row\.travel_fee/.test(script) || /order\.travelFee\s*=\s*Number\(row\?\.travel_fee/.test(script));
assert('manual travel fee still saves to travel_fee', /travel_fee:\s*waived\s*\?\s*0\s*:\s*travel/.test(dispatch));
assert('manual travel fee save recalculates balance from edited travel fee', /adjustedOrder\s*=\s*\{[\s\S]*travelFee:\s*waived\s*\?\s*0\s*:\s*travel/.test(dispatch) && /orderTotal\(adjustedOrder\)/.test(dispatch));
assert('manual travel fee save stores final total snapshot', /final_total:calculatedTotal/.test(dispatch) && /order_total_cents:calculatedTotalCents/.test(dispatch));
assert('invoice wrapper adds NJ Toll Fee row', /guestInvoiceHtml/.test(v240) && /NJ Toll Fee/.test(v240) && /Sales Tax/.test(v240));
assert('invoice and chef settlement contact lines become clickable links',
  /linkifyContactLines/.test(v240) && /google\.com\/maps\/search\/\?api=1/.test(v240) && /tel:\+1/.test(v240) && /phoenix-hibachi\.com/.test(v240));
assert('admin cards show Travel Fee and Balance Due', /Final Total/.test(v240) && /Balance Due/.test(v240) && /phx-v240-fee-fields/.test(v240));

['full_address', 'map_url', 'travel_fee', 'nj_toll_fee', 'final_total', 'balance_due', 'internal_sms_content'].forEach(field => {
  assert(`booking-lifecycle payload includes ${field}`, lifecycle.includes(field));
  assert(`stripe-webhook payload includes ${field}`, stripeWebhook.includes(field));
});
['Address', 'Add-ons', 'Protein selections', 'Allergies', 'Travel Fee', 'NJ Toll Fee', 'Sales Tax', 'Final Total', 'Paid', 'Balance Due'].forEach(label => {
  assert(`booking-created branded email/PDF includes ${label}`, bookingCreated.includes(label));
});
assert('booking-created email links address/phone/site',
  /linked\(address,\s*mapHref\(address\)\)/.test(bookingCreated) && /linked\(SITE_PHONE,\s*phoneHref\(SITE_PHONE\)\)/.test(bookingCreated) && /linked\(websiteLabel\(SITE_URL\),\s*SITE_URL\)/.test(bookingCreated));
assert('booking-created PDF includes clickable link annotations',
  /PDFName/.test(bookingCreated) && /Subtype:\s*"Link"/.test(bookingCreated) && /addPdfLink/.test(bookingCreated));
assert('booking-lifecycle branded email links address/phone/email',
  /linkedAddress/.test(lifecycle) && /linkedPhone/.test(lifecycle) && /linkedEmail/.test(lifecycle));
assert('stripe webhook branded email links address/phone/email',
  /detailValueHtml/.test(stripeWebhook) && /mapHref\(address\)/.test(stripeWebhook));

function travelFeeByMiles(miles) {
  if (!Number.isFinite(miles) || miles < 0 || miles > 100) return null;
  return 50 + Math.max(0, Math.ceil(miles - 20)) * 2;
}
const pricingSamples = [
  [0, 50],
  [20, 50],
  [21, 52],
  [40, 90],
  [100, 210],
  [101, null]
];
pricingSamples.forEach(([miles, expected]) => {
  assert(`travel rule sample ${miles} miles = ${expected === null ? 'custom quote' : `$${expected}`}`,
    travelFeeByMiles(miles) === expected);
});

function runRuntimePatchCheck() {
  const context = {
    console,
    setTimeout(fn) {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout() {},
    MutationObserver: function MutationObserver() {
      this.observe = function observe() {};
    },
    document: {
      readyState: 'complete',
      body: {},
      head: { appendChild() {} },
      createElement() { return { id: '', textContent: '' }; },
      getElementById() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {}
    }
  };
  context.window = context;
  context.money = (value) => `$${Number(value || 0).toFixed(2)}`;
  context.escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  context.estimateTravelFeeByMiles = () => 0;
  context.updateTravelEstimateFromCoords = async () => undefined;
  context.buildOrderFromForm = () => ({
    address: '10 Broad St, Newark, NJ 07102',
    state: 'NJ',
    specialNotes: ''
  });
  context.bookingRowToOrder = (row) => ({
    id: row.booking_number,
    specialNotes: row.admin_notes,
    travelFee: row.travel_fee
  });
  context.calculateOrderMoney = (order) => ({
    travelFee: Number(order.travelFee || order.travel_fee || 50),
    taxRate: 0.08875,
    taxableSubtotal: 150,
    salesTax: 13.31,
    guestTotalBeforeDeposit: 163.31,
    guestTotalAfterDeposit: 63.31,
    depositPaid: 100,
    companyBalanceDue: 63.31,
    chefKeepsBeforeTip: 150,
    chefGuestPayout: 100,
    chefReturnToCompany: 0,
    ownerOwesChef: 0,
    foodSubtotal: 100,
    staffingFee: 0
  });
  context.guestInvoiceHtml = () => [
    '<div class="invoice-brand"><span>(516) 518-3325</span><span>phoenix-hibachi.com</span></div>',
    '<div class="invoice-highlight-yellow"><b>Phone:</b><span>(347) 555-1234</span></div>',
    '<div class="invoice-highlight-yellow"><b>Address:</b><span>10 Broad St, Newark, NJ 07102</span></div>',
    '<div class="invoice-row"><span>Travel Fee</span><em></em><b>Total: $50.00</b></div>',
    '<div class="invoice-row"><span>Sales Tax</span><em>NY 8.875%</em><b>Total: $13.31</b></div>',
    '<div><b>Subtotal before tax:</b><span>$150.00</span></div>',
    '<span>Travel $50.00</span>'
  ].join('');
  vm.createContext(context);
  vm.runInContext(v240, context, { filename: v240Path });

  const built = context.buildOrderFromForm({});
  const readBack = context.bookingRowToOrder({
    booking_number: 'PHX-TEST',
    admin_notes: 'NJ Toll Fee: 30.00',
    travel_fee: 50
  });
  const money = context.calculateOrderMoney({
    id: 'PHX-TEST',
    travelFee: 50,
    specialNotes: 'NJ Toll Fee: 30.00'
  });
  const invoice = context.guestInvoiceHtml({
    id: 'PHX-TEST',
    travelFee: 50,
    specialNotes: 'NJ Toll Fee: 30.00',
    phone: '(347) 555-1234',
    address: '10 Broad St, Newark, NJ 07102'
  });

  assert('runtime v240 travel rule overrides estimator', context.estimateTravelFeeByMiles(21) === 52);
  assert('runtime new NJ booking stores toll note', /NJ Toll Fee:\s*30\.00/.test(built.specialNotes || ''));
  assert('runtime legacy row parses NJ toll from notes', readBack.njTollFee === 30);
  assert('runtime calculation adds separate NJ toll', money.njTollFee === 30 && money.travelAndTollTotal === 80);
  assert('runtime invoice includes a separate NJ Toll Fee row', /NJ Toll Fee/.test(invoice));
  assert('runtime invoice links address to Google Maps', /google\.com\/maps\/search\/\?api=1(?:&|&amp;)query=10%20Broad%20St/.test(invoice));
  assert('runtime invoice links phone and website', /tel:\+13475551234/.test(invoice) && /https:\/\/phoenix-hibachi\.com/.test(invoice));
}

runRuntimePatchCheck();

function runDynamicPricingRuntimeCheck() {
  const context = {
    console,
    setTimeout(fn) {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout() {},
    MutationObserver: function MutationObserver() {
      this.observe = function observe() {};
    },
    document: {
      readyState: 'complete',
      body: {},
      head: { appendChild() {} },
      createElement() { return { id: '', textContent: '' }; },
      getElementById() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {}
    }
  };
  context.window = context;
  context.PHX_GET_PRICING_V140 = () => ({
    moneyRules: {
      travelFeeBase: 60,
      travelFeeIncludedMiles: 10,
      travelFeePerExtraMile: 3,
      njTollFee: 45,
      travelFeeCustomQuoteMiles: 80
    }
  });
  context.estimateTravelFeeByMiles = () => 0;
  context.updateTravelEstimateFromCoords = async () => undefined;
  context.buildOrderFromForm = () => ({ address: 'Jersey City, NJ', state: 'NJ', specialNotes: '' });
  context.bookingRowToOrder = (row) => ({ id: row.booking_number, specialNotes: row.admin_notes });
  context.calculateOrderMoney = (order) => ({
    travelFee: Number(order.travelFee || 60),
    taxRate: 0,
    taxableSubtotal: 60,
    salesTax: 0,
    guestTotalBeforeDeposit: 60,
    guestTotalAfterDeposit: 60,
    depositPaid: 0,
    companyBalanceDue: 60,
    chefKeepsBeforeTip: 60,
    chefGuestPayout: 0,
    chefReturnToCompany: 0,
    ownerOwesChef: 0,
    foodSubtotal: 0,
    staffingFee: 0
  });
  context.guestInvoiceHtml = () => '<div class="invoice-row"><span>Sales Tax</span><b>Total: $0.00</b></div>';
  vm.createContext(context);
  vm.runInContext(v240, context, { filename: v240Path });
  const built = context.buildOrderFromForm({});
  const money = context.calculateOrderMoney({ travelFee: 60, state: 'NJ' });
  assert('runtime travel rule reads backend base/miles/rate', context.estimateTravelFeeByMiles(11) === 63);
  assert('runtime custom quote limit reads backend setting', context.estimateTravelFeeByMiles(81) === null);
  assert('runtime NJ toll reads backend setting', /NJ Toll Fee:\s*45\.00/.test(built.specialNotes || '') && money.njTollFee === 45);
}

runDynamicPricingRuntimeCheck();

const idMatches = [...index.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const idCounts = idMatches.reduce((acc, id) => ((acc[id] = (acc[id] || 0) + 1), acc), {});
const duplicateIds = Object.entries(idCounts).filter(([, count]) => count > 1);
assert('index.html has no duplicate IDs', duplicateIds.length === 0, duplicateIds.map(([id, count]) => `${id} x${count}`).join(', '));

const refs = [...index.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
  .map(match => match[1])
  .filter(ref => !/^(https?:|data:|mailto:|tel:|sms:|javascript:|#)/i.test(ref))
  .filter(ref => !ref.includes('${'))
  .filter(ref => /\.(css|js|png|jpe?g|webp|gif|svg|ico|mp4|webm|json|woff2?)($|\?)/i.test(ref))
  .map(ref => ref.split('?')[0].split('#')[0]);
const missingRefs = [...new Set(refs)].filter(ref => !exists(ref));
assert('index.html local assets referenced by src/href exist', missingRefs.length === 0, missingRefs.join(', '));

const failed = checks.filter(check => !check.ok);
checks.forEach(check => {
  const marker = check.ok ? 'PASS' : 'FAIL';
  console.log(`${marker} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
});
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exitCode = 1;
