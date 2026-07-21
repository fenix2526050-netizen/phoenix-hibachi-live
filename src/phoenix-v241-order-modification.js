/* Phoenix Hibachi V2.4.1 — customer/admin order modification.
   Adds a 48-hour customer edit window and an always-available admin edit flow
   without changing Supabase schema. */
(function phoenixOrderModificationV241(){
  if (window.__PHX_V241_ORDER_MODIFICATION__) return;
  window.__PHX_V241_ORDER_MODIFICATION__ = true;

  const EDIT_WINDOW_HOURS = 48;
  const PATCH_VERSION = 'V248';
  const lookupOrders = new Map();

  const text = value => String(value ?? '').trim();
  const lower = value => text(value).toLowerCase();
  const esc = value => text(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char] || char));
  const num = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const int = (value, fallback = 0) => Math.max(0, Math.floor(num(value, fallback)));
  const money = value => {
    try { return typeof window.money === 'function' ? window.money(num(value, 0)) : `$${num(value, 0).toFixed(2)}`; }
    catch { return `$${num(value, 0).toFixed(2)}`; }
  };

  function idOf(order = {}) {
    return text(order.id || order.booking_number || order.bookingNumber || order.order_id);
  }
  function orderNotes(order = {}) {
    return text(order.admin_notes || order.specialNotes || order.service_notes || order.customer_notes || order.notes);
  }
  function upsertNote(notes, label, value) {
    const cleanLabel = text(label);
    const cleanValue = text(value);
    if (!cleanLabel || !cleanValue) return text(notes);
    const base = text(notes);
    const safe = cleanLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const line = `${cleanLabel}: ${cleanValue}`;
    const rx = new RegExp(`(^|\\n)${safe}:\\s*[^\\n]*`, 'i');
    return rx.test(base) ? base.replace(rx, `$1${line}`) : [base, line].filter(Boolean).join('\n');
  }
  function addHistory(notes, label, value) {
    return [text(notes), `${label}: ${value}`].filter(Boolean).join('\n');
  }

  function firstTimePart(raw) {
    return text(raw || '4:00 PM').split(/\s*[-–]\s*/)[0].replace(/\bat\b/i, '').trim() || '4:00 PM';
  }
  function timeToDb(raw) {
    const value = firstTimePart(raw);
    try {
      if (typeof parseEventTimeForDb === 'function') return parseEventTimeForDb(value);
    } catch {}
    const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return value;
    let hour = Number(match[1]);
    const minute = match[2] || '00';
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}:00`;
  }
  function dbDate(raw) {
    const value = text(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return '';
  }
  function dateForInput(order = {}) {
    return dbDate(order.event_date || order.eventDate || order.date);
  }
  function eventDateTime(order = {}) {
    const date = dateForInput(order);
    if (!date) return null;
    const time = firstTimePart(order.event_time || order.eventTime || '4:00 PM');
    const parsed = new Date(`${date} ${time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  function hoursUntilEvent(order = {}) {
    const event = eventDateTime(order);
    if (!event) return null;
    return (event.getTime() - Date.now()) / 36e5;
  }
  function customerCanModify(order = {}) {
    const hours = hoursUntilEvent(order);
    return hours === null || hours > EDIT_WINDOW_HOURS;
  }
  function formatWindow(order = {}) {
    const hours = hoursUntilEvent(order);
    if (hours === null) return `Changes are available until ${EDIT_WINDOW_HOURS} hours before the event.`;
    if (hours > EDIT_WINDOW_HOURS) {
      return `Customer changes open now. Locks ${EDIT_WINDOW_HOURS} hours before the event.`;
    }
    return `Order locked. Less than ${EDIT_WINDOW_HOURS} hours before the event.`;
  }
  function supportPhone() {
    try {
      const cfg = typeof getContactSettingsV60 === 'function' ? getContactSettingsV60() : {};
      return text(cfg.textPhone || cfg.phone || '(516) 518-3325');
    } catch { return '(516) 518-3325'; }
  }
  function supportHref() {
    const digits = supportPhone().replace(/\D/g, '');
    return digits ? `tel:+1${digits.replace(/^1/, '')}` : 'tel:+15165183325';
  }

  function collectOrders() {
    const map = new Map();
    const add = order => {
      const id = idOf(order);
      if (id) map.set(id.toLowerCase(), order);
    };
    lookupOrders.forEach(add);
    try { Object.values(window.__PHX_LOOKUP_ORDER_CACHE__ || {}).forEach(order => add({ ...order, __v241PublicLookup:true })); } catch {}
    try { (window.getDashboardOrders?.() || getDashboardOrders?.() || []).forEach(add); } catch {}
    try { (window.getStoredOrders?.() || getStoredOrders?.() || []).forEach(add); } catch {}
    try { if (Array.isArray(remoteOrdersCache)) remoteOrdersCache.forEach(add); } catch {}
    return map;
  }
  function rememberLookupOrder(order = {}) {
    const id = idOf(order);
    if (!id) return order;
    const enriched = { ...order, __v241PublicLookup:true };
    lookupOrders.set(id.toLowerCase(), enriched);
    window.__PHX_LOOKUP_ORDER_CACHE__ = window.__PHX_LOOKUP_ORDER_CACHE__ || {};
    window.__PHX_LOOKUP_ORDER_CACHE__[id] = enriched;
    return enriched;
  }
  function orderForCard(card, orders = collectOrders()) {
    const raw = card.getAttribute('data-v120-order-card') ||
      card.getAttribute('data-v102-order-card') ||
      card.getAttribute('data-v101-order-card') ||
      card.getAttribute('data-v241-lookup-card') ||
      card.querySelector('[data-print-lookup]')?.getAttribute('data-print-lookup') ||
      card.querySelector('[data-print-guest]')?.getAttribute('data-print-guest') ||
      card.querySelector('[data-download-pdf]')?.getAttribute('data-download-pdf') ||
      card.querySelector('strong')?.textContent ||
      '';
    const match = text(raw).match(/\bPHX[-\w]+\b/i);
    const id = (match ? match[0] : text(raw)).toLowerCase();
    if (!id) return null;
    return orders.get(id) || orderStubFromCard(card, id);
  }
  function orderStubFromCard(card, id) {
    const rawId = text(id).toUpperCase();
    const bodyText = text(card?.textContent || '');
    const dateMatch = bodyText.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i);
    const timeMatch = bodyText.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i);
    const lines = bodyText.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const addressLine = lines.find(line => /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(line)) || '';
    return {
      id:rawId,
      booking_number:rawId,
      eventDate:dateMatch?.[0] || '',
      eventTime:timeMatch?.[0] || '',
      address:addressLine,
      package:'Classic',
      adults:0,
      kids:0,
      __v241NeedsFullFetch:true
    };
  }
  function currentRole() {
    try { return text(window.currentDashboardRole || currentDashboardRole || localStorage.getItem('phoenix_portal_role') || localStorage.getItem('phoenix_dashboard_role')); }
    catch { return text(localStorage.getItem('phoenix_portal_role') || ''); }
  }
  function isStaffRole(role = currentRole()) {
    const raw = lower(role).replace(/[_-]+/g, ' ');
    return raw.includes('admin') || raw.includes('manager') || raw.includes('customer service');
  }
  function hasStaffControls(card) {
    if (!card) return false;
    if (card.querySelector([
      '[data-v101-confirm]',
      '[data-v102-confirm]',
      '[data-confirm-order]',
      '[data-v101-open-chef]',
      '[data-v102-open-chef]',
      '[data-run-auto]',
      '[data-delete-order]',
      '[data-v107-payment-open]',
      '[data-v120-action="payment"]',
      '[data-v120-save-payment]',
      '[data-v107-save-payment]'
    ].join(','))) return true;
    const label = lower(card.querySelector('.order-actions, .order-actions-v101, .v102-order-tools')?.textContent || '');
    return /confirm order|accept order|assign chef|payment\s*\/\s*price|delete order/.test(label);
  }
  function isMemberCard(card) {
    const role = lower(currentRole());
    return card.classList.contains('lookup-card') ||
      card.classList.contains('member-order-card-v96') ||
      card.classList.contains('member-order-card-v101') ||
      card.closest('[data-dashboard-page="orders"]') && /member|customer/.test(role) && !isStaffRole(role);
  }
  function actionsFor(card) {
    return card.querySelector('.order-actions, .order-actions-v101, .v102-order-tools, .v107-payment-actions, .phx-v120-stop-actions, .lookup-actions-v103');
  }
  function paymentButtonHtml(id) {
    return `<button type="button" data-open-payment="${esc(id)}" data-v241-payment-order="${esc(id)}">Pay deposit / balance</button>`;
  }
  function paymentNoteHtml() {
    return `<div class="phx-v241-payment-note"><b>Payment options</b><span>Pay a deposit or balance after Phoenix accepts the order. Include your booking number so staff can verify the payment.</span></div>`;
  }

  function styleOnce() {
    const existingStyle = document.getElementById('phx-v241-order-mod-style');
    const style = existingStyle || document.createElement('style');
    style.id = 'phx-v241-order-mod-style';
    style.textContent = `
      .phx-v241-lock-note{border:1px solid rgba(214,154,40,.25);background:rgba(214,154,40,.08);border-radius:10px;padding:8px 10px;margin:8px 0;color:inherit;font-size:.84rem;line-height:1.45}
      .phx-v241-lock-note strong{display:block;color:#ffd778;margin-bottom:2px}
      body.light-theme .phx-v241-lock-note,body.light .phx-v241-lock-note{background:#fff7e7;color:#332315}
      .phx-v241-edit-modal{max-width:min(96vw,820px);width:820px;max-height:min(92vh,880px);overflow:hidden;border:1px solid rgba(255,215,121,.36);border-radius:18px;background:#100b07;color:#fff7ea;padding:0;box-shadow:0 28px 90px rgba(0,0,0,.62)}
      .phx-v241-edit-modal::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}
      .phx-v241-edit-card{padding:20px;display:flex;flex-direction:column;gap:12px;max-height:min(92vh,880px);overflow:hidden}
      .phx-v241-edit-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .phx-v241-edit-head h2{margin:.1rem 0 .25rem;font-family:Georgia,serif}
      .phx-v241-edit-close{border:0;background:transparent;color:inherit;font-size:30px;line-height:1;cursor:pointer}
      .phx-v241-edit-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;border:1px solid rgba(255,215,121,.22);background:rgba(255,215,121,.07);border-radius:14px;padding:11px}
      .phx-v241-edit-summary .wide{grid-column:1/-1}
      .phx-v241-edit-summary span{display:block;color:#cdbb9b;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;font-weight:950}
      .phx-v241-edit-summary strong{display:block;color:#fff7ea;font-size:.94rem;line-height:1.35;word-break:break-word}
      .phx-v241-choice-section{grid-column:1/-1;display:grid;gap:9px;border:1px solid rgba(255,215,121,.18);background:rgba(255,255,255,.035);border-radius:14px;padding:12px}
      .phx-v241-choice-section h3{margin:0;color:#ffd778;font-size:.95rem}
      .phx-v241-choice-section p{margin:0;color:#d7c8ad;font-size:.84rem;line-height:1.45}
      .phx-v241-protein-total{display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(255,215,121,.22);border-radius:10px;background:rgba(255,215,121,.07);padding:8px 10px;margin:8px 0 0;color:#ffd778;font-weight:900;font-size:.84rem}
      .phx-v241-protein-total.warn{border-color:rgba(255,120,120,.45);background:rgba(255,80,80,.12);color:#ffb1a7}
      .phx-v241-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .phx-v241-choice-grid label{display:grid;grid-template-columns:1fr 74px;align-items:center;gap:8px;border:1px solid rgba(255,215,121,.22);border-radius:12px;padding:8px 10px;background:rgba(0,0,0,.22);font-size:.82rem;font-weight:850}
      .phx-v241-choice-grid small{display:block;color:#cdbb9b;font-size:.72rem;font-weight:750;margin-top:2px}
      .phx-v241-choice-grid input{width:100%;margin:0;text-align:center;accent-color:#f5b83f}
      .phx-v241-price-preview{grid-column:1/-1;border:1px solid rgba(255,215,121,.26);background:linear-gradient(135deg,rgba(255,215,121,.12),rgba(255,255,255,.035));border-radius:14px;padding:12px;display:grid;gap:7px}
      .phx-v241-price-preview h3{margin:0;color:#ffd778;font-size:.96rem}
      .phx-v241-price-preview div{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(255,215,121,.12);padding-top:6px;font-size:.86rem}
      .phx-v241-price-preview div:first-of-type{border-top:0;padding-top:0}
      .phx-v241-price-preview b{color:#fff7ea}
      .phx-v241-price-preview .warn{color:#ffcd77;font-weight:900}
      .phx-v241-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;overflow:auto;max-height:calc(min(92vh,880px) - 190px);padding-right:6px;scrollbar-gutter:stable}
      .phx-v241-edit-grid label{display:grid;gap:6px;font-weight:800;font-size:.86rem}
      .phx-v241-edit-grid .wide{grid-column:1/-1}
      .phx-v241-edit-grid [hidden]{display:none!important}
      .phx-v241-edit-grid input,.phx-v241-edit-grid select,.phx-v241-edit-grid textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,215,121,.28);border-radius:10px;background:#050302;color:inherit;padding:10px 11px;font:inherit}
      .phx-v241-edit-grid textarea{min-height:58px;max-height:92px;resize:vertical}
      .phx-v241-edit-status{min-height:22px;color:#ffd778;font-weight:800;font-size:.88rem}
      .phx-v241-edit-actions{position:sticky;bottom:0;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;background:linear-gradient(180deg,rgba(16,11,7,.78),#100b07 38%);border-top:1px solid rgba(255,215,121,.18);padding-top:12px;margin-top:0;z-index:2}
      .phx-v241-customer-locked{opacity:.65;cursor:not-allowed}
      #orderLookupModal{width:min(96vw,920px)!important;max-width:min(96vw,920px)!important;height:auto!important;max-height:92dvh!important;overflow-y:auto!important;overflow-x:hidden!important;padding:0!important;scrollbar-gutter:stable}
      #orderLookupModal .order-lookup-card{width:100%!important;height:auto!important;min-height:auto!important;max-height:none!important;overflow:visible!important;display:flex;flex-direction:column;box-sizing:border-box}
      #orderLookupModal .order-lookup-card label{flex:0 0 auto}
      #orderLookupModal .order-lookup-card .modal-actions{order:20;position:static!important;bottom:auto!important;z-index:2;padding-top:10px}
      #orderLookupModal .order-lookup-result{order:30;overflow:visible!important;min-height:88px;max-height:none!important;height:auto!important;padding-right:0!important;scrollbar-gutter:auto}
      #orderLookupModal .lookup-card{max-height:none!important;overflow:visible!important}
      .lookup-card-v103 .lookup-actions-v103 [data-open-payment]{background:linear-gradient(135deg,#ffd77a,#d99a16);color:#170c03;border:0}
      #paymentModal.open .phx-payment-card{max-height:90vh;overflow:auto}
      #paymentModal .phx-payment-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #paymentModal .phx-payment-option{border-radius:14px;padding:13px;display:grid;gap:9px;align-content:start}
      #paymentModal .phx-payment-option img{max-height:230px}
      #paymentModal .phx-payment-icon-card{min-height:112px;border:1px solid rgba(255,215,121,.28);border-radius:14px;background:linear-gradient(135deg,rgba(255,215,121,.14),rgba(255,255,255,.035));display:grid;place-items:center;color:#ffd778;font-weight:950;letter-spacing:.18em}
      #paymentModal .phx-payment-inline-btn{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:inherit}
      #phxPaymentTopDialogV241{width:min(96vw,980px);max-height:94vh;border:0;background:transparent;padding:0;color:#fff7ea;z-index:2147483600}
      #phxPaymentTopDialogV241::backdrop{background:rgba(0,0,0,.82);backdrop-filter:blur(5px)}
      #phxPaymentTopDialogV241 .phx-payment-card{width:min(960px,calc(100vw - 24px));max-height:92vh;overflow:auto;margin:0 auto;border:1px solid rgba(255,215,121,.42);box-shadow:0 30px 95px rgba(0,0,0,.72)}
      .phx-v241-payment-note{border:1px solid rgba(255,215,121,.24);background:rgba(255,215,121,.07);border-radius:12px;padding:9px 11px;color:#fff2cf;font-size:.84rem;line-height:1.42}
      .phx-v241-payment-note b{color:#ffd778}
      .phx-v241-locked-stamp{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 14px;background:rgba(255,255,255,.08);color:#a9a098;font-weight:950;text-transform:uppercase;letter-spacing:.08em}
      @media(max-width:720px){.phx-v241-edit-summary{grid-template-columns:1fr}.phx-v241-choice-grid{grid-template-columns:1fr}.phx-v241-edit-grid{grid-template-columns:1fr;max-height:calc(92dvh - 178px)}.phx-v241-edit-card{padding:14px}.phx-v241-edit-actions{justify-content:stretch}.phx-v241-edit-actions button{flex:1 1 auto}#orderLookupModal{width:calc(100vw - 14px)!important;max-width:calc(100vw - 14px)!important;height:auto!important;max-height:92dvh!important;margin:auto!important;overflow-y:auto!important;overflow-x:hidden!important}#orderLookupModal .order-lookup-card{width:100%!important;height:auto!important;max-height:none!important;padding:16px 13px;overflow:visible!important;gap:10px}#orderLookupModal .order-lookup-card h2{font-size:clamp(1.9rem,8vw,2.8rem);line-height:1.08;margin:.15rem 0 .35rem;letter-spacing:0}#orderLookupModal .order-lookup-card .modal-help{font-size:.95rem;line-height:1.45;margin:.1rem 0 .4rem}#orderLookupModal .order-lookup-card label{font-size:.9rem;gap:6px}#orderLookupModal .order-lookup-result{min-height:96px;max-height:none!important;overflow:visible!important;margin-top:4px}#orderLookupModal .modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}#orderLookupModal input{font-size:16px;padding:12px 14px}#paymentModal .phx-payment-grid,#phxPaymentTopDialogV241 .phx-payment-grid{grid-template-columns:1fr}#paymentModal .phx-payment-option img,#phxPaymentTopDialogV241 .phx-payment-option img{max-height:210px}}
    `;
    if (!existingStyle) document.head.appendChild(style);
  }

  function forceOrderLookupWholeWindow() {
    const modalEl = document.getElementById('orderLookupModal');
    const card = modalEl?.querySelector?.('.order-lookup-card');
    const result = modalEl?.querySelector?.('.order-lookup-result');
    const actions = modalEl?.querySelector?.('.modal-actions');
    if (!modalEl || !card) return;
    Object.assign(modalEl.style, {
      width:'min(96vw, 920px)',
      maxWidth:'min(96vw, 920px)',
      height:'auto',
      maxHeight:'92dvh',
      overflowY:'auto',
      overflowX:'hidden',
      padding:'0'
    });
    Object.assign(card.style, {
      width:'100%',
      height:'auto',
      maxHeight:'none',
      overflow:'visible'
    });
    if (result) Object.assign(result.style, {
      height:'auto',
      maxHeight:'none',
      overflow:'visible',
      paddingRight:'0'
    });
    if (actions) Object.assign(actions.style, {
      position:'static',
      bottom:'auto'
    });
  }

  function injectButtons() {
    styleOnce();
    forceOrderLookupWholeWindow();
    const orders = collectOrders();
    document.querySelectorAll('#orderList article.order-card, #calendarSummaryList article.order-card, [data-v120-order-card], [data-v102-order-card], [data-v101-order-card], .lookup-card').forEach(card => {
      if (!card || card.querySelector('[data-v241-edit-order], .phx-v241-lock-note')) return;
      const order = orderForCard(card, orders);
      if (!order) return;
      const actions = actionsFor(card);
      if (!actions) return;
      const id = esc(idOf(order));
      const member = isMemberCard(card);
      const staff = !member && (isStaffRole() || hasStaffControls(card));
      if (member) {
        const open = customerCanModify(order);
        const note = document.createElement('div');
        note.className = 'phx-v241-lock-note';
        note.innerHTML = open
          ? `<strong>Order changes</strong><span>You can modify this order until ${EDIT_WINDOW_HOURS} hours before the event. Saved changes notify Phoenix Hibachi for manager review.</span>`
          : `<strong>Order locked <span class="phx-v241-locked-stamp">locked</span></strong><span>This order is within ${EDIT_WINDOW_HOURS} hours of the event. Please call <a href="${esc(supportHref())}">${esc(supportPhone())}</a> to ask whether a change is still possible.</span>`;
        actions.parentNode.insertBefore(note, actions);
        if (!card.querySelector('.phx-v241-payment-note')) actions.parentNode.insertBefore(document.createRange().createContextualFragment(paymentNoteHtml()), actions);
        actions.insertAdjacentHTML('afterbegin', open
          ? `<button type="button" data-v241-edit-order="${id}" data-v241-mode="customer">Modify order</button>`
          : `<button type="button" class="phx-v241-customer-locked" data-v241-locked-order="${id}" title="Call support for changes within ${EDIT_WINDOW_HOURS} hours" disabled>Modify locked</button>`);
        if (!actions.querySelector('[data-open-payment]')) actions.insertAdjacentHTML('beforeend', paymentButtonHtml(id));
      } else if (staff) {
        actions.insertAdjacentHTML('afterbegin', `<button type="button" data-v241-edit-order="${id}" data-v241-mode="admin">Modify order</button>`);
      }
    });
  }

  function modal() {
    let dialog = document.getElementById('phxOrderModifyModalV241');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxOrderModifyModalV241';
    dialog.className = 'phx-v241-edit-modal';
    dialog.innerHTML = `<form method="dialog" class="phx-v241-edit-card" id="phxOrderModifyFormV241">
      <div class="phx-v241-edit-head"><div><p class="eyebrow">Order modification</p><h2>Modify order details</h2><p class="modal-help" data-v241-help></p></div><button type="button" class="phx-v241-edit-close" data-v241-close aria-label="Close">×</button></div>
      <input type="hidden" name="bookingNumber">
      <input type="hidden" name="mode">
      <div class="phx-v241-edit-grid">
        <div class="phx-v241-edit-summary" data-v241-customer-summary hidden></div>
        <label class="wide" data-v241-verify-wrap>Verification phone or email<input name="verificationContact" placeholder="Phone or email used on the booking"></label>
        <label data-v241-basic-field>Event date<input type="date" name="eventDate"></label>
        <label data-v241-basic-field>Event time<input name="eventTime" placeholder="6:00 PM"></label>
        <label>Package / price<select name="packageName"><option value="Classic">Classic - $55/adult</option><option value="Premium">Premium - $65/adult</option><option value="Signature">Signature - $110/adult</option></select></label>
        <label>Adults<input type="number" min="0" step="1" name="adults"></label>
        <label>Children<input type="number" min="0" step="1" name="kids"></label>
        <label data-v241-travel-wrap>Travel Fee ($)<input type="number" min="0" step="0.01" name="travelFee"></label>
        <label class="wide" data-v241-basic-field>Event address<input name="address" placeholder="Full event address"></label>
        <div class="phx-v241-choice-section" data-v241-customer-choices hidden>
          <h3>Choose menu changes</h3>
          <p>Select the package, guests, proteins, side orders, and allergy notes you want Phoenix to review. Event time changes must be handled by Phoenix customer service.</p>
          <div><strong>Protein choices</strong><div class="phx-v241-protein-total" data-v241-protein-total></div><div class="phx-v241-choice-grid" data-v241-protein-choices></div></div>
          <div><strong>Add-ons / side orders</strong><div class="phx-v241-choice-grid" data-v241-addon-choices></div></div>
        </div>
        <label class="wide" data-v241-menu-text>Add-ons / side orders<textarea name="addons" rows="3" placeholder="One item per line"></textarea></label>
        <label class="wide" data-v241-menu-text>Protein selections<textarea name="proteinSummary" rows="3" placeholder="Chicken 4, Steak 4, Shrimp 2..."></textarea></label>
        <label class="wide">Allergies / dietary notes<textarea name="allergyNotes" rows="3"></textarea></label>
        <label class="wide">Change note<textarea name="changeNote" rows="3" placeholder="Tell Phoenix Hibachi what changed."></textarea></label>
        <div class="phx-v241-price-preview" data-v241-price-preview></div>
      </div>
      <div class="phx-v241-edit-status" data-v241-status></div>
      <div class="phx-v241-edit-actions"><button type="button" class="outline-btn" data-v241-close>Cancel</button><button type="submit" class="gold-btn">Save changes</button></div>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target?.closest?.('[data-v241-close]')) closeModal();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
    dialog.querySelector('form')?.addEventListener('submit', event => {
      event.preventDefault();
      saveModal();
    });
    return dialog;
  }

  const PROTEIN_CHOICES_V241 = [
    { name:'Chicken', label:'Chicken' },
    { name:'Steak', label:'Steak' },
    { name:'Shrimp', label:'Shrimp' },
    { name:'Salmon', label:'Salmon' },
    { name:'Tofu', label:'Tofu' },
    { name:'Filet Mignon', label:'Filet Mignon upgrade', premium:true },
    { name:'Scallop', label:'Scallop upgrade', premium:true },
    { name:'Lobster', label:'Lobster Tail upgrade', premium:true }
  ];
  const ADDON_CHOICES_V241 = [
    { name:'Extra Fried Rice Tray', price:25, note:'serves about 5' },
    { name:'Noodle / Yakisoba Tray', price:50, note:'tray' },
    { name:'Hibachi Vegetables', price:28, note:'serves about 5' },
    { name:'Hibachi Tofu', price:30, note:'serves about 5' },
    { name:'Extra Gyoza Tray', price:45, note:'tray' },
    { name:'Extra Edamame Tray', price:35, note:'tray' },
    { name:'Sushi Starter', price:59, note:'28 pcs' },
    { name:'Party Roll Platter', price:89, note:'56 pcs' },
    { name:'Deluxe Sushi Platter', price:119, note:'72 pcs' },
    { name:'Phoenix Party Punch', price:49, note:'1 gallon' },
    { name:'Japanese Ramune Soda', price:20, note:'5 bottles' },
    { name:'Mochi Ice Cream', price:32, note:'12 pcs' }
  ];

  function customerSummaryHtml(order = {}) {
    const id = idOf(order);
    const date = text(order.event_date || order.eventDate || order.date || '');
    const time = text(order.event_time || order.eventTime || '');
    const name = text(order.name || order.customer_name || 'Guest');
    const phone = text(order.phone || order.customer_phone || '');
    const email = text(order.email || order.customer_email || '');
    const address = text(order.address || order.event_address || '');
    return `
      <div><span>Booking</span><strong>${esc(id)}</strong></div>
      <div><span>Guest</span><strong>${esc(name)}</strong></div>
      <div><span>Date / Time</span><strong>${esc([date, time].filter(Boolean).join(' · ') || 'Current order time')}</strong></div>
      <div><span>Contact</span><strong>${esc([phone, email].filter(Boolean).join(' · ') || 'On file')}</strong></div>
      <div class="wide"><span>Event address</span><strong>${esc(address || 'Address on file')}</strong></div>
    `;
  }

  const FALLBACK_PACKAGE_PROTEIN_PORTIONS_V241 = { Classic:2, Premium:3, Signature:4 };

  function tryJsonValue(value) {
    if (typeof value !== 'string') return value;
    const raw = text(value);
    if (!/^[\[{]/.test(raw)) return value;
    try { return JSON.parse(raw); } catch { return value; }
  }
  function normalizedChoiceName(value) {
    return lower(value)
      .replace(/&/g, 'and')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\b(upgrade|included protein|portion|portions|pcs|pieces|tray|trays|serves about \d+)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  function canonicalQtyName(rawName) {
    const raw = text(rawName).replace(/\s*\([^)]*\)\s*$/, '');
    const norm = normalizedChoiceName(raw);
    const aliases = {
      chicken:'Chicken',
      steak:'Steak',
      'ny strip':'Steak',
      'ny strip steak':'Steak',
      shrimp:'Shrimp',
      salmon:'Salmon',
      tofu:'Tofu',
      filet:'Filet Mignon',
      'filet mignon':'Filet Mignon',
      scallop:'Scallop',
      scallops:'Scallop',
      lobster:'Lobster',
      'lobster tail':'Lobster',
      'extra fried rice':'Extra Fried Rice Tray',
      'fried rice':'Extra Fried Rice Tray',
      'extra fried rice tray':'Extra Fried Rice Tray',
      'noodle yakisoba':'Noodle / Yakisoba Tray',
      'noodle yakisoba tray':'Noodle / Yakisoba Tray',
      noodles:'Noodle / Yakisoba Tray',
      yakisoba:'Noodle / Yakisoba Tray',
      'hibachi vegetables':'Hibachi Vegetables',
      vegetables:'Hibachi Vegetables',
      'hibachi tofu':'Hibachi Tofu',
      'extra gyoza':'Extra Gyoza Tray',
      'extra gyoza tray':'Extra Gyoza Tray',
      gyoza:'Extra Gyoza Tray',
      'extra edamame':'Extra Edamame Tray',
      'extra edamame tray':'Extra Edamame Tray',
      edamame:'Extra Edamame Tray',
      'sushi starter':'Sushi Starter',
      'party roll platter':'Party Roll Platter',
      'deluxe sushi platter':'Deluxe Sushi Platter',
      'phoenix party punch':'Phoenix Party Punch',
      'japanese ramune soda':'Japanese Ramune Soda',
      ramune:'Japanese Ramune Soda',
      mochi:'Mochi Ice Cream',
      'mochi ice cream':'Mochi Ice Cream'
    };
    if (aliases[norm]) return aliases[norm];
    const protein = PROTEIN_CHOICES_V241.find(item => normalizedChoiceName(item.name) === norm || normalizedChoiceName(item.label) === norm);
    const addon = ADDON_CHOICES_V241.find(item => normalizedChoiceName(item.name) === norm);
    return protein?.name || addon?.name || raw;
  }
  function addQtyToMap(map, rawName, qty, options = {}) {
    const name = canonicalQtyName(rawName);
    const cleanName = text(name);
    const amount = int(qty, NaN);
    if (!cleanName || !Number.isFinite(amount) || amount <= 0) return;
    map[cleanName] = int(map[cleanName], 0) + amount;
  }
  function parseQtyMap(value = '', options = {}) {
    const map = {};
    const parsed = tryJsonValue(value);
    if (Array.isArray(parsed)) {
      parsed.forEach(item => {
        if (typeof item === 'string') {
          const nested = parseQtyMap(item, options);
          Object.entries(nested).forEach(([name, qty]) => addQtyToMap(map, name, qty));
          if (options.defaultKnown && !Object.keys(nested).length) {
            const name = canonicalQtyName(item);
            if (ADDON_CHOICES_V241.some(choice => choice.name === name)) addQtyToMap(map, name, 1);
          }
          return;
        }
        if (!item || typeof item !== 'object') return;
        const name = item.name || item.label || item.item || item.title || item.protein || item.addon;
        const qty = item.qty ?? item.quantity ?? item.count ?? item.portions ?? item.value ?? 1;
        addQtyToMap(map, name, qty, options);
      });
      return map;
    }
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([name, rawQty]) => {
        if (rawQty && typeof rawQty === 'object') {
          addQtyToMap(map, rawQty.name || rawQty.label || name, rawQty.qty ?? rawQty.quantity ?? rawQty.count ?? rawQty.portions ?? 1, options);
        } else {
          addQtyToMap(map, name, rawQty, options);
        }
      });
      return map;
    }
    text(parsed)
      .replace(/^Protein selections:\s*/i, '')
      .replace(/^Menu selections:\s*/i, '')
      .replace(/^Add-ons?:\s*/i, '')
      .split(/[,;\n]+/)
      .forEach(part => {
        const clean = text(part)
          .replace(/^(?:protein selections?|protein summary|menu selections?|proteins?|add-ons?|side orders?):\s*/i, '')
          .replace(/\$\d+(?:\.\d{2})?/g, '')
          .replace(/\s*\([^)]*\)\s*/g, ' ');
        if (!clean || /^none|not selected/i.test(clean)) return;
        const m = clean.match(/^(.+?)\s*(?:x|×|\u00d7|\u8133|:|-)\s*(\d+)\b/i) ||
          clean.match(/^(.+?)\s+(\d+)\s*(?:pcs|pieces|portions|trays?)?\b/i) ||
          clean.match(/^(\d+)\s*(?:x|×|\u00d7)?\s*(.+)$/i);
        if (m) {
          const rawName = /^\d/.test(clean) ? m[2] : m[1];
          const qty = /^\d/.test(clean) ? m[1] : m[2];
          addQtyToMap(map, rawName, qty, options);
          return;
        }
        if (options.defaultKnown) {
          const name = canonicalQtyName(clean);
          if (ADDON_CHOICES_V241.some(choice => choice.name === name)) addQtyToMap(map, name, 1, options);
        }
      });
    return map;
  }
  function selectedProteinsFromForm(form) {
    normalizeProteinTotal(form);
    const selections = {};
    form?.querySelectorAll?.('[data-v241-protein-input]').forEach(input => {
      const qty = int(input.value, 0);
      const name = text(input.getAttribute('data-v241-protein-input'));
      if (name && qty > 0) selections[name] = qty;
    });
    return selections;
  }
  function selectedAddonsFromForm(form) {
    const items = [];
    form?.querySelectorAll?.('[data-v241-addon-input]').forEach(input => {
      const qty = int(input.value, 0);
      const name = text(input.getAttribute('data-v241-addon-input'));
      const unitPrice = num(input.getAttribute('data-v241-addon-price'), 0);
      if (name && qty > 0) items.push({ name, qty, unitPrice, price:unitPrice * qty });
    });
    return items;
  }
  function proteinSummaryFromSelections(selections = {}) {
    const parts = Object.entries(selections).filter(([, qty]) => Number(qty) > 0).map(([name, qty]) => `${name} x ${qty}`);
    return parts.join(', ');
  }
  function addonSummaryFromItems(items = []) {
    return items.filter(item => Number(item.qty) > 0).map(item => `${item.name} x ${item.qty}`).join('\n');
  }
  function activePricingV241() {
    try { return window.PHX_GET_PRICING_V140?.() || {}; } catch { return {}; }
  }
  function packageProteinPortionsV241() {
    const pricing = activePricingV241();
    return { ...FALLBACK_PACKAGE_PROTEIN_PORTIONS_V241, ...(pricing.packageProteinPortions || {}) };
  }
  function normalizedPackageName(value) {
    const raw = text(value) || 'Classic';
    const found = Object.keys(packageProteinPortionsV241()).find(name => lower(name) === lower(raw) || lower(raw).includes(lower(name)));
    return found || raw;
  }
  function proteinPortionsForPackageV241(packageName) {
    const packageNameClean = normalizedPackageName(packageName);
    const portions = packageProteinPortionsV241();
    return Math.max(1, num(portions[packageNameClean], FALLBACK_PACKAGE_PROTEIN_PORTIONS_V241[packageNameClean] || 2));
  }
  function proteinRuleForForm(form) {
    const packageName = normalizedPackageName(form?.elements?.packageName?.value || 'Classic');
    const adults = int(form?.elements?.adults?.value, 0);
    const kids = int(form?.elements?.kids?.value, 0);
    const billableGuests = Math.max(0, adults + kids * 0.5);
    const portionsPerGuest = proteinPortionsForPackageV241(packageName);
    const required = Math.ceil(billableGuests * portionsPerGuest);
    return { packageName, portionsPerGuest, adults, kids, billableGuests, required, maxTotal:required };
  }
  function renderProteinQuantityList(container, form, currentText) {
    if (!container || !form) return;
    const current = parseQtyMap(currentText || form.elements.proteinSummary.value);
    const rule = proteinRuleForForm(form);
    container.innerHTML = PROTEIN_CHOICES_V241.map(choice => {
      const value = int(current[choice.name], 0);
      const note = choice.premium ? '+$5 per portion' : 'included protein';
      return `<label><span>${esc(choice.label)}<small>${esc(note)}</small></span><input type="number" min="0" max="${rule.maxTotal}" step="1" value="${value}" data-v241-protein-input="${esc(choice.name)}" aria-label="${esc(choice.label)} quantity"></label>`;
    }).join('');
  }
  function renderAddonQuantityList(container, form, currentText) {
    if (!container || !form) return;
    const current = parseQtyMap(currentText || form.elements.addons.value, { defaultKnown:true });
    container.innerHTML = ADDON_CHOICES_V241.map(item => {
      const value = int(current[item.name], 0);
      return `<label><span>${esc(item.name)}<small>${money(item.price)} · ${esc(item.note || 'add-on')}</small></span><input type="number" min="0" step="1" value="${value}" data-v241-addon-input="${esc(item.name)}" data-v241-addon-price="${esc(item.price)}" aria-label="${esc(item.name)} quantity"></label>`;
    }).join('');
  }

  function updateProteinTotalIndicator(form) {
    const rule = proteinRuleForForm(form);
    const total = Array.from(form?.querySelectorAll?.('[data-v241-protein-input]') || [])
      .reduce((sum, input) => sum + int(input.value, 0), 0);
    const indicator = form?.querySelector?.('[data-v241-protein-total]');
    if (!indicator) return;
    indicator.classList.toggle('warn', total !== rule.required);
    indicator.innerHTML = `<span>${esc(rule.packageName)} protein total</span><b>${total} / ${rule.required} portions</b>`;
  }
  function normalizeProteinTotal(form, changedInput = null) {
    const rule = proteinRuleForForm(form);
    const inputs = Array.from(form?.querySelectorAll?.('[data-v241-protein-input]') || []);
    if (!inputs.length || rule.required <= 0) {
      updateProteinTotalIndicator(form);
      return;
    }
    inputs.forEach(input => {
      input.max = String(rule.maxTotal);
      if (int(input.value, 0) < 0) input.value = '0';
    });
    if (changedInput) {
      const othersTotal = inputs
        .filter(input => input !== changedInput)
        .reduce((sum, input) => sum + int(input.value, 0), 0);
      const allowedForCurrent = Math.max(0, rule.required - othersTotal);
      const current = int(changedInput.value, 0);
      if (current > allowedForCurrent) changedInput.value = String(allowedForCurrent);
    }
    let runningTotal = 0;
    const ordered = changedInput
      ? [changedInput, ...inputs.filter(input => input !== changedInput)]
      : inputs;
    ordered.forEach(input => {
      const current = int(input.value, 0);
      const remaining = Math.max(0, rule.required - runningTotal);
      const next = Math.min(current, remaining);
      if (current !== next) input.value = String(next);
      runningTotal += next;
    });
    updateProteinTotalIndicator(form);
  }

  function setupCustomerChoices(dialog, form) {
    renderProteinQuantityList(dialog.querySelector('[data-v241-protein-choices]'), form, form.elements.proteinSummary.value);
    renderAddonQuantityList(dialog.querySelector('[data-v241-addon-choices]'), form, form.elements.addons.value);
    const sync = event => {
      normalizeProteinTotal(form, event?.target?.matches?.('[data-v241-protein-input]') ? event.target : null);
      const proteins = selectedProteinsFromForm(form);
      const addons = selectedAddonsFromForm(form);
      form.elements.proteinSummary.value = proteinSummaryFromSelections(proteins);
      form.elements.addons.value = addonSummaryFromItems(addons);
      updatePricePreview(form);
    };
    dialog.querySelectorAll('[data-v241-protein-input],[data-v241-addon-input]').forEach(input => input.addEventListener('input', sync));
    normalizeProteinTotal(form);
    sync();
  }

  function bindPricePreviewEvents(dialog, form, customerMode) {
    const rerenderProteins = () => {
      setupCustomerChoices(dialog, form);
      updatePricePreview(form);
    };
    ['packageName', 'adults', 'kids', 'travelFee'].forEach(name => {
      const input = form.elements[name];
      if (!input) return;
      input.oninput = name === 'adults' || name === 'kids' ? rerenderProteins : () => updatePricePreview(form);
      input.onchange = input.oninput;
    });
    ['addons', 'proteinSummary', 'allergyNotes'].forEach(name => {
      const input = form.elements[name];
      if (input) input.oninput = () => updatePricePreview(form);
    });
  }

  function draftOrderFromForm(form, order = {}, mode = text(form?.elements?.mode?.value || 'customer')) {
    const packageName = text(form.elements.packageName.value) || 'Classic';
    const adults = int(form.elements.adults.value, 0);
    const kids = int(form.elements.kids.value, 0);
    const totalGuests = adults + kids;
    const proteinSelections = selectedProteinsFromForm(form);
    const pricedAddons = selectedAddonsFromForm(form);
    const travelFee = mode === 'admin' ? num(form.elements.travelFee.value, 0) : num(order.travelFee ?? order.travel_fee, 0);
    return {
      ...order,
      eventDate:form.elements.eventDate.value,
      event_date:form.elements.eventDate.value,
      eventTime:form.elements.eventTime.value,
      event_time:form.elements.eventTime.value,
      package:packageName,
      package_name:packageName,
      adults,
      kids,
      totalGuests,
      guest_count:totalGuests,
      billableGuests:adults + kids * 0.5,
      address:form.elements.address.value,
      addons:pricedAddons,
      add_ons:pricedAddons,
      proteinSelections,
      protein_selections:proteinSelections,
      proteinSummary:proteinSummaryFromSelections(proteinSelections),
      protein_summary:proteinSummaryFromSelections(proteinSelections),
      allergyNotes:form.elements.allergyNotes.value,
      allergy_notes:form.elements.allergyNotes.value,
      travelFee,
      travel_fee:travelFee
    };
  }

  function estimateOrderFromForm(form, order = {}, mode = text(form?.elements?.mode?.value || 'customer')) {
    const draft = draftOrderFromForm(form, order, mode);
    try {
      if (typeof calculateOrderMoney === 'function') return { draft, money:calculateOrderMoney(draft) || {} };
    } catch {}
    const packagePrices = { Classic:55, Premium:65, Signature:110, ...(activePricingV241().packages || {}) };
    const packagePrice = packagePrices[draft.package] || 55;
    const kidFoodPrice = draft.package === 'Classic' ? 28 : Math.ceil(packagePrice / 2);
    const rawFood = draft.adults * packagePrice + draft.kids * kidFoodPrice + selectedAddonsFromForm(form).reduce((sum, item) => sum + item.price, 0);
    const minimumFoodTotal = 550;
    const minimumOrderAdjustment = Math.max(0, minimumFoodTotal - rawFood);
    const foodSubtotal = rawFood + minimumOrderAdjustment;
    const guestTotalBeforeDeposit = foodSubtotal + num(draft.travelFee, 0);
    return { draft, money:{ packagePrice, billableGuests:draft.billableGuests, minimumFoodTotal, minimumOrderAdjustment, foodSubtotal, travelFee:num(draft.travelFee, 0), salesTax:0, guestTotalBeforeDeposit, guestTotalAfterDeposit:guestTotalBeforeDeposit } };
  }

  function proteinRuleMessage(form) {
    const rule = proteinRuleForForm(form);
    return `${rule.packageName} includes ${rule.portionsPerGuest} protein portions per adult-equivalent guest. ${formatGuestNumberSafe(rule.billableGuests)} x ${rule.portionsPerGuest} = ${rule.required} total protein portions required across all selections.`;
  }
  function formatGuestNumberSafe(value) {
    try { return typeof formatGuestNumber === 'function' ? formatGuestNumber(value) : (Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1).replace(/\.0$/, '')); }
    catch { return String(value); }
  }
  function validateProteinQuantities(form) {
    const rule = proteinRuleForForm(form);
    const selections = selectedProteinsFromForm(form);
    const total = Object.values(selections).reduce((sum, qty) => sum + int(qty, 0), 0);
    if (rule.required <= 0) return 'Please enter the guest count before saving changes.';
    if (total > rule.required) return `Protein quantity cannot exceed ${rule.required} total portions. Current selected total is ${total}. ${proteinRuleMessage(form)}`;
    if (total !== rule.required) return `Protein quantity must equal ${rule.required} total portions. Current selected total is ${total}. ${proteinRuleMessage(form)}`;
    return '';
  }
  function centsAsDollars(value) {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = num(value, NaN);
    return Number.isFinite(parsed) ? Math.max(0, parsed / 100) : 0;
  }
  function firstPositiveMoney(...values) {
    for (const value of values) {
      const parsed = num(value, NaN);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }
  function balanceDueForOrder(order = {}) {
    return firstPositiveMoney(
      order.balanceDue,
      order.balance_due,
      centsAsDollars(order.balance_due_cents),
      centsAsDollars(order.balanceDueCents)
    );
  }
  function hasBalanceDueField(order = {}) {
    return ['balanceDue', 'balance_due', 'balance_due_cents', 'balanceDueCents'].some(key => order[key] !== undefined && order[key] !== null && order[key] !== '');
  }
  function previousFinalTotalForOrder(order = {}) {
    const direct = firstPositiveMoney(
      order.finalTotal,
      order.final_total,
      order.guestTotalBeforeDeposit,
      order.guest_total_before_deposit,
      centsAsDollars(order.order_total_cents),
      centsAsDollars(order.total_cents)
    );
    if (direct) return direct;
    const paid = firstPositiveMoney(order.paidAmount, order.paid_amount, order.amount_paid, order.paid, order.depositPaid, order.deposit_amount);
    const balance = balanceDueForOrder(order);
    return paid || balance ? paid + balance : 0;
  }
  function statusSaysPaidInFull(order = {}) {
    const status = lower([
      order.paymentStatus,
      order.payment_status,
      order.depositStatus,
      order.deposit_status,
      order.payment_verification_status
    ].join(' '));
    return /paid\s*in\s*full|fully\s*paid|paid[_\s-]*full|balance\s*paid/.test(status);
  }
  function amountPaidForOrder(order = {}, fallbackFinalTotal = previousFinalTotalForOrder(order)) {
    let paid = Math.max(
      firstPositiveMoney(order.paidAmount, order.paid_amount, order.amount_paid, order.paid, order.paymentReceived, order.payment_received),
      centsAsDollars(order.paid_amount_cents),
      centsAsDollars(order.amount_paid_cents),
      firstPositiveMoney(order.depositPaid, order.deposit_amount, order.depositAmount),
      centsAsDollars(order.deposit_amount_cents)
    );
    const balance = balanceDueForOrder(order);
    const fullByBalance = hasBalanceDueField(order) && fallbackFinalTotal > 0 && balance <= 0 && paid > 0;
    if ((statusSaysPaidInFull(order) || fullByBalance) && fallbackFinalTotal > 0) paid = Math.max(paid, fallbackFinalTotal);
    return Math.max(0, paid);
  }
  function paymentPolicyForModification(order = {}, finalTotal = 0) {
    const previousFinalTotal = previousFinalTotalForOrder(order);
    const paid = amountPaidForOrder(order, previousFinalTotal);
    const balance = Math.max(0, num(finalTotal, 0) - paid);
    const noRefundCredit = Math.max(0, paid - num(finalTotal, 0));
    const wasPaidInFull = paid > 0 && (statusSaysPaidInFull(order) || (previousFinalTotal > 0 && paid >= previousFinalTotal - 0.01));
    const additionalDue = balance > 0 ? balance : 0;
    return { previousFinalTotal, paid, balance, noRefundCredit, wasPaidInFull, additionalDue };
  }
  function paymentStatusAfterModification(order = {}, policy = {}) {
    if (policy.balance > 0 && policy.paid > 0 && policy.wasPaidInFull) return 'additional balance due';
    if (policy.balance > 0 && policy.paid > 0) return 'partial payment - balance due';
    if (policy.balance > 0) return text(order.payment_status || order.paymentStatus || 'unpaid');
    if (policy.paid > 0) return 'paid in full';
    return text(order.payment_status || order.paymentStatus || 'unpaid');
  }
  function paymentAdjustmentNote(policy = {}, finalTotal = 0) {
    if (policy.noRefundCredit > 0.004) {
      return `No refund after order modification: paid ${money(policy.paid)}; updated total ${money(finalTotal)}; balance remains $0.00. Guest-count or item reductions do not create refunds.`;
    }
    if (policy.additionalDue > 0.004 && policy.paid > 0) {
      return `Additional balance due after order modification: ${money(policy.additionalDue)}. Previously paid ${money(policy.paid)} remains applied.`;
    }
    return '';
  }

  function updatePricePreview(form, order = collectOrders().get(text(form?.elements?.bookingNumber?.value).toLowerCase()) || {}) {
    const box = document.querySelector('#phxOrderModifyModalV241 [data-v241-price-preview]');
    if (!box || !form) return;
    const { money:m } = estimateOrderFromForm(form, order, text(form.elements.mode.value || 'customer'));
    const rule = proteinRuleForForm(form);
    const proteinTotal = Object.values(selectedProteinsFromForm(form)).reduce((sum, qty) => sum + int(qty, 0), 0);
    const finalTotal = num(m.guestTotalBeforeDeposit ?? m.total ?? m.grandTotal, 0);
    const policy = paymentPolicyForModification(order, finalTotal);
    const minimumLine = num(m.minimumOrderAdjustment, 0) > 0
      ? `<div class="warn"><span>Minimum order adjustment</span><b>${money(m.minimumOrderAdjustment)} to meet ${money(m.minimumFoodTotal || 550)}</b></div>`
      : `<div><span>Minimum order</span><b>Met</b></div>`;
    const paymentRuleLine = policy.noRefundCredit > 0.004
      ? `<div class="warn"><span>No-refund rule</span><b>Paid ${money(policy.paid)} stays applied; reductions do not create refunds.</b></div>`
      : (policy.additionalDue > 0.004 && policy.paid > 0
        ? `<div class="warn"><span>Additional amount due</span><b>${money(policy.additionalDue)} after previous payment</b></div>`
        : '');
    box.innerHTML = `
      <h3>Updated price preview</h3>
      <div><span>Protein rule</span><b>${proteinTotal}/${rule.required} portions</b></div>
      <div><span>Package</span><b>${esc(text(form.elements.packageName.value || 'Classic'))} · ${money(m.packagePrice || 0)}/adult</b></div>
      <div><span>Food subtotal</span><b>${money(m.foodSubtotal || 0)}</b></div>
      ${minimumLine}
      <div><span>Travel fee</span><b>${money(m.travelFee || 0)}</b></div>
      <div><span>Sales tax</span><b>${money(m.salesTax || 0)}</b></div>
      <div><span>Estimated final total</span><b>${money(finalTotal)}</b></div>
      <div><span>Already paid</span><b>${money(policy.paid)}</b></div>
      <div><span>Balance after paid/deposit</span><b>${money(policy.balance)}</b></div>
      ${paymentRuleLine}
    `;
  }

  function setCustomerBasicMode(dialog, customerMode, order) {
    const summary = dialog.querySelector('[data-v241-customer-summary]');
    const choices = dialog.querySelector('[data-v241-customer-choices]');
    if (summary) {
      summary.hidden = false;
      summary.innerHTML = customerSummaryHtml(order);
    }
    if (choices) choices.hidden = false;
    dialog.querySelectorAll('[data-v241-basic-field]').forEach(label => { label.hidden = customerMode; });
    dialog.querySelectorAll('[data-v241-menu-text]').forEach(label => { label.hidden = true; });
    setupCustomerChoices(dialog, dialog.querySelector('form'));
  }

  function paymentDialog() {
    let dialog = document.getElementById('phxPaymentTopDialogV241');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxPaymentTopDialogV241';
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target?.closest?.('[data-close-payment]')) closePaymentDialog();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePaymentDialog(); });
    return dialog;
  }

  function openPaymentDialog(orderId) {
    setPaymentOrderContext(orderId);
    const base = document.getElementById('paymentModal');
    const card = base?.querySelector?.('.phx-payment-card') || document.querySelector('#phxPaymentTopDialogV241 .phx-payment-card');
    if (!card) {
      alert('Payment options are loading. Please try again.');
      return;
    }
    const dialog = paymentDialog();
    dialog.appendChild(card);
    base?.classList?.remove('open');
    base?.setAttribute?.('aria-hidden', 'true');
    const ref = card.querySelector('#paymentOrderReference');
    const id = normalizedBookingNumber(orderId);
    if (ref) ref.textContent = id ? `Booking ${id}` : 'Select a confirmed order from your dashboard.';
    try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
    setTimeout(() => {
      try { dialog.scrollTop = 0; card.scrollTop = 0; card.querySelector('[data-close-payment]')?.focus?.(); } catch {}
    }, 20);
  }

  function closePaymentDialog() {
    const dialog = document.getElementById('phxPaymentTopDialogV241');
    const base = document.getElementById('paymentModal');
    const card = dialog?.querySelector?.('.phx-payment-card');
    if (card && base) base.appendChild(card);
    try { dialog?.close(); } catch { dialog?.removeAttribute('open'); }
  }

  function closeModal() {
    const dialog = document.getElementById('phxOrderModifyModalV241');
    try { dialog?.close(); } catch { dialog?.removeAttribute('open'); }
  }
  function setStatus(message, isError = false) {
    const el = document.querySelector('#phxOrderModifyModalV241 [data-v241-status]');
    if (el) {
      el.textContent = message || '';
      el.style.color = isError ? '#ff9b9b' : '#ffd778';
    }
  }
  function noteValueFromOrder(order = {}, label = '') {
    const safe = text(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const notes = [
      order.admin_notes,
      order.specialNotes,
      order.service_notes,
      order.customer_notes,
      order.special_requests,
      order.notes,
      order.menu_summary
    ].map(text).filter(Boolean).join('\n');
    const match = notes.match(new RegExp(`(?:^|\\n)${safe}:\\s*([^\\n]+)`, 'i'));
    return match ? match[1].trim() : '';
  }
  function firstQtyMapFromSources(sources = [], options = {}) {
    for (const source of sources) {
      const map = parseQtyMap(source, options);
      if (Object.keys(map).length) return map;
    }
    return {};
  }
  function addonItemsFromMap(map = {}) {
    return Object.entries(map).filter(([name, qty]) => int(qty, 0) > 0 && ADDON_CHOICES_V241.some(item => item.name === canonicalQtyName(name))).map(([name, qty]) => {
      const cleanName = canonicalQtyName(name);
      const choice = ADDON_CHOICES_V241.find(item => item.name === cleanName);
      const unitPrice = num(choice?.price, 0);
      return { name:choice?.name || cleanName, qty:int(qty, 0), unitPrice, price:unitPrice * int(qty, 0) };
    });
  }
  function proteinSelectionsFromMap(map = {}) {
    return Object.entries(map).reduce((acc, [name, qty]) => {
      const cleanName = canonicalQtyName(name);
      if (PROTEIN_CHOICES_V241.some(item => item.name === cleanName) && int(qty, 0) > 0) acc[cleanName] = int(qty, 0);
      return acc;
    }, {});
  }
  function addonsText(order = {}) {
    const items = Array.isArray(order.addons) ? order.addons : (Array.isArray(order.add_ons) ? order.add_ons : []);
    return items.map(item => typeof item === 'string' ? item : `${item.name || 'Add-on'}${item.qty ? ` × ${item.qty}` : ''}${item.price ? ` (${money(item.price)})` : ''}`).join('\n');
  }
  function proteinText(order = {}) {
    try {
      return text(order.proteinSummary || order.protein_summary || (typeof proteinSummary === 'function' ? proteinSummary(order.proteinSelections || {}) : ''));
    } catch { return text(order.proteinSummary || order.protein_summary); }
  }

  // V246: read real order menu data from structured fields, text fields, and legacy notes.
  function addonsTextV246(order = {}) {
    const map = firstQtyMapFromSources([
      order.addons,
      order.add_ons,
      order.addOns,
      order.side_orders,
      order.sideOrders,
      order.addon_summary,
      order.menuSelections,
      order.menu_selections,
      noteValueFromOrder(order, 'Add-ons'),
      noteValueFromOrder(order, 'Side orders'),
      order.admin_notes,
      order.specialNotes,
      order.menu_summary
    ], { defaultKnown:true });
    if (Object.keys(map).length) return addonSummaryFromItems(addonItemsFromMap(map));
    return text(order.addons || order.add_ons || '');
  }
  function proteinTextV246(order = {}) {
    const map = firstQtyMapFromSources([
      order.proteinSelections,
      order.protein_selections,
      order.proteins,
      order.selectedProteins,
      order.selected_proteins,
      order.menuSelections,
      order.menu_selections,
      order.proteinSummary,
      order.protein_summary,
      noteValueFromOrder(order, 'Protein summary'),
      noteValueFromOrder(order, 'Protein selections'),
      noteValueFromOrder(order, 'Proteins'),
      noteValueFromOrder(order, 'Menu selections'),
      order.menu_summary,
      order.admin_notes,
      order.specialNotes
    ]);
    const proteinMap = proteinSelectionsFromMap(map);
    if (Object.keys(proteinMap).length) return proteinSummaryFromSelections(proteinMap);
    return text(order.proteinSummary || order.protein_summary || '');
  }

  function cleanVerificationContact(value) {
    const raw = text(value);
    return raw && !raw.includes('*') ? raw : '';
  }
  function lookupContactValue() {
    const query = cleanVerificationContact(document.getElementById('orderLookupInput')?.value);
    const contact = cleanVerificationContact(document.getElementById('orderLookupEmail')?.value);
    return contact || (/^PHX-/i.test(query) ? '' : query);
  }
  function normalizedBookingNumber(value) {
    const match = text(value).match(/\bPHX[-\w]+\b/i);
    return (match ? match[0] : text(value)).toUpperCase();
  }
  function friendlyFunctionError(error, action = 'request') {
    const message = text(error?.message || error);
    if (/non-2xx|failed to send|functions? invoke|edge function/i.test(message)) {
      return `Phoenix online service has not been updated for this ${action} yet. Please deploy the latest Supabase Edge Function: booking-lifecycle.`;
    }
    return message || `Phoenix could not complete this ${action}.`;
  }
  async function invokeLifecycle(action, body = {}) {
    const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
    const cfg = window.PHOENIX_SUPABASE_CONFIG || window.PHX_SUPABASE_CONFIG || {};
    const fn = cfg.bookingLifecycleFunction || cfg.lookupBookingFunction || 'booking-lifecycle';
    if (!client?.functions?.invoke) throw new Error('Booking service is not available.');
    const { data, error } = await client.functions.invoke(fn, { body:{ action, ...body } });
    if (error) throw new Error(friendlyFunctionError(error, action));
    if (data?.ok === false) throw new Error(data.error || 'Booking service rejected the request.');
    return data || {};
  }
  function maskedPublicOrderFromRow(row = {}) {
    const phoneDigits = text(row.customer_phone || row.phone).replace(/\D/g, '');
    const email = text(row.customer_email || row.email);
    return rememberLookupOrder({
      id:row.booking_number || row.id,
      booking_number:row.booking_number || row.id,
      eventDate:row.event_date || row.eventDate || '',
      eventTime:row.event_time || row.eventTime || '',
      status:row.status || '',
      requestStatus:row.request_status || '',
      paymentStatus:row.payment_status || '',
      depositStatus:row.deposit_status || '',
      depositPaid:num(row.deposit_amount || row.depositPaid, 0),
      paidAmount:num(row.paid_amount || row.amount_paid || row.deposit_amount || row.depositPaid, 0),
      paid_amount:num(row.paid_amount || row.amount_paid || row.deposit_amount || row.depositPaid, 0),
      balance_due:num(row.balance_due || row.balanceDue, 0),
      balanceDueCents:num(row.balance_due_cents || row.balanceDueCents, 0),
      name:row.customer_name ? `${text(row.customer_name).slice(0, 1)}***` : 'Guest',
      phone:phoneDigits ? `***${phoneDigits.slice(-4)}` : '',
      email:email ? email.replace(/^(.).+(@.+)$/, '$1***$2') : '',
      address:row.address ? text(row.address).split(',').slice(-2).join(',').trim() : '',
      package:row.package_name || row.package || 'Classic',
      adults:int(row.adults, 0),
      kids:int(row.kids, 0),
      totalGuests:int(row.guest_count || row.totalGuests, 0),
      travelFee:num(row.travel_fee || row.travelFee, 0),
      finalTotal:num(row.final_total || row.finalTotal, 0),
      final_total:num(row.final_total || row.finalTotal, 0),
      order_total_cents:num(row.order_total_cents || row.orderTotalCents, 0),
      __v241PublicLookup:true
    });
  }
  async function directPublicLookupByNumber(query) {
    const orderId = normalizedBookingNumber(query);
    if (!orderId || !/^PHX-/i.test(orderId)) return null;
    const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
    if (!client) return null;
    const fields = 'booking_number,event_date,event_time,status,request_status,payment_status,deposit_status,deposit_amount,paid_amount,balance_due,balance_due_cents,customer_name,customer_phone,customer_email,address,package_name,adults,kids,guest_count,travel_fee,final_total,order_total_cents';
    const { data, error } = await client.from('bookings').select(fields).eq('booking_number', orderId).order('created_at', { ascending:false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return maskedPublicOrderFromRow(data);
  }
  function renderLookupOrders(orders = []) {
    const html = orders.length
      ? orders.slice(0, 5).map(order => typeof orderLookupResultHtml === 'function' ? orderLookupResultHtml(order) : `<div class="lookup-card"><strong>${esc(idOf(order))}</strong></div>`).join('')
      : '<div class="empty-state">No active upcoming booking was found. Try the booking phone or email, or call Phoenix Hibachi.</div>';
    const result = document.getElementById('orderLookupResult');
    if (result) result.innerHTML = html;
    forceOrderLookupWholeWindow();
    setTimeout(injectButtons, 120);
  }
  function setPaymentOrderContext(orderId) {
    const id = normalizedBookingNumber(orderId);
    if (!id) return;
    const order = collectOrders().get(id.toLowerCase()) || { id, booking_number:id };
    const normalized = { ...order, id:idOf(order) || id, booking_number:idOf(order) || id };
    try { lastSubmittedOrder = normalized; } catch { window.lastSubmittedOrder = normalized; }
    try { window.lastSubmittedOrder = normalized; } catch {}
    try { window.phoenixRefreshRequiredDepositUI?.(normalized); } catch {}
    try { if (typeof prepareBookingPaymentAccessToken === 'function') prepareBookingPaymentAccessToken(normalized); } catch {}
  }
  function installOrderNumberLookupFallback() {
    if (window.__PHX_V241_ORDER_NUMBER_LOOKUP_FALLBACK__) return;
    window.__PHX_V241_ORDER_NUMBER_LOOKUP_FALLBACK__ = true;
    document.addEventListener('submit', async event => {
      const form = event.target?.closest?.('#orderLookupForm');
      if (!form) return;
      const query = text(document.getElementById('orderLookupInput')?.value);
      const contact = text(document.getElementById('orderLookupEmail')?.value);
      if (!/^PHX-/i.test(query) || contact) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const result = document.getElementById('orderLookupResult');
      if (result) result.innerHTML = '<div class="empty-state">Searching active upcoming booking by order number...</div>';
      let orders = [];
      let backendMessage = '';
      try {
        const data = await invokeLifecycle('lookup', { query, verificationContact:'' });
        orders = Array.isArray(data.orders) ? data.orders.map(rememberLookupOrder) : [];
      } catch (error) {
        backendMessage = friendlyFunctionError(error, 'order-number lookup');
      }
      if (!orders.length) {
        try {
          const direct = await directPublicLookupByNumber(query);
          if (direct) orders = [direct];
        } catch {}
      }
      if (orders.length) {
        renderLookupOrders(orders);
      } else if (result) {
        result.innerHTML = `<div class="empty-state">${esc(backendMessage || 'Order-number lookup is not available yet.')}<br><br>For now, search by the booking phone or email, or deploy the latest Supabase booking-lifecycle function.</div>`;
        forceOrderLookupWholeWindow();
      }
    }, true);
  }
  async function loadEditableCustomerOrder(order = {}, verificationContact = '') {
    const orderId = idOf(order);
    if (!orderId) throw new Error('Order number is missing.');
    const verify = cleanVerificationContact(verificationContact);
    if (!verify) throw new Error('Phone or email verification is required to modify this order.');
    const data = await invokeLifecycle('customer_edit_order', { bookingNumber:orderId, verificationContact:verify });
    const fullOrder = { ...order, ...(data.booking || {}), __v241VerificationContact:verify, __v241PublicLookup:false, __v241Locked:data.locked === true };
    lookupOrders.set(orderId.toLowerCase(), fullOrder);
    return fullOrder;
  }
  async function loadFullAdminOrder(order = {}) {
    const orderId = idOf(order);
    if (!orderId) throw new Error('Order number is missing.');
    const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
    if (!client) throw new Error('Supabase client is not available.');
    const { data, error } = await client.from('bookings').select('*').eq('booking_number', orderId).order('created_at', { ascending:false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message || 'Could not load this order.');
    if (!data) throw new Error('Order was not found in Supabase.');
    const fullOrder = {
      ...data,
      id:data.booking_number || orderId,
      booking_number:data.booking_number || orderId,
      name:data.customer_name || data.name || '',
      phone:data.customer_phone || data.phone || '',
      email:data.customer_email || data.email || '',
      eventDate:data.event_date || data.eventDate || '',
      eventTime:data.event_time || data.eventTime || '',
      package:data.package_name || data.package || 'Classic',
      totalGuests:data.guest_count || data.totalGuests || 0,
      __v241NeedsFullFetch:false
    };
    lookupOrders.set(orderId.toLowerCase(), fullOrder);
    return fullOrder;
  }

  async function openEditor(order, mode) {
    const customerMode = mode === 'customer';
    if (customerMode && !customerCanModify(order)) {
      alert(`This order is within ${EDIT_WINDOW_HOURS} hours of the event and is now locked. Please call ${supportPhone()} to ask whether a change is still possible.`);
      return;
    }
    let editableOrder = order;
    if (!customerMode && order.__v241NeedsFullFetch) {
      try {
        editableOrder = await loadFullAdminOrder(order);
      } catch (error) {
        alert(`${error?.message || 'Could not load this order.'} Open Order details once, then try Modify order again.`);
        return;
      }
    }
    if (customerMode && order.__v241PublicLookup) {
      let verify = lookupContactValue();
      if (!verify) {
        verify = cleanVerificationContact(window.prompt?.('Please enter the phone or email used on this booking before modifying the order.') || '');
      }
      try {
        editableOrder = await loadEditableCustomerOrder(order, verify);
        if (editableOrder.__v241Locked || !customerCanModify(editableOrder)) {
          alert(`This order is within ${EDIT_WINDOW_HOURS} hours of the event and is now locked. Please call ${supportPhone()} to ask whether a change is still possible.`);
          return;
        }
      } catch (error) {
        alert(`${error?.message || 'Could not verify this order.'} Please call ${supportPhone()} for help.`);
        return;
      }
    }
    const dialog = modal();
    const form = dialog.querySelector('form');
    const verificationContact = cleanVerificationContact(editableOrder.__v241VerificationContact || lookupContactValue() || editableOrder.email || editableOrder.customer_email || editableOrder.phone || editableOrder.customer_phone);
    form.dataset.v241Order = JSON.stringify({ id:idOf(editableOrder) });
    form.elements.bookingNumber.value = idOf(editableOrder);
    form.elements.mode.value = mode;
    form.elements.verificationContact.value = verificationContact;
    form.elements.eventDate.value = dateForInput(editableOrder);
    form.elements.eventTime.value = text(editableOrder.event_time || editableOrder.eventTime || '');
    form.elements.packageName.value = text(editableOrder.package || editableOrder.package_name || 'Classic');
    form.elements.adults.value = int(editableOrder.adults || editableOrder.adultCount || 0);
    form.elements.kids.value = int(editableOrder.kids || editableOrder.childCount || 0);
    form.elements.address.value = text(editableOrder.address || editableOrder.event_address || '');
    form.elements.addons.value = addonsTextV246(editableOrder);
    form.elements.proteinSummary.value = proteinTextV246(editableOrder);
    form.elements.allergyNotes.value = text(editableOrder.allergyNotes || editableOrder.allergy_notes || (Array.isArray(editableOrder.allergies) ? editableOrder.allergies.join(', ') : editableOrder.allergies || ''));
    form.elements.changeNote.value = '';
    form.elements.travelFee.value = num(editableOrder.travelFee ?? editableOrder.travel_fee, 0).toFixed(2);
    setCustomerBasicMode(dialog, customerMode, editableOrder);
    bindPricePreviewEvents(dialog, form, customerMode);
    const help = dialog.querySelector('[data-v241-help]');
    const travelWrap = dialog.querySelector('[data-v241-travel-wrap]');
    const verifyWrap = dialog.querySelector('[data-v241-verify-wrap]');
    if (customerMode) {
      help.textContent = `${formatWindow(editableOrder)} Event time changes must be handled by Phoenix customer service. Price preview updates here; final total may still require manager review.`;
      travelWrap.hidden = true;
      verifyWrap.hidden = true;
    } else {
      help.textContent = 'Admin override: staff can modify this order at any time. Changes may send a booking modified notification.';
      travelWrap.hidden = false;
      verifyWrap.hidden = true;
    }
    setStatus('');
    updatePricePreview(form, editableOrder);
    try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
  }

  function patchFromForm(form, order, mode) {
    const fd = new FormData(form);
    const verificationContact = cleanVerificationContact(fd.get('verificationContact'));
    const eventDate = dbDate(fd.get('eventDate'));
    const eventTime = text(fd.get('eventTime'));
    const packageName = text(fd.get('packageName')) || 'Classic';
    const adults = int(fd.get('adults'), 0);
    const kids = int(fd.get('kids'), 0);
    const address = text(fd.get('address'));
    const proteinSelectionsValue = selectedProteinsFromForm(form);
    const proteinSummaryValue = proteinSummaryFromSelections(proteinSelectionsValue) || text(fd.get('proteinSummary'));
    const pricedAddOns = selectedAddonsFromForm(form);
    const addOns = addonSummaryFromItems(pricedAddOns).split(/\n+/).filter(Boolean);
    const allergyNotes = text(fd.get('allergyNotes'));
    const changeNote = text(fd.get('changeNote'));
    const totalGuests = adults + kids;
    const localPatch = {
      eventDate,
      event_date:eventDate,
      eventTime,
      event_time:eventTime,
      package:packageName,
      package_name:packageName,
      adults,
      kids,
      totalGuests,
      guest_count:totalGuests,
      address,
      add_ons:addOns,
      addons:addOns,
      proteinSelections:proteinSelectionsValue,
      protein_selections:proteinSelectionsValue,
      proteinSummary:proteinSummaryValue,
      protein_summary:proteinSummaryValue,
      allergyNotes,
      allergy_notes:allergyNotes
    };
    if (mode === 'admin') {
      localPatch.travelFee = num(fd.get('travelFee'), 0);
      localPatch.travel_fee = localPatch.travelFee;
    }
    const updated = { ...order, ...localPatch, addons:pricedAddOns, add_ons:pricedAddOns, proteinSelections:proteinSelectionsValue };
    const m = (() => { try { return typeof calculateOrderMoney === 'function' ? calculateOrderMoney(updated) : {}; } catch { return {}; } })();
    const finalTotal = num(m.guestTotalBeforeDeposit ?? updated.finalTotal ?? updated.final_total, 0);
    const paymentPolicy = paymentPolicyForModification(order, finalTotal);
    const paid = paymentPolicy.paid;
    const balance = paymentPolicy.balance;
    const paymentStatus = paymentStatusAfterModification(order, paymentPolicy);
    const paymentNote = paymentAdjustmentNote(paymentPolicy, finalTotal);
    const actor = mode === 'admin' ? 'Admin dashboard' : 'Customer portal';
    const now = new Date().toISOString();
    let notes = orderNotes(order);
    notes = upsertNote(notes, `${mode === 'admin' ? 'Admin' : 'Customer'} modified at`, now);
    notes = upsertNote(notes, 'Last order modification source', actor);
    if (proteinSummaryValue) notes = upsertNote(notes, 'Protein summary', proteinSummaryValue);
    if (allergyNotes) notes = upsertNote(notes, 'Allergy / dietary notes', allergyNotes);
    if (changeNote) notes = addHistory(notes, `${mode === 'admin' ? 'Admin' : 'Customer'} modification note`, changeNote);
    if (paymentNote) notes = addHistory(notes, 'Payment modification rule', paymentNote);
    const dbPatch = {
      package_name:packageName,
      adults,
      kids,
      guest_count:totalGuests,
      add_ons:addOns,
      protein_selections:proteinSelectionsValue,
      proteinSummary:proteinSummaryValue,
      protein_summary:proteinSummaryValue,
      allergy_notes:allergyNotes || null,
      admin_notes:notes,
      final_total:finalTotal,
      order_total_cents:Math.round(finalTotal * 100),
      balance_due:balance,
      balance_due_cents:Math.round(balance * 100),
      paid_amount:paid,
      payment_status:paymentStatus,
      paymentAdjustmentNote:paymentNote,
      changeNote
    };
    if (mode === 'admin') {
      dbPatch.event_date = eventDate;
      dbPatch.event_time = timeToDb(eventTime);
      dbPatch.address = address;
      dbPatch.travel_fee = localPatch.travelFee;
    }
    if (mode === 'customer') {
      dbPatch.status = /cancel|complete/i.test(text(order.status)) ? order.status : 'Customer updated - manager review';
      dbPatch.request_status = 'modified';
    }
    return {
      dbPatch,
      localPatch:{ ...localPatch, finalTotal, final_total:finalTotal, paidAmount:paid, paid_amount:paid, balanceDue:balance, balance_due:balance, paymentStatus, payment_status:paymentStatus, specialNotes:notes, admin_notes:notes, status:dbPatch.status || order.status },
      changeNote,
      verificationContact,
      finalTotal,
      balance,
      paid,
      paymentNote,
      noRefundCredit:paymentPolicy.noRefundCredit,
      additionalDue:paymentPolicy.additionalDue
    };
  }

  function removeMissingColumn(payload, message) {
    const match = text(message).match(/Could not find the '([^']+)' column/i) || text(message).match(/column "([^"]+)" .* does not exist/i);
    const column = match?.[1];
    if (!column || !(column in payload)) return null;
    const next = { ...payload };
    delete next[column];
    return next;
  }
  async function directUpdate(orderId, patch) {
    const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
    if (!client) throw new Error('Supabase client is not available.');
    let payload = { ...patch };
    let result = await client.from('bookings').update(payload).eq('booking_number', orderId).select('*').maybeSingle();
    for (let i = 0; result?.error && i < 12; i += 1) {
      const retry = removeMissingColumn(payload, result.error.message);
      if (!retry) break;
      payload = retry;
      result = await client.from('bookings').update(payload).eq('booking_number', orderId).select('*').maybeSingle();
    }
    if (result?.error) throw new Error(result.error.message);
    return result?.data || null;
  }
  async function lifecycleUpdate(orderId, mode, patch, order, verificationContactValue = '') {
    if (mode === 'admin' && typeof window.phoenixAdminLifecycleInvokeV2382 === 'function') {
      return window.phoenixAdminLifecycleInvokeV2382('admin_modify_order', { bookingNumber:orderId, patch });
    }
    const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
    const cfg = window.PHOENIX_SUPABASE_CONFIG || window.PHX_SUPABASE_CONFIG || {};
    const fn = cfg.bookingLifecycleFunction || cfg.lookupBookingFunction || 'booking-lifecycle';
    if (!client?.functions?.invoke) throw new Error('Booking service is not available.');
    const verificationContact = cleanVerificationContact(verificationContactValue || order.__v241VerificationContact || order.email || order.customer_email || order.phone || order.customer_phone);
    const { data, error } = await client.functions.invoke(fn, {
      body: { action:'customer_modify_order', bookingNumber:orderId, verificationContact, patch }
    });
    if (error) throw new Error(error.message || 'Booking service rejected the update.');
    if (data?.ok === false) throw new Error(data.error || 'Booking service rejected the update.');
    return data;
  }
  function patchLocal(orderId, patch) {
    try {
      const next = (getStoredOrders?.() || []).map(order => idOf(order) === orderId ? { ...order, ...patch } : order);
      saveStoredOrders?.(next);
    } catch {}
    try {
      if (Array.isArray(remoteOrdersCache)) remoteOrdersCache = remoteOrdersCache.map(order => idOf(order) === orderId ? { ...order, ...patch } : order);
    } catch {}
  }
  async function saveModal() {
    const dialog = document.getElementById('phxOrderModifyModalV241');
    const form = dialog?.querySelector('form');
    if (!form) return;
    const orderId = text(form.elements.bookingNumber.value);
    const mode = text(form.elements.mode.value) || 'customer';
    const order = collectOrders().get(orderId.toLowerCase());
    if (!order) { setStatus('Order was not found. Refresh and try again.', true); return; }
    if (mode === 'customer' && !customerCanModify(order)) {
      setStatus(`This order is locked within ${EDIT_WINDOW_HOURS} hours. Please call ${supportPhone()}.`, true);
      return;
    }
    const proteinError = validateProteinQuantities(form);
    if (proteinError) {
      setStatus(proteinError, true);
      updatePricePreview(form, order);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      setStatus('Saving changes...');
      const built = patchFromForm(form, order, mode);
      let remoteOk = false;
      let serviceData = null;
      try {
        serviceData = await lifecycleUpdate(orderId, mode, built.dbPatch, order, built.verificationContact);
        remoteOk = true;
      } catch (serviceError) {
        if (mode === 'admin') {
          await directUpdate(orderId, built.dbPatch);
          remoteOk = true;
        } else {
          throw serviceError;
        }
      }
      patchLocal(orderId, built.localPatch);
      const notified = serviceData?.notification?.sentAny === true || serviceData?.notification?.queued === true;
      const notificationLine = mode === 'customer'
        ? (notified ? 'Phoenix has been notified for review.' : `Saved, but automatic SMS/email confirmation was not reported. Please call ${supportPhone()} if the change is urgent.`)
        : (notified ? 'Booking modified notification was queued.' : 'Saved. Notification delivery depends on Make/SMS configuration.');
      const paymentLine = built.noRefundCredit > 0.004
        ? 'No refund is created by this reduction; paid funds stay applied to the booking.'
        : (built.additionalDue > 0.004 && built.paid > 0 ? `Additional unpaid balance is ${money(built.additionalDue)}.` : '');
      setStatus(remoteOk ? `Saved. New total ${money(built.finalTotal)}; balance ${money(built.balance)}. ${paymentLine} ${notificationLine}`.replace(/\s+/g, ' ').trim() : 'Saved locally only.');
      setTimeout(() => {
        closeModal();
        try {
          if (typeof loadDashboardDataFromSupabase === 'function') {
            Promise.resolve(loadDashboardDataFromSupabase()).finally(() => renderDashboard?.(currentDashboardRole || (mode === 'admin' ? 'Admin' : 'Member')));
          } else {
            renderDashboard?.(currentDashboardRole || (mode === 'admin' ? 'Admin' : 'Member'));
          }
        } catch {}
      }, 700);
    } catch (error) {
      console.error('V241 order modification failed:', error);
      setStatus(`${error?.message || 'Could not save changes.'} ${mode === 'customer' ? `Please call ${supportPhone()} for help.` : ''}`.trim(), true);
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  document.addEventListener('click', async event => {
    const cardPay = event.target?.closest?.('[data-v241-card-payment]');
    if (cardPay) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const button = document.getElementById('payStripeDepositBtn');
      if (button && !button.disabled && button.offsetParent) {
        button.click();
      } else {
        alert('Secure card checkout is available only when Phoenix Hibachi activates card payment for this booking. Please use Zelle, Venmo, or call Phoenix to request a card payment link.');
      }
      return;
    }
    const pay = event.target?.closest?.('[data-open-payment]');
    if (pay) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openPaymentDialog(pay.getAttribute('data-open-payment') || pay.getAttribute('data-v241-payment-order') || '');
      return;
    }
    const locked = event.target?.closest?.('[data-v241-locked-order]');
    if (locked) {
      event.preventDefault();
      alert(`This order is locked within ${EDIT_WINDOW_HOURS} hours of the event. Please call ${supportPhone()} to ask whether a change is still possible.`);
      return;
    }
    const button = event.target?.closest?.('[data-v241-edit-order]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const orderId = text(button.getAttribute('data-v241-edit-order'));
    const order = collectOrders().get(orderId.toLowerCase());
    if (!order) { alert('Order was not found. Refresh and try again.'); return; }
    await openEditor(order, text(button.getAttribute('data-v241-mode')) || (isStaffRole() ? 'admin' : 'customer'));
  }, true);

  try {
    const previousLookupHtml = window.orderLookupResultHtml || orderLookupResultHtml;
    if (typeof previousLookupHtml === 'function' && !window.__PHX_V241_LOOKUP_HTML_WRAP__) {
      window.__PHX_V241_LOOKUP_HTML_WRAP__ = true;
      window.orderLookupResultHtml = function(order = {}) {
        const tracked = rememberLookupOrder(order);
        const id = esc(idOf(tracked));
        const html = String(previousLookupHtml.call(this, tracked));
        return id && !html.includes('data-v241-lookup-card')
          ? html.replace('<div class="lookup-card', `<div data-v241-lookup-card="${id}" class="lookup-card`)
          : html;
      };
      orderLookupResultHtml = window.orderLookupResultHtml;
    }
  } catch {}

  try {
    const previousRender = window.renderDashboard || renderDashboard;
    if (typeof previousRender === 'function') {
      window.renderDashboard = function(...args) {
        const result = previousRender.apply(this, args);
        setTimeout(injectButtons, 90);
        setTimeout(injectButtons, 320);
        return result;
      };
      renderDashboard = window.renderDashboard;
    }
  } catch {}

  try {
    const observer = new MutationObserver(() => {
      clearTimeout(window.__PHX_V241_ENHANCE_TIMER__);
      window.__PHX_V241_ENHANCE_TIMER__ = setTimeout(() => {
        forceOrderLookupWholeWindow();
        injectButtons();
      }, 160);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  } catch {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installOrderNumberLookupFallback();
      document.addEventListener('click', event => {
        if (event.target?.closest?.('[data-open-order-lookup]')) setTimeout(forceOrderLookupWholeWindow, 30);
      }, true);
      forceOrderLookupWholeWindow();
      setTimeout(injectButtons, 500);
    }, { once:true });
  } else {
    installOrderNumberLookupFallback();
    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-open-order-lookup]')) setTimeout(forceOrderLookupWholeWindow, 30);
    }, true);
    forceOrderLookupWholeWindow();
    setTimeout(injectButtons, 500);
  }
})();
