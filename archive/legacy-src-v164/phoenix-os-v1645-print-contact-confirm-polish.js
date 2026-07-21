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

  try {
    new MutationObserver(() => polishConfirmDialog()).observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['open'] });
  } catch {}
  setInterval(polishConfirmDialog, 1000);

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

  function applyReadablePrint(){
    const area = document.getElementById('printArea');
    if (!area) return;
    area.classList.add('phx-v1645-readable-print','phx-v1643-print-polish','phx-force-one-page-v1641','phx-one-page-fit');
    markZeroRows(area);
    const textLen = (area.innerText || '').replace(/\s+/g,' ').length;
    const rows = area.querySelectorAll('.invoice-row, .invoice-labels div, .invoice-ledger-grid-v164 div:not(.phx-v1645-zero-row), .invoice-payment-grid-v164 div:not(.phx-v1645-zero-row), .tip-suggestions-final tr, .invoice-food-alert').length;
    area.dataset.v1645Density = rows > 34 || textLen > 2200 ? 'tight' : (rows > 28 || textLen > 1700 ? 'compact' : 'readable');
  }

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
  setInterval(enhanceContactLinks, 1500);
})();
