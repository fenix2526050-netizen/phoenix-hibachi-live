(function phoenixTravelFeeNotificationsV240(){
  'use strict';

  if (window.__PHX_V240_TRAVEL_FEE_NOTIFICATIONS__) return;
  window.__PHX_V240_TRAVEL_FEE_NOTIFICATIONS__ = {
    version: 'v240',
    rules: {
      baseFee: 50,
      includedMiles: 20,
      perExtraMile: 2,
      njTollFee: 30,
      customQuoteAboveMiles: 100
    }
  };

  const RULES = window.__PHX_V240_TRAVEL_FEE_NOTIFICATIONS__.rules;
  const STYLE_ID = 'phoenix-v240-travel-fee-notifications-style';

  const text = (value) => String(value == null ? '' : value).trim();
  const asNumber = (value, fallback = 0) => {
    const num = Number(String(value == null ? '' : value).replace(/[$,]/g, ''));
    return Number.isFinite(num) ? num : fallback;
  };
  const moneyText = (value) => {
    const num = asNumber(value, 0);
    try {
      if (typeof window.money === 'function') return window.money(num);
    } catch {}
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const esc = (value) => {
    try {
      if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    } catch {}
    return text(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  };
  const LINK_STYLE = 'color:#0645ad;text-decoration:underline;font-weight:700;';
  const addressOf = (order = {}) => text(order.address || order.event_address || order.fullAddress || order.full_address || order.eventLocation || order.location);
  const mapsUrl = (address) => {
    const clean = text(address);
    if (!clean || /^(address pending|not entered|no address)$/i.test(clean)) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
  };
  const phoneUrl = (value) => {
    const raw = text(value);
    const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    return digits.length === 10 ? `tel:+1${digits}` : '';
  };
  const websiteUrl = (value) => {
    const raw = text(value) || 'phoenix-hibachi.com';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/phoenix-hibachi\.com/i.test(raw)) return 'https://phoenix-hibachi.com';
    return '';
  };
  const blueLink = (displayHtml, href, label) => href
    ? `<a href="${esc(href)}" target="_blank" rel="noreferrer" title="${esc(label || '')}" style="${LINK_STYLE}">${displayHtml}</a>`
    : displayHtml;
  const orderIdOf = (order = {}) => text(order.id || order.booking_number || order.bookingNumber || order.order_id);
  const noteText = (order = {}) => text(order.specialNotes || order.admin_notes || order.service_notes || order.customer_notes || '');
  const readNote = (notes, label) => {
    const safe = text(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text(notes).match(new RegExp(`(?:^|\\n)${safe}:\\s*([^\\n]+)`, 'i'));
    return match ? match[1].trim() : '';
  };
  const removeNote = (notes, label) => {
    const safe = text(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text(notes)
      .replace(new RegExp(`(?:^|\\n)${safe}:\\s*[^\\n]*`, 'ig'), '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };
  const upsertNote = (notes, label, value) => {
    const base = removeNote(notes, label);
    const cleanValue = text(value);
    return cleanValue ? `${base ? `${base}\n` : ''}${label}: ${cleanValue}` : base;
  };

  function syncRulesFromPricing() {
    let moneyRules = {};
    try {
      moneyRules = window.PHX_GET_PRICING_V140?.().moneyRules || {};
    } catch {}
    const readRule = (keys, fallback) => {
      for (const key of keys) {
        if (moneyRules[key] !== undefined && moneyRules[key] !== null && moneyRules[key] !== '') {
          return asNumber(moneyRules[key], fallback);
        }
      }
      return fallback;
    };
    RULES.baseFee = readRule(['travelFeeBase', 'travelFeeBaseFee', 'defaultTravelFee'], RULES.baseFee || 50);
    RULES.includedMiles = readRule(['travelFeeIncludedMiles', 'travelFeeBaseMiles'], RULES.includedMiles || 20);
    RULES.perExtraMile = readRule(['travelFeePerExtraMile', 'feePerMile'], RULES.perExtraMile || 2);
    RULES.njTollFee = readRule(['njTollFee', 'nj_toll_fee'], RULES.njTollFee || 30);
    RULES.customQuoteAboveMiles = readRule(['travelFeeCustomQuoteMiles', 'customQuoteAboveMiles'], RULES.customQuoteAboveMiles || 100);
    window.PHX_V240_TRAVEL_RULES = RULES;
    return RULES;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .phx-v240-fee-fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        margin: 12px 0;
        padding: 10px;
        border: 1px solid rgba(214, 154, 40, 0.28);
        border-radius: 10px;
        background: rgba(214, 154, 40, 0.08);
      }
      .phx-v240-fee-fields span {
        display: grid;
        gap: 3px;
        color: #70502d;
        font-size: 0.78rem;
        line-height: 1.25;
      }
      .phx-v240-fee-fields b {
        color: #8a4f10;
        font-size: 0.95rem;
      }
      .phx-v240-nj-toll-panel {
        display: grid;
        gap: 4px;
        margin: 10px 0;
        padding: 10px 12px;
        border: 1px solid rgba(192, 0, 0, 0.24);
        border-radius: 10px;
        background: rgba(192, 0, 0, 0.06);
      }
      .phx-v240-nj-toll-panel b,
      .travel-estimate .phx-v240-nj-toll-estimate {
        color: #c00000;
        font-weight: 800;
      }
      .travel-estimate .phx-v240-nj-toll-estimate {
        display: block;
        margin-top: 4px;
      }
      .phx-v240-travel-rule-card {
        outline: 1px solid rgba(214, 154, 40, 0.22);
      }
    `;
    document.head.appendChild(style);
  }

  injectStyle();

  function inferState(order = {}) {
    const direct = text(order.state || order.eventState || order.event_state || order.addressState || order.address_state).toUpperCase();
    if (/^(NY|NJ|CT|PA)$/.test(direct)) return direct;
    const address = text(order.address || order.event_address || order.fullAddress || order.full_address).toUpperCase();
    if (/\bNEW JERSEY\b|\bNJ\b/.test(address)) return 'NJ';
    if (/\bCONNECTICUT\b|\bCT\b/.test(address)) return 'CT';
    if (/\bPENNSYLVANIA\b|\bPA\b/.test(address)) return 'PA';
    if (/\bNEW YORK\b|\bNY\b|\bBROOKLYN\b|\bQUEENS\b|\bSTATEN ISLAND\b|\bBRONX\b|\bMANHATTAN\b|\bLONG ISLAND\b/.test(address)) return 'NY';
    const zip = text(order.zip || order.eventZip || order.event_zip || order.postal_code || order.address_zip);
    if (/^0[78]/.test(zip)) return 'NJ';
    if (/^06/.test(zip)) return 'CT';
    if (/^(15|16|17|18|19)/.test(zip)) return 'PA';
    if (/^(10|11|12|13|14)/.test(zip)) return 'NY';
    return '';
  }

  function isNewJerseyOrder(order = {}) {
    return inferState(order) === 'NJ';
  }

  function explicitNjTollFee(order = {}) {
    const direct = [
      order.njTollFee,
      order.nj_toll_fee,
      order.tollFee,
      order.toll_fee,
      order.njToll,
      order.nj_toll
    ].find(value => value !== undefined && value !== null && value !== '');
    if (direct !== undefined) return Math.max(0, asNumber(direct, 0));
    const note = readNote(noteText(order), 'NJ Toll Fee') || readNote(noteText(order), 'New Jersey Toll Fee');
    return note ? Math.max(0, asNumber(note, 0)) : 0;
  }

  function shouldTreatAsTransientEstimate(order = {}) {
    return !orderIdOf(order) && !order.createdAt && !order.created_at && !order.status && !order.request_status;
  }

  function njTollFeeForOrder(order = {}) {
    const explicit = explicitNjTollFee(order);
    if (explicit > 0) return explicit;
    const rules = syncRulesFromPricing();
    return shouldTreatAsTransientEstimate(order) && isNewJerseyOrder(order) ? rules.njTollFee : 0;
  }

  function travelFeeByMilesV240(miles) {
    const rules = syncRulesFromPricing();
    const distance = Number(miles);
    if (!Number.isFinite(distance) || distance < 0) return null;
    if (distance > rules.customQuoteAboveMiles) return null;
    const extraMiles = Math.max(0, Math.ceil(distance - rules.includedMiles));
    return rules.baseFee + extraMiles * rules.perExtraMile;
  }

  syncRulesFromPricing();
  window.PHX_V240_TRAVEL_RULES = RULES;
  window.PHX_V240_IS_NJ_ORDER = isNewJerseyOrder;
  window.PHX_V240_NJ_TOLL_FEE = njTollFeeForOrder;
  window.PHX_V240_TRAVEL_FEE_BY_MILES = travelFeeByMilesV240;

  try {
    window.estimateTravelFeeByMiles = travelFeeByMilesV240;
    estimateTravelFeeByMiles = travelFeeByMilesV240;
  } catch {}

  function decorateTravelEstimate() {
    const box = document.getElementById('travelEstimate');
    if (!box || box.dataset.travelStatus !== 'ready') return;
    const order = {
      address: document.getElementById('eventAddressInput')?.value || '',
      city: document.getElementById('eventCityInput')?.value || '',
      state: document.getElementById('eventStateInput')?.value || '',
      zip: document.getElementById('eventZipInput')?.value || ''
    };
    const rules = syncRulesFromPricing();
    const toll = isNewJerseyOrder(order) ? rules.njTollFee : 0;
    box.querySelector('.phx-v240-nj-toll-estimate')?.remove();
    const baseFee = asNumber(document.getElementById('travelFeeInput')?.value, 0);
    const combined = baseFee + toll;
    const strong = box.querySelector('strong');
    if (strong && combined > 0) strong.textContent = `Estimated travel fee for this address: ${moneyText(combined)}`;
  }

  try {
    const previousUpdateTravel = window.updateTravelEstimateFromCoords || updateTravelEstimateFromCoords;
    if (typeof previousUpdateTravel === 'function') {
      window.updateTravelEstimateFromCoords = async function(...args) {
        const result = await previousUpdateTravel.apply(this, args);
        decorateTravelEstimate();
        return result;
      };
      updateTravelEstimateFromCoords = window.updateTravelEstimateFromCoords;
    }
  } catch {}

  ['eventStateInput', 'eventAddressInput', 'eventZipInput'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => setTimeout(decorateTravelEstimate, 0), true);
    document.getElementById(id)?.addEventListener('change', () => setTimeout(decorateTravelEstimate, 0), true);
  });

  try {
    const previousBuildOrder = window.buildOrderFromForm || buildOrderFromForm;
    if (typeof previousBuildOrder === 'function') {
      window.buildOrderFromForm = function(form) {
        const order = previousBuildOrder.call(this, form);
        const rules = syncRulesFromPricing();
        const toll = isNewJerseyOrder(order) ? rules.njTollFee : 0;
        order.njTollFee = toll;
        // Keep the route component in the dedicated field; do not add customer-visible toll notes.
        return order;
      };
      buildOrderFromForm = window.buildOrderFromForm;
    }
  } catch {}

  try {
    const previousRead = window.bookingRowToOrder || bookingRowToOrder;
    if (typeof previousRead === 'function') {
      window.bookingRowToOrder = function(row = {}) {
        const order = previousRead.call(this, row) || {};
        const toll = explicitNjTollFee({
          ...order,
          ...row,
          specialNotes: order.specialNotes || row.service_notes || row.admin_notes || '',
          admin_notes: row.admin_notes || order.admin_notes || ''
        });
        order.njTollFee = toll;
        order.nj_toll_fee = toll;
        return order;
      };
      bookingRowToOrder = window.bookingRowToOrder;
    }
  } catch {}

  try {
    const previousCalc = window.calculateOrderMoney || calculateOrderMoney;
    if (typeof previousCalc === 'function') {
      window.calculateOrderMoney = function(order = {}) {
        const base = previousCalc.call(this, order) || {};
        const njTollFee = njTollFeeForOrder(order);
        const travelFee = asNumber(base.travelFee ?? order.travelFee ?? order.travel_fee, 0);
        if (base.serverPricingVerified === true || order.serverPricingVerified === true) {
          const discount = asNumber(base.managerDiscount, 0) + asNumber(base.couponDiscount, 0) + asNumber(base.memberCreditUsed, 0);
          const tipBasisBeforeDiscount = Math.max(0, asNumber(base.guestTotalBeforeDeposit, 0) + discount);
          return {
            ...base,
            njTollFee,
            nj_toll_fee:njTollFee,
            tollFee:njTollFee,
            travelAndTollTotal:travelFee + njTollFee,
            tipBasisBeforeDiscount,
            tip20:Math.round(tipBasisBeforeDiscount * 0.20),
            tip25:Math.round(tipBasisBeforeDiscount * 0.25),
            tip30:Math.round(tipBasisBeforeDiscount * 0.30)
          };
        }
        if (njTollFee <= 0) {
          return { ...base, njTollFee: 0, nj_toll_fee: 0, tollFee: 0, travelAndTollTotal: travelFee };
        }

        const depositPaid = asNumber(base.depositPaid ?? order.depositPaid ?? order.deposit_amount, 0);
        const taxRate = asNumber(base.taxRate, 0);
        const taxableSubtotal = asNumber(base.taxableSubtotal, 0) + njTollFee;
        const salesTax = Math.round(taxableSubtotal * taxRate * 100) / 100;
        const taxDelta = Math.max(0, salesTax - asNumber(base.salesTax, 0));
        const guestTotalBeforeDeposit = asNumber(base.guestTotalBeforeDeposit, 0) + njTollFee + taxDelta;
        const guestTotalAfterDeposit = Math.max(0, guestTotalBeforeDeposit - depositPaid);
        const tipBasisBeforeDiscount = asNumber(base.tipBasisBeforeDiscount ?? base.guestTotalBeforeDeposit, 0) + njTollFee + taxDelta;
        const tip20 = Math.round(tipBasisBeforeDiscount * 0.20);
        const tip25 = Math.round(tipBasisBeforeDiscount * 0.25);
        const tip30 = Math.round(tipBasisBeforeDiscount * 0.30);
        const companyBalanceDue = Math.max(0, asNumber(base.companyBalanceDue, 0) + taxDelta);
        const chefKeepsBeforeTip = asNumber(base.chefKeepsBeforeTip, 0) + njTollFee;
        const chefReturnToCompany = Math.max(0, companyBalanceDue - asNumber(base.chefGuestPayout, 0));
        const ownerOwesChef = Math.max(0, asNumber(base.chefGuestPayout, 0) - companyBalanceDue);

        return {
          ...base,
          njTollFee,
          nj_toll_fee: njTollFee,
          tollFee: njTollFee,
          travelAndTollTotal: travelFee + njTollFee,
          tipBasisBeforeDiscount,
          taxableSubtotal,
          salesTax,
          guestTotalBeforeDeposit,
          guestTotalAfterDeposit,
          companyBalanceDue,
          chefKeepsBeforeTip,
          chefReturnToCompany,
          ownerOwesChef,
          tip20,
          tip25,
          tip30
        };
      };
      calculateOrderMoney = window.calculateOrderMoney;
    }
  } catch {}

  function patchInvoiceTotals(html, order, m) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const root = template.content;
    const travel = asNumber(m.travelFee, 0);
    const toll = asNumber(m.njTollFee, 0);
    const combinedTravel = travel + toll;

    // Lightweight fallback for older browsers/test harnesses without template.content.
    if (!root || typeof root.querySelectorAll !== 'function') {
      let out = String(html || '');
      out = out.replace(/<div class="invoice-row[^"]*phx-v240-nj-toll-row[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
      out = out.replace(/<div class="invoice-row[^"]*"[^>]*>\s*<span>\s*(?:NJ Toll Fee|New Jersey route[^<]*)<\/span>[\s\S]*?<\/div>/gi, '');
      out = out.replace(/(<div class="invoice-row[^"]*"[^>]*>\s*<span>Travel Fee<\/span>\s*<em>)[\s\S]*?(<\/em>\s*<b[^>]*>)[\s\S]*?(<\/b>\s*<\/div>)/i,
        combinedTravel > 0 ? `$1$2Total: ${moneyText(combinedTravel)}$3` : '');
      out = out.replace(/<div class="invoice-brand">[\s\S]*?<\/div>/i,
        '<div class="invoice-brand invoice-brand-v255"><strong>PHOENIX HIBACHI</strong><span>Phone: <a href="tel:+15165183325">(516) 518-3325</a></span><span>Email: <a href="mailto:booking@phoenix-hibachi.com">booking@phoenix-hibachi.com</a></span><span>Website: <a href="https://phoenix-hibachi.com">phoenix-hibachi.com</a></span></div>');
      return out;
    }

    root.querySelectorAll('.phx-v240-nj-toll-row').forEach(node => node.remove());
    root.querySelectorAll('.invoice-row').forEach(row => {
      const label = text(row.querySelector('span')?.textContent).toLowerCase();
      if (/nj toll|new jersey route/.test(label)) row.remove();
    });

    const travelRows = [...root.querySelectorAll('.invoice-row')].filter(row => /^travel fee$/i.test(text(row.querySelector('span')?.textContent)));
    travelRows.forEach(row => {
      if (combinedTravel <= 0) { row.remove(); return; }
      const amount = row.querySelector('b') || row.querySelector('span:last-child');
      if (amount) amount.textContent = `Total: ${moneyText(combinedTravel)}`;
      const note = row.querySelector('em');
      if (note) note.textContent = '';
    });

    const directFinal = asNumber(order.finalTotal ?? order.final_total ?? ((order.orderTotalCents ?? order.order_total_cents) != null ? asNumber(order.orderTotalCents ?? order.order_total_cents, 0) / 100 : 0), 0);
    const directBalanceRaw = order.balanceDue ?? order.balance_due ?? ((order.balanceDueCents ?? order.balance_due_cents) != null ? asNumber(order.balanceDueCents ?? order.balance_due_cents, 0) / 100 : null);
    const directBalance = directBalanceRaw === null || directBalanceRaw === undefined ? null : asNumber(directBalanceRaw, 0);
    const finalTotal = directFinal > 0 ? directFinal : asNumber(m.guestTotalBeforeDeposit, 0);
    const balanceDue = directBalance !== null ? directBalance : asNumber(m.guestTotalAfterDeposit, finalTotal);
    const paidAmount = Math.max(0, asNumber(order.paidAmount ?? order.paid_amount ?? order.depositPaid ?? order.deposit_amount ?? m.depositPaid, 0));
    const couponDiscount = Math.max(0, asNumber(order.couponDiscount ?? order.coupon_discount ?? m.couponDiscount, 0));
    const managerDiscount = Math.max(0, asNumber(order.managerDiscount ?? order.manager_discount ?? m.managerDiscount, 0));

    root.querySelectorAll('.invoice-totals div,.invoice-ledger-grid-v164 div,.invoice-payment-grid-v164 div').forEach(row => {
      const label = text(row.querySelector('b,span')?.textContent).toLowerCase();
      const value = row.querySelector('span:last-child,b:last-child');
      if (/nj toll/.test(label)) { row.remove(); return; }
      if (/subtotal before tax/.test(label) && value) value.textContent = moneyText(asNumber(m.foodSubtotal, 0) + asNumber(m.staffingFee, 0) + combinedTravel);
      if (/^total$|^final total$/.test(label) && value) value.textContent = moneyText(finalTotal);
      if (/balance due/.test(label) && value) value.textContent = moneyText(balanceDue);
      if (/coupon discount/.test(label) && value) value.textContent = moneyText(couponDiscount);
      if (/manager discount/.test(label) && value) value.textContent = moneyText(managerDiscount);
      if (/deposit paid|amount paid|payment received/.test(label) && value) value.textContent = moneyText(paidAmount);
    });

    const brand = root.querySelector('.invoice-brand');
    if (brand) {
      const logo = brand.querySelector('img,svg')?.outerHTML || '';
      brand.classList.add('invoice-brand-v255');
      brand.innerHTML = `${logo}<strong>PHOENIX HIBACHI</strong><span>Phone: <a href="tel:+15165183325">(516) 518-3325</a></span><span>Email: <a href="mailto:booking@phoenix-hibachi.com">booking@phoenix-hibachi.com</a></span><span>Website: <a href="https://phoenix-hibachi.com">phoenix-hibachi.com</a></span>`;
    }

    const zeroLabels = /coupon discount|manager discount|points discount|gift card applied|wallet|party credit|promotion code|discount|deposit paid|amount paid|payment received|other card|zelle payments confirmed/i;
    root.querySelectorAll('.invoice-totals div,.invoice-ledger-grid-v164 div,.invoice-payment-grid-v164 div').forEach(row => {
      const label = text(row.querySelector('b,span')?.textContent);
      const value = text(row.querySelector('span:last-child,b:last-child')?.textContent);
      if (zeroLabels.test(label) && (!value || /^\$?0(?:\.00)?$|^none$/i.test(value))) row.remove();
    });

    return template.innerHTML;
  }

  function linkifyContactLines(html, order = {}) {
    let out = String(html || '');
    const address = addressOf(order);
    const map = mapsUrl(address);
    if (map && !/google\.com\/maps\/search\/\?api=1/i.test(out)) {
      out = out.replace(
        /(<b>\s*(?:Address|Where|Event Location)\s*:?\s*<\/b>\s*<span[^>]*>)([^<]*)(<\/span>)/ig,
        (match, start, shown, end) => {
          const label = text(String(shown).replace(/&amp;/g, '&'));
          if (!label || /^(address pending|not entered|no address)$/i.test(label)) return match;
          return `${start}${blueLink(shown, map, 'Open address in Google Maps')}${end}`;
        }
      );
      out = out.replace(
        /(<b>\s*Address\s*<\/b>\s*<span[^>]*>)([^<]*)(<\/span>)/ig,
        (match, start, shown, end) => {
          const label = text(String(shown).replace(/&amp;/g, '&'));
          if (!label || /^(address pending|not entered|no address)$/i.test(label)) return match;
          return `${start}${blueLink(shown, map, 'Open address in Google Maps')}${end}`;
        }
      );
    }
    out = out.replace(
      /(<b>\s*Phone\s*:?\s*<\/b>\s*<span[^>]*>)([^<]*)(<\/span>)/ig,
      (match, start, shown, end) => {
        const href = phoneUrl(shown || order.phone || order.customer_phone);
        return href ? `${start}${blueLink(shown, href, 'Call phone number')}${end}` : match;
      }
    );
    out = out.replace(
      /(<span>)(\(?516\)?[\s.-]*518[\s.-]*3325)(<\/span>)/ig,
      (match, start, shown, end) => `${start}${blueLink(shown, phoneUrl(shown), 'Call Phoenix Hibachi')}${end}`
    );
    out = out.replace(
      /(<span>)(phoenix-hibachi\.com)(<\/span>)/ig,
      (match, start, shown, end) => `${start}${blueLink(shown, websiteUrl(shown), 'Open Phoenix Hibachi website')}${end}`
    );
    return out;
  }

  try {
    const previousInvoice = window.guestInvoiceHtml || guestInvoiceHtml;
    if (typeof previousInvoice === 'function') {
      window.guestInvoiceHtml = function(order = {}) {
        const html = previousInvoice.call(this, order);
        const m = window.calculateOrderMoney ? window.calculateOrderMoney(order) : {};
        return linkifyContactLines(patchInvoiceTotals(html, order, m), order);
      };
      guestInvoiceHtml = window.guestInvoiceHtml;
    }
  } catch {}

  try {
    const previousChefSettlement = window.chefSettlementHtml || chefSettlementHtml;
    if (typeof previousChefSettlement === 'function' && !window.__PHX_V240_CHEF_LINKS__) {
      window.__PHX_V240_CHEF_LINKS__ = true;
      window.chefSettlementHtml = function(order = {}) {
        return linkifyContactLines(previousChefSettlement.call(this, order), order);
      };
      chefSettlementHtml = window.chefSettlementHtml;
    }
  } catch {}

  function priceFields(order = {}) {
    const m = window.calculateOrderMoney ? window.calculateOrderMoney(order) : {};
    const toll = asNumber(m.njTollFee, 0);
    const combinedTravel = asNumber(m.travelFee, 0) + toll;
    const bits = [
      combinedTravel > 0 ? `<span>Travel Fee <b>${moneyText(combinedTravel)}</b></span>` : '',
      `<span>Final Total <b>${moneyText(m.guestTotalBeforeDeposit)}</b></span>`,
      `<span>Balance Due <b>${moneyText(m.guestTotalAfterDeposit)}</b></span>`
    ].filter(Boolean).join('');
    return `<div class="phx-v240-fee-fields">${bits}</div>`;
  }

  function collectOrders() {
    const map = new Map();
    const add = (order) => {
      const id = orderIdOf(order);
      if (id) map.set(id.toLowerCase(), order);
    };
    try { (window.getDashboardOrders?.() || getDashboardOrders?.() || []).forEach(add); } catch {}
    try { (window.getStoredOrders?.() || getStoredOrders?.() || []).forEach(add); } catch {}
    try { (Array.isArray(window.remoteOrdersCache) ? window.remoteOrdersCache : []).forEach(add); } catch {}
    return map;
  }

  function orderForCard(card, orders) {
    const raw = card.getAttribute('data-v120-order-card') ||
      card.getAttribute('data-v102-order-card') ||
      card.querySelector('[data-print-guest]')?.getAttribute('data-print-guest') ||
      card.querySelector('strong')?.textContent ||
      '';
    const match = text(raw).match(/\bPHX[-\w]+\b/i);
    const id = (match ? match[0] : text(raw)).toLowerCase();
    return id ? orders.get(id) || null : null;
  }

  function enhanceOrderCards() {
    const orders = collectOrders();
    document.querySelectorAll('#orderList article.order-card, #calendarSummaryList article.order-card, #chefDispatch article.dispatch-card, [data-v120-order-card], [data-v102-order-card]').forEach(card => {
      if (!card || card.querySelector(':scope > .phx-v240-fee-fields')) return;
      const order = orderForCard(card, orders);
      if (!order) return;
      const actions = card.querySelector('.order-actions, .v102-order-tools, .v107-payment-actions, .phx-v120-stop-actions');
      if (actions) actions.insertAdjacentHTML('beforebegin', priceFields(order));
      else card.insertAdjacentHTML('beforeend', priceFields(order));
    });
    document.querySelectorAll('[data-v107-payment-open], [data-v120-action="payment"]').forEach(btn => {
      btn.textContent = 'Payment / price / travel';
    });
  }

  function enhancePaymentPanels() {
    const orders = collectOrders();
    document.querySelectorAll('.v107-payment-panel, [data-v120-payment-panel]').forEach(panel => {
      if (!panel || panel.querySelector('.phx-v240-nj-toll-panel')) return;
      const raw = panel.getAttribute('data-v120-payment-panel') ||
        panel.querySelector('[data-v107-save-payment]')?.getAttribute('data-v107-save-payment') ||
        panel.querySelector('[data-v120-save-payment]')?.getAttribute('data-v120-save-payment') ||
        '';
      const order = orders.get(text(raw).toLowerCase());
      const toll = order ? njTollFeeForOrder(order) : 0;
      const travelLabel = panel.querySelector('[data-v107-travel-fee]')?.closest('label') ||
        panel.querySelector('[data-v120-travel-fee]')?.closest('label');
      if (travelLabel && toll > 0) {
        travelLabel.insertAdjacentHTML('afterend', `<div class="phx-v240-nj-toll-panel"><b>NJ Toll Fee</b><span>${moneyText(toll)}</span></div>`);
      }
    });
  }

  function pricingInput(name, value, label) {
    return `<label>${esc(label)}<input type="number" step="0.01" data-price-field="${esc(name)}" value="${esc(value)}"></label>`;
  }

  function enhancePricingSettings() {
    if (typeof document.querySelector !== 'function') return;
    const grid = document.querySelector('.v140-settings-grid');
    if (!grid || grid.querySelector('.phx-v240-travel-rule-card')) return;
    const rules = syncRulesFromPricing();
    const card = document.createElement('article');
    card.className = 'phx-v240-travel-rule-card';
    card.innerHTML = `<h4>Travel fee rules</h4><p class="small-muted">Saved here updates address estimates, Booking totals, Admin cards, customer Portal, and Invoice display immediately after admin save.</p>${
      pricingInput('moneyRules.travelFeeBase', rules.baseFee, 'Base travel fee ($)')
    }${
      pricingInput('moneyRules.travelFeeIncludedMiles', rules.includedMiles, 'Miles included in base')
    }${
      pricingInput('moneyRules.travelFeePerExtraMile', rules.perExtraMile, 'Extra mileage rate ($ / mile)')
    }${
      pricingInput('moneyRules.njTollFee', rules.njTollFee, 'NJ toll fee ($)')
    }${
      pricingInput('moneyRules.travelFeeCustomQuoteMiles', rules.customQuoteAboveMiles, 'Custom quote above miles')
    }`;
    const chefCard = Array.from(grid.querySelectorAll('article')).find(article => /Chef payout|business rules/i.test(article.textContent || ''));
    grid.insertBefore(card, chefCard || null);
    const manualDefault = document.querySelector('[data-price-field="moneyRules.defaultTravelFee"]');
    if (manualDefault && asNumber(manualDefault.value, 0) <= 0) manualDefault.value = String(rules.baseFee);
  }

  function updateOrderBeforeManualTravelSave(button) {
    const orderId = text(button?.getAttribute?.('data-v120-save-payment') || button?.getAttribute?.('data-v107-save-payment'));
    if (!orderId) return;
    const card = button.closest?.('[data-v120-payment-panel], .v107-payment-panel, article, .order-card') || document;
    const escapeCss = value => (window.CSS && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
    const id = escapeCss(orderId);
    const travelInput = card.querySelector?.(`[data-v120-travel-fee="${id}"], [data-v107-travel-fee="${id}"]`);
    if (!travelInput) return;
    const waived = !!card.querySelector?.(`[data-v120-waive-travel="${id}"], [data-v107-waive-travel="${id}"]`)?.checked;
    const travel = waived ? 0 : asNumber(travelInput.value, 0);
    const orders = collectOrders();
    const order = orders.get(orderId.toLowerCase());
    if (!order) return;
    order.travelFee = travel;
    order.travel_fee = travel;
    const m = window.calculateOrderMoney ? window.calculateOrderMoney(order) : null;
    const finalInput = card.querySelector?.(`[data-v120-final-total="${id}"], [data-v107-final-total="${id}"]`);
    if (finalInput && m && !text(finalInput.value)) finalInput.value = String(asNumber(m.guestTotalBeforeDeposit, 0).toFixed(2));
  }

  function enhanceDashboard() {
    enhanceOrderCards();
    enhancePaymentPanels();
    enhancePricingSettings();
  }

  function refreshAfterPricingUpdate() {
    syncRulesFromPricing();
    const lat = document.getElementById('eventAddressLat')?.value || '';
    const lon = document.getElementById('eventAddressLon')?.value || '';
    const formatted = document.getElementById('eventAddressInput')?.value || '';
    const hasCoords = lat !== '' && lon !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
    try {
      if (hasCoords && typeof window.updateTravelEstimateFromCoords === 'function') {
        window.updateTravelEstimateFromCoords(lat, lon, formatted);
      } else {
        decorateTravelEstimate();
        if (typeof window.updateSummary === 'function') window.updateSummary();
      }
    } catch {
      decorateTravelEstimate();
    }
    setTimeout(enhanceDashboard, 80);
  }

  document.addEventListener('phoenix:pricing-updated', () => {
    setTimeout(refreshAfterPricingUpdate, 0);
  });

  const addRootListener = window.addEventListener || document.addEventListener;
  addRootListener?.call(window.addEventListener ? window : document, 'click', event => {
    const button = event.target?.closest?.('[data-v120-save-payment], [data-v107-save-payment]');
    if (button) updateOrderBeforeManualTravelSave(button);
  }, true);

  try {
    const previousRender = window.renderDashboard || renderDashboard;
    if (typeof previousRender === 'function') {
      window.renderDashboard = function(...args) {
        const result = previousRender.apply(this, args);
        setTimeout(enhanceDashboard, 60);
        setTimeout(enhanceDashboard, 300);
        return result;
      };
      renderDashboard = window.renderDashboard;
    }
  } catch {}

  try {
    const observer = new MutationObserver(() => {
      clearTimeout(window.__PHX_V240_ENHANCE_TIMER__);
      window.__PHX_V240_ENHANCE_TIMER__ = setTimeout(enhanceDashboard, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      decorateTravelEstimate();
      setTimeout(enhanceDashboard, 400);
    }, { once: true });
  } else {
    decorateTravelEstimate();
    setTimeout(enhanceDashboard, 400);
  }
})();
