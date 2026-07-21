(function phoenixStabilityV239(){
  'use strict';

  if (window.__PHX_STABILITY_V239__) return;
  window.__PHX_STABILITY_V239__ = { version: 'v239' };

  const SELECTORS = {
    fixedActions: '.theme-switcher, .ai-assistant, .floating-book',
    orderCards: '#orderList article.order-card, #calendarSummaryList article.order-card, #chefDispatch article.dispatch-card, [data-v102-order-card], [data-v120-order-card]'
  };

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  const text = (value, fallback = '') => {
    const out = value == null ? '' : String(value).trim();
    return out || fallback;
  };

  const asNumber = (...values) => {
    for (const value of values) {
      if (value == null || value === '') continue;
      const num = Number(String(value).replace(/[$,]/g, ''));
      if (Number.isFinite(num)) return num;
    }
    return 0;
  };

  const money = (value) => {
    const num = asNumber(value);
    try {
      if (typeof window.money === 'function') return window.money(num);
    } catch {}
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const humanDateTime = (order = {}) => {
    const date = text(order.eventDate || order.event_date || order.date || order.bookingDate || order.booking_date, 'Date pending');
    const timeValue = text(order.eventTime || order.event_time || order.time || order.arrivalWindow || order.arrival_window, 'Time pending');
    return `${date} / ${timeValue}`;
  };

  const idOf = (order = {}) => text(order.id || order.booking_number || order.bookingNumber || order.order_id || order.ref);

  const callMoney = (order = {}) => {
    try {
      if (typeof window.calculateOrderMoney === 'function') return window.calculateOrderMoney(order) || {};
      if (typeof calculateOrderMoney === 'function') return calculateOrderMoney(order) || {};
    } catch {}
    return {};
  };

  const collectOrders = () => {
    const map = new Map();
    const add = (order) => {
      const id = idOf(order);
      if (id) map.set(id, order);
    };
    try { (typeof getStoredOrders === 'function' ? getStoredOrders() : []).forEach(add); } catch {}
    try { (typeof window.getStoredOrders === 'function' ? window.getStoredOrders() : []).forEach(add); } catch {}
    try { (typeof getDashboardOrders === 'function' ? getDashboardOrders() : []).forEach(add); } catch {}
    try { (typeof window.getDashboardOrders === 'function' ? window.getDashboardOrders() : []).forEach(add); } catch {}
    try { (Array.isArray(window.remoteOrdersCache) ? window.remoteOrdersCache : []).forEach(add); } catch {}
    return map;
  };

  const idFromCard = (card) => {
    const direct = card.getAttribute('data-v120-order-card') ||
      card.getAttribute('data-v102-order-card') ||
      card.getAttribute('data-order-id') ||
      card.querySelector('[data-v120-order-id]')?.getAttribute('data-v120-order-id') ||
      card.querySelector('[data-v102-print]')?.getAttribute('data-v102-print') ||
      card.querySelector('[data-print-guest]')?.getAttribute('data-print-guest');
    if (text(direct)) return text(direct);
    const raw = text(card.querySelector('strong')?.textContent || card.textContent);
    const match = raw.match(/\b(PHX[-\w]+|SET[-\w]+)\b/i);
    return match ? match[1] : '';
  };

  const orderForCard = (card, orders) => {
    const id = idFromCard(card);
    if (!id) return null;
    if (orders.has(id)) return orders.get(id);
    const lower = id.toLowerCase();
    for (const [key, order] of orders.entries()) {
      if (String(key).toLowerCase() === lower) return order;
    }
    try {
      if (typeof findDashboardOrder === 'function') return findDashboardOrder(id);
      if (typeof window.findDashboardOrder === 'function') return window.findDashboardOrder(id);
    } catch {}
    return null;
  };

  const serviceText = (order = {}, m = {}) => {
    const packageName = text(order.package || order.package_name || order.packageName, 'Package pending');
    const adults = asNumber(m.adults, order.adults, order.adultCount, order.adult_count);
    const kids = asNumber(m.kids, order.kids, order.kidCount, order.kids_count, order.children);
    const total = asNumber(m.totalGuests, order.totalGuests, order.total_guests, order.guest_count, order.guests, adults + kids);
    const billable = asNumber(m.billableGuests, order.billableGuests, order.billable_guests, total);
    const parts = [packageName];
    if (total) parts.push(`${total} guests`);
    if (adults || kids) parts.push(`${adults} adults / ${kids} kids`);
    if (billable && billable !== total) parts.push(`${billable} billable`);
    return parts.join(' | ');
  };

  const priceText = (order = {}, m = {}) => {
    const total = asNumber(
      m.guestTotalBeforeDeposit,
      m.grandTotal,
      m.total,
      order.finalTotal,
      order.final_total,
      order.estimatedTotal,
      order.estimated_total,
      order.total
    );
    const paid = asNumber(m.depositPaid, order.depositPaid, order.deposit_paid, order.amount_paid, order.paidAmount);
    const balance = asNumber(
      m.guestTotalAfterDeposit,
      order.balanceDue,
      order.balance_due,
      total && paid ? Math.max(0, total - paid) : 0
    );
    const travel = asNumber(m.travelFee, order.travelFee, order.travel_fee);
    const bits = [];
    if (total) bits.push(`Total ${money(total)}`);
    if (paid) bits.push(`Paid ${money(paid)}`);
    if (balance || total) bits.push(`Balance ${money(balance)}`);
    if (travel) bits.push(`Travel ${money(travel)}`);
    return bits.join(' | ') || 'Price pending';
  };

  const paymentText = (order = {}) => {
    const status = text(order.paymentStatus || order.payment_status || order.depositStatus || order.deposit_status, 'Not marked paid');
    const method = text(order.paymentMethod || order.payment_method || order.depositMethod || order.deposit_method);
    return method ? `${status} | ${method}` : status;
  };

  const noteText = (order = {}) => {
    return text(
      order.serviceNotes ||
      order.service_notes ||
      order.customerVisibleNote ||
      order.customer_visible_note ||
      order.specialNotes ||
      order.admin_notes,
      'No service note'
    ).replace(/\s+/g, ' ').slice(0, 180);
  };

  const field = (label, value) => {
    const wrap = document.createElement('div');
    wrap.className = 'phx-v239-field';
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('b');
    strong.textContent = value;
    wrap.append(span, strong);
    return wrap;
  };

  const enhanceOrderCards = () => {
    const orders = collectOrders();
    document.querySelectorAll(SELECTORS.orderCards).forEach((card) => {
      if (!card || card.classList.contains('application-card') || card.classList.contains('feedback-card')) return;
      if (card.querySelector(':scope > .phx-v239-order-fields')) return;
      const order = orderForCard(card, orders);
      if (!order) return;
      const m = callMoney(order);
      const fields = document.createElement('div');
      fields.className = 'phx-v239-order-fields';
      fields.append(
        field('Event', humanDateTime(order)),
        field('Service', serviceText(order, m)),
        field('Money', priceText(order, m)),
        field('Payment', paymentText(order)),
        field('Guest', text([order.name || order.customer_name, order.phone || order.customer_phone].filter(Boolean).join(' | '), 'Guest pending')),
        field('Notes', noteText(order))
      );
      const tools = card.querySelector('.v102-order-tools, .v107-payment-actions, .order-actions, .phx-v120-stop-actions');
      if (tools) tools.insertAdjacentElement('beforebegin', fields);
      else card.appendChild(fields);
      card.classList.add('phx-v239-card-normalized');
    });
  };

  const setFixedActionState = () => {
    document.body.classList.add('phx-v239-fixed-actions-ready');
    document.querySelectorAll(SELECTORS.fixedActions).forEach((node) => {
      node.removeAttribute('hidden');
      node.setAttribute('data-phx-v239-fixed', '1');
    });
  };

  const printDensityFor = (area) => {
    const textLength = text(area?.innerText || '').length;
    const rows = area?.querySelectorAll('tr, .invoice-row, .invoice-labels div, .settlement-grid div, .settlement-money div').length || 0;
    if (textLength > 4600 || rows > 42) return 'ultra';
    if (textLength > 3600 || rows > 34) return 'tight';
    if (textLength > 2600 || rows > 26) return 'compact';
    return 'balanced';
  };

  const preparePrintArea = () => {
    const area = document.getElementById('printArea');
    if (!area) return;
    area.classList.add('phx-v239-print-ready');
    area.setAttribute('data-v239-density', printDensityFor(area));
    area.querySelectorAll('.guest-invoice, .chef-settlement-sheet').forEach((sheet) => {
      sheet.classList.add('phx-v239-print-sheet');
    });
  };

  const wrapPrintModal = () => {
    if (window.__PHX_V239_PRINT_WRAP__) return;
    const previous = (typeof window.openPrintModalForOrder === 'function' && window.openPrintModalForOrder) ||
      (typeof openPrintModalForOrder === 'function' && openPrintModalForOrder);
    if (!previous) return;
    window.__PHX_V239_PRINT_WRAP__ = true;
    const wrapped = function(order, type){
      const result = previous.apply(this, arguments);
      setTimeout(preparePrintArea, 0);
      setTimeout(preparePrintArea, 120);
      return result;
    };
    try { window.openPrintModalForOrder = wrapped; } catch {}
    try { openPrintModalForOrder = wrapped; } catch {}
  };

  const installPrintEvents = () => {
    document.addEventListener('click', (event) => {
      const printButton = event.target?.closest?.('[data-print-guest], [data-print-chef], [data-v102-print], #printInvoiceBtn, #printGuestInvoiceBtn, #printChefSettlementBtn');
      if (printButton) setTimeout(preparePrintArea, 60);
    }, true);

    window.addEventListener('beforeprint', () => {
      preparePrintArea();
      document.body.classList.add('printing-invoice');
    });
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-invoice');
    });
  };

  const scheduleEnhance = (() => {
    let timer = 0;
    return () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setFixedActionState();
        wrapPrintModal();
        preparePrintArea();
        enhanceOrderCards();
      }, 80);
    };
  })();

  ready(() => {
    setFixedActionState();
    wrapPrintModal();
    installPrintEvents();
    enhanceOrderCards();
    preparePrintArea();

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'open', 'hidden'],
      childList: true,
      subtree: true
    });

    ['click', 'change', 'input'].forEach((eventName) => {
      document.addEventListener(eventName, scheduleEnhance, true);
    });
  });
})();
