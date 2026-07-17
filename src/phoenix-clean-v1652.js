/* Phoenix Hibachi V1651 Clean Rebuild consolidated runtime JS.
   Consolidated from the approved live fixes; the known login-conflict code is intentionally excluded. */



/* Phoenix OS Master Build V164
   Architecture rule: do not stack random patches; centralize final overrides for
   contacts, login routing, invoice branding, modal behavior, and finance-ready display.
*/
(function phoenixOsMasterBuildV164(){
  if (window.__PHX_OS_MASTER_V164__) return;
  window.__PHX_OS_MASTER_V164__ = true;
  window.PHX_BUILD_VERSION = 'V164_PHOENIX_OS_MASTER_BUILD';

  const OFFICIAL = Object.freeze({
    businessName: 'Phoenix Hibachi',
    websiteUrl: 'https://phoenix-hibachi.com',
    websiteLabel: 'phoenix-hibachi.com',
    phoneDigits: '5165183325',
    phoneDisplay: '(516) 518-3325',
    phoneHref: '+15165183325',
    bookingEmail: 'booking@phoenix-hibachi.com',
    ordersEmail: 'orders@phoenix-hibachi.com',
    supportEmail: 'support@phoenix-hibachi.com',
    infoEmail: 'info@phoenix-hibachi.com',
    internalGmail: 'phoenixhibachi.team@gmail.com',
    logo: 'assets/phoenix-logo-transparent.png',
    serviceArea: 'NY, NJ, CT, PA',
    policy: 'A $200 deposit holds an approved date. Final guest count locks 42 hours before the event. Inside 72 hours, the deposit is non-refundable and may be applied once to a manager-approved event within 30 days.'
  });
  window.PHX_OS = Object.freeze({ ...(window.PHX_OS || {}), official: OFFICIAL });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (value) => {
    try { return (typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))); }
    catch { return String(value ?? ''); }
  };
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const moneySafe = (value) => {
    try { return (typeof money === 'function' ? money(value) : `$${num(value).toFixed(2).replace(/\.00$/, '')}`); }
    catch { return `$${num(value).toFixed(2)}`; }
  };
  const formatPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits.startsWith('1')) return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    return String(value || OFFICIAL.phoneDisplay);
  };
  const toast = (message, type = 'success', ms = 3600) => {
    try { if (typeof window.phoenixToastV71 === 'function') return window.phoenixToastV71(message, type, ms); } catch {}
    try { if (typeof toastV70 === 'function') return toastV70(message, type, ms); } catch {}
    if (type === 'error') alert(message); else console.log(`[Phoenix] ${message}`);
  };

  function officialContactSettings(overrides = {}){
    return {
      phone: OFFICIAL.phoneDigits,
      textPhone: OFFICIAL.phoneDigits,
      bookingEmail: OFFICIAL.bookingEmail,
      supportEmail: OFFICIAL.supportEmail,
      policy: OFFICIAL.policy,
      websiteUrl: OFFICIAL.websiteUrl,
      businessName: OFFICIAL.businessName,
      ...overrides
    };
  }

  function mutateLegacyDefaultContacts(){
    try {
      if (typeof DEFAULT_V60_CONTACTS !== 'undefined' && DEFAULT_V60_CONTACTS) {
        DEFAULT_V60_CONTACTS.phone = OFFICIAL.phoneDigits;
        DEFAULT_V60_CONTACTS.textPhone = OFFICIAL.phoneDigits;
        DEFAULT_V60_CONTACTS.bookingEmail = OFFICIAL.bookingEmail;
        DEFAULT_V60_CONTACTS.supportEmail = OFFICIAL.supportEmail;
        DEFAULT_V60_CONTACTS.policy = OFFICIAL.policy;
      }
    } catch {}
  }

  function normalizeSettingsFromAny(value = {}){
    return officialContactSettings({
      phone: value.business_phone || value.phone || value.public_phone || OFFICIAL.phoneDigits,
      textPhone: value.text_phone || value.textPhone || value.sms_phone || value.business_phone || value.phone || OFFICIAL.phoneDigits,
      bookingEmail: value.booking_email || value.bookingEmail || value.public_booking_email || OFFICIAL.bookingEmail,
      supportEmail: value.support_email || value.supportEmail || value.public_support_email || value.booking_email || OFFICIAL.supportEmail,
      policy: value.cancellation_policy_text || value.policy || value.public_policy || OFFICIAL.policy,
      websiteUrl: value.website_url || value.websiteUrl || OFFICIAL.websiteUrl,
      businessName: value.business_name || value.businessName || OFFICIAL.businessName
    });
  }

  function settingsToDb(settings = (typeof getContactSettingsV60 === 'function' ? getContactSettingsV60() : officialContactSettings())){
    const s = normalizeSettingsFromAny(settings);
    return {
      business_name: OFFICIAL.businessName,
      business_phone: String(s.phone || OFFICIAL.phoneDigits).replace(/\D/g,''),
      text_phone: String(s.textPhone || s.phone || OFFICIAL.phoneDigits).replace(/\D/g,''),
      booking_email: s.bookingEmail || OFFICIAL.bookingEmail,
      support_email: s.supportEmail || OFFICIAL.supportEmail,
      orders_email: OFFICIAL.ordersEmail,
      info_email: OFFICIAL.infoEmail,
      internal_gmail: OFFICIAL.internalGmail,
      website_url: OFFICIAL.websiteUrl,
      service_area_text: OFFICIAL.serviceArea,
      cancellation_policy_title: '72-Hour Policy',
      cancellation_policy_text: s.policy || OFFICIAL.policy,
      public_phone_provider: 'Quo',
      private_phone_policy: 'Private owner number is internal only and should not be displayed on customer-facing pages.',
      updated_by_master_build: 'V164_PHOENIX_OS_MASTER_BUILD'
    };
  }

  try { window.normalizeContactSettingsFromDbV68 = normalizeSettingsFromAny; } catch {}
  try { window.contactSettingsToDbV68 = settingsToDb; } catch {}
  mutateLegacyDefaultContacts();

  function readContactSettings(){
    try {
      if (typeof getContactSettingsV60 === 'function') return normalizeSettingsFromAny(getContactSettingsV60());
    } catch {}
    return officialContactSettings();
  }
  function saveContactSettings(settings){
    mutateLegacyDefaultContacts();
    try {
      if (typeof saveContactSettingsV60 === 'function') saveContactSettingsV60(normalizeSettingsFromAny(settings));
      else localStorage.setItem('phoenixHibachiContactSettingsV60', JSON.stringify(normalizeSettingsFromAny(settings)));
    } catch {}
  }

  function applyPublicContactDom(){
    const s = readContactSettings();
    const phoneDigits = String(s.phone || OFFICIAL.phoneDigits).replace(/\D/g,'') || OFFICIAL.phoneDigits;
    const textDigits = String(s.textPhone || s.phone || OFFICIAL.phoneDigits).replace(/\D/g,'') || OFFICIAL.phoneDigits;
    const phoneDisplay = formatPhone(phoneDigits);
    const textDisplay = formatPhone(textDigits);
    const bookingEmail = s.bookingEmail || OFFICIAL.bookingEmail;
    const supportEmail = s.supportEmail || OFFICIAL.supportEmail;

    const call = $('#contactCallCard');
    if (call) { call.href = `tel:+1${phoneDigits}`; const span = $('span', call); if (span) span.textContent = phoneDisplay; }
    const text = $('#contactTextCard');
    if (text) { text.href = `sms:+1${textDigits}`; const span = $('span', text); if (span) span.textContent = `${textDisplay} · Fastest for same-week party questions`; }
    const mail = $('#contactEmailCard');
    if (mail) { mail.href = `mailto:${bookingEmail}`; const span = $('span', mail); if (span) span.textContent = bookingEmail; }
    const quote = $('#quoteTextBtn');
    if (quote) quote.href = `sms:+1${textDigits}`;

    $$('a[href^="tel:"], a[href^="sms:"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/3474719190|13474719190|10000000000/.test(href)) {
        a.href = href.startsWith('sms:') ? `sms:+1${textDigits}` : `tel:+1${phoneDigits}`;
      }
      if (/Call Phoenix/i.test(a.textContent || '') && a.tagName === 'A') a.href = `tel:+1${phoneDigits}`;
    });
    $$('a[href^="mailto:"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/phoenix4719190@gmail\.com|bookings@phoenixhibachi\.com|support@phoenixhibachi\.com|fenix2526050@gmail\.com/i.test(href)) a.href = `mailto:${bookingEmail}`;
    });
    $$('p,span,small,div,a').forEach(el => {
      if (!el || el.children.length > 4) return;
      const t = el.textContent || '';
      if (t.includes('phoenix4719190@gmail.com')) el.textContent = t.replace(/phoenix4719190@gmail\.com/g, bookingEmail);
      if (t.includes('347-471-9190')) el.textContent = el.textContent.replace(/347-471-9190/g, phoneDisplay);
      if (t.includes('www.phoenixhibachi.com')) el.textContent = el.textContent.replace(/www\.phoenixhibachi\.com/g, OFFICIAL.websiteLabel);
    });

    const phoneInput = $('#sitePhoneInput'); if (phoneInput && !phoneInput.value) phoneInput.value = phoneDigits;
    const textInput = $('#siteTextPhoneInput'); if (textInput && !textInput.value) textInput.value = textDigits;
    const bookingInput = $('#siteBookingEmailInput'); if (bookingInput && !bookingInput.value) bookingInput.value = bookingEmail;
    const supportInput = $('#siteSupportEmailInput'); if (supportInput && !supportInput.value) supportInput.value = supportEmail;
    const policyInput = $('#sitePolicyInput'); if (policyInput && !policyInput.value) policyInput.value = s.policy || OFFICIAL.policy;
  }

  // Keep old apply function but make it use official defaults and new DOM replacements.
  const oldApplyContact = (typeof applyContactSettingsV60 === 'function') ? applyContactSettingsV60 : null;
  if (oldApplyContact) {
    try {
      window.applyContactSettingsV60 = function(){
        mutateLegacyDefaultContacts();
        try { oldApplyContact(); } catch (error) { console.warn('Legacy contact apply warning:', error); }
        applyPublicContactDom();
      };
    } catch {}
  }

  async function saveContactToSupabase(settings){
    const client = (typeof initSupabaseClient === 'function') ? initSupabaseClient() : null;
    const session = (typeof supabaseSession !== 'undefined') ? supabaseSession : null;
    if (!client || !session) return { skipped: true, reason: 'Not logged in to Supabase.' };
    const payload = {
      key: 'contact_settings',
      value: settingsToDb(settings),
      updated_by: session.user?.id || null,
      public_read: true
    };
    const { error } = await client.from('app_settings').upsert(payload, { onConflict: 'key' });
    if (error) throw error;
    return { ok: true };
  }

  document.addEventListener('click', async function(event){
    const btn = event.target?.closest?.('#saveContactSettingsBtn');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const role = String((typeof currentDashboardRole !== 'undefined' ? currentDashboardRole : '') || '').toLowerCase();
    if (role && !['admin','owner','manager'].includes(role)) {
      toast('Only Admin / Manager can change public contact settings.', 'info');
      return false;
    }
    const settings = officialContactSettings({
      phone: $('#sitePhoneInput')?.value?.trim() || OFFICIAL.phoneDigits,
      textPhone: $('#siteTextPhoneInput')?.value?.trim() || $('#sitePhoneInput')?.value?.trim() || OFFICIAL.phoneDigits,
      bookingEmail: $('#siteBookingEmailInput')?.value?.trim() || OFFICIAL.bookingEmail,
      supportEmail: $('#siteSupportEmailInput')?.value?.trim() || OFFICIAL.supportEmail,
      policy: $('#sitePolicyInput')?.value?.trim() || OFFICIAL.policy
    });
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Saving...';
    saveContactSettings(settings);
    applyPublicContactDom();
    try {
      const result = await saveContactToSupabase(settings);
      toast(result?.skipped ? 'Contact settings saved locally. Supabase save skipped because you are not logged in.' : 'Contact settings saved.', 'success', 4200);
    } catch (error) {
      console.warn('V164 Supabase contact save failed:', error);
      toast('Saved locally, but Supabase save failed: ' + (error.message || error), 'error', 6500);
    } finally {
      btn.disabled = false;
      btn.textContent = oldText || 'Save contact settings';
    }
    return false;
  }, true);

  function renderCloseIcon(){
    const svg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 5.1 12 10.7l5.6-5.6 1.3 1.3-5.6 5.6 5.6 5.6-1.3 1.3-5.6-5.6-5.6 5.6-1.3-1.3 5.6-5.6-5.6-5.6z" fill="currentColor"/></svg>';
    $$('.modal-close').forEach(btn => {
      if (!btn.querySelector('svg')) btn.innerHTML = svg;
      btn.setAttribute('aria-label', 'Close');
      btn.type = 'button';
    });
  }

  function normalizeRole(role){
    const raw = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['admin','owner'].includes(raw)) return 'Admin';
    if (raw === 'manager') return 'Manager';
    if (raw === 'customer_service' || raw === 'customerservice' || raw === 'service' || raw === 'staff') return 'Customer Service';
    if (raw === 'chef' || raw === 'server') return 'Chef';
    return 'Member';
  }
  function dbRole(role){
    const ui = normalizeRole(role);
    return ({'Admin':'admin','Manager':'manager','Customer Service':'customer_service','Chef':'chef','Member':'customer'}[ui] || 'customer');
  }
  function roleDashboardTitle(role){
    const ui = normalizeRole(role);
    if (ui === 'Customer Service') return 'Customer Service Dashboard';
    if (ui === 'Chef') return 'Chef Dashboard';
    if (ui === 'Admin') return 'Admin Dashboard';
    if (ui === 'Manager') return 'Manager Dashboard';
    return 'Member Dashboard';
  }
  function findLocalAccountAnyRole(email, password){
    const target = String(email || '').trim().toLowerCase();
    const pass = String(password || '');
    const people = (typeof getPeopleRecords === 'function') ? getPeopleRecords() : [];
    const base = (typeof basePeopleRecords === 'function') ? basePeopleRecords() : [];
    const all = [...people, ...base];
    return all.find(p => {
      const emailMatch = String(p.email || p.account_email || '').trim().toLowerCase() === target;
      const status = String(p.status || p.accountStatus || p.account_status || 'active').toLowerCase();
      const statusOk = !['deleted','removed','inactive','paused'].includes(status);
      const savedPassword = String(p.tempPassword || p.password || '').trim();
      const passwordOk = savedPassword ? savedPassword === pass : false;
      return emailMatch && statusOk && passwordOk;
    }) || null;
  }
  function setDashboardHeading(role){
    const ui = normalizeRole(role);
    const title = $('#dashboardTitle');
    if (title) title.textContent = roleDashboardTitle(ui);
    const help = $('#dashboardHelp');
    if (help) help.innerHTML = `<span class="role-badge">${esc(ui)}</span> Secure Phoenix portal. Your dashboard is opened by account role, not by a public admin link.`;
    const acct = $('#accountLabel'); if (acct) acct.textContent = ui === 'Member' ? 'VIP Member' : ui;
  }
  const oldRenderDashboard = (typeof renderDashboard === 'function') ? renderDashboard : null;
  if (oldRenderDashboard) {
    try {
      renderDashboard = function(role){
        const ui = normalizeRole(role || (typeof currentDashboardRole !== 'undefined' ? currentDashboardRole : 'Member'));
        const result = oldRenderDashboard.call(this, ui);
        setTimeout(() => setDashboardHeading(ui), 0);
        return result;
      };
    } catch {}
  }
  async function openDashboardForAuthenticatedRole(role, email){
    const ui = normalizeRole(role);
    try { currentDashboardRole = ui; } catch {}
    try { if (typeof setPortalSessionMeta === 'function') setPortalSessionMeta(ui, email || ''); } catch {}
    try { if (typeof loadDashboardDataFromSupabase === 'function') await loadDashboardDataFromSupabase(); } catch (error) { console.warn('Dashboard data load warning:', error); }
    try { $('#loginModal')?.close?.(); } catch {}
    if (typeof isPortalRoute === 'function' && isPortalRoute()) {
      try { renderDashboard(ui); } catch (error) { console.warn('V164 dashboard render failed:', error); }
      const modal = $('#dashboardModal');
      if (modal && typeof modal.showModal === 'function' && !modal.open) modal.showModal();
    } else {
      try { localStorage.setItem('phoenixPortalPreferredTabV1', ui === 'Chef' ? 'dispatch' : 'orders'); } catch {}
      const url = new URL(window.location.href.replace(/#.*$/, ''));
      url.hash = `#portal?role=${encodeURIComponent(ui)}&email=${encodeURIComponent(email || '')}`;
      const opened = window.open(url.toString(), '_blank');
      if (!opened) window.location.href = url.toString();
    }
  }

  const loginForm = $('#portalLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(event){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const email = loginForm.querySelector('input[type="email"]')?.value?.trim() || '';
      const password = loginForm.querySelector('input[type="password"]')?.value || '';
      if (!email || !password) { toast('Enter email and password first.', 'info'); return false; }
      const button = loginForm.querySelector('button.gold-btn');
      const oldText = button?.textContent || 'Login';
      if (button) { button.disabled = true; button.textContent = 'Logging in...'; }
      try {
        let profile = null;
        try { profile = await signInPortal(email, password); }
        catch (remoteError) {
          const local = findLocalAccountAnyRole(email, password);
          if (!local) throw remoteError;
          const status = String(local.status || local.accountStatus || 'active').toLowerCase();
          if (dbRole(local.role) === 'chef' && status === 'pending') throw new Error('This chef account is pending admin approval.');
          profile = { role: local.role || 'customer', email: local.email || email, account_status: status, full_name: local.name || '' };
        }
        const role = normalizeRole(profile?.role);
        await openDashboardForAuthenticatedRole(role, email);
      } catch (error) {
        toast('Login failed: ' + (error.message || error), 'error', 7600);
      } finally {
        if (button) { button.disabled = false; button.textContent = oldText; }
      }
      return false;
    }, true);
  }

  function invoiceDate(order){
    try { return (typeof invoiceDateLine === 'function' ? invoiceDateLine(order) : [order.eventDate || order.event_date, order.eventTime || order.event_time].filter(Boolean).join(' ')); }
    catch { return [order.eventDate || order.event_date, order.eventTime || order.event_time].filter(Boolean).join(' '); }
  }
  function proteinText(order, m){
    try {
      const selections = m?.proteinSelections || order.proteinSelections || {};
      const summary = (typeof proteinSummary === 'function') ? proteinSummary(selections) : (order.proteinSummary || '');
      return `${m?.proteinSelectedTotal || 0}/${m?.proteinRequiredTotal || 0} portions ${summary}`.trim();
    } catch { return order.proteinSummary || 'Not selected'; }
  }
  function appliedCoupon(order){
    return order.couponCode || order.coupon_code || order.applied_coupon_code || '';
  }
  function invoiceAdjustmentRows(order, m){
    const couponDiscount = num(order.couponDiscount ?? order.coupon_discount ?? order.discount_amount, 0) || (appliedCoupon(order) ? num(m.discount, 0) : 0);
    const managerDiscount = num(order.managerDiscount ?? order.manager_discount, 0);
    const pointsDiscount = num(order.pointsDiscount ?? order.points_discount, 0);
    const giftCardUsed = num(order.giftCardUsed ?? order.gift_card_used, 0);
    const walletUsed = num(order.walletCreditUsed ?? order.wallet_credit_used ?? order.memberCreditUsed, 0);
    const paidExtra = Math.max(0, num(order.paidAmount ?? order.paid_amount, 0) - num(m.depositPaid, 0));
    const balance = Math.max(0, num(m.guestTotalAfterDeposit, 0) - paidExtra - giftCardUsed - walletUsed - managerDiscount - pointsDiscount);
    return { couponDiscount, managerDiscount, pointsDiscount, giftCardUsed, walletUsed, paidExtra, balance };
  }

  if (typeof guestInvoiceHtml === 'function' && typeof calculateOrderMoney === 'function') {
    guestInvoiceHtml = function(order = {}){
      const m = calculateOrderMoney(order || {});
      const ref = esc(order.id || order.booking_number || (typeof generateOrderId === 'function' ? generateOrderId('PHX') : 'PHX'));
      const addons = (m.addons || []).length
        ? m.addons.map(item => `<div class="invoice-row invoice-addon-row" style="color:#c00000;font-weight:900;"><span style="color:#c00000!important;font-weight:900!important;">${esc(item.name)}${item.qty && item.qty > 1 ? ' × ' + item.qty : ''}</span><em></em><b style="color:#c00000!important;font-weight:900!important;">Total: ${moneySafe(item.price)}</b></div>`).join('')
        : `<div class="invoice-row"><span>Add-ons</span><em></em><b style="color:#c00000;font-weight:800;">Total: $0</b></div>`;
      const premiumProteinRow = m.proteinUpcharge > 0 ? `<div class="invoice-row"><span>Premium protein upgrade</span><em>${m.proteinPremiumCount || 0} × $5</em><b>Total: ${moneySafe(m.proteinUpcharge)}</b></div>` : '';
      const allergies = Array.isArray(order.allergies) ? order.allergies.join(', ') : (order.allergies || order.allergyNotes || 'None listed');
      const adj = invoiceAdjustmentRows(order, m);
      const tip20 = num(m.guestTotalAfterDeposit, 0) + num(m.tip20, 0);
      const tip25 = num(m.guestTotalAfterDeposit, 0) + num(m.tip25, 0);
      const tip30 = num(m.guestTotalAfterDeposit, 0) + num(m.tip30, 0);
      const coupon = appliedCoupon(order);
      return `<section class="guest-invoice guest-invoice-v164" data-watermark="PHOENIX HIBACHI ${ref}">
        <div class="invoice-top-line"></div>
        <div class="invoice-ref">Ref ID: ${ref}</div>
        <div class="invoice-brand invoice-brand-v164">
          <img class="invoice-logo-v164" src="${OFFICIAL.logo}" alt="Phoenix Hibachi logo">
          <strong>PHOENIX HIBACHI</strong>
          <span class="invoice-brand-contact"><span>${OFFICIAL.phoneDisplay}</span><span>${OFFICIAL.bookingEmail}</span><span>${OFFICIAL.websiteLabel}</span></span>
        </div>
        <div class="invoice-main-grid">
          <div class="invoice-labels invoice-labels-v164">
            <div class="invoice-highlight-yellow"><b>When:</b><span>${esc(invoiceDate(order))}</span></div>
            <div class="invoice-highlight-yellow"><b>Name:</b><span>${esc(order.name || order.customer_name || '')}</span></div>
            <div class="invoice-highlight-yellow"><b>Phone:</b><span>${esc(order.phone || order.customer_phone || '')}</span></div>
            <div class="invoice-highlight-yellow"><b>Address:</b><span>${esc(order.address || '')}</span></div>
            <div><b>Number of Adults:</b><span>${num(m.adults, 0)}</span></div>
            <div><b>Number of Kids:</b><span>${num(m.kids, 0)}</span></div>
          </div>
          <div class="invoice-money-block invoice-money-block-v164">
            <div class="invoice-row"><span>Adult</span><em>Total: ${num(m.adults,0)}</em><b>Total: ${moneySafe(m.adultFoodTotal)}</b></div>
            <div class="invoice-row"><span>Kid</span><em>Total: ${num(m.kids,0)}</em><b>Total: ${moneySafe(m.kidFoodTotal)}</b></div>
            <div class="invoice-row"><span>Package charge</span><em>${esc(m.packageName)}</em><b>Total: ${moneySafe(m.packageSubtotal)}</b></div>
            ${premiumProteinRow}
            ${addons}
            <div class="invoice-row"><span>Travel Fee</span><em></em><b style="color:#c00000;font-weight:800;">Total: ${moneySafe(m.travelFee)}</b></div>
            <div class="invoice-row"><span>Sales Tax</span><em>${esc(m.taxLabel)}</em><b>Total: ${moneySafe(m.salesTax)}</b></div>
          </div>
        </div>
        <div class="invoice-payment-grid-v164">
          <div><b>Coupon Code</b><span>${coupon ? esc(coupon) : 'None'}</span></div>
          <div><b>Coupon Discount</b><span>${moneySafe(adj.couponDiscount)}</span></div>
          <div><b>Manager Discount</b><span>${moneySafe(adj.managerDiscount)}</span></div>
          <div><b>Points Discount</b><span>${moneySafe(adj.pointsDiscount)}</span></div>
          <div><b>Gift Card Applied</b><span>${moneySafe(adj.giftCardUsed)}</span></div>
          <div><b>Wallet / Party Credit Applied</b><span>${moneySafe(adj.walletUsed)}</span></div>
        </div>
        <div class="invoice-ledger-grid-v164">
          <div><b>Total</b><span>${moneySafe(m.guestTotalBeforeDeposit)}</span></div>
          <div><b>Deposit Paid</b><span>${moneySafe(m.depositPaid)}</span></div>
          <div><b>Other Card/Zelle Payments Confirmed</b><span>${moneySafe(adj.paidExtra)}</span></div>
          <div class="balance-due-v164"><b>Balance Due</b><span>${moneySafe(adj.balance)}</span></div>
        </div>
        <div class="invoice-notes invoice-food-alert"><b>FOOD ALLERGIES</b><span>${esc(allergies || 'None listed')}</span></div>
        <div class="invoice-protein-detail invoice-food-alert"><b>PROTEIN SELECTIONS</b><span>${esc(proteinText(order, m))}</span></div>
        <div class="invoice-rule-box invoice-rule-box-v164">
          <b>Payment / Coupon / Gift Card Rules</b>
          <span>Zelle QR and card payment support are prepared for this invoice. Zelle payments must be manually confirmed by Phoenix Hibachi before the balance is marked paid.</span>
          <span>One coupon only per order. Coupons cannot be combined with another coupon or promotion.</span>
          <span>Random one-time coupons are locked after use. Date/month coupons are valid only within their eligible event date range and expire automatically.</span>
          <span>Gift card and wallet credits are payment methods, not coupons. They reduce the remaining balance after approved discounts.</span>
          <strong class="coupon-red-warning">Final availability, final price, discounts, credits, and payment confirmation must be confirmed by Phoenix Hibachi.</strong>
        </div>
        <div class="invoice-cash-note"><b>Payment note:</b><span>For fastest service, book online at ${OFFICIAL.websiteLabel} or text ${OFFICIAL.phoneDisplay}. Card/Zelle/gift card modules may appear after staff activation.</span></div>
        <div class="tip-suggestions-final tip-suggestions-v164">
          <b>Tip Suggestions</b>
          <table><thead><tr><th>Rate</th><th>Tip</th><th>Total if added</th></tr></thead><tbody>
            <tr><td>20%</td><td>${moneySafe(m.tip20)}</td><td>${moneySafe(tip20)}</td></tr>
            <tr><td>25%</td><td>${moneySafe(m.tip25)}</td><td>${moneySafe(tip25)}</td></tr>
            <tr><td>30%</td><td>${moneySafe(m.tip30)}</td><td>${moneySafe(tip30)}</td></tr>
          </tbody></table>
          <em>Tips are optional and appreciated. Cash tips only.</em>
        </div>
        <div class="invoice-security-seal-v164"><b>Verified Phoenix Hibachi Order</b><span>Ref ${ref} · Generated from the Phoenix Hibachi booking system · ${OFFICIAL.websiteLabel}</span></div>
        <div class="invoice-footer-red">THIS IS AN AUTOMATED INVOICE. FOR HELP, TEXT ${OFFICIAL.phoneDisplay} OR EMAIL ${OFFICIAL.supportEmail}.</div>
      </section>`;
    };
  }

  function hardenLookupLinks(){
    try {
      if (typeof orderLookupResultHtml !== 'function' || window.__PHX_V164_LOOKUP_WRAP__) return;
      window.__PHX_V164_LOOKUP_WRAP__ = true;
      const oldLookup = orderLookupResultHtml;
      orderLookupResultHtml = function(order){
        return String(oldLookup(order))
          .replace(/tel:13474719190/g, `tel:+1${OFFICIAL.phoneDigits}`)
          .replace(/347-471-9190/g, OFFICIAL.phoneDisplay)
          .replace(/www\.phoenixhibachi\.com/g, OFFICIAL.websiteLabel)
          .replace(/phoenix4719190@gmail\.com/g, OFFICIAL.bookingEmail);
      };
    } catch {}
  }

  function initLoginUi(){
    const form = $('#portalLoginForm');
    if (!form) return;
    $$('.login-tabs button', form).forEach((btn, idx) => btn.classList.toggle('active', idx === 0));
    const applyBtn = $('#loginApplyActionBtn');
    if (applyBtn) { applyBtn.hidden = false; applyBtn.textContent = 'Apply for Membership'; }
  }

  function installDomObserver(){
    if (window.__PHX_V164_DOM_OBSERVER__) return;
    window.__PHX_V164_DOM_OBSERVER__ = true;
    const refresh = () => {
      try { applyPublicContactDom(); } catch {}
      try { renderCloseIcon(); } catch {}
    };
    /* V166: do not watch/rewrite the whole document. Refresh only when a
       dashboard or confirmation dialog is deliberately opened. */
    document.addEventListener('phoenix:v166-dashboard-ready', refresh);
    document.addEventListener('phoenix:confirm-email-opened', refresh);
  }

  function bootstrap(){
    mutateLegacyDefaultContacts();
    saveContactSettings(readContactSettings());
    applyPublicContactDom();
    renderCloseIcon();
    initLoginUi();
    hardenLookupLinks();
    installDomObserver();
    setTimeout(applyPublicContactDom, 300);
    setTimeout(renderCloseIcon, 300);
    setTimeout(applyPublicContactDom, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
  else bootstrap();
})();



