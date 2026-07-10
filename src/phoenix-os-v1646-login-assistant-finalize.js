/* Phoenix OS V164.6 — final login isolation + working dashboard assistant tools
   Purpose: remove legacy stacked login listeners, guarantee confirmed customer login path,
   and make the Admin/Staff Assistant buttons open real top-layer tools. */
(function phoenixOsV1646LoginAssistantFinalize(){
  if (window.__PHX_OS_V1646_LOGIN_ASSISTANT_FINALIZE__) return;
  window.__PHX_OS_V1646_LOGIN_ASSISTANT_FINALIZE__ = true;
  window.PHX_BUILD_VERSION = (window.PHX_BUILD_VERSION || 'V164') + '+V164.6_LOGIN_ASSISTANT_FINALIZE';

  const HOME_URL = 'https://phoenix-hibachi.com';
  const BUSINESS_PHONE = '+15165183325';
  const BUSINESS_PHONE_DISPLAY = '(516) 518-3325';
  const BOOKING_EMAIL = 'booking@phoenix-hibachi.com';
  const SUPPORT_EMAIL = 'support@phoenix-hibachi.com';
  const LAST_EMAIL_KEY = 'phx_last_confirmation_email_v1646';

  const cleanEmail = (value) => String(value || '').trim().toLowerCase();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function client(){
    try { return typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null; }
    catch { return null; }
  }
  function setLastEmail(email){
    const clean = cleanEmail(email);
    if (!clean) return;
    window.__PHX_LAST_CONFIRM_EMAIL__ = clean;
    try { localStorage.setItem(LAST_EMAIL_KEY, clean); } catch {}
    try { localStorage.setItem('phx_last_confirmation_email_v1645', clean); } catch {}
  }
  function getLastEmail(){
    return cleanEmail(
      window.__PHX_LAST_CONFIRM_EMAIL__ ||
      localStorage.getItem(LAST_EMAIL_KEY) ||
      localStorage.getItem('phx_last_confirmation_email_v1645') ||
      document.querySelector('#portalLoginForm input[type="email"]')?.value ||
      document.querySelector('#memberSignupForm input[name="email"]')?.value ||
      ''
    );
  }
  function roleToDashboard(role){
    const raw = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (raw === 'admin' || raw === 'owner') return 'Admin';
    if (raw === 'manager') return 'Manager';
    if (raw === 'customer_service' || raw === 'customerservice' || raw === 'staff' || raw === 'service') return 'Customer Service';
    if (raw === 'chef') return 'Chef';
    return 'Member';
  }
  function exactLoginMessage(error){
    const raw = String(error?.message || error || '').replace(/^Login failed:\s*/i,'').trim();
    if (/email\s+not\s+confirmed|not\s+confirmed/i.test(raw)) return 'Email not confirmed. Please open the Phoenix Hibachi confirmation email first, then tap “I already confirmed” or try login again.';
    if (/invalid\s+login\s+credentials|invalid\s+credentials/i.test(raw)) return 'Email or password is incorrect. If this account was just created, confirm the email first and then login again.';
    if (/no\s+matching\s+row|profiles|row-level|rls|permission/i.test(raw)) return 'Supabase Auth accepted the account, but the profile row is missing or blocked. Run the V164.6 Login Repair SQL once, then try again.';
    if (/failed\s+to\s+fetch|network|load/i.test(raw)) return 'Network connection to Supabase failed. Refresh the page and try again.';
    return raw || 'Login failed. Please check email, password, and confirmation status.';
  }
  function inlineError(form, message){
    if (!form) return;
    let box = form.querySelector('[data-v1646-login-error]');
    if (!box) {
      box = document.createElement('div');
      box.className = 'phx-v1646-login-error';
      box.setAttribute('data-v1646-login-error','');
      const btn = form.querySelector('button.gold-btn');
      if (btn) form.insertBefore(box, btn); else form.appendChild(box);
    }
    box.textContent = message || '';
    box.hidden = !message;
  }
  function showNotice(title, message, type='info'){
    try {
      if (typeof window.phoenixSystemNotice === 'function') {
        window.phoenixSystemNotice({ eyebrow: type === 'error' ? 'Action needed' : 'Phoenix notice', title, message });
        return;
      }
    } catch {}
    alert(`${title}\n\n${message}`);
  }
  function showConfirm(email, reason='unconfirmed', immediate=false){
    const clean = cleanEmail(email || getLastEmail());
    if (clean) setLastEmail(clean);
    if (typeof window.phoenixShowConfirmEmailFlow === 'function') {
      window.phoenixShowConfirmEmailFlow({ email: clean, reason, allowImmediateResend: !!immediate });
      setTimeout(() => {
        const dialog = document.getElementById('phxV1644ConfirmDialog');
        if (!dialog) return;
        const input = dialog.querySelector('[data-v1644-email-input]');
        if (input && clean) input.value = clean;
        const wrap = dialog.querySelector('[data-v1644-email-wrap]');
        if (wrap) wrap.style.display = 'none';
        let display = dialog.querySelector('[data-v1646-confirm-display]') || dialog.querySelector('[data-v1645-confirm-display]');
        if (!display) {
          display = document.createElement('div');
          display.className = 'phx-v1646-confirm-display';
          display.setAttribute('data-v1646-confirm-display','');
          const status = dialog.querySelector('[data-v1644-status]');
          if (status) status.parentNode.insertBefore(display, status); else dialog.querySelector('.phx-v1644-confirm-card')?.appendChild(display);
        }
        display.innerHTML = `<small>Confirmation email will be sent to</small><strong>${esc(clean || 'your registered email')}</strong>`;
        const msg = dialog.querySelector('[data-v1644-message]');
        if (msg) msg.textContent = reason === 'signup'
          ? 'Open the confirmation email and click the link before logging in. If it does not arrive, use Resend after the timer.'
          : 'This account exists, but it cannot log in until the confirmation link is clicked. No extra email entry is needed.';
        const done = dialog.querySelector('[data-v1644-done]');
        if (done) done.textContent = 'I already confirmed';
      }, 30);
      return;
    }
    showNotice('Confirm your email', `Please check the confirmation email sent to ${clean || 'your registered email'}.`, 'info');
  }
  async function ensureCustomerProfile(sb, user){
    if (!sb || !user?.id) return { role:'customer', account_status:'active', email:user?.email || '' };
    let profile = null;
    try {
      const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error && !/PGRST116/.test(error.code || error.message || '')) throw error;
      if (data) profile = data;
    } catch (readError) {
      console.warn('V164.6 profile read warning:', readError);
    }
    if (profile) return profile;

    const payload = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0] || 'Member',
      phone: user.user_metadata?.phone || '',
      role: user.user_metadata?.requested_role === 'chef' ? 'chef' : 'customer',
      account_status: user.user_metadata?.requested_role === 'chef' ? 'pending' : 'active',
      updated_at: new Date().toISOString()
    };
    try {
      const { data, error } = await sb.from('profiles').upsert(payload).select('*').maybeSingle();
      if (error) throw error;
      return data || payload;
    } catch (writeError) {
      console.warn('V164.6 profile upsert warning, opening safe member fallback:', writeError);
      return payload;
    }
  }
  async function loginWithSupabase(email, password){
    const sb = client();
    if (!sb?.auth?.signInWithPassword) throw new Error('Supabase Auth is not loaded. Refresh the page and try again.');

    // Prefer legacy signInPortal first because it sets the original dashboard session variables used by old code.
    if (typeof window.signInPortal === 'function') {
      try {
        const profile = await window.signInPortal(email, password);
        if (profile) return profile;
      } catch (legacyError) {
        const raw = String(legacyError?.message || legacyError || '');
        if (/email\s+not\s+confirmed|not\s+confirmed|invalid\s+login\s+credentials/i.test(raw)) throw legacyError;
        console.warn('V164.6 legacy signInPortal fallback:', legacyError);
      }
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Supabase did not return a valid user session.');
    const profile = await ensureCustomerProfile(sb, data.user);
    const status = String(profile?.account_status || 'active').toLowerCase();
    if (status && status !== 'active') {
      try { await sb.auth.signOut(); } catch {}
      throw new Error(`This account is ${profile.account_status}. It must be approved before login.`);
    }
    try { window.supabaseSession = data.session; } catch {}
    try { window.supabaseProfile = profile; } catch {}
    return profile;
  }
  async function openDashboard(profile, email){
    const role = roleToDashboard(profile?.role || 'customer');
    try { if (typeof window.setPortalSessionMeta === 'function') window.setPortalSessionMeta(role, email || profile?.email || ''); } catch {}
    try { document.getElementById('loginModal')?.close?.(); } catch {}
    try { if (typeof window.loadDashboardDataFromSupabase === 'function') await window.loadDashboardDataFromSupabase(); } catch (error) { console.warn('V164.6 dashboard data warning:', error); }
    try { if (typeof window.renderDashboard === 'function') window.renderDashboard(role); } catch (error) { console.warn('V164.6 render warning:', error); }
    const modal = document.getElementById('dashboardModal');
    try { if (modal?.showModal && !modal.open) modal.showModal(); } catch {}
    setTimeout(() => {
      try { if (typeof window.renderDashboard === 'function') window.renderDashboard(role); } catch {}
      try { if (modal?.showModal && !modal.open) modal.showModal(); } catch {}
    }, 150);
  }

  async function handlePortalLoginSubmit(event, form){
    if (!form) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const email = cleanEmail(form.querySelector('input[type="email"]')?.value || '');
    const password = form.querySelector('input[type="password"]')?.value || '';
    setLastEmail(email);
    inlineError(form, '');
    if (!email || !password) { inlineError(form, 'Enter email and password first.'); return false; }
    const btn = form.querySelector('button.gold-btn');
    const oldText = btn?.textContent || 'Login';
    if (btn) { btn.disabled = true; btn.textContent = 'Logging in…'; }
    try {
      const profile = await loginWithSupabase(email, password);
      await openDashboard(profile, email);
    } catch (error) {
      const msg = exactLoginMessage(error);
      inlineError(form, msg);
      if (/confirm|not\s+confirmed/i.test(msg)) showConfirm(email, 'unconfirmed', true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText; }
    }
    return false;
  }

  window.addEventListener('submit', (event) => {
    const form = event.target?.closest?.('#portalLoginForm');
    if (!form) return;
    handlePortalLoginSubmit(event, form);
  }, true);

  function isolateLoginForm(){
    const oldForm = document.getElementById('portalLoginForm');
    if (!oldForm || oldForm.dataset.v1646Isolated === '1') return oldForm;
    const form = oldForm.cloneNode(true);
    form.dataset.v1646Isolated = '1';
    oldForm.replaceWith(form);

    form.addEventListener('submit', (event) => handlePortalLoginSubmit(event, form), true);

    form.addEventListener('click', (event) => {
      const target = event.target;
      if (target.closest('[data-close-modal]')) {
        event.preventDefault();
        try { document.getElementById('loginModal')?.close?.(); } catch {}
        return;
      }
      if (target.closest('#forgotPasswordBtn')) {
        event.preventDefault();
        try { document.getElementById('forgotPasswordModal')?.showModal?.(); } catch {}
        return;
      }
      if (target.closest('#loginApplyActionBtn,[data-login-apply]')) {
        event.preventDefault();
        try { document.getElementById('loginModal')?.close?.(); } catch {}
        try { document.getElementById('memberSignupModal')?.showModal?.(); } catch {}
      }
    }, true);
    return form;
  }

  function ensureAssistantDialog(){
    let dialog = document.getElementById('phxV1646AssistantDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxV1646AssistantDialog';
    dialog.className = 'phx-v1646-assistant-dialog';
    dialog.innerHTML = `
      <section class="phx-v1646-assistant-card" role="dialog" aria-modal="true" aria-labelledby="phxV1646AssistantTitle">
        <button type="button" class="phx-v1646-x" data-v1646-close aria-label="Close">×</button>
        <p class="phx-v1646-eyebrow">Phoenix Staff Assistant</p>
        <h3 id="phxV1646AssistantTitle">Quick staff tools</h3>
        <p class="phx-v1646-help">This is a built-in assistant helper for staff. It can open booking tools, contact tools, and show quick operating reminders. OpenAI live chat can be connected later.</p>
        <div class="phx-v1646-tool-grid">
          <button type="button" data-v1646-tool="orders">Review orders</button>
          <button type="button" data-v1646-tool="contact">Contact customer</button>
          <button type="button" data-v1646-tool="booking">New booking</button>
          <button type="button" data-v1646-tool="policy">Policy reminder</button>
        </div>
        <div class="phx-v1646-answer" data-v1646-answer>Choose a tool above.</div>
      </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-v1646-close]')) {
        event.preventDefault();
        try { dialog.close(); } catch {}
        return;
      }
      const tool = event.target.closest('[data-v1646-tool]')?.dataset?.v1646Tool;
      if (!tool) return;
      event.preventDefault();
      const answer = dialog.querySelector('[data-v1646-answer]');
      if (tool === 'orders') {
        answer.innerHTML = 'Use <b>Order details / edit</b> to check date, time, address, guest count, proteins, allergies, payment, and chef notes. Use <b>Payment / price</b> for final balance.';
      } else if (tool === 'contact') {
        answer.innerHTML = `Use customer row <b>SMS</b> or <b>Email</b> buttons. SMS opens the device text app; automatic Quo sending needs the future Quo API/Worker integration.`;
        try { document.getElementById('contactModal')?.showModal?.(); } catch {}
      } else if (tool === 'booking') {
        answer.innerHTML = 'Opening the booking form. For staff-created orders, still confirm date, ZIP, guest count, package, allergies, rain plan, and deposit status.';
        try { dialog.close(); } catch {}
        try { if (typeof window.openBookingModal === 'function') window.openBookingModal({ package:'Phoenix Hibachi event' }); } catch {}
      } else if (tool === 'policy') {
        answer.innerHTML = '<b>72-hour policy:</b> deposits are applied toward final balance. Cancellations within 72 hours may be non-refundable. Rescheduling is subject to availability and must be confirmed by Phoenix Hibachi.';
      }
    }, true);
    return dialog;
  }
  function ensureContactToolsDialog(){
    let dialog = document.getElementById('phxV1646ContactToolsDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxV1646ContactToolsDialog';
    dialog.className = 'phx-v1646-contact-dialog';
    const smsText = encodeURIComponent('Hi, this is Phoenix Hibachi. We received your booking request. Please reply with event date, ZIP code, guest count, and preferred time.');
    const emailSubject = encodeURIComponent('Phoenix Hibachi booking follow-up');
    const emailBody = encodeURIComponent(`Hi,\n\nThank you for contacting Phoenix Hibachi. Please send your event date, ZIP code, guest count, preferred time, and any allergies or special notes.\n\nPhoenix Hibachi\n${BUSINESS_PHONE_DISPLAY}\nhttps://phoenix-hibachi.com`);
    dialog.innerHTML = `
      <section class="phx-v1646-contact-card" role="dialog" aria-modal="true" aria-labelledby="phxV1646ContactTitle">
        <button type="button" class="phx-v1646-x" data-v1646-close aria-label="Close">×</button>
        <p class="phx-v1646-eyebrow">Contact tools</p>
        <h3 id="phxV1646ContactTitle">Phoenix contact shortcuts</h3>
        <p class="phx-v1646-help">These buttons open your device phone, SMS app, or Gmail compose. Quo auto-send will require a later private API integration.</p>
        <div class="phx-v1646-contact-list">
          <a href="tel:${BUSINESS_PHONE}"><b>Call Phoenix Hibachi</b><span>${BUSINESS_PHONE_DISPLAY}</span></a>
          <a href="sms:${BUSINESS_PHONE}?&body=${smsText}"><b>Text from device</b><span>Opens SMS app</span></a>
          <a target="_blank" rel="noreferrer" href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(BOOKING_EMAIL)}&su=${emailSubject}&body=${emailBody}"><b>Open Gmail compose</b><span>${BOOKING_EMAIL}</span></a>
          <a href="mailto:${SUPPORT_EMAIL}"><b>Support email</b><span>${SUPPORT_EMAIL}</span></a>
        </div>
      </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-v1646-close]')) { event.preventDefault(); try { dialog.close(); } catch {} }
    }, true);
    return dialog;
  }
  function bindDashboardAssistantButtons(){
    const assistantBtn = document.getElementById('dashAssistantBtn');
    const panel = document.getElementById('dashboardAssistantPanel');
    const closeBtn = document.getElementById('dashAssistantCloseBtn');
    const fullBtn = document.getElementById('dashAssistantOpenPublicBtn');
    const contactBtn = panel?.querySelector('[data-open-contact]');
    if (assistantBtn && !assistantBtn.dataset.v1646Bound) {
      assistantBtn.dataset.v1646Bound = '1';
      assistantBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (panel) panel.hidden = !panel.hidden;
      }, true);
    }
    if (closeBtn && !closeBtn.dataset.v1646Bound) {
      closeBtn.dataset.v1646Bound = '1';
      closeBtn.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); if (panel) panel.hidden = true; }, true);
    }
    if (fullBtn && !fullBtn.dataset.v1646Bound) {
      fullBtn.dataset.v1646Bound = '1';
      fullBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const dialog = ensureAssistantDialog();
        try { if (!dialog.open) dialog.showModal(); } catch { dialog.setAttribute('open',''); }
      }, true);
    }
    if (contactBtn && !contactBtn.dataset.v1646Bound) {
      contactBtn.dataset.v1646Bound = '1';
      contactBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const dialog = ensureContactToolsDialog();
        try { if (!dialog.open) dialog.showModal(); } catch { dialog.setAttribute('open',''); }
      }, true);
    }
  }

  function boot(){
    isolateLoginForm();
    bindDashboardAssistantButtons();
    setTimeout(bindDashboardAssistantButtons, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
  setInterval(() => { isolateLoginForm(); bindDashboardAssistantButtons(); }, 1200);
})();
