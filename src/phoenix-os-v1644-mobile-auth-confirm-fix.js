/* Phoenix OS V164.4 — mobile overlay + confirmation resend + reliable login
   No SQL required for CSS/UX. Companion SQL is only a safe profile backfill/repair. */
(function phoenixOsV1644MobileAuthConfirmFix(){
  if (window.__PHX_OS_V1644_MOBILE_AUTH_CONFIRM_FIX__) return;
  window.__PHX_OS_V1644_MOBILE_AUTH_CONFIRM_FIX__ = true;
  window.PHX_BUILD_VERSION = (window.PHX_BUILD_VERSION || 'V164') + '+V164.4_MOBILE_AUTH_CONFIRM_FIX';

  const HOME_URL = 'https://phoenix-hibachi.com';
  const RESEND_SECONDS = 60;
  const previousAlert = window.alert ? window.alert.bind(window) : null;

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function cleanEmail(value){ return String(value || '').trim().toLowerCase(); }
  function getClient(){
    try { return typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null; }
    catch { return null; }
  }
  function getLoginForm(){ return document.getElementById('portalLoginForm'); }
  function getLoginEmail(){
    return cleanEmail(getLoginForm()?.querySelector('input[type="email"]')?.value || document.querySelector('#memberSignupForm input[name="email"]')?.value || '');
  }
  function isEmailConfirmText(text){
    return /account\s+created|confirm\s+email|email\s+confirmation|not\s+confirmed|confirmation\s+email|pending\s+email/i.test(String(text || ''));
  }
  function isLoginFailureText(text){
    return /login\s+failed|invalid\s+login|invalid\s+credentials|not\s+in\s+supabase|password\s+does\s+not\s+match|no\s+matching\s+row/i.test(String(text || ''));
  }
  function exactLoginMessage(error){
    const raw = String(error?.message || error || '').trim();
    if (/email\s+not\s+confirmed|not\s+confirmed/i.test(raw)) {
      return 'This account has not confirmed its email yet. Please open the Phoenix Hibachi confirmation email first.';
    }
    if (/invalid\s+login\s+credentials|invalid\s+credentials/i.test(raw)) {
      return 'Email or password is incorrect. If you just registered, confirm your email first, then try again.';
    }
    if (/no\s+matching\s+row|profiles/i.test(raw)) {
      return 'Login reached Supabase Auth, but the customer profile row is missing or blocked by RLS. Run the V164.4 profile repair SQL, then try again.';
    }
    if (/failed\s+to\s+fetch|network/i.test(raw)) {
      return 'Network connection to Supabase failed. Check internet connection and refresh the page.';
    }
    return raw || 'Login failed. Please check the email, password, and email confirmation status.';
  }
  function normalizeRole(value){
    const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (raw === 'admin' || raw === 'owner') return 'Admin';
    if (raw === 'manager') return 'Manager';
    if (raw === 'customer_service' || raw === 'staff' || raw === 'service') return 'Customer Service';
    if (raw === 'chef') return 'Chef';
    return 'Member';
  }
  function setInlineLoginError(message){
    const form = getLoginForm();
    if (!form) return;
    let box = form.querySelector('[data-v1644-login-error]');
    if (!box) {
      box = document.createElement('div');
      box.className = 'phx-v1644-login-error';
      box.setAttribute('data-v1644-login-error','');
      const loginBtn = form.querySelector('button.gold-btn');
      if (loginBtn) form.insertBefore(box, loginBtn); else form.appendChild(box);
    }
    box.textContent = message || '';
    box.hidden = !message;
  }
  function clearInlineLoginError(){ setInlineLoginError(''); }

  function ensureConfirmDialog(){
    let dialog = document.getElementById('phxV1644ConfirmDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxV1644ConfirmDialog';
    dialog.className = 'phx-v1644-confirm-dialog';
    dialog.innerHTML = `
      <section class="phx-v1644-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="phxV1644ConfirmTitle">
        <button type="button" class="phx-v1644-close" data-v1644-confirm-close aria-label="Close">×</button>
        <p class="phx-v1644-eyebrow" data-v1644-eyebrow>Account created</p>
        <h3 id="phxV1644ConfirmTitle" data-v1644-title>Confirm your email</h3>
        <p data-v1644-message></p>
        <label data-v1644-email-wrap>Email for confirmation
          <input type="email" data-v1644-email-input placeholder="email@example.com" autocomplete="email">
        </label>
        <div class="phx-v1644-status" data-v1644-status></div>
        <div class="phx-v1644-confirm-actions">
          <button type="button" class="primary" data-v1644-resend>Resend confirmation email</button>
          <button type="button" class="secondary" data-v1644-done>I already confirmed</button>
        </div>
      </section>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  function startCountdown(button, status, seconds = RESEND_SECONDS){
    let left = seconds;
    const old = button.dataset.readyText || button.textContent || 'Resend confirmation email';
    button.dataset.readyText = old;
    button.disabled = true;
    const tick = () => {
      if (left <= 0) {
        button.disabled = false;
        button.textContent = old;
        status.textContent = 'Still no email? You can resend now. Also check Spam/Junk.';
        return;
      }
      button.textContent = `Resend available in ${left}s`;
      status.textContent = `Please check Inbox and Spam/Junk. Resend will unlock in ${left}s.`;
      left -= 1;
      window.setTimeout(tick, 1000);
    };
    tick();
  }
  async function resendConfirmation(email, status){
    const clean = cleanEmail(email || getLoginEmail());
    if (!clean) throw new Error('Enter the account email first.');
    const client = getClient();
    if (!client?.auth?.resend) throw new Error('Supabase resend is not available. Refresh the page and try again.');
    const { error } = await client.auth.resend({
      type: 'signup',
      email: clean,
      options: { emailRedirectTo: HOME_URL }
    });
    if (error) throw error;
    if (status) status.textContent = `Confirmation email sent to ${clean}. Check Inbox and Spam/Junk.`;
  }
  function showConfirmFlow({ email='', reason='signup', allowImmediateResend=false } = {}){
    const dialog = ensureConfirmDialog();
    const title = dialog.querySelector('[data-v1644-title]');
    const eyebrow = dialog.querySelector('[data-v1644-eyebrow]');
    const message = dialog.querySelector('[data-v1644-message]');
    const input = dialog.querySelector('[data-v1644-email-input]');
    const status = dialog.querySelector('[data-v1644-status]');
    const resend = dialog.querySelector('[data-v1644-resend]');
    const done = dialog.querySelector('[data-v1644-done]');
    const close = dialog.querySelector('[data-v1644-confirm-close]');
    const clean = cleanEmail(email || getLoginEmail());

    eyebrow.textContent = reason === 'unconfirmed' ? 'Email not confirmed' : 'Account created';
    title.textContent = 'Confirm your email';
    message.textContent = reason === 'unconfirmed'
      ? 'This account exists, but it cannot log in until the email confirmation link is clicked. Enter the same email below if you need a new confirmation email.'
      : 'Your Phoenix Hibachi account was created. Open the confirmation email and click the link before logging in. If it does not arrive, wait for the timer and resend it here.';
    input.value = clean;
    status.textContent = '';
    resend.disabled = false;
    resend.textContent = 'Resend confirmation email';

    resend.onclick = async () => {
      try {
        resend.disabled = true;
        resend.textContent = 'Sending…';
        await resendConfirmation(input.value, status);
        startCountdown(resend, status, RESEND_SECONDS);
      } catch (error) {
        resend.disabled = false;
        resend.textContent = 'Resend confirmation email';
        status.textContent = error?.message || String(error);
      }
    };
    done.onclick = () => { try { dialog.close(); } catch { dialog.removeAttribute('open'); } };
    close.onclick = done.onclick;
    if (!allowImmediateResend) startCountdown(resend, status, RESEND_SECONDS);
    try { if (!dialog.open) dialog.showModal(); } catch { dialog.setAttribute('open',''); }
    setTimeout(() => { try { input.focus(); input.select(); } catch {} }, 100);
  }
  window.phoenixShowConfirmEmailFlow = showConfirmFlow;
  window.phoenixResendConfirmationEmailV1644 = resendConfirmation;

  window.alert = function phoenixV1644Alert(message){
    const text = String(message ?? '');
    if (isEmailConfirmText(text)) {
      showConfirmFlow({ email:getLoginEmail(), reason:'signup', allowImmediateResend:false });
      return;
    }
    if (isLoginFailureText(text)) {
      const msg = exactLoginMessage(text.replace(/^Login failed:\s*/i, ''));
      setInlineLoginError(msg);
      if (/not\s+confirmed|confirm/i.test(msg)) showConfirmFlow({ email:getLoginEmail(), reason:'unconfirmed', allowImmediateResend:true });
      return;
    }
    if (typeof window.phoenixSystemNotice === 'function') {
      window.phoenixSystemNotice({ title:'Phoenix Hibachi', message:text || 'Done', eyebrow:'System notice' });
      return;
    }
    if (previousAlert) previousAlert(text);
  };

  function openDashboard(role, email){
    const uiRole = normalizeRole(role);
    try { if (typeof setPortalSessionMeta === 'function') setPortalSessionMeta(uiRole, email || ''); } catch {}
    try { localStorage.setItem('phoenixPortalPreferredTabV1', uiRole === 'Customer Service' ? 'orders' : ''); } catch {}
    try { document.getElementById('loginModal')?.close(); } catch {}
    if (typeof isPortalRoute === 'function' && isPortalRoute()) {
      try { renderDashboard(uiRole); } catch (error) { console.warn('Dashboard render warning:', error); }
      try {
        const modal = document.getElementById('dashboardModal');
        if (modal && typeof modal.showModal === 'function' && !modal.open) modal.showModal();
      } catch {}
    } else if (typeof openPortalInNewTab === 'function') {
      openPortalInNewTab();
    } else {
      window.location.hash = '#portal';
    }
  }
  async function ensureProfile(client, user){
    if (!client || !user?.id) return null;
    let result = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (result.error && result.error.code !== 'PGRST116') throw result.error;
    if (result.data) return result.data;
    const payload = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || (user.email || '').split('@')[0] || 'Member',
      phone: user.user_metadata?.phone || '',
      role: user.user_metadata?.requested_role === 'chef' ? 'chef' : 'customer',
      account_status: user.user_metadata?.requested_role === 'chef' ? 'pending' : 'active',
      updated_at: new Date().toISOString()
    };
    const upsert = await client.from('profiles').upsert(payload).select('*').maybeSingle();
    if (upsert.error) throw upsert.error;
    return upsert.data || payload;
  }
  async function reliableLogin(email, password){
    const client = getClient();
    if (!client?.auth?.signInWithPassword) throw new Error('Supabase Auth is not loaded. Refresh the page and try again.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Supabase did not return a valid user session.');
    const profile = await ensureProfile(client, data.user);
    if (!profile) throw new Error('Login worked, but the profile could not be loaded.');
    const status = String(profile.account_status || 'active').toLowerCase();
    if (status && status !== 'active') {
      try { await client.auth.signOut(); } catch {}
      throw new Error(`This account is ${profile.account_status}. It must be approved before login.`);
    }
    try { window.supabaseSession = data.session; } catch {}
    try { window.supabaseProfile = profile; } catch {}
    try { if (typeof loadDashboardDataFromSupabase === 'function') await loadDashboardDataFromSupabase(); } catch (loadError) { console.warn('Dashboard data load warning:', loadError); }
    return profile;
  }

  window.addEventListener('submit', async (event) => {
    const form = event.target?.closest?.('#portalLoginForm');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const email = cleanEmail(form.querySelector('input[type="email"]')?.value || '');
    const password = form.querySelector('input[type="password"]')?.value || '';
    clearInlineLoginError();
    if (!email || !password) {
      setInlineLoginError('Enter email and password first.');
      return;
    }
    const btn = form.querySelector('button.gold-btn');
    const old = btn?.textContent || 'Login';
    if (btn) { btn.disabled = true; btn.textContent = 'Logging in…'; }
    try {
      const profile = await reliableLogin(email, password);
      openDashboard(profile.role || 'customer', email);
    } catch (error) {
      const msg = exactLoginMessage(error);
      setInlineLoginError(msg);
      if (/not\s+confirmed|confirm/i.test(msg)) showConfirmFlow({ email, reason:'unconfirmed', allowImmediateResend:true });
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }, true);

  function syncMobileMenuState(){
    const nav = document.getElementById('mobileNav');
    document.body.classList.toggle('phx-mobile-menu-open', !!nav?.classList.contains('open'));
  }
  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#menuBtn, #mobileNav')) setTimeout(syncMobileMenuState, 30);
  }, true);
  const nav = document.getElementById('mobileNav');
  if (nav) {
    try { new MutationObserver(syncMobileMenuState).observe(nav, { attributes:true, attributeFilter:['class'] }); } catch {}
  }

  function boot(){
    document.querySelectorAll('.phx-v1642-login-helper').forEach(el => el.remove());
    syncMobileMenuState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