/* Phoenix OS V164.1 UI Finish
   Purpose: polish admin tools, one-page invoice print, protein wording, and alerts
   without changing database schema or breaking working booking logic. */
(function phoenixOsV1641UiFinish(){
  if (window.__PHX_OS_V1641_UI_FINISH__) return;
  window.__PHX_OS_V1641_UI_FINISH__ = true;
  window.PHX_BUILD_VERSION = (window.PHX_BUILD_VERSION || 'V164') + '+V164.1_UI_FINISH';

  const official = window.PHX_OS?.official || {
    businessName: 'Phoenix Hibachi',
    phoneDisplay: '(516) 518-3325',
    phoneDigits: '5165183325',
    bookingEmail: 'booking@phoenix-hibachi.com',
    supportEmail: 'support@phoenix-hibachi.com',
    websiteLabel: 'phoenix-hibachi.com'
  };

  function safeText(value){ return String(value ?? '').trim(); }
  function esc(value){
    try { return typeof escapeHtml === 'function' ? escapeHtml(value ?? '') : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    catch { return String(value ?? ''); }
  }
  function moneyText(value){
    try { return typeof money === 'function' ? money(value) : `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`; }
    catch { return `$${Number(value || 0).toFixed(2)}`; }
  }
  function orderById(id){
    const key = String(id || '');
    if (!key) return null;
    try { const found = findDashboardOrder?.(key); if (found) return found; } catch {}
    try { const found = findOrder?.(key); if (found) return found; } catch {}
    try { return (getStoredOrders?.() || []).find(o => String(o.id || o.booking_number) === key) || null; } catch {}
    return null;
  }
  function firstReadable(value){
    try { return firstReadableTime?.(value || '') || value || ''; } catch { return value || ''; }
  }
  function cleanProteinText(raw){
    let text = safeText(raw);
    if (!text) return '';
    text = text.replace(/\b(\d+)\s*\/\s*\1\s*portions?\s*/i, 'Total selected: $1 portions · ');
    text = text.replace(/\b(\d+)\s*\/\s*(\d+)\s*portions?\s*/i, 'Selected $1 of $2 portions · ');
    text = text.replace(/\s+·\s*$/,'').trim();
    return text;
  }
  function proteinDisplay(order){
    const m = (() => { try { return calculateOrderMoney?.(order) || {}; } catch { return {}; } })();
    let summary = '';
    try { summary = proteinSummary?.(m.proteinSelections || order.proteinSelections || order.protein_selections || []) || ''; } catch {}
    if (!summary) summary = safeText(order.proteinSummary || order.protein_summary || '');
    if (!summary) {
      const notes = safeText(order.admin_notes || order.specialNotes || '');
      const match = notes.match(/Protein selections:\s*([^\n]+)/i);
      if (match) summary = match[1];
    }
    const selected = Number(m.proteinSelectedTotal || order.proteinSelectedTotal || 0);
    const required = Number(m.proteinRequiredTotal || order.proteinRequiredTotal || 0);
    if (summary && selected && required && selected !== required) return `Selected ${selected} of ${required} portions · ${summary}`;
    if (summary && selected) return `Total selected: ${selected} portions · ${summary}`;
    if (summary) return cleanProteinText(summary);
    return 'No protein selections recorded yet.';
  }
  function orderTotalDisplay(order){
    try {
      const m = calculateOrderMoney?.(order) || {};
      const total = Number(m.guestTotalBeforeDeposit || m.finalTotal || order.finalTotal || order.final_total || order.total || 0);
      const travel = Number(m.travelFee || order.travelFee || order.travel_fee || 0);
      const paid = Number(m.depositPaid || order.depositPaid || order.deposit_amount || 0);
      const balance = Math.max(0, Number(m.guestTotalAfterDeposit || total - paid || 0));
      return `Total ${moneyText(total)} · Travel ${moneyText(travel)} · Balance ${moneyText(balance)}`;
    } catch { return 'Totals available on invoice.'; }
  }


  function numberValue(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function paymentSummary(order = {}){
    const depositPaid = Math.max(0, numberValue(order.depositPaid ?? order.deposit_amount ?? order.paidAmount ?? order.paid_amount, 0));
    const depositStatus = String(order.depositStatus || order.deposit_status || '').trim().toLowerCase();
    const verification = String(order.paymentVerificationStatus || order.payment_verification_status || '').trim().toLowerCase();
    const paymentStatus = String(order.paymentStatus || order.payment_status || '').trim().toLowerCase();
    const preference = String(order.paymentPreference || order.payment_preference || '').trim();
    const balanceRaw = order.balanceDueCents ?? order.balance_due_cents;
    const hasBalance = balanceRaw !== null && balanceRaw !== undefined && String(balanceRaw) !== '';
    const balanceCents = hasBalance ? Math.max(0, numberValue(balanceRaw, 0)) : null;
    let calculatedTotal = 0;
    try { calculatedTotal = numberValue(window.calculateOrderMoney?.(order)?.guestTotalBeforeDeposit, 0); } catch {}
    const fullPaid = (
      /\bpaid\s*in\s*full\b|\bfully\s*paid\b/.test(paymentStatus) ||
      (balanceCents !== null && balanceCents <= 0 && verification === 'verified' && depositPaid > 0) ||
      (calculatedTotal > 0 && depositPaid >= calculatedTotal - 0.01)
    );
    const depositVerified = (
      ['paid', 'paid_by_benefits'].includes(depositStatus) ||
      (verification === 'verified' && depositPaid > 0) ||
      /\bdeposit\s*received\b|\bcash\s*deposit\b|\bzelle\s*deposit\b/.test(paymentStatus)
    );
    const pending = (
      ['pending', 'pending_manual_verification'].includes(depositStatus) ||
      ['awaiting_webhook', 'not_verified'].includes(verification) ||
      /\btransfer\s*pending\b/.test(paymentStatus)
    );
    if (fullPaid) return { kind:'full', label:'PAID IN FULL', detail: preference || 'Verified payment' };
    if (depositVerified) return { kind:'deposit', label:`DEPOSIT PAID ${depositPaid > 0 ? '$' + depositPaid.toFixed(0) : ''}`.trim(), detail: preference || 'Verified deposit' };
    if (pending) return { kind:'pending', label:'PAYMENT PENDING', detail: preference || 'Awaiting verification' };
    return { kind:'unpaid', label:'DEPOSIT UNPAID', detail:'No verified deposit' };
  }
  function updatePaymentBadge(header, order){
    if (!header) return;
    const summary = paymentSummary(order);
    let badge = header.querySelector('[data-v233-payment-badge]');
    if (!badge) {
      badge = document.createElement('span');
      badge.setAttribute('data-v233-payment-badge', 'true');
      badge.className = 'phx-v233-payment-badge';
      header.appendChild(badge);
    }
    badge.className = `phx-v233-payment-badge is-${summary.kind}`;
    badge.textContent = summary.label;
    badge.title = summary.detail;
  }

  function enhanceOrderCards(){
    document.querySelectorAll('[data-v102-order-card], [data-v101-order-card]').forEach(card => {
      const id = card.getAttribute('data-v102-order-card') || card.getAttribute('data-v101-order-card');
      const order = orderById(id);
      if (!order) return;

      card.querySelectorAll('[data-v102-details], [data-v101-details]').forEach(btn => {
        btn.textContent = 'Order details / edit';
        btn.setAttribute('aria-label', 'Open order details, date/time editor, and chef tools');
      });
      card.querySelectorAll('[data-v102-time-open], [data-v101-open-time]').forEach(btn => {
        btn.setAttribute('aria-hidden', 'true');
        btn.tabIndex = -1;
      });

      const panel = card.querySelector('.v102-order-panel, .v101-order-panel');
      const grid = panel?.querySelector('.v102-detail-grid, .v101-detail-grid');
      if (grid && !grid.querySelector('[data-v1641-food]')) {
        const food = document.createElement('p');
        food.className = 'v1641-order-food';
        food.setAttribute('data-v1641-food', 'true');
        food.innerHTML = `<b>Food / proteins</b><br>${esc(proteinDisplay(order))}<small>${esc(orderTotalDisplay(order))}</small>`;
        grid.appendChild(food);
      }
    });
  }

  function openPanelFromDetailsButtons(){
    document.addEventListener('click', event => {
      const btn = event.target?.closest?.('[data-v102-details], [data-v101-details]');
      if (!btn) return;
      const id = btn.getAttribute('data-v102-details') || btn.getAttribute('data-v101-details');
      if (!id) return;
      setTimeout(() => {
        const panel = document.querySelector(`[data-v102-panel="${CSS.escape(String(id))}"], [data-v101-panel="${CSS.escape(String(id))}"]`);
        const date = panel?.querySelector('[data-v102-date], [data-v101-date]');
        if (panel && !panel.hidden) date?.scrollIntoView?.({ behavior:'smooth', block:'nearest' });
      }, 80);
    }, true);
  }

  function forceOnePagePrint(){ /* V166: V163 print engine remains authoritative. */ }
  document.getElementById('runPrintBtn')?.addEventListener('click', forceOnePagePrint, true);
  window.addEventListener('beforeprint', forceOnePagePrint);
  window.addEventListener('afterprint', () => {
    const area = document.getElementById('printArea');
    if (!area) return;
    area.classList.remove('phx-force-one-page-v1641');
  });

  function patchInvoiceHtml(){
    if (typeof guestInvoiceHtml !== 'function' || window.__PHX_V1641_INVOICE_WRAP__) return;
    window.__PHX_V1641_INVOICE_WRAP__ = true;
    const previous = guestInvoiceHtml;
    guestInvoiceHtml = function(order = {}){
      let html = String(previous(order) || '');
      html = html.replace(/(PROTEIN SELECTIONS<\/b>\s*<span>)([^<]*)(<\/span>)/i, (all, a, body, c) => `${a}${esc(cleanProteinText(body))}${c}`);
      html = html.replace(/\b\d+\s*\/\s*\d+\s*portions?\s*/gi, match => cleanProteinText(match));
      html = html.replace(/347-471-9190/g, official.phoneDisplay || '(516) 518-3325');
      html = html.replace(/www\.phoenixhibachi\.com/g, official.websiteLabel || 'phoenix-hibachi.com');
      html = html.replace(/support@phoenix-hibachi\.com/g, official.supportEmail || 'support@phoenix-hibachi.com');
      html = html.replace(/booking@phoenix-hibachi\.com/g, official.bookingEmail || 'booking@phoenix-hibachi.com');
      return html;
    };
  }

  function phoenixAlert(message, title){
    const existing = document.querySelector('.phx-alert-layer-v1641');
    existing?.remove();
    const layer = document.createElement('div');
    layer.className = 'phx-alert-layer-v1641';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.innerHTML = `<div class="phx-alert-card-v1641"><h3>${esc(title || 'Phoenix Hibachi')}</h3><p>${esc(message)}</p><button type="button">OK</button></div>`;
    document.body.appendChild(layer);
    const close = () => layer.remove();
    layer.querySelector('button')?.addEventListener('click', close, { once:true });
    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    setTimeout(() => layer.querySelector('button')?.focus?.(), 20);
  }
  function patchAlert(){
    if (window.__PHX_V1641_ALERT_WRAP__) return;
    window.__PHX_V1641_ALERT_WRAP__ = true;
    const nativeAlert = window.alert.bind(window);
    window.__PHX_NATIVE_ALERT__ = nativeAlert;
    window.alert = function(message){
      try { phoenixAlert(String(message ?? ''), 'Phoenix Hibachi'); }
      catch { nativeAlert(message); }
    };
  }

  function scan(){
    enhanceOrderCards();
    patchInvoiceHtml();
  }

  openPanelFromDetailsButtons();
  patchAlert();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once:true });
  else scan();
  // V166: polling removed; updates are event/observer driven.
  try {
    const root = document.querySelector('[data-dashboard-page="orders"]');
    if (root) {
      const observer = new MutationObserver(() => { clearTimeout(window.__PHX_V1641_SCAN_TIMER__); window.__PHX_V1641_SCAN_TIMER__ = setTimeout(scan, 80); });
      observer.observe(root, { childList:true, subtree:true });
    }
  } catch {}
})();



