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
    serviceArea: 'NY, NJ, CT, Long Island',
    policy: 'Deposits are applied toward your final balance. Cancellations within 72 hours of the event may be non-refundable. Rescheduling is subject to availability and must be confirmed by Phoenix Hibachi.'
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
        ? m.addons.map(item => `<div class="invoice-row"><span>${esc(item.name)}${item.qty && item.qty > 1 ? ' × ' + item.qty : ''}</span><em></em><b>Total: ${moneySafe(item.price)}</b></div>`).join('')
        : `<div class="invoice-row"><span>Add-ons</span><em></em><b>Total: $0</b></div>`;
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
            <div class="invoice-row"><span>Travel Fee</span><em></em><b>Total: ${moneySafe(m.travelFee)}</b></div>
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
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { applyPublicContactDom(); } catch {}
        try { renderCloseIcon(); } catch {}
      }, 80);
    };
    try {
      new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
    } catch {}
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
