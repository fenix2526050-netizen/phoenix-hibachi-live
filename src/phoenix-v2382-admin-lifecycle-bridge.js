/* Phoenix Hibachi V2.3.8.2 — secure Admin lifecycle bridge.
   Loaded last, but listens on window capture so it runs before older document handlers.
   It never contains a secret key. It uses the current signed-in Supabase session. */
(function phoenixAdminLifecycleBridgeV2382(){
  if (window.__PHX_ADMIN_LIFECYCLE_BRIDGE_V2382__) return;
  window.__PHX_ADMIN_LIFECYCLE_BRIDGE_V2382__ = true;
  window.PHX_ADMIN_LIFECYCLE_VERSION = 'V2382';

  const clean = value => String(value ?? '').trim();
  const moneyNumber = value => {
    const n = Number(String(value ?? '').replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  function getClient(){
    const client = typeof window.initSupabaseClient === 'function'
      ? window.initSupabaseClient()
      : (typeof initSupabaseClient === 'function' ? initSupabaseClient() : null);
    if (!client) throw new Error('Supabase client is not available. Refresh the Admin page and sign in again.');
    return client;
  }

  async function getAdminSession(){
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.access_token) {
      throw new Error('Admin session expired. Sign out, sign in again, and retry.');
    }
    return { client, session };
  }

  async function invokeAdmin(action, payload = {}){
    const { session } = await getAdminSession();
    const cfg = window.PHOENIX_PAYMENT_CONFIG || {};
    const projectUrl = clean(window.PHX_SUPABASE_URL);
    const base = clean(cfg.supabaseFunctionsBaseUrl)
      || (projectUrl ? `${projectUrl.replace(/\/$/, '')}/functions/v1` : '');
    const fn = clean(cfg.bookingLifecycleFunction || cfg.lookupBookingFunction || 'booking-lifecycle');
    const anonKey = clean(window.PHX_SUPABASE_ANON_KEY);

    if (!base || !anonKey) throw new Error('Secure booking service configuration is missing.');

    const response = await fetch(`${base.replace(/\/$/, '')}/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'x-supabase-auth': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action,
        ...payload,
        accessToken: session.access_token
      })
    });

    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `Booking service failed (${response.status}).`);
    }
    return data;
  }

  function notificationAccepted(result){
    const n = result?.notification || {};
    return n.sentAny === true
      || n.queued === true
      || n.duplicate === true
      || (Number(n.makeStatus) >= 200 && Number(n.makeStatus) < 300);
  }

  function notificationMessage(result, successText){
    if (notificationAccepted(result)) {
      return `${successText}\n\nCustomer email/SMS notification was accepted by Make.`;
    }
    const error = clean(result?.notification?.error);
    return `${successText}\n\nThe order update succeeded, but notification delivery did not complete${error ? `: ${error}` : '.'}`;
  }

  async function refreshAdmin(){
    try {
      if (typeof window.loadDashboardDataFromSupabase === 'function') {
        await window.loadDashboardDataFromSupabase();
      } else if (typeof loadDashboardDataFromSupabase === 'function') {
        await loadDashboardDataFromSupabase();
      }
    } catch (error) {
      console.warn('V2382 dashboard refresh failed:', error);
    }
    try {
      const role = window.currentDashboardRole || (typeof currentDashboardRole !== 'undefined' ? currentDashboardRole : 'Admin');
      if (typeof window.renderDashboard === 'function') window.renderDashboard(role || 'Admin');
      else if (typeof renderDashboard === 'function') renderDashboard(role || 'Admin');
    } catch {}
  }

  function datasetValue(button, names){
    for (const name of names) {
      const value = button?.dataset?.[name];
      if (value) return value;
    }
    return '';
  }

  function findOrder(orderId){
    try {
      if (typeof window.findDashboardOrder === 'function') return window.findDashboardOrder(orderId);
      if (typeof findDashboardOrder === 'function') return findDashboardOrder(orderId);
    } catch {}
    return null;
  }

  async function handleConfirm(button){
    const orderId = datasetValue(button, ['v101Confirm', 'v102Confirm', 'confirmOrder']);
    if (!orderId) return;
    button.disabled = true;
    try {
      const result = await invokeAdmin('admin_confirm', { bookingNumber: orderId });
      await refreshAdmin();
      alert(notificationMessage(result, 'Order confirmed successfully.'));
    } catch (error) {
      alert(`Order confirmation failed: ${error.message || error}`);
    } finally {
      button.disabled = false;
    }
  }

  async function handleTime(button){
    const orderId = datasetValue(button, ['v101SaveTime', 'v102SaveTime']);
    if (!orderId) return;

    const escaped = window.CSS?.escape ? CSS.escape(String(orderId)) : String(orderId);
    const card = document.querySelector(
      `[data-v101-order-card="${escaped}"],[data-v102-order-card="${escaped}"],[data-v101-panel="${escaped}"],[data-v102-panel="${escaped}"]`
    )?.closest('article, [data-v101-order-card], [data-v102-order-card]')
      || document;

    const date = clean(
      card.querySelector(`[data-v101-date="${escaped}"]`)?.value
      || card.querySelector(`[data-v102-date="${escaped}"]`)?.value
    );
    const time = clean(
      card.querySelector(`[data-v101-time="${escaped}"]`)?.value
      || card.querySelector(`[data-v102-time="${escaped}"]`)?.value
    );

    if (!date || !time) {
      alert('Choose a valid event date and time.');
      return;
    }

    button.disabled = true;
    try {
      const result = await invokeAdmin('admin_reschedule', {
        bookingNumber: orderId,
        eventDate: date,
        eventTime: time
      });
      await refreshAdmin();
      alert(notificationMessage(result, 'Order date/time updated successfully.'));
    } catch (error) {
      alert(`Schedule update failed: ${error.message || error}`);
    } finally {
      button.disabled = false;
    }
  }

  function requiredDeposit(order){
    try {
      const guests = Number(order?.totalGuests || order?.guest_count || 0);
      if (typeof window.phoenixDepositRequiredForGuests === 'function') {
        return Number(window.phoenixDepositRequiredForGuests(guests)) || 100;
      }
      if (typeof phoenixDepositRequiredForGuests === 'function') {
        return Number(phoenixDepositRequiredForGuests(guests)) || 100;
      }
      if (guests >= 31) return 300;
      if (guests >= 21) return 200;
      return 100;
    } catch {
      return 100;
    }
  }

  async function handlePayment(button, quickDeposit){
    const orderId = datasetValue(button, ['v107SavePayment', 'v107MarkDeposit']);
    if (!orderId) return;

    const escaped = window.CSS?.escape ? CSS.escape(String(orderId)) : String(orderId);
    const panel = document.querySelector(`[data-v107-payment-panel="${escaped}"]`);
    if (!panel) {
      alert('Payment panel was not found.');
      return;
    }

    const order = findOrder(orderId) || {};
    const amount = quickDeposit
      ? requiredDeposit(order)
      : moneyNumber(panel.querySelector('[data-v107-payment-received]')?.value);
    const panelMethod = clean(panel.querySelector('[data-v107-payment-method]')?.value);
    const claimedMethod = clean(
      order.paymentPreference || order.payment_preference ||
      order.depositPaymentMethod || order.deposit_payment_method ||
      order.paymentMethod || order.payment_method
    );
    const normalizedClaimedMethod = /zelle/i.test(claimedMethod)
      ? 'Zelle'
      : /venmo/i.test(claimedMethod)
        ? 'Venmo'
        : /cash\s*app/i.test(claimedMethod)
          ? 'Cash App'
          : /cash/i.test(claimedMethod)
            ? 'Cash'
            : claimedMethod;
    const method = panelMethod || (quickDeposit ? (normalizedClaimedMethod || 'Manual transfer') : '');
    const chosenStatus = clean(panel.querySelector('[data-v107-payment-status]')?.value);
    const calculated = (() => {
      try {
        const m = typeof calculateOrderMoney === 'function' ? calculateOrderMoney(order) : {};
        return Number(m?.guestTotalBeforeDeposit || order?.finalTotal || order?.final_total || 0);
      } catch { return 0; }
    })();
    const paidInFull = /paid\s*in\s*full|full/i.test(chosenStatus)
      || (calculated > 0 && amount >= calculated);

    if (quickDeposit) {
      const accepted = window.confirm(
        `Confirm that Phoenix Hibachi received $${amount.toFixed(2)}${method ? ` by ${method}` : ''}?\n\nThis will immediately send the customer a deposit-received email and, when opted in, an SMS.`
      );
      if (!accepted) return;
    }

    button.disabled = true;
    try {
      const result = await invokeAdmin('admin_payment_update', {
        bookingNumber: orderId,
        amountReceived: amount,
        paymentMethod: method || (quickDeposit ? 'cash' : ''),
        paymentStatus: paidInFull ? 'paid in full' : (chosenStatus || 'deposit received'),
        paidInFull
      });
      await refreshAdmin();
      alert(notificationMessage(
        result,
        paidInFull ? 'Order marked paid in full.' : `Payment of $${amount.toFixed(2)} recorded.`
      ));
    } catch (error) {
      alert(`Payment update failed: ${error.message || error}`);
    } finally {
      button.disabled = false;
    }
  }

  window.phoenixAdminLifecycleInvokeV2382 = invokeAdmin;

  window.addEventListener('click', function(event){
    const confirmButton = event.target?.closest?.(
      '[data-v101-confirm],[data-v102-confirm],[data-confirm-order]'
    );
    if (confirmButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleConfirm(confirmButton);
      return;
    }

    const timeButton = event.target?.closest?.(
      '[data-v101-save-time],[data-v102-save-time]'
    );
    if (timeButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleTime(timeButton);
      return;
    }

    const paymentButton = event.target?.closest?.(
      '[data-v107-save-payment],[data-v107-mark-deposit]'
    );
    if (paymentButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handlePayment(paymentButton, paymentButton.hasAttribute('data-v107-mark-deposit'));
    }
  }, true);

  try {
    if (!window.__PHX_V240_LOADER__ && !document.querySelector('script[src="src/phoenix-v240-travel-fee-notifications.js"]')) {
      window.__PHX_V240_LOADER__ = true;
      const script = document.createElement('script');
      script.src = 'src/phoenix-v240-travel-fee-notifications.js';
      script.defer = true;
      script.dataset.phoenixPatch = 'v240-travel-fee-notifications';
      (document.currentScript?.parentNode || document.body || document.documentElement).appendChild(script);
    }
  } catch (error) {
    console.warn('Phoenix v240 patch loader skipped:', error);
  }

  try {
    if (!window.__PHX_V241_LOADER__ && !document.querySelector('script[src="src/phoenix-v241-order-modification.js"]')) {
      window.__PHX_V241_LOADER__ = true;
      const script = document.createElement('script');
      script.src = 'src/phoenix-v241-order-modification.js';
      script.defer = true;
      script.dataset.phoenixPatch = 'v241-order-modification';
      (document.currentScript?.parentNode || document.body || document.documentElement).appendChild(script);
    }
  } catch (error) {
    console.warn('Phoenix v241 patch loader skipped:', error);
  }
})();
