/* Phoenix Hibachi V2.4.1 — customer/admin order modification.
   Adds a 48-hour customer edit window and an always-available admin edit flow
   without changing Supabase schema. */
(function phoenixOrderModificationV241(){
  if (window.__PHX_V241_ORDER_MODIFICATION__) return;
  window.__PHX_V241_ORDER_MODIFICATION__ = true;

  const EDIT_WINDOW_HOURS = 48;
  const PATCH_VERSION = 'V241';
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
    if (document.getElementById('phx-v241-order-mod-style')) return;
    const style = document.createElement('style');
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
      .phx-v241-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;overflow:auto;max-height:calc(min(92vh,880px) - 190px);padding-right:6px;scrollbar-gutter:stable}
      .phx-v241-edit-grid label{display:grid;gap:6px;font-weight:800;font-size:.86rem}
      .phx-v241-edit-grid .wide{grid-column:1/-1}
      .phx-v241-edit-grid input,.phx-v241-edit-grid select,.phx-v241-edit-grid textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,215,121,.28);border-radius:10px;background:#050302;color:inherit;padding:10px 11px;font:inherit}
      .phx-v241-edit-grid textarea{min-height:58px;max-height:92px;resize:vertical}
      .phx-v241-edit-status{min-height:22px;color:#ffd778;font-weight:800;font-size:.88rem}
      .phx-v241-edit-actions{position:sticky;bottom:0;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;background:linear-gradient(180deg,rgba(16,11,7,.78),#100b07 38%);border-top:1px solid rgba(255,215,121,.18);padding-top:12px;margin-top:0;z-index:2}
      .phx-v241-customer-locked{opacity:.65;cursor:not-allowed}
      #orderLookupModal{max-width:min(96vw,760px);max-height:92vh;overflow:hidden;padding:0}
      #orderLookupModal .order-lookup-card{width:min(760px,calc(100vw - 24px));max-height:90vh;overflow:hidden;display:flex;flex-direction:column}
      #orderLookupModal .order-lookup-result{overflow:auto;max-height:calc(90vh - 280px);padding-right:4px;scrollbar-gutter:stable}
      #orderLookupModal .lookup-card{max-height:none}
      .lookup-card-v103 .lookup-actions-v103 [data-open-payment]{background:linear-gradient(135deg,#ffd77a,#d99a16);color:#170c03;border:0}
      #paymentModal.open .phx-payment-card{max-height:90vh;overflow:auto}
      #paymentModal .phx-payment-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #paymentModal .phx-payment-option{border-radius:14px;padding:13px;display:grid;gap:9px;align-content:start}
      #paymentModal .phx-payment-option img{max-height:230px}
      #paymentModal .phx-payment-icon-card{min-height:112px;border:1px solid rgba(255,215,121,.28);border-radius:14px;background:linear-gradient(135deg,rgba(255,215,121,.14),rgba(255,255,255,.035));display:grid;place-items:center;color:#ffd778;font-weight:950;letter-spacing:.18em}
      #paymentModal .phx-payment-inline-btn{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:inherit}
      .phx-v241-payment-note{border:1px solid rgba(255,215,121,.24);background:rgba(255,215,121,.07);border-radius:12px;padding:9px 11px;color:#fff2cf;font-size:.84rem;line-height:1.42}
      .phx-v241-payment-note b{color:#ffd778}
      .phx-v241-locked-stamp{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 14px;background:rgba(255,255,255,.08);color:#a9a098;font-weight:950;text-transform:uppercase;letter-spacing:.08em}
      @media(max-width:720px){.phx-v241-edit-grid{grid-template-columns:1fr;max-height:calc(92vh - 178px)}.phx-v241-edit-card{padding:14px}.phx-v241-edit-actions{justify-content:stretch}.phx-v241-edit-actions button{flex:1 1 auto}#orderLookupModal .order-lookup-card{width:calc(100vw - 18px);padding:18px 14px}#orderLookupModal .order-lookup-result{max-height:calc(90vh - 255px)}#paymentModal .phx-payment-grid{grid-template-columns:1fr}#paymentModal .phx-payment-option img{max-height:210px}}
    `;
    document.head.appendChild(style);
  }

  function injectButtons() {
    styleOnce();
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
        <label class="wide" data-v241-verify-wrap>Verification phone or email<input name="verificationContact" placeholder="Phone or email used on the booking"></label>
        <label>Event date<input type="date" name="eventDate"></label>
        <label>Event time<input name="eventTime" placeholder="6:00 PM"></label>
        <label>Package<select name="packageName"><option>Classic</option><option>Premium</option><option>Signature</option></select></label>
        <label>Adults<input type="number" min="0" step="1" name="adults"></label>
        <label>Children<input type="number" min="0" step="1" name="kids"></label>
        <label data-v241-travel-wrap>Travel Fee ($)<input type="number" min="0" step="0.01" name="travelFee"></label>
        <label class="wide">Event address<input name="address" placeholder="Full event address"></label>
        <label class="wide">Add-ons / side orders<textarea name="addons" rows="3" placeholder="One item per line"></textarea></label>
        <label class="wide">Protein selections<textarea name="proteinSummary" rows="3" placeholder="Chicken 4, Steak 4, Shrimp 2..."></textarea></label>
        <label class="wide">Allergies / dietary notes<textarea name="allergyNotes" rows="3"></textarea></label>
        <label class="wide">Change note<textarea name="changeNote" rows="3" placeholder="Tell Phoenix Hibachi what changed."></textarea></label>
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
  function addonsText(order = {}) {
    const items = Array.isArray(order.addons) ? order.addons : (Array.isArray(order.add_ons) ? order.add_ons : []);
    return items.map(item => typeof item === 'string' ? item : `${item.name || 'Add-on'}${item.qty ? ` × ${item.qty}` : ''}${item.price ? ` (${money(item.price)})` : ''}`).join('\n');
  }
  function proteinText(order = {}) {
    try {
      return text(order.proteinSummary || order.protein_summary || (typeof proteinSummary === 'function' ? proteinSummary(order.proteinSelections || {}) : ''));
    } catch { return text(order.proteinSummary || order.protein_summary); }
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
      __v241PublicLookup:true
    });
  }
  async function directPublicLookupByNumber(query) {
    const orderId = normalizedBookingNumber(query);
    if (!orderId || !/^PHX-/i.test(orderId)) return null;
    const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
    if (!client) return null;
    const fields = 'booking_number,event_date,event_time,status,request_status,payment_status,deposit_status,deposit_amount,balance_due_cents,customer_name,customer_phone,customer_email,address,package_name,adults,kids,guest_count,travel_fee,final_total';
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
      }
    }, true);
  }
  async function loadEditableCustomerOrder(order = {}, verificationContact = '') {
    const orderId = idOf(order);
    if (!orderId) throw new Error('Order number is missing.');
    const verify = cleanVerificationContact(verificationContact);
    if (!verify) throw new Error('Phone or email verification is required to modify this order.');
    const data = await invokeLifecycle('customer_edit_order', { bookingNumber:orderId, verificationContact:verify });
    const fullOrder = { ...(data.booking || order), __v241VerificationContact:verify, __v241PublicLookup:false, __v241Locked:data.locked === true };
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
    form.elements.addons.value = addonsText(editableOrder);
    form.elements.proteinSummary.value = proteinText(editableOrder);
    form.elements.allergyNotes.value = text(editableOrder.allergyNotes || editableOrder.allergy_notes || (Array.isArray(editableOrder.allergies) ? editableOrder.allergies.join(', ') : editableOrder.allergies || ''));
    form.elements.changeNote.value = '';
    form.elements.travelFee.value = num(editableOrder.travelFee ?? editableOrder.travel_fee, 0).toFixed(2);
    const help = dialog.querySelector('[data-v241-help]');
    const travelWrap = dialog.querySelector('[data-v241-travel-wrap]');
    const verifyWrap = dialog.querySelector('[data-v241-verify-wrap]');
    if (customerMode) {
      help.textContent = `${formatWindow(editableOrder)} Travel fee and final total may still require manager review after changes.`;
      travelWrap.hidden = true;
      verifyWrap.hidden = false;
    } else {
      help.textContent = 'Admin override: staff can modify this order at any time. Changes may send a booking modified notification.';
      travelWrap.hidden = false;
      verifyWrap.hidden = true;
    }
    setStatus('');
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
    const addOns = text(fd.get('addons')).split(/\n+/).map(line => line.trim()).filter(Boolean);
    const proteinSummaryValue = text(fd.get('proteinSummary'));
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
      proteinSummary:proteinSummaryValue,
      protein_summary:proteinSummaryValue,
      allergyNotes,
      allergy_notes:allergyNotes
    };
    if (mode === 'admin') {
      localPatch.travelFee = num(fd.get('travelFee'), 0);
      localPatch.travel_fee = localPatch.travelFee;
    }
    const updated = { ...order, ...localPatch };
    const m = (() => { try { return typeof calculateOrderMoney === 'function' ? calculateOrderMoney(updated) : {}; } catch { return {}; } })();
    const finalTotal = num(m.guestTotalBeforeDeposit ?? updated.finalTotal ?? updated.final_total, 0);
    const paid = num(updated.paidAmount ?? updated.paid_amount ?? updated.depositPaid ?? updated.deposit_amount, 0);
    const balance = Math.max(0, finalTotal - paid);
    const actor = mode === 'admin' ? 'Admin dashboard' : 'Customer portal';
    const now = new Date().toISOString();
    let notes = orderNotes(order);
    notes = upsertNote(notes, `${mode === 'admin' ? 'Admin' : 'Customer'} modified at`, now);
    notes = upsertNote(notes, 'Last order modification source', actor);
    if (proteinSummaryValue) notes = upsertNote(notes, 'Protein summary', proteinSummaryValue);
    if (allergyNotes) notes = upsertNote(notes, 'Allergy / dietary notes', allergyNotes);
    if (changeNote) notes = addHistory(notes, `${mode === 'admin' ? 'Admin' : 'Customer'} modification note`, changeNote);
    const dbPatch = {
      event_date:eventDate,
      event_time:timeToDb(eventTime),
      package_name:packageName,
      adults,
      kids,
      guest_count:totalGuests,
      address,
      add_ons:addOns,
      allergy_notes:allergyNotes || null,
      admin_notes:notes,
      final_total:finalTotal,
      order_total_cents:Math.round(finalTotal * 100),
      balance_due:balance,
      balance_due_cents:Math.round(balance * 100)
    };
    if (mode === 'admin') dbPatch.travel_fee = localPatch.travelFee;
    if (mode === 'customer') {
      dbPatch.status = /cancel|complete/i.test(text(order.status)) ? order.status : 'Customer updated - manager review';
      dbPatch.request_status = 'modified';
    }
    return {
      dbPatch,
      localPatch:{ ...localPatch, finalTotal, final_total:finalTotal, balanceDue:balance, balance_due:balance, specialNotes:notes, admin_notes:notes, status:dbPatch.status || order.status },
      changeNote,
      verificationContact,
      finalTotal,
      balance
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
      setStatus(remoteOk ? `Saved. New total ${money(built.finalTotal)}; balance ${money(built.balance)}. ${notificationLine}` : 'Saved locally only.');
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
      setPaymentOrderContext(pay.getAttribute('data-open-payment') || pay.getAttribute('data-v241-payment-order') || '');
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
      window.__PHX_V241_ENHANCE_TIMER__ = setTimeout(injectButtons, 160);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  } catch {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      installOrderNumberLookupFallback();
      setTimeout(injectButtons, 500);
    }, { once:true });
  } else {
    installOrderNumberLookupFallback();
    setTimeout(injectButtons, 500);
  }
})();
