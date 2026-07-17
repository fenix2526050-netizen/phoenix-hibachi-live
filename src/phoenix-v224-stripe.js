/* Phoenix Hibachi V2.3.3 Stripe client: compact checkout, polling confirmation, and paid-state collapse. */
(function initPhoenixStripeClient(){
  if(window.__PHX_STRIPE_CLIENT__) return;
  window.__PHX_STRIPE_CLIENT__ = true;

  const cfg = window.PHOENIX_PAYMENT_CONFIG || {};
  const payBtn = document.getElementById('payStripeDepositBtn');
  const message = document.getElementById('stripeDepositMessage');
  const mount = document.getElementById('stripePaymentMount');
  const panel = payBtn?.closest('[data-payment-panel="stripe"]') || null;
  const amountChoice = document.getElementById('stripePaymentAmountChoice');
  const amountInputs = [...document.querySelectorAll('input[name="stripePaymentAmount"]')];
  const fullBalanceLabel = document.getElementById('stripeFullBalanceAmount');
  const depositTitle = document.getElementById('stripeDepositOptionTitle');
  const depositHelp = document.getElementById('stripeDepositOptionHelp');
  const customAmountInput = document.getElementById('stripeCustomAmount');
  let stripe = null;
  let checkout = null;
  let activeSessionId = '';
  let completionHandled = false;
  let pollTimer = 0;
  const stripeEnabled = cfg.features?.stripe === true;
  const sandboxMode = cfg.mode === 'sandbox';

  function cleanBookingNumber(value = '') {
    const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const match = raw.toUpperCase().match(/PHX-\d{6}-[A-Z0-9]{4,12}/);
    return match?.[0] || raw;
  }

  function readStoredContext() {
    try {
      return JSON.parse(sessionStorage.getItem('phoenix_last_payment_context_v230') || '{}') || {};
    } catch {
      return {};
    }
  }

  function context() {
    let order = {};
    try {
      if (typeof lastSubmittedOrder !== 'undefined' && lastSubmittedOrder) order = lastSubmittedOrder;
    } catch {}

    const stored = readStoredContext();
    const receipt = document.getElementById('successReceipt');
    const bookingNumber = cleanBookingNumber(
      order.booking_number || order.bookingNumber || order.id ||
      receipt?.dataset?.bookingId ||
      receipt?.querySelector('[data-booking-reference]')?.textContent?.trim() ||
      window.lastSubmittedBookingId || stored.bookingNumber || ''
    );
    const customerEmail = String(
      order.customer_email || order.customerEmail || order.email || stored.customerEmail || ''
    ).trim().toLowerCase();

    let paymentAccessToken = '';
    try {
      paymentAccessToken = sessionStorage.getItem(`phoenix_payment_access_${bookingNumber}`) || stored.paymentAccessToken || '';
      if (bookingNumber && customerEmail) {
        sessionStorage.setItem('phoenix_last_payment_context_v230', JSON.stringify({
          bookingNumber,
          customerEmail,
          paymentAccessToken,
          savedAt: Date.now(),
        }));
      }
    } catch {}

    const paymentType = document.querySelector('input[name="stripePaymentAmount"]:checked')?.value || 'deposit';
    const customAmount = Math.round(Number(customAmountInput?.value || 0) * 100);
    return { bookingNumber, customerEmail, paymentAccessToken, paymentType, customAmountCents: paymentType === 'custom' ? customAmount : 0 };
  }

  function money(cents, currency = 'usd') {
    const amount = Number(cents || 0) / 100;
    try {
      return amount.toLocaleString('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase() });
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }

  function currentOrderObject() {
    try { return (typeof lastSubmittedOrder !== 'undefined' && lastSubmittedOrder) ? lastSubmittedOrder : {}; } catch { return {}; }
  }

  function estimatedBalanceCents() {
    const order = currentOrderObject();
    const direct = Number(order.balanceDueCents ?? order.balance_due_cents);
    if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
    try {
      const calculated = typeof calculateOrderMoney === 'function' ? calculateOrderMoney(order) : null;
      const dollars = Number(calculated?.guestTotalAfterDeposit ?? calculated?.guestTotalBeforeDeposit ?? 0);
      if (Number.isFinite(dollars) && dollars > 0) return Math.round(dollars * 100);
    } catch {}
    const fallback = Number(order.finalTotal ?? order.final_total ?? order.total ?? 0);
    return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback * 100) : 0;
  }

  function requiredDepositCents() {
    const order = currentOrderObject();
    const direct = Number(order.depositRequired || 0) * 100 || Number(order.deposit_required_cents || 0);
    if (Number.isFinite(direct) && direct >= 10000) return Math.round(direct);
    const guests = Math.max(10, Math.ceil(Number(order.totalGuests || order.guest_count || (Number(order.adults || 0) + Number(order.kids || 0)) || 0)));
    if (guests >= 31) return 30000;
    if (guests >= 21) return 20000;
    return 10000;
  }

  function selectedPaymentType() {
    return document.querySelector('input[name="stripePaymentAmount"]:checked')?.value || 'deposit';
  }

  function customAmountCents() {
    return Math.round(Number(customAmountInput?.value || 0) * 100);
  }

  function refreshAmountChoice() {
    const type = selectedPaymentType();
    const balance = estimatedBalanceCents();
    const deposit = Math.min(requiredDepositCents(), balance || requiredDepositCents());
    const custom = customAmountCents();
    amountInputs.forEach(input => input.closest('.phx-stripe-amount-option')?.classList.toggle('selected', input.checked));
    if (depositTitle) depositTitle.textContent = `Pay ${money(deposit)} required deposit`;
    if (depositHelp) depositHelp.textContent = 'Party-size rule: up to 20 guests $100; 21–30 guests $200; 31+ guests $300.';
    if (fullBalanceLabel) fullBalanceLabel.textContent = balance > 0 ? `Pay ${money(balance)} now and leave a $0 balance.` : 'Exact amount is verified by the server before payment.';
    if (customAmountInput) {
      customAmountInput.max = balance > 0 ? String(Math.floor(balance / 100)) : '';
      customAmountInput.closest('.phx-stripe-custom-option')?.classList.toggle('selected', type === 'custom');
    }
    if (payBtn && !payBtn.disabled) {
      if (type === 'full_balance') {
        payBtn.textContent = sandboxMode ? `Test full payment${balance ? ` ${money(balance)}` : ''} (Sandbox)` : `Pay full balance${balance ? ` ${money(balance)}` : ''}`;
      } else if (type === 'custom') {
        payBtn.textContent = custom >= 10000 ? `${sandboxMode ? 'Test' : 'Pay'} ${money(custom)} securely${sandboxMode ? ' (Sandbox)' : ''}` : 'Enter a custom amount of at least $100';
      } else {
        payBtn.textContent = sandboxMode ? `Test ${money(deposit)} deposit (Sandbox)` : `Pay ${money(deposit)} deposit securely`;
      }
    }
  }

  function injectSuccessStyles() {
    if (document.getElementById('phxStripeSuccessStyles')) return;
    const style = document.createElement('style');
    style.id = 'phxStripeSuccessStyles';
    style.textContent = `
      .phx-stripe-result-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.78);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:20px}
      .phx-stripe-result-card{width:min(620px,100%);background:linear-gradient(180deg,#17110a,#090704);border:1px solid rgba(245,184,51,.62);border-radius:24px;box-shadow:0 28px 90px rgba(0,0,0,.68);padding:30px;color:#fff;font-family:inherit;text-align:center}
      .phx-stripe-result-icon{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;margin:0 auto 17px;background:rgba(45,201,112,.13);border:2px solid #38d67a;color:#55e58e;font-size:42px;font-weight:900}
      .phx-stripe-result-card h2{margin:0 0 8px;font-size:clamp(27px,4vw,38px);line-height:1.1;color:#fff}
      .phx-stripe-result-lead{font-size:18px;color:#f6c451;margin:0 0 18px;font-weight:800}
      .phx-stripe-result-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0;text-align:left}
      .phx-stripe-result-row{padding:13px 14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.11);border-radius:13px}
      .phx-stripe-result-row span{display:block;color:#bcb3a7;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
      .phx-stripe-result-row strong{display:block;color:#fff;font-size:16px;overflow-wrap:anywhere}
      .phx-stripe-result-note{margin:16px 0 0;color:#d5cec5;line-height:1.55;font-size:14px}
      .phx-stripe-result-warning{margin:14px 0 0;padding:11px 13px;border-radius:11px;background:rgba(245,184,51,.1);color:#f7d87f;font-size:13px}
      .phx-stripe-result-actions{display:flex;justify-content:center;gap:11px;margin-top:23px;flex-wrap:wrap}
      .phx-stripe-result-actions button,.phx-stripe-result-actions a{border:0;border-radius:999px;padding:12px 22px;font-weight:900;cursor:pointer;text-decoration:none;font-family:inherit}
      .phx-stripe-result-primary{background:linear-gradient(90deg,#da9215,#ffd46d);color:#130d04}
      .phx-stripe-result-secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25)!important}
      .phx-stripe-inline-success{padding:28px 18px;text-align:center;background:linear-gradient(180deg,rgba(26,83,51,.22),rgba(10,27,18,.25));border:1px solid rgba(75,222,133,.42);border-radius:17px;color:#fff}
      .phx-stripe-inline-success .check{font-size:43px;color:#50e18b;margin-bottom:8px}
      .phx-stripe-inline-success h3{margin:0 0 7px;color:#fff;font-size:25px}
      .phx-stripe-inline-success p{margin:5px auto;color:#d8e8dd;max-width:560px;line-height:1.5}
      .phx-stripe-amount-choice{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}
      .phx-stripe-amount-option{position:relative;display:grid;grid-template-columns:26px 1fr;gap:11px;align-items:flex-start;padding:15px;border:1px solid rgba(245,184,51,.28);border-radius:15px;background:rgba(255,255,255,.025);cursor:pointer;text-align:left;min-height:112px}
      .phx-stripe-amount-option.selected{border-color:#f5b833;background:linear-gradient(180deg,rgba(245,184,51,.13),rgba(245,184,51,.055));box-shadow:0 0 0 1px rgba(245,184,51,.25)}
      .phx-stripe-amount-option>input[type="radio"]{position:absolute;opacity:0;pointer-events:none}
      .phx-stripe-choice-mark{width:24px;height:24px;border-radius:8px;border:1px solid rgba(245,184,51,.46);display:grid!important;place-items:center;color:transparent;background:rgba(0,0,0,.22);font-weight:900}
      .phx-stripe-amount-option.selected .phx-stripe-choice-mark{background:#f5b833;color:#1a1005;border-color:#f5b833}
      .phx-stripe-amount-option span,.phx-stripe-amount-option b,.phx-stripe-amount-option small{display:block}
      .phx-stripe-amount-option b{color:#fff;margin-bottom:5px}
      .phx-stripe-amount-option small{color:#c7bfb4;line-height:1.42}
      .phx-stripe-custom-input-wrap{display:flex!important;align-items:center;gap:7px;margin-top:10px;padding:8px 10px;border:1px solid rgba(245,184,51,.28);border-radius:10px;background:#0c0906;color:#f5c65d;font-weight:900}
      .phx-stripe-custom-input-wrap input{width:100%;border:0!important;outline:0!important;background:transparent!important;color:#fff!important;font:inherit;padding:0!important;box-shadow:none!important}
      [data-stripe-state="open"] .phx-stripe-amount-choice,[data-stripe-state="loading"] .phx-stripe-amount-choice,[data-stripe-state="paid"] .phx-stripe-amount-choice{display:none}
      @media(max-width:900px){.phx-stripe-amount-choice{grid-template-columns:1fr}}
      @media(max-width:620px){.phx-stripe-result-card{padding:24px 17px}.phx-stripe-result-grid{grid-template-columns:1fr}.phx-stripe-result-actions{flex-direction:column}.phx-stripe-result-actions button,.phx-stripe-result-actions a{width:100%}}
    `;
    document.head.appendChild(style);
  }


  function setPanelMode(mode = 'idle') {
    if (!panel) return;
    panel.classList.toggle('phx-stripe-checkout-open', mode === 'open' || mode === 'loading');
    panel.classList.toggle('phx-stripe-paid', mode === 'paid');
    panel.dataset.stripeState = mode;
  }

  function stopStatusPolling() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = 0;
  }

  function clearReturnParam() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_return');
      url.searchParams.delete('session_id');
      history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  }

  function showResultOverlay(details = {}, state = 'success') {
    injectSuccessStyles();
    document.getElementById('phxStripeResultOverlay')?.remove();

    const paid = state === 'success';
    const processing = state === 'processing';
    const overlay = document.createElement('div');
    overlay.id = 'phxStripeResultOverlay';
    overlay.className = 'phx-stripe-result-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const bookingNumber = details.bookingNumber || context().bookingNumber || 'Pending reference';
    const amount = money(details.amountTotal || requiredDepositCents(), details.currency || 'usd');
    const verified = details.bookingVerified === true || details.depositStatus === 'paid';
    const sandbox = details.livemode === false || sandboxMode;

    let title = 'Payment successful';
    const fullPayment = details.paymentType === 'full_balance' || details.paidInFull === true;
    const customPayment = details.paymentType === 'custom';
    const partialPayment = customPayment && String(details.depositStatus || '').toLowerCase() === 'partially_paid';
    let lead = fullPayment ? `${amount} full payment received` : partialPayment ? `${amount} payment received` : `${amount} deposit received`;
    let icon = '✓';
    let note = verified
      ? (fullPayment
        ? 'Your full payment has been verified and recorded. Phoenix Hibachi will continue processing your booking according to its current confirmation status.'
        : partialPayment
          ? 'Your payment has been verified and recorded. The required party-size deposit is not yet fully covered.'
          : 'Your deposit has been verified and recorded. Phoenix Hibachi will continue processing your booking according to its current confirmation status.')
      : 'Stripe accepted the payment. Our secure webhook is finishing the booking update; this normally takes only a few seconds.';

    if (processing) {
      title = 'Checking your payment';
      lead = 'Please wait a moment';
      icon = '…';
      note = 'We are securely confirming the Stripe payment and updating your booking record.';
    } else if (!paid) {
      title = 'Payment not completed';
      lead = 'No successful charge was confirmed';
      icon = '!';
      note = details.message || 'Return to the booking payment panel and try again, or choose cash or Zelle.';
    }

    overlay.innerHTML = `
      <section class="phx-stripe-result-card">
        <div class="phx-stripe-result-icon">${icon}</div>
        <h2>${title}</h2>
        <p class="phx-stripe-result-lead">${lead}</p>
        <div class="phx-stripe-result-grid">
          <div class="phx-stripe-result-row"><span>Booking reference</span><strong>${bookingNumber}</strong></div>
          <div class="phx-stripe-result-row"><span>Payment status</span><strong>${paid ? (verified ? 'Paid and verified' : 'Paid — recording') : (processing ? 'Checking' : 'Incomplete')}</strong></div>
        </div>
        <p class="phx-stripe-result-note">${note}</p>
        ${sandbox ? '<div class="phx-stripe-result-warning">Sandbox test only — no real money was charged.</div>' : ''}
        <div class="phx-stripe-result-actions">
          <button type="button" class="phx-stripe-result-primary" data-phx-close-result>${paid ? 'Done' : 'Close'}</button>
          <a class="phx-stripe-result-secondary" href="/">Back to homepage</a>
        </div>
      </section>`;

    document.body.appendChild(overlay);
    overlay.querySelector('[data-phx-close-result]')?.addEventListener('click', () => overlay.remove());
    if (paid) clearReturnParam();
  }

  function renderInlineSuccess(details = {}) {
    if (!mount) return;
    const amount = money(details.amountTotal || requiredDepositCents(), details.currency || 'usd');
    const bookingNumber = details.bookingNumber || context().bookingNumber || '';
    const fullPayment = details.paymentType === 'full_balance' || details.paidInFull === true;
    const partialPayment = details.paymentType === 'custom' && String(details.depositStatus || '').toLowerCase() === 'partially_paid';
    setPanelMode('paid');
    mount.hidden = false;
    mount.innerHTML = `
      <div class="phx-stripe-inline-success phx-stripe-inline-success-compact">
        <div class="check">✓</div>
        <div class="phx-stripe-success-copy">
          <h3>${fullPayment ? 'Paid in full' : partialPayment ? 'Payment received' : 'Deposit paid'}</h3>
          <p><strong>${amount}</strong>${bookingNumber ? ` · ${bookingNumber}` : ''}</p>
          <small>${details.bookingVerified ? 'Verified and recorded.' : 'Payment received; booking record is updating.'}${sandboxMode ? ' Sandbox test — no real money charged.' : ''}</small>
        </div>
      </div>`;
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.hidden = true;
      payBtn.textContent = fullPayment ? 'Paid in full' : partialPayment ? 'Payment received' : 'Deposit paid';
    }
  }

  async function fetchSessionStatus(sessionId) {
    if (!sessionId || !cfg.supabaseFunctionsBaseUrl) return null;
    const endpoint = `${cfg.supabaseFunctionsBaseUrl.replace(/\/$/, '')}/stripe-session-status`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Unable to verify payment (${res.status})`);
    return data;
  }

  async function confirmAndShow(sessionId, options = {}) {
    const inline = options.inline === true;
    if (!inline) showResultOverlay({ bookingNumber: context().bookingNumber }, 'processing');

    let details = null;
    let lastError = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        details = await fetchSessionStatus(sessionId);
        if (details?.paymentStatus === 'paid' && (details.bookingVerified || attempt >= 2)) break;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 900 + (attempt * 250)));
    }

    if (details?.status === 'complete' && details?.paymentStatus === 'paid') {
      if (inline) renderInlineSuccess(details);
      else showResultOverlay(details, 'success');
      if (message) {
        message.textContent = details.paymentType === 'full_balance' || details.paidInFull ? 'Payment successful. The booking is paid in full.' : 'Payment successful. The deposit was received and is being recorded.';
        message.className = 'phx-v224-payment-message success';
      }
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = details.paymentType === 'full_balance' || details.paidInFull
          ? 'Paid in full'
          : (details.paymentType === 'custom' && String(details.depositStatus || '').toLowerCase() === 'partially_paid')
            ? 'Payment received'
            : 'Deposit paid';
      }
      window.dispatchEvent(new CustomEvent('phoenix:stripe-payment-verified', { detail: details }));
      if (details.paymentType !== 'full_balance') window.dispatchEvent(new CustomEvent('phoenix:stripe-deposit-verified', { detail: details }));
      return;
    }

    const failure = {
      ...(details || {}),
      message: lastError?.message || 'The payment status could not be confirmed. Please check your Stripe receipt or contact Phoenix Hibachi.',
    };
    showResultOverlay(failure, 'error');
    if (message) {
      message.textContent = `Payment verification error: ${failure.message}`;
      message.className = 'phx-v224-payment-message error';
    }
    if (payBtn) payBtn.disabled = false;
  }

  async function handleComplete(sessionId, payload) {
    if (completionHandled) return;
    completionHandled = true;
    stopStatusPolling();
    try { checkout?.destroy?.(); } catch {}
    checkout = null;
    if (mount) {
      mount.hidden = false;
      mount.innerHTML = `<div class="phx-stripe-inline-success phx-stripe-inline-success-compact"><div class="check">✓</div><div class="phx-stripe-success-copy"><h3>Payment received</h3><p>Confirming your ${payload?.paymentType === 'full_balance' ? 'full payment' : payload?.paymentType === 'custom' ? 'custom payment' : 'booking deposit'}…</p></div></div>`;
    }
    try {
      if (sessionId) await confirmAndShow(sessionId, { inline: true });
      else renderInlineSuccess({ bookingNumber: payload?.bookingNumber, amountTotal: payload?.paymentType === 'full_balance' ? estimatedBalanceCents() : (payload?.paymentType === 'custom' ? Number(payload?.customAmountCents || 0) : requiredDepositCents()), paymentType: payload?.paymentType, paidInFull: payload?.paymentType === 'full_balance', livemode: !sandboxMode });
    } catch (error) {
      completionHandled = false;
      showResultOverlay({ bookingNumber: payload?.bookingNumber, message: error.message }, 'error');
    }
  }

  function startStatusPolling(sessionId, payload) {
    stopStatusPolling();
    if (!sessionId) return;
    const started = Date.now();
    const tick = async () => {
      if (completionHandled || Date.now() - started > 10 * 60 * 1000) return;
      try {
        const details = await fetchSessionStatus(sessionId);
        if (details?.status === 'complete' && details?.paymentStatus === 'paid') {
          await handleComplete(sessionId, payload);
          return;
        }
      } catch {}
      pollTimer = window.setTimeout(tick, 1400);
    };
    pollTimer = window.setTimeout(tick, 1200);
  }

  async function startCheckout() {
    if (!stripeEnabled || !cfg.stripePublishableKey || !cfg.supabaseFunctionsBaseUrl) {
      if (message) {
        message.textContent = 'Stripe test connection is not configured yet. Add the publishable key and Supabase Functions URL after deploying the secure backend.';
        message.className = 'phx-v224-payment-message error';
      }
      return;
    }

    const payload = context();
    const balance = estimatedBalanceCents();
    if (payload.paymentType === 'custom') {
      if (!Number.isInteger(payload.customAmountCents) || payload.customAmountCents < 10000) {
        if (message) {
          message.textContent = 'Custom card payment must be at least $100.';
          message.className = 'phx-v224-payment-message error';
        }
        customAmountInput?.focus();
        return;
      }
      if (balance > 0 && payload.customAmountCents > balance) {
        if (message) {
          message.textContent = `Custom payment cannot exceed the remaining balance of ${money(balance)}.`;
          message.className = 'phx-v224-payment-message error';
        }
        customAmountInput?.focus();
        return;
      }
    }
    if (!payload.bookingNumber || !payload.customerEmail) {
      if (message) {
        message.textContent = 'Booking reference or customer email is missing. Submit a new booking request, then open card payment from the confirmation window.';
        message.className = 'phx-v224-payment-message error';
      }
      return;
    }

    completionHandled = false;
    setPanelMode('loading');
    if (mount) {
      mount.hidden = true;
      mount.innerHTML = '';
    }
    payBtn.disabled = true;
    if (message) {
      message.textContent = `Opening secure Stripe checkout for ${payload.bookingNumber}…`;
      message.className = 'phx-v224-payment-message';
    }

    try {
      stripe = stripe || window.Stripe(cfg.stripePublishableKey);
      const endpoint = `${cfg.supabaseFunctionsBaseUrl.replace(/\/$/, '')}/${cfg.createCheckoutFunction}`;
      let authHeader = {};
      try {
        const client = typeof initSupabaseClient === 'function' ? initSupabaseClient() : null;
        const session = client ? (await client.auth.getSession()).data.session : null;
        if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
      } catch {}

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(payload),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error || `Unable to create checkout session (${res.status})`);

      activeSessionId = String(data.sessionId || '');
      try {
        if (activeSessionId) sessionStorage.setItem('phoenix_active_stripe_session', activeSessionId);
      } catch {}

      if (data.resolvedBookingNumber && data.resolvedBookingNumber !== payload.bookingNumber) {
        try {
          window.lastSubmittedBookingId = data.resolvedBookingNumber;
          sessionStorage.setItem('phoenix_last_payment_context_v230', JSON.stringify({
            ...payload,
            bookingNumber: data.resolvedBookingNumber,
            savedAt: Date.now(),
          }));
        } catch {}
      }

      if (data.alreadyPaid || data.coveredByBenefits) {
        const fullPayment = data.paidInFull === true || payload.paymentType === 'full_balance';
        const details = {bookingNumber:data.resolvedBookingNumber||payload.bookingNumber,amountTotal:data.coveredByBenefits?0:(fullPayment?estimatedBalanceCents():(payload.paymentType==='custom'?Number(payload.customAmountCents||0):requiredDepositCents())),bookingVerified:true,paymentType:payload.paymentType,paidInFull:fullPayment};
        window.dispatchEvent(new CustomEvent('phoenix:stripe-payment-verified', {detail:details}));
        if (!fullPayment) window.dispatchEvent(new CustomEvent('phoenix:stripe-deposit-verified', {detail:details}));
        renderInlineSuccess(details);
        if (message) message.textContent = data.coveredByBenefits
          ? 'The selected amount is fully covered by verified gift card or Phoenix Credit.'
          : (fullPayment ? 'This booking is already paid in full.' : 'The deposit is already paid and verified.');
        return;
      }

      if (data.clientSecret) {
        try { checkout?.destroy?.(); } catch {}
        setPanelMode('open');
        if (mount) {
          mount.hidden = false;
          mount.innerHTML = '';
        }

        const onComplete = () => handleComplete(activeSessionId, payload);
        if (typeof stripe.createEmbeddedCheckoutPage === 'function') {
          checkout = await stripe.createEmbeddedCheckoutPage({
            clientSecret: data.clientSecret,
            onComplete,
          });
        } else if (typeof stripe.initEmbeddedCheckout === 'function') {
          checkout = await stripe.initEmbeddedCheckout({
            clientSecret: data.clientSecret,
            onComplete,
          });
        } else {
          throw new Error('This browser could not load the Stripe checkout component');
        }

        checkout.mount('#stripePaymentMount');
        startStatusPolling(activeSessionId, payload);
        if (message) {
          message.textContent = `Use the secure Stripe form to pay ${money(data.amountDue || (payload.paymentType==='custom'?payload.customAmountCents:requiredDepositCents()))}.`;
          message.className = 'phx-v224-payment-message';
        }
      } else if (data.url) {
        location.assign(data.url);
      } else {
        throw new Error('Checkout session did not return a client secret or URL');
      }
    } catch (error) {
      if (message) {
        message.textContent = `Payment setup error: ${error.message}`;
        message.className = 'phx-v224-payment-message error';
      }
      setPanelMode('idle');
      if (mount && !checkout) {
        mount.hidden = true;
        mount.innerHTML = '';
      }
      payBtn.disabled = false;
      refreshAmountChoice();
    }
  }

  async function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search || '');
    const sessionId = params.get('stripe_return') || params.get('session_id');
    if (!sessionId) return;
    await confirmAndShow(sessionId, { inline: false });
  }

  injectSuccessStyles();
  setPanelMode('idle');
  if (mount) {
    mount.hidden = true;
    mount.innerHTML = '';
  }

  if (payBtn && stripeEnabled && sandboxMode) {
    payBtn.disabled = false;
    payBtn.textContent = `Test ${money(requiredDepositCents())} deposit (Sandbox)`;
    if (panel && !panel.querySelector('.phx-stripe-sandbox-banner')) {
      const banner = document.createElement('div');
      banner.className = 'phx-stripe-sandbox-banner';
      banner.innerHTML = '<b>Stripe Sandbox Test</b><span>No real money is charged. Use only Stripe test card details.</span>';
      panel.insertBefore(banner, panel.firstChild);
    }
    if (message) {
      message.textContent = 'Sandbox test only. Submit a new booking using booking@phoenix-hibachi.com, then pay from that confirmation window.';
      message.className = 'phx-v224-payment-message';
    }
  } else if (payBtn && !stripeEnabled) {
    payBtn.disabled = true;
    payBtn.textContent = 'Online card payment setup in progress';
    if (message) {
      message.textContent = 'Choose cash, Zelle, or Venmo for now. Card payment will appear only after the secure Stripe backend is activated.';
      message.className = 'phx-v224-payment-message';
    }
  }

  amountInputs.forEach(input => input.addEventListener('change', refreshAmountChoice));
  customAmountInput?.addEventListener('focus', () => {
    const customRadio = document.querySelector('input[name="stripePaymentAmount"][value="custom"]');
    if (customRadio && !customRadio.checked) { customRadio.checked = true; customRadio.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  customAmountInput?.addEventListener('input', refreshAmountChoice);
  window.addEventListener('phoenix:booking-summary-updated', refreshAmountChoice);
  setTimeout(refreshAmountChoice, 0);
  setTimeout(refreshAmountChoice, 800);
  payBtn?.addEventListener('click', startCheckout);
  window.addEventListener('pagehide', stopStatusPolling, { once:true });
  handleStripeReturn().catch((error) => {
    showResultOverlay({ message: error.message }, 'error');
  });
})();
