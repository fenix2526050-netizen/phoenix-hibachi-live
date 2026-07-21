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
      return html;
    };
  }
  function rowCount(area){
    return area?.querySelectorAll?.('.invoice-row, .invoice-labels div, .invoice-payment-grid-v164 div, .invoice-ledger-grid-v164 div, .invoice-rule-box span, .tip-suggestions-final tr, .invoice-food-alert')?.length || 0;
  }
  function applyPrintPolish(){
    const area = document.getElementById('printArea');
    if (!area) return;
    area.classList.add('phx-force-one-page-v1641', 'phx-one-page-fit', 'phx-v1643-print-polish');
    const rows = rowCount(area);
    area.dataset.printFit = rows > 38 ? 'ultra' : (rows > 30 ? 'compact' : 'balanced');
  }
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
  setInterval(scan, 1500);
  try {
    const observer = new MutationObserver(() => {
      clearTimeout(window.__PHX_V1643_SCAN_TIMER__);
      window.__PHX_V1643_SCAN_TIMER__ = setTimeout(scan, 120);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  } catch {}
})();
