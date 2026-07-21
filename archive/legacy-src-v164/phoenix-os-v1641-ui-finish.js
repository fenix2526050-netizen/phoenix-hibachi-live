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

  function forceOnePagePrint(){
    const area = document.getElementById('printArea');
    if (!area) return;
    area.classList.add('phx-force-one-page-v1641', 'phx-one-page-fit');
    area.dataset.printFit = 'ultra';
  }
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
  setInterval(scan, 1000);
  try {
    const observer = new MutationObserver(() => { clearTimeout(window.__PHX_V1641_SCAN_TIMER__); window.__PHX_V1641_SCAN_TIMER__ = setTimeout(scan, 80); });
    observer.observe(document.body, { childList:true, subtree:true });
  } catch {}
})();