/* Phoenix Hibachi V164.2 — Auth/Profile finish
   Safe front-end patch. Requires the companion SQL only for persistent avatar_url/profile policies.
*/
(function initPhoenixV1642AuthProfileFinish(){
  if (window.__PHX_V1642_AUTH_PROFILE_FINISH__) return;
  window.__PHX_V1642_AUTH_PROFILE_FINISH__ = true;
  window.PHX_BUILD_VERSION = 'V164_2_AUTH_PROFILE_FINISH';

  const HOME_URL = 'https://phoenix-hibachi.com';
  const AVATAR_BUCKET = 'profile-avatars';
  const AVATAR_PREFIX = 'phoenix_member_avatar_v133_';
  const PORTAL_META_KEYS = [
    'phoenixPortalSessionMetaV1',
    'phoenixPortalPreferredTabV1',
    'phoenix_portal_email',
    'phoenix_portal_role'
  ];
  const nativeAlert = window.alert ? window.alert.bind(window) : null;

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
  function getClient(){
    try { return typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null; }
    catch { return null; }
  }
  function cleanEmail(email){ return String(email || '').trim().toLowerCase(); }
  function currentLoginEmail(){
    const selectors = [
      '#portalLoginForm input[type="email"]',
      '#memberSignupForm input[name="email"]',
      '#chefApplyForm input[name="email"]',
      '#forgotPasswordForm input[type="email"]',
      '#changePasswordForm input[name="email"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = cleanEmail(el?.value);
      if (value) return value;
    }
    try { return cleanEmail(window.supabaseSession?.user?.email || window.supabaseProfile?.email || JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1') || '{}')?.email); }
    catch { return ''; }
  }

  function ensureSystemDialog(){
    let dialog = document.getElementById('phxV1642SystemDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxV1642SystemDialog';
    dialog.className = 'phx-v1642-system-dialog';
    dialog.innerHTML = `
      <section class="phx-v1642-system-card" role="alertdialog" aria-modal="true" aria-labelledby="phxV1642SystemTitle">
        <button type="button" class="phx-v1642-close" data-v1642-close aria-label="Close">×</button>
        <p class="phx-v1642-eyebrow" data-v1642-eyebrow>Phoenix Hibachi</p>
        <h3 id="phxV1642SystemTitle" data-v1642-title>Notice</h3>
        <p data-v1642-message></p>
        <div class="phx-v1642-system-actions" data-v1642-actions></div>
      </section>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function showSystemNotice({ title='Notice', message='', eyebrow='Phoenix Hibachi', actions=[] } = {}){
    return new Promise(resolve => {
      const dialog = ensureSystemDialog();
      dialog.querySelector('[data-v1642-eyebrow]').textContent = eyebrow;
      dialog.querySelector('[data-v1642-title]').textContent = title;
      dialog.querySelector('[data-v1642-message]').textContent = message;
      const actionsBox = dialog.querySelector('[data-v1642-actions]');
      actionsBox.innerHTML = '';
      const close = (value) => {
        try { dialog.close(); } catch { dialog.removeAttribute('open'); }
        resolve(value);
      };
      const closeBtn = dialog.querySelector('[data-v1642-close]');
      closeBtn.onclick = () => close('close');
      const configured = Array.isArray(actions) && actions.length ? actions : [{ label:'Got it', value:'ok', primary:true }];
      configured.forEach(action => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `phx-v1642-btn ${action.primary === false ? 'secondary' : ''}`;
        btn.textContent = action.label || 'OK';
        btn.addEventListener('click', async () => {
          if (typeof action.onClick === 'function') {
            btn.disabled = true;
            const old = btn.textContent;
            if (action.loadingText) btn.textContent = action.loadingText;
            try {
              const keepOpen = await action.onClick();
              if (keepOpen === true) { btn.disabled = false; btn.textContent = old; return; }
            } catch (error) {
              btn.disabled = false;
              btn.textContent = old;
              showSystemNotice({ title:'Action failed', message: error?.message || String(error), eyebrow:'Phoenix Hibachi' });
              return;
            }
          }
          close(action.value || action.label || 'ok');
        });
        actionsBox.appendChild(btn);
      });
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); close('escape'); }, { once:true });
      try { if (!dialog.open) dialog.showModal(); }
      catch { dialog.setAttribute('open',''); }
    });
  }
  window.phoenixSystemNotice = showSystemNotice;

  function looksEmailUnconfirmed(message){
    const raw = String(message || '');
    return /email\s+not\s+confirmed|not\s+confirmed|confirm\s+your\s+email|email\s+confirmation/i.test(raw);
  }
  async function resendConfirmation(email){
    const clean = cleanEmail(email || currentLoginEmail());
    if (!clean) throw new Error('Enter the account email first, then click resend confirmation.');
    const client = getClient();
    if (!client?.auth?.resend) throw new Error('Supabase resend is not available on this browser. Refresh the page and try again.');
    const { error } = await client.auth.resend({
      type: 'signup',
      email: clean,
      options: { emailRedirectTo: HOME_URL }
    });
    if (error) throw error;
    await showSystemNotice({
      title: 'Confirmation email sent',
      message: `We sent a new confirmation email to ${clean}. Please check Inbox, Spam/Junk, and Promotions. After confirming, return to Phoenix Hibachi and log in again.`,
      eyebrow: 'Check your email'
    });
  }
  window.phoenixResendConfirmationEmail = resendConfirmation;

  function normalizeAlertText(raw){
    const text = String(raw ?? '').replace(/^Login failed:\s*/i, '').trim();
    if (looksEmailUnconfirmed(text)) {
      return {
        title: 'Confirm your email first',
        eyebrow: 'Account not activated',
        message: 'Your account was created, but the email has not been confirmed yet. Please open the confirmation email and click the link before logging in. If you did not receive it, resend the confirmation email.',
        emailConfirm: true
      };
    }
    if (/account\s+created|member\s+portal\s+account\s+created|confirm\s+email/i.test(text)) {
      return {
        title: 'Check your email',
        eyebrow: 'Account created',
        message: 'Your account was created. Please check your email and click the confirmation link before logging in. If you do not see it, check Spam/Junk or use Resend confirmation.',
        emailConfirm: true
      };
    }
    return { title:'Phoenix Hibachi', eyebrow:'System notice', message:text || 'Done', emailConfirm:false };
  }

  window.alert = function phoenixV1642Alert(message){
    const normalized = normalizeAlertText(message);
    if (normalized.emailConfirm) {
      return showSystemNotice({
        title: normalized.title,
        eyebrow: normalized.eyebrow,
        message: normalized.message,
        actions: [
          { label:'Resend confirmation email', loadingText:'Sending…', primary:true, onClick: async () => { await resendConfirmation(currentLoginEmail()); } },
          { label:'Got it', primary:false, value:'ok' }
        ]
      });
    }
    return showSystemNotice(normalized);
  };

  function addLoginHelper(){
    const form = document.getElementById('portalLoginForm');
    if (!form || form.querySelector('[data-v1642-login-helper]')) return;
    const helper = document.createElement('div');
    helper.className = 'phx-v1642-login-helper';
    helper.setAttribute('data-v1642-login-helper','');
    helper.innerHTML = `
      <strong>New customer account?</strong><br>
      Please confirm your email before logging in. No email? Check Spam/Junk or resend it below.<br>
      <button type="button" data-v1642-resend-confirmation>Resend confirmation email</button>`;
    form.appendChild(helper);
  }

  document.addEventListener('click', async (event) => {
    const resend = event.target?.closest?.('[data-v1642-resend-confirmation]');
    if (!resend) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      resend.disabled = true;
      const old = resend.textContent;
      resend.textContent = 'Sending…';
      await resendConfirmation(currentLoginEmail());
      resend.textContent = old;
    } catch (error) {
      showSystemNotice({ title:'Could not resend', message:error?.message || String(error), eyebrow:'Phoenix Hibachi' });
    } finally {
      resend.disabled = false;
    }
  }, true);

  function removeAuthStorage(){
    const shouldRemove = key => {
      const k = String(key || '');
      return PORTAL_META_KEYS.includes(k)
        || /^sb-[a-z0-9]+-auth-token$/i.test(k)
        || /supabase\.auth\.token/i.test(k)
        || /^phoenix_portal_(email|role|session)$/i.test(k);
    };
    [localStorage, sessionStorage].forEach(store => {
      try {
        for (let i = store.length - 1; i >= 0; i--) {
          const key = store.key(i);
          if (shouldRemove(key)) store.removeItem(key);
        }
      } catch {}
    });
  }
  function resetAccountUI(){
    try { window.supabaseSession = null; } catch {}
    try { window.supabaseProfile = null; } catch {}
    try { window.remoteOrdersCache = null; } catch {}
    try { window.remoteChefApplicationsCache = null; } catch {}
    document.body.classList.add('phx-v1642-logging-out');
    document.body.classList.remove('portal-mode');
    document.querySelectorAll('.login-entry, .mobile-login-entry').forEach(el => {
      el.hidden = false;
      el.style.display = '';
      el.setAttribute('aria-hidden','false');
    });
    document.querySelectorAll('#portalAccount,#mobilePortalEntry,.portal-account').forEach(el => {
      el.hidden = true;
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
    });
    try { if (typeof window.closeAccountDropdown === 'function') window.closeAccountDropdown(); } catch {}
    ['dashboardModal','loginModal','changePasswordModal','forgotPasswordModal','memberSignupModal','chefApplyModal'].forEach(id => {
      try { const el = window[id] || document.getElementById(id); if (el?.open) el.close(); } catch {}
    });
    try { if (typeof window.updateAccountMenuState === 'function') window.updateAccountMenuState(); } catch {}
    setTimeout(() => document.body.classList.remove('phx-v1642-logging-out'), 1500);
  }
  async function robustSignOut({message='', redirect=true} = {}){
    document.body.classList.add('phx-v1642-logging-out');
    const client = getClient();
    try { if (client?.auth?.signOut) await client.auth.signOut({ scope:'local' }); } catch {}
    removeAuthStorage();
    resetAccountUI();
    if (message) await showSystemNotice({ title:'Logged out', message, eyebrow:'Phoenix Hibachi' });
    if (redirect) {
      const target = (typeof window.cleanIndexUrl === 'function') ? window.cleanIndexUrl() : HOME_URL;
      setTimeout(() => { window.location.replace(target); }, 180);
    }
  }
  window.phoenixRobustLogout = robustSignOut;

  const originalSignOutPortal = window.signOutPortal;
  if (typeof originalSignOutPortal === 'function') {
    window.signOutPortal = async function patchedSignOutPortal(reason = ''){
      try { await originalSignOutPortal.call(this, ''); } catch {}
      await robustSignOut({ message: reason || '', redirect:false });
    };
  }
  const originalSignOutAndClosePortal = window.signOutAndClosePortal;
  if (typeof originalSignOutAndClosePortal === 'function') {
    window.signOutAndClosePortal = async function patchedSignOutAndClosePortal(){
      try { await originalSignOutAndClosePortal.call(this); } catch {}
      await robustSignOut({ redirect:true });
    };
  }

  document.addEventListener('click', async (event) => {
    const logout = event.target?.closest?.('[data-portal-logout], [data-account-action="logout"]');
    if (!logout) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await robustSignOut({ message:'You have been logged out of Phoenix Hibachi.', redirect:true });
  }, true);

  function emailForAvatar(){
    return cleanEmail(window.supabaseSession?.user?.email || window.supabaseProfile?.email || currentLoginEmail() || 'local-member') || 'local-member';
  }
  function avatarKey(){ return AVATAR_PREFIX + emailForAvatar(); }
  function setLocalAvatar(url){
    try {
      if (url) localStorage.setItem(avatarKey(), url);
      else localStorage.removeItem(avatarKey());
    } catch {}
  }
  function initials(){
    const name = window.supabaseProfile?.full_name || emailForAvatar() || 'Member';
    return String(name).trim().charAt(0).toUpperCase() || 'M';
  }
  function refreshAvatarDom(url){
    document.querySelectorAll('[data-member-avatar-preview-v133],[data-member-profile-avatar-v133]').forEach(target => {
      target.innerHTML = url ? `<img src="${esc(url)}" alt="Profile photo">` : `<span>${esc(initials())}</span>`;
    });
  }
  function setAvatarStatus(message, type='ok'){
    const block = document.querySelector('[data-member-avatar-block-v133]');
    if (!block) return;
    let status = block.querySelector('[data-v1642-avatar-status]');
    if (!status) {
      status = document.createElement('div');
      status.className = 'phx-v1642-avatar-status';
      status.setAttribute('data-v1642-avatar-status','');
      block.appendChild(status);
    }
    status.className = `phx-v1642-avatar-status ${type}`;
    status.textContent = message || '';
  }
  async function currentSessionAndProfile(){
    const client = getClient();
    if (!client) return { client:null, session:null, user:null, profile:null };
    const { data } = await client.auth.getSession().catch(() => ({ data:null }));
    const session = data?.session || window.supabaseSession || null;
    const user = session?.user || window.supabaseSession?.user || null;
    let profile = window.supabaseProfile || null;
    if (user?.id && client.from) {
      try {
        const res = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (res?.data) {
          profile = res.data;
          try { window.supabaseProfile = profile; } catch {}
        }
      } catch {}
    }
    return { client, session, user, profile };
  }
  async function syncAvatarFromSupabase(){
    const { profile } = await currentSessionAndProfile();
    const url = profile?.avatar_url || '';
    if (url) {
      setLocalAvatar(url);
      refreshAvatarDom(url);
    }
  }
  async function uploadAvatar(file){
    const { client, user } = await currentSessionAndProfile();
    if (!client || !user?.id) throw new Error('Please log in before saving a profile photo.');
    if (!file || !file.type?.startsWith('image/')) throw new Error('Please choose an image file.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    setAvatarStatus('Uploading photo to your Phoenix profile…', 'warn');
    const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, file, { cacheControl:'3600', upsert:true, contentType:file.type });
    if (uploadError) throw uploadError;
    const { data: publicData } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = publicData?.publicUrl || '';
    if (!url) throw new Error('Supabase did not return a profile photo URL.');
    const { error: profileError } = await client.from('profiles').update({ avatar_url:url, updated_at: new Date().toISOString() }).eq('id', user.id);
    if (profileError) throw profileError;
    try { window.supabaseProfile = { ...(window.supabaseProfile || {}), avatar_url:url }; } catch {}
    setLocalAvatar(url);
    refreshAvatarDom(url);
    setAvatarStatus('Profile photo saved. It will stay after refresh/login.', 'ok');
    return url;
  }
  async function removePersistentAvatar(){
    const { client, user } = await currentSessionAndProfile();
    setLocalAvatar('');
    refreshAvatarDom('');
    if (client && user?.id) {
      try {
        await client.from('profiles').update({ avatar_url:null, updated_at: new Date().toISOString() }).eq('id', user.id);
      } catch {}
      try { window.supabaseProfile = { ...(window.supabaseProfile || {}), avatar_url:null }; } catch {}
      setAvatarStatus('Profile photo removed.', 'ok');
    }
  }

  document.addEventListener('change', async (event) => {
    const input = event.target?.closest?.('[data-member-avatar-input-v133]');
    if (!input) return;
    if (window.__PHX_V167_AVATAR_EDITOR_ENABLED__) return;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await sleep(30);
      await uploadAvatar(file);
    } catch (error) {
      setAvatarStatus(error?.message || 'Could not save this profile photo.', 'error');
      showSystemNotice({ title:'Profile photo not saved', message:error?.message || String(error), eyebrow:'Phoenix Hibachi' });
    }
  }, true);

  document.addEventListener('click', async (event) => {
    const remove = event.target?.closest?.('[data-member-avatar-remove-v133]');
    if (!remove) return;
    try { await sleep(20); await removePersistentAvatar(); }
    catch (error) { showSystemNotice({ title:'Could not remove photo', message:error?.message || String(error), eyebrow:'Phoenix Hibachi' }); }
  }, true);

  function boot(){
    addLoginHelper();
    syncAvatarFromSupabase().catch(() => {});
    const client = getClient();
    if (client?.auth?.onAuthStateChange) {
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') { removeAuthStorage(); resetAccountUI(); return; }
        if (session?.user) setTimeout(() => syncAvatarFromSupabase().catch(() => {}), 150);
      });
    }
    // If there is stale portal UI but Supabase has no session, clear it on first load.
    setTimeout(async () => {
      const client2 = getClient();
      if (!client2?.auth?.getSession) return;
      const { data } = await client2.auth.getSession().catch(() => ({ data:null }));
      if (!data?.session?.user) {
        const meta = (() => { try { return JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1') || 'null'); } catch { return null; } })();
        if (meta?.email) { removeAuthStorage(); resetAccountUI(); }
      }
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();



/* Phoenix Hibachi V2.3.3 adds verified payment badges and red add-on packing alerts. */

/* Phoenix OS V164.3 Order Age + Print Polish
   Purpose: show order age on admin cards and improve one-page invoice print.
   No database schema changes. */
(function phoenixOsV1643OrderPrintPolish(){
  if (window.__PHX_OS_V1643_ORDER_PRINT_POLISH__) return;
  window.__PHX_OS_V1643_ORDER_PRINT_POLISH__ = true;
  window.PHX_BUILD_VERSION = (window.PHX_BUILD_VERSION || 'V164') + '+V164.3_ORDER_PRINT_POLISH';

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function tryFindOrder(id){
    const key = String(id || '');
    if (!key) return null;
    try { const found = window.findDashboardOrder?.(key); if (found) return found; } catch {}
    try { const found = window.findOrder?.(key); if (found) return found; } catch {}
    try { const rows = window.getStoredOrders?.() || []; const found = rows.find(o => String(o.id || o.booking_number || '') === key); if (found) return found; } catch {}
    try {
      const raw = localStorage.getItem('phoenix_orders_v1') || localStorage.getItem('phoenixHibachiOrders') || localStorage.getItem('PHX_BOOKINGS');
      const rows = raw ? JSON.parse(raw) : [];
      if (Array.isArray(rows)) return rows.find(o => String(o.id || o.booking_number || '') === key) || null;
    } catch {}
    return null;
  }
  function parseDateLike(value){
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') {
      const d = new Date(value > 100000000000 ? value : value * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;
    const m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]||0), Number(m[5]||0));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  function submittedDate(order){
    const candidates = [
      order?.created_at, order?.createdAt, order?.submitted_at, order?.submittedAt,
      order?.request_created_at, order?.booking_created_at, order?.inserted_at,
      order?.created, order?.timestamp, order?.timeStamp
    ];
    for (const c of candidates) {
      const d = parseDateLike(c);
      if (d) return d;
    }
    return null;
  }
  function orderAgeLabel(order){
    const d = submittedDate(order);
    if (!d) return 'Received time unknown';
    const now = new Date();
    const diff = Math.max(0, now.getTime() - d.getTime());
    const min = Math.floor(diff / 60000);
    const hours = Math.floor(min / 60);
    const days = Math.floor(hours / 24);
    if (min < 1) return 'Received just now';
    if (min < 60) return `Received ${min}m ago`;
    if (hours < 24) return `Received ${hours}h ago`;
    if (days < 30) return `Received ${days}d ago`;
    const sameYear = d.getFullYear() === now.getFullYear();
    return 'Submitted ' + d.toLocaleDateString('en-US', sameYear
      ? { month:'short', day:'numeric' }
      : { year:'numeric', month:'short', day:'numeric' });
  }
  function submittedExactLabel(order){
    const d = submittedDate(order);
    if (!d) return '';
    return d.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }
  function enhanceOrderCards(){
    document.querySelectorAll('[data-v120-order-card], [data-v102-order-card], [data-v101-order-card]').forEach(card => {
      const id = card.getAttribute('data-v120-order-card') || card.getAttribute('data-v102-order-card') || card.getAttribute('data-v101-order-card');
      const order = tryFindOrder(id);
      if (!order) return;
      const header = card.querySelector(':scope > header');
      if (header) {
        header.classList.add('phx-v1643-order-header');
        const status = header.querySelector('.tag');
        let meta = header.querySelector('[data-v1643-order-age]');
        if (!meta) {
          meta = document.createElement('span');
          meta.className = 'phx-v1643-order-age';
          meta.setAttribute('data-v1643-order-age', 'true');
          if (status) header.insertBefore(meta, status); else header.appendChild(meta);
        }
        meta.textContent = orderAgeLabel(order);
        const exact = submittedExactLabel(order);
        if (exact) meta.title = exact;
        updatePaymentBadge(header, order);
      }
      card.querySelectorAll('[data-v120-action="details"], [data-v102-details], [data-v101-details]').forEach(btn => {
        btn.textContent = 'Order details / edit';
        btn.setAttribute('aria-label', 'Open order details, edit event date/time, and manage chef assignment');
      });
      card.querySelectorAll('[data-v120-action="time"], [data-v102-time-open], [data-v101-open-time]').forEach(btn => {
        btn.setAttribute('aria-hidden', 'true');
        btn.tabIndex = -1;
      });
    });
  }

  function cleanProteinText(raw){
    let text = String(raw ?? '').trim();
    if (!text) return '';
    text = text.replace(/\b(\d+)\s*\/\s*\1\s*portions?\s*/i, 'Total selected: $1 portions · ');
    text = text.replace(/\b(\d+)\s*\/\s*(\d+)\s*portions?\s*/i, 'Selected $1 of $2 portions · ');
    return text.replace(/\s+·\s*$/,'').trim();
  }
  function patchInvoiceHtml(){
    if (typeof window.guestInvoiceHtml !== 'function' || window.__PHX_V1643_INVOICE_WRAP__) return;
    window.__PHX_V1643_INVOICE_WRAP__ = true;
    const previous = window.guestInvoiceHtml;
    window.guestInvoiceHtml = function(order = {}){
      let html = String(previous(order) || '');
      html = html.replace('<section class="guest-invoice', '<section class="guest-invoice phx-v1643-clean-invoice');
      html = html.replace(/(PROTEIN SELECTIONS<\/b>\s*<span>)([^<]*)(<\/span>)/i, (all, a, body, c) => `${a}${esc(cleanProteinText(body))}${c}`);
      html = html.replace(/\b\d+\s*\/\s*\d+\s*portions?\s*/gi, match => cleanProteinText(match));
      html = html.replace(/<div class="invoice-footer-red">[\s\S]*?<\/div>/i, '');

      let addons = [];
      try { addons = window.calculateOrderMoney?.(order)?.addons || []; } catch {}
      if (!Array.isArray(addons) || !addons.length) {
        const raw = order.addons || order.add_ons || [];
        addons = Array.isArray(raw) ? raw.map(item => typeof item === 'string' ? {name:item, qty:1} : item).filter(Boolean) : [];
      }

      if (addons.length) {
        const host = document.createElement('div');
        host.innerHTML = html;
        const names = addons.map(item => String(item?.name || item || '').trim()).filter(Boolean);
        host.querySelectorAll('.invoice-row').forEach(row => {
          const rowText = String(row.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (names.some(name => rowText.includes(name.toLowerCase()))) {
            row.classList.add('invoice-addon-row', 'phx-v233-addon-row');
          }
        });

        let alert = host.querySelector('.invoice-addon-alert');
        if (!alert) {
          alert = document.createElement('div');
          alert.className = 'invoice-addon-alert phx-v233-addon-alert';
          const target = host.querySelector('.invoice-payment-grid-v164, .invoice-ledger-grid-v164, .invoice-rule-box, .invoice-food-alert');
          if (target?.parentNode) target.parentNode.insertBefore(alert, target);
          else host.querySelector('.guest-invoice')?.appendChild(alert);
        } else {
          alert.classList.add('phx-v233-addon-alert');
        }
        alert.setAttribute('style','border:2px solid #c00000!important;background:#fff0f0!important;color:#c00000!important;font-weight:900!important;padding:7px 9px!important;');
        alert.innerHTML = `<b style="color:#c00000!important;">ADD-ONS TO BRING</b><span style="color:#c00000!important;font-weight:900!important;">${addons.map(item => `${esc(item?.name || item)}${Number(item?.qty || 1) > 1 ? ` × ${Number(item.qty)}` : ''}`).join(' · ')}</span>`;
        html = host.innerHTML;
      }
      return html;
    };
  }
  function rowCount(area){
    return area?.querySelectorAll?.('.invoice-row, .invoice-labels div, .invoice-payment-grid-v164 div, .invoice-ledger-grid-v164 div, .invoice-rule-box span, .tip-suggestions-final tr, .invoice-food-alert')?.length || 0;
  }
  function applyPrintPolish(){ /* V166: V163 print engine remains authoritative. */ }
  document.getElementById('runPrintBtn')?.addEventListener('click', applyPrintPolish, true);
  window.addEventListener('beforeprint', applyPrintPolish);
  window.addEventListener('afterprint', () => {
    const area = document.getElementById('printArea');
    if (!area) return;
    area.classList.remove('phx-v1643-print-polish');
  });

  function scan(){
    enhanceOrderCards();
    patchInvoiceHtml();
    if (document.getElementById('printModal')?.open) applyPrintPolish();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once:true });
  else scan();
  // V166: polling removed; updates are event/observer driven.
  try {
    const root = document.querySelector('[data-dashboard-page="orders"]');
    if (root) {
      const observer = new MutationObserver(() => {
        clearTimeout(window.__PHX_V1643_SCAN_TIMER__);
        window.__PHX_V1643_SCAN_TIMER__ = setTimeout(scan, 120);
      });
      observer.observe(root, { childList:true, subtree:true });
    }
  } catch {}
})();



/* Phoenix OS V164.4 — mobile overlay + confirmation resend + reliable login
   No SQL required for CSS/UX. Companion SQL is only a safe profile backfill/repair. */
(function phoenixOsV1644MobileAuthConfirmFix(){
  if (window.__PHX_OS_V1644_MOBILE_AUTH_CONFIRM_FIX__) return;
  window.__PHX_OS_V1644_MOBILE_AUTH_CONFIRM_FIX__ = true;
  window.PHX_BUILD_VERSION = (window.PHX_BUILD_VERSION || 'V164') + '+V164.4_MOBILE_AUTH_CONFIRM_FIX';

  const HOME_URL = 'https://phoenix-hibachi.com';
  const RESEND_SECONDS = 60;
  const previousAlert = window.alert ? window.alert.bind(window) : null;

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function cleanEmail(value){ return String(value || '').trim().toLowerCase(); }
  function getClient(){
    try { return typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null; }
    catch { return null; }
  }
  function getLoginForm(){ return document.getElementById('portalLoginForm'); }
  function getLoginEmail(){
    return cleanEmail(getLoginForm()?.querySelector('input[type="email"]')?.value || document.querySelector('#memberSignupForm input[name="email"]')?.value || '');
  }
  function isEmailConfirmText(text){
    return /account\s+created|confirm\s+email|email\s+confirmation|not\s+confirmed|confirmation\s+email|pending\s+email/i.test(String(text || ''));
  }
  function isLoginFailureText(text){
    return /login\s+failed|invalid\s+login|invalid\s+credentials|not\s+in\s+supabase|password\s+does\s+not\s+match|no\s+matching\s+row/i.test(String(text || ''));
  }
  function exactLoginMessage(error){
    const raw = String(error?.message || error || '').trim();
    if (/email\s+not\s+confirmed|not\s+confirmed/i.test(raw)) {
      return 'This account has not confirmed its email yet. Please open the Phoenix Hibachi confirmation email first.';
    }
    if (/invalid\s+login\s+credentials|invalid\s+credentials/i.test(raw)) {
      return 'Email or password is incorrect. If you just registered, confirm your email first, then try again.';
    }
    if (/no\s+matching\s+row|profiles/i.test(raw)) {
      return 'Login reached Supabase Auth, but the customer profile row is missing or blocked by RLS. Run the V164.4 profile repair SQL, then try again.';
    }
    if (/failed\s+to\s+fetch|network/i.test(raw)) {
      return 'Network connection to Supabase failed. Check internet connection and refresh the page.';
    }
    return raw || 'Login failed. Please check the email, password, and email confirmation status.';
  }
  function normalizeRole(value){
    const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (raw === 'admin' || raw === 'owner') return 'Admin';
    if (raw === 'manager') return 'Manager';
    if (raw === 'customer_service' || raw === 'staff' || raw === 'service') return 'Customer Service';
    if (raw === 'chef') return 'Chef';
    return 'Member';
  }
  function setInlineLoginError(message){
    const form = getLoginForm();
    if (!form) return;
    let box = form.querySelector('[data-v1644-login-error]');
    if (!box) {
      box = document.createElement('div');
      box.className = 'phx-v1644-login-error';
      box.setAttribute('data-v1644-login-error','');
      const loginBtn = form.querySelector('button.gold-btn');
      if (loginBtn) form.insertBefore(box, loginBtn); else form.appendChild(box);
    }
    box.textContent = message || '';
    box.hidden = !message;
  }
  function clearInlineLoginError(){ setInlineLoginError(''); }

  function ensureConfirmDialog(){
    let dialog = document.getElementById('phxV1644ConfirmDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxV1644ConfirmDialog';
    dialog.className = 'phx-v1644-confirm-dialog';
    dialog.innerHTML = `
      <section class="phx-v1644-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="phxV1644ConfirmTitle">
        <button type="button" class="phx-v1644-close" data-v1644-confirm-close aria-label="Close">×</button>
        <p class="phx-v1644-eyebrow" data-v1644-eyebrow>Account created</p>
        <h3 id="phxV1644ConfirmTitle" data-v1644-title>Confirm your email</h3>
        <p data-v1644-message></p>
        <label data-v1644-email-wrap>Email for confirmation
          <input type="email" data-v1644-email-input placeholder="email@example.com" autocomplete="email">
        </label>
        <div class="phx-v1644-status" data-v1644-status></div>
        <div class="phx-v1644-confirm-actions">
          <button type="button" class="primary" data-v1644-resend>Resend confirmation email</button>
          <button type="button" class="secondary" data-v1644-done>I already confirmed</button>
        </div>
      </section>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  function startCountdown(button, status, seconds = RESEND_SECONDS){
    let left = seconds;
    const old = button.dataset.readyText || button.textContent || 'Resend confirmation email';
    button.dataset.readyText = old;
    button.disabled = true;
    const tick = () => {
      if (left <= 0) {
        button.disabled = false;
        button.textContent = old;
        status.textContent = 'Still no email? You can resend now. Also check Spam/Junk.';
        return;
      }
      button.textContent = `Resend available in ${left}s`;
      status.textContent = `Please check Inbox and Spam/Junk. Resend will unlock in ${left}s.`;
      left -= 1;
      window.setTimeout(tick, 1000);
    };
    tick();
  }
  async function resendConfirmation(email, status){
    const clean = cleanEmail(email || getLoginEmail());
    if (!clean) throw new Error('Enter the account email first.');
    const client = getClient();
    if (!client?.auth?.resend) throw new Error('Supabase resend is not available. Refresh the page and try again.');
    const { error } = await client.auth.resend({
      type: 'signup',
      email: clean,
      options: { emailRedirectTo: HOME_URL }
    });
    if (error) throw error;
    if (status) status.textContent = `Confirmation email sent to ${clean}. Check Inbox and Spam/Junk.`;
  }
  function showConfirmFlow({ email='', reason='signup', allowImmediateResend=false } = {}){
    const dialog = ensureConfirmDialog();
    const title = dialog.querySelector('[data-v1644-title]');
    const eyebrow = dialog.querySelector('[data-v1644-eyebrow]');
    const message = dialog.querySelector('[data-v1644-message]');
    const input = dialog.querySelector('[data-v1644-email-input]');
    const status = dialog.querySelector('[data-v1644-status]');
    const resend = dialog.querySelector('[data-v1644-resend]');
    const done = dialog.querySelector('[data-v1644-done]');
    const close = dialog.querySelector('[data-v1644-confirm-close]');
    const clean = cleanEmail(email || getLoginEmail());

    eyebrow.textContent = reason === 'unconfirmed' ? 'Email not confirmed' : 'Account created';
    title.textContent = 'Confirm your email';
    message.textContent = reason === 'unconfirmed'
      ? 'This account exists, but it cannot log in until the email confirmation link is clicked. Enter the same email below if you need a new confirmation email.'
      : 'Your Phoenix Hibachi account was created. Open the confirmation email and click the link before logging in. If it does not arrive, wait for the timer and resend it here.';
    input.value = clean;
    status.textContent = '';
    resend.disabled = false;
    resend.textContent = 'Resend confirmation email';

    resend.onclick = async () => {
      try {
        resend.disabled = true;
        resend.textContent = 'Sending…';
        await resendConfirmation(input.value, status);
        startCountdown(resend, status, RESEND_SECONDS);
      } catch (error) {
        resend.disabled = false;
        resend.textContent = 'Resend confirmation email';
        status.textContent = error?.message || String(error);
      }
    };
    done.onclick = () => { try { dialog.close(); } catch { dialog.removeAttribute('open'); } };
    close.onclick = done.onclick;
    if (!allowImmediateResend) startCountdown(resend, status, RESEND_SECONDS);
    try { if (!dialog.open) dialog.showModal(); } catch { dialog.setAttribute('open',''); }
    document.dispatchEvent(new CustomEvent('phoenix:confirm-email-opened', { detail:{ email:clean, reason } }));
    setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 100);
  }
  window.phoenixShowConfirmEmailFlow = showConfirmFlow;
  window.phoenixResendConfirmationEmailV1644 = resendConfirmation;

  window.alert = function phoenixV1644Alert(message){
    const text = String(message ?? '');
    /* V166: classify a login failure first. A generic sentence that mentions
       “confirm your email” must never be mistaken for an unconfirmed account. */
    if (isLoginFailureText(text)) {
      const msg = exactLoginMessage(text.replace(/^Login failed:\s*/i, ''));
      setInlineLoginError(msg);
      if (/email\s+not\s+confirmed|not\s+confirmed/i.test(text)) {
        showConfirmFlow({ email:getLoginEmail(), reason:'unconfirmed', allowImmediateResend:true });
      }
      return;
    }
    if (isEmailConfirmText(text)) {
      showConfirmFlow({ email:getLoginEmail(), reason:'signup', allowImmediateResend:false });
      return;
    }
    if (typeof window.phoenixSystemNotice === 'function') {
      window.phoenixSystemNotice({ title:'Phoenix Hibachi', message:text || 'Done', eyebrow:'System notice' });
      return;
    }
    if (previousAlert) previousAlert(text);
  };

  function openDashboard(role, email){
    const uiRole = normalizeRole(role);
    try { if (typeof setPortalSessionMeta === 'function') setPortalSessionMeta(uiRole, email || ''); } catch {}
    try { localStorage.setItem('phoenixPortalPreferredTabV1', uiRole === 'Customer Service' ? 'orders' : ''); } catch {}
    try { document.getElementById('loginModal')?.close(); } catch {}
    if (typeof isPortalRoute === 'function' && isPortalRoute()) {
      try { renderDashboard(uiRole); } catch (error) { console.warn('Dashboard render warning:', error); }
      try {
        const modal = document.getElementById('dashboardModal');
        if (modal && typeof modal.showModal === 'function' && !modal.open) modal.showModal();
      } catch {}
    } else if (typeof openPortalInNewTab === 'function') {
      openPortalInNewTab();
    } else {
      window.location.hash = '#portal';
    }
  }
  async function ensureProfile(client, user){
    if (!client || !user?.id) return null;
    let result = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (result.error && result.error.code !== 'PGRST116') throw result.error;
    if (result.data) return result.data;
    const payload = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || (user.email || '').split('@')[0] || 'Member',
      phone: user.user_metadata?.phone || '',
      role: user.user_metadata?.requested_role === 'chef' ? 'chef' : 'customer',
      account_status: user.user_metadata?.requested_role === 'chef' ? 'pending' : 'active',
      updated_at: new Date().toISOString()
    };
    const upsert = await client.from('profiles').upsert(payload).select('*').maybeSingle();
    if (upsert.error) throw upsert.error;
    return upsert.data || payload;
  }
  async function reliableLogin(email, password){
    const client = getClient();
    if (!client?.auth?.signInWithPassword) throw new Error('Supabase Auth is not loaded. Refresh the page and try again.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Supabase did not return a valid user session.');
    const profile = await ensureProfile(client, data.user);
    if (!profile) throw new Error('Login worked, but the profile could not be loaded.');
    const status = String(profile.account_status || 'active').toLowerCase();
    if (status && status !== 'active') {
      try { await client.auth.signOut(); } catch {}
      throw new Error(`This account is ${profile.account_status}. It must be approved before login.`);
    }
    try { window.supabaseSession = data.session; } catch {}
    try { window.supabaseProfile = profile; } catch {}
    try { if (typeof loadDashboardDataFromSupabase === 'function') await loadDashboardDataFromSupabase(); } catch (loadError) { console.warn('Dashboard data load warning:', loadError); }
    return profile;
  }

  window.addEventListener('submit', async (event) => {
    if (window.__PHX_DISABLED_LOGIN_CONFLICT__) return;
    const form = event.target?.closest?.('#portalLoginForm');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const email = cleanEmail(form.querySelector('input[type="email"]')?.value || '');
    const password = form.querySelector('input[type="password"]')?.value || '';
    clearInlineLoginError();
    if (!email || !password) {
      setInlineLoginError('Enter email and password first.');
      return;
    }
    const btn = form.querySelector('button.gold-btn');
    const old = btn?.textContent || 'Login';
    if (btn) { btn.disabled = true; btn.textContent = 'Logging in…'; }
    try {
      const profile = await reliableLogin(email, password);
      openDashboard(profile.role || 'customer', email);
    } catch (error) {
      const msg = exactLoginMessage(error);
      setInlineLoginError(msg);
      const rawAuthError = String(error?.message || error || '');
      if (/email\s+not\s+confirmed|not\s+confirmed/i.test(rawAuthError)) showConfirmFlow({ email, reason:'unconfirmed', allowImmediateResend:true });
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }, true);

  function syncMobileMenuState(){
    const nav = document.getElementById('mobileNav');
    document.body.classList.toggle('phx-mobile-menu-open', !!nav?.classList.contains('open'));
  }
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#menuBtn, #mobileNav')) setTimeout(syncMobileMenuState, 30);
  }, true);
  const nav = document.getElementById('mobileNav');
  if (nav) {
    try { new MutationObserver(syncMobileMenuState).observe(nav, { attributes:true, attributeFilter:['class'] }); } catch {}
  }

  function boot(){
    document.querySelectorAll('.phx-v1642-login-helper').forEach(el => el.remove());
    syncMobileMenuState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();



/* Phoenix OS V164.5 — readable print, Gmail/SMS helpers, no-email-field confirmation resend. */
(function phoenixOsV1645PrintContactConfirmPolish(){
  if (window.__PHX_OS_V1645_PRINT_CONTACT_CONFIRM_POLISH__) return;
  window.__PHX_OS_V1645_PRINT_CONTACT_CONFIRM_POLISH__ = true;
  window.PHX_BUILD_VERSION = (window.PHX_BUILD_VERSION || 'V164') + '+V164.5_PRINT_CONTACT_CONFIRM_POLISH';

  const LAST_CONFIRM_EMAIL = 'phx_last_confirmation_email_v1645';
  const BUSINESS_PHONE_DIGITS = '15165183325';
  const BOOKING_EMAIL = 'booking@phoenix-hibachi.com';

  function cleanEmail(value){ return String(value || '').trim().toLowerCase(); }
  function digits(value){ return String(value || '').replace(/\D/g,''); }
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function getLastEmail(){
    return cleanEmail(window.__PHX_LAST_CONFIRM_EMAIL__ || localStorage.getItem(LAST_CONFIRM_EMAIL) || document.querySelector('#portalLoginForm input[type="email"]')?.value || '');
  }
  function setLastEmail(email){
    const clean = cleanEmail(email);
    if (!clean) return;
    window.__PHX_LAST_CONFIRM_EMAIL__ = clean;
    try { localStorage.setItem(LAST_CONFIRM_EMAIL, clean); } catch {}
  }

  document.addEventListener('submit', (event) => {
    const memberForm = event.target?.closest?.('#memberSignupForm');
    if (memberForm) setLastEmail(memberForm.querySelector('input[name="email"]')?.value || '');
    const loginForm = event.target?.closest?.('#portalLoginForm');
    if (loginForm) setLastEmail(loginForm.querySelector('input[type="email"]')?.value || '');
  }, true);

  const previousAlert = window.alert ? window.alert.bind(window) : null;
  window.alert = function phoenixV1645Alert(message){
    const text = String(message ?? '');
    if (/login\s+failed|invalid\s+login|invalid\s+credentials|email\s+or\s+password\s+is\s+incorrect/i.test(text)) {
      if (previousAlert) return previousAlert(text);
      return;
    }
    if (/membership application received|member portal account created|confirm email|email confirmation/i.test(text)) {
      const email = getLastEmail();
      if (email && typeof window.phoenixShowConfirmEmailFlow === 'function') {
        window.phoenixShowConfirmEmailFlow({ email, reason:'signup', allowImmediateResend:false });
        setTimeout(polishConfirmDialog, 50);
        return;
      }
    }
    if (previousAlert) return previousAlert(text);
  };

  function polishConfirmDialog(){
    const dialog = document.getElementById('phxV1644ConfirmDialog');
    if (!dialog) return;
    const input = dialog.querySelector('[data-v1644-email-input]');
    const email = cleanEmail(input?.value || getLastEmail());
    if (email) {
      setLastEmail(email);
      if (input) input.value = email;
    }
    const message = dialog.querySelector('[data-v1644-message]');
    if (message) {
      message.textContent = 'Open the confirmation email and click the link before logging in. If it does not arrive, use Resend after the timer. No extra email entry is needed.';
    }
    let display = dialog.querySelector('[data-v1645-confirm-display]');
    if (!display) {
      display = document.createElement('div');
      display.className = 'phx-v1645-confirm-email-display';
      display.setAttribute('data-v1645-confirm-display','');
      const status = dialog.querySelector('[data-v1644-status]');
      if (status) status.parentNode.insertBefore(display, status);
      else dialog.querySelector('.phx-v1644-confirm-card')?.appendChild(display);
    }
    display.innerHTML = `<small>Confirmation email will be sent to</small>${esc(email || 'the account email')}`;
    const resend = dialog.querySelector('[data-v1644-resend]');
    const done = dialog.querySelector('[data-v1644-done]');
    if (resend) resend.dataset.readyText = 'Resend confirmation email';
    if (done) done.textContent = 'I already confirmed';
  }

  document.addEventListener('phoenix:confirm-email-opened', () => queueMicrotask(polishConfirmDialog));
  // V166: no document-wide confirmation observer; updates are event-driven.

  function markZeroRows(area){
    if (!area) return;
    const grids = area.querySelectorAll('.invoice-payment-grid-v164');
    grids.forEach(grid => {
      let visible = 0;
      grid.querySelectorAll('div').forEach(row => {
        const text = (row.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const isNone = /coupon code\s+none/.test(text);
        const isZero = /\$0(?:\.00)?$/.test(text) || /\$0(?:\.00)?\b/.test(text);
        if (isNone || isZero) row.classList.add('phx-v1645-zero-row');
        else { row.classList.remove('phx-v1645-zero-row'); visible += 1; }
      });
      grid.classList.toggle('phx-v1645-empty-adjustments', visible === 0);
    });
  }

  function applyReadablePrint(){ /* V166: V163 print engine remains authoritative. */ }

  const previousOpenPrint = typeof window.openPrintModalForOrder === 'function' ? window.openPrintModalForOrder : (typeof openPrintModalForOrder === 'function' ? openPrintModalForOrder : null);
  if (previousOpenPrint && !window.__PHX_V1645_PRINT_WRAP__) {
    window.__PHX_V1645_PRINT_WRAP__ = true;
    try {
      openPrintModalForOrder = function phoenixV1645OpenPrintModalForOrder(order, type){
        const out = previousOpenPrint.apply(this, arguments);
        setTimeout(applyReadablePrint, 30);
        setTimeout(applyReadablePrint, 180);
        return out;
      };
      window.openPrintModalForOrder = openPrintModalForOrder;
    } catch {
      window.openPrintModalForOrder = function(order, type){
        const out = previousOpenPrint.call(this, order, type);
        setTimeout(applyReadablePrint, 30);
        return out;
      };
    }
  }
  document.getElementById('runPrintBtn')?.addEventListener('click', () => {
    document.body.classList.add('printing-invoice');
    applyReadablePrint();
  }, true);
  window.addEventListener('beforeprint', () => { document.body.classList.add('printing-invoice'); applyReadablePrint(); });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-invoice'));

  function customerFromLink(link){
    const row = link.closest?.('.customer-row, .order-card, .application-card, .feedback-card, article');
    const text = row?.innerText || '';
    const href = link.getAttribute('href') || '';
    let phone = '';
    let email = '';
    if (href.startsWith('sms:')) phone = digits(decodeURIComponent(href.replace(/^sms:/,'')));
    if (href.startsWith('mailto:')) email = decodeURIComponent(href.replace(/^mailto:/,'').split('?')[0]).trim();
    if (!phone) {
      const m = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      if (m) phone = digits(m[0]);
    }
    if (!email) {
      const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (m) email = m[0].trim();
    }
    const name = (row?.querySelector('strong,b')?.textContent || text.split('\n')[0] || 'there').trim();
    return { row, phone, email, name };
  }
  function smsBody(c){
    return `Hi ${c.name || ''}, this is Phoenix Hibachi. We received your request. Please reply with your event date, ZIP code, guest count, and preferred time so we can confirm availability.`.replace(/\s+/g,' ').trim();
  }
  function emailBody(c){
    return `Hi ${c.name || 'there'},\n\nThank you for contacting Phoenix Hibachi. Please send us your event date, ZIP code, guest count, preferred time, and any allergies or special notes.\n\nPhoenix Hibachi\n(516) 518-3325\nhttps://phoenix-hibachi.com`;
  }
  function gmailComposeUrl(to, subject, body){
    const qs = new URLSearchParams({ view:'cm', fs:'1', to: to || '', su: subject || 'Phoenix Hibachi booking', body: body || '' });
    return `https://mail.google.com/mail/?${qs.toString()}`;
  }

  function enhanceContactLinks(){
    document.querySelectorAll('a[href^="sms:"], a[href^="mailto:"]').forEach(link => {
      if (link.dataset.v1645Enhanced === '1') return;
      const c = customerFromLink(link);
      if (link.getAttribute('href')?.startsWith('sms:') && c.phone) {
        const to = c.phone.length === 10 ? `1${c.phone}` : c.phone;
        link.href = `sms:+${to}?&body=${encodeURIComponent(smsBody(c))}`;
        link.classList.add('phx-v1645-contact-ready');
        link.dataset.v1645Mode = 'SMS app';
        link.title = 'Opens the device SMS app. True Quo auto-send requires Quo API/Make/Worker.';
      }
      if (link.getAttribute('href')?.startsWith('mailto:') && c.email) {
        link.href = gmailComposeUrl(c.email, 'Phoenix Hibachi booking follow-up', emailBody(c));
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.classList.add('phx-v1645-contact-ready');
        link.dataset.v1645Mode = 'Gmail';
        link.title = 'Opens Gmail compose in the browser.';
      }
      link.dataset.v1645Enhanced = '1';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { enhanceContactLinks(); applyReadablePrint(); }, { once:true });
  else { enhanceContactLinks(); applyReadablePrint(); }
  // V166: polling removed; updates are event/observer driven.
})();

/* V166 targeted stability: auth/profile/contact runtime retained; stacked profile/print layers removed. */
