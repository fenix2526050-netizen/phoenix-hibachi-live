/* Phoenix Hibachi V164.2 — Auth/Profile finish
   Safe front-end patch. Requires the companion SQL only for persistent avatar_url/profile policies.
*/
(function initPhoenixV1642AuthProfileFinish(){
  if (window.__PHX_V1642_AUTH_PROFILE_FINISH__) return;
  window.__PHX_V1642_AUTH_PROFILE_FINISH__ = true;
  window.PHX_BUILD_VERSION = 'V164_2_AUTH_PROFILE_FINISH';

  const HOME_URL = 'https://phoenix-hibachi.com';
  const AVATAR_BUCKET = 'profile-avatars';
  const AVATAR_PREFIX = 'phoenix_member_avatar_v133_';
  const PORTAL_META_KEYS = [
    'phoenixPortalSessionMetaV1',
    'phoenixPortalPreferredTabV1',
    'phoenix_portal_email',
    'phoenix_portal_role'
  ];
  const nativeAlert = window.alert ? window.alert.bind(window) : null;

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
  function getClient(){
    try { return typeof window.initSupabaseClient === 'function' ? window.initSupabaseClient() : null; }
    catch { return null; }
  }
  function cleanEmail(email){ return String(email || '').trim().toLowerCase(); }
  function currentLoginEmail(){
    const selectors = [
      '#portalLoginForm input[type="email"]',
      '#memberSignupForm input[name="email"]',
      '#chefApplyForm input[name="email"]',
      '#forgotPasswordForm input[type="email"]',
      '#changePasswordForm input[name="email"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = cleanEmail(el?.value);
      if (value) return value;
    }
    try { return cleanEmail(window.supabaseSession?.user?.email || window.supabaseProfile?.email || JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1') || '{}')?.email); }
    catch { return ''; }
  }

  function ensureSystemDialog(){
    let dialog = document.getElementById('phxV1642SystemDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'phxV1642SystemDialog';
    dialog.className = 'phx-v1642-system-dialog';
    dialog.innerHTML = `
      <section class="phx-v1642-system-card" role="alertdialog" aria-modal="true" aria-labelledby="phxV1642SystemTitle">
        <button type="button" class="phx-v1642-close" data-v1642-close aria-label="Close">×</button>
        <p class="phx-v1642-eyebrow" data-v1642-eyebrow>Phoenix Hibachi</p>
        <h3 id="phxV1642SystemTitle" data-v1642-title>Notice</h3>
        <p data-v1642-message></p>
        <div class="phx-v1642-system-actions" data-v1642-actions></div>
      </section>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function showSystemNotice({ title='Notice', message='', eyebrow='Phoenix Hibachi', actions=[] } = {}){
    return new Promise(resolve => {
      const dialog = ensureSystemDialog();
      dialog.querySelector('[data-v1642-eyebrow]').textContent = eyebrow;
      dialog.querySelector('[data-v1642-title]').textContent = title;
      dialog.querySelector('[data-v1642-message]').textContent = message;
      const actionsBox = dialog.querySelector('[data-v1642-actions]');
      actionsBox.innerHTML = '';
      const close = (value) => {
        try { dialog.close(); } catch { dialog.removeAttribute('open'); }
        resolve(value);
      };
      const closeBtn = dialog.querySelector('[data-v1642-close]');
      closeBtn.onclick = () => close('close');
      const configured = Array.isArray(actions) && actions.length ? actions : [{ label:'Got it', value:'ok', primary:true }];
      configured.forEach(action => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `phx-v1642-btn ${action.primary === false ? 'secondary' : ''}`;
        btn.textContent = action.label || 'OK';
        btn.addEventListener('click', async () => {
          if (typeof action.onClick === 'function') {
            btn.disabled = true;
            const old = btn.textContent;
            if (action.loadingText) btn.textContent = action.loadingText;
            try {
              const keepOpen = await action.onClick();
              if (keepOpen === true) { btn.disabled = false; btn.textContent = old; return; }
            } catch (error) {
              btn.disabled = false;
              btn.textContent = old;
              showSystemNotice({ title:'Action failed', message: error?.message || String(error), eyebrow:'Phoenix Hibachi' });
              return;
            }
          }
          close(action.value || action.label || 'ok');
        });
        actionsBox.appendChild(btn);
      });
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); close('escape'); }, { once:true });
      try { if (!dialog.open) dialog.showModal(); }
      catch { dialog.setAttribute('open',''); }
    });
  }
  window.phoenixSystemNotice = showSystemNotice;

  function looksEmailUnconfirmed(message){
    const raw = String(message || '');
    return /email\s+not\s+confirmed|not\s+confirmed|confirm\s+your\s+email|email\s+confirmation/i.test(raw);
  }
  async function resendConfirmation(email){
    const clean = cleanEmail(email || currentLoginEmail());
    if (!clean) throw new Error('Enter the account email first, then click resend confirmation.');
    const client = getClient();
    if (!client?.auth?.resend) throw new Error('Supabase resend is not available on this browser. Refresh the page and try again.');
    const { error } = await client.auth.resend({
      type: 'signup',
      email: clean,
      options: { emailRedirectTo: HOME_URL }
    });
    if (error) throw error;
    await showSystemNotice({
      title: 'Confirmation email sent',
      message: `We sent a new confirmation email to ${clean}. Please check Inbox, Spam/Junk, and Promotions. After confirming, return to Phoenix Hibachi and log in again.`,
      eyebrow: 'Check your email'
    });
  }
  window.phoenixResendConfirmationEmail = resendConfirmation;

  function normalizeAlertText(raw){
    const text = String(raw ?? '').replace(/^Login failed:\s*/i, '').trim();
    if (looksEmailUnconfirmed(text)) {
      return {
        title: 'Confirm your email first',
        eyebrow: 'Account not activated',
        message: 'Your account was created, but the email has not been confirmed yet. Please open the confirmation email and click the link before logging in. If you did not receive it, resend the confirmation email.',
        emailConfirm: true
      };
    }
    if (/account\s+created|member\s+portal\s+account\s+created|confirm\s+email/i.test(text)) {
      return {
        title: 'Check your email',
        eyebrow: 'Account created',
        message: 'Your account was created. Please check your email and click the confirmation link before logging in. If you do not see it, check Spam/Junk or use Resend confirmation.',
        emailConfirm: true
      };
    }
    return { title:'Phoenix Hibachi', eyebrow:'System notice', message:text || 'Done', emailConfirm:false };
  }

  window.alert = function phoenixV1642Alert(message){
    const normalized = normalizeAlertText(message);
    if (normalized.emailConfirm) {
      return showSystemNotice({
        title: normalized.title,
        eyebrow: normalized.eyebrow,
        message: normalized.message,
        actions: [
          { label:'Resend confirmation email', loadingText:'Sending…', primary:true, onClick: async () => { await resendConfirmation(currentLoginEmail()); } },
          { label:'Got it', primary:false, value:'ok' }
        ]
      });
    }
    return showSystemNotice(normalized);
  };

  function addLoginHelper(){
    const form = document.getElementById('portalLoginForm');
    if (!form || form.querySelector('[data-v1642-login-helper]')) return;
    const helper = document.createElement('div');
    helper.className = 'phx-v1642-login-helper';
    helper.setAttribute('data-v1642-login-helper','');
    helper.innerHTML = `
      <strong>New customer account?</strong><br>
      Please confirm your email before logging in. No email? Check Spam/Junk or resend it below.<br>
      <button type="button" data-v1642-resend-confirmation>Resend confirmation email</button>`;
    form.appendChild(helper);
  }

  document.addEventListener('click', async (event) => {
    const resend = event.target?.closest?.('[data-v1642-resend-confirmation]');
    if (!resend) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      resend.disabled = true;
      const old = resend.textContent;
      resend.textContent = 'Sending…';
      await resendConfirmation(currentLoginEmail());
      resend.textContent = old;
    } catch (error) {
      showSystemNotice({ title:'Could not resend', message:error?.message || String(error), eyebrow:'Phoenix Hibachi' });
    } finally {
      resend.disabled = false;
    }
  }, true);

  function removeAuthStorage(){
    const shouldRemove = key => {
      const k = String(key || '');
      return PORTAL_META_KEYS.includes(k)
        || /^sb-[a-z0-9]+-auth-token$/i.test(k)
        || /supabase\.auth\.token/i.test(k)
        || /^phoenix_portal_(email|role|session)$/i.test(k);
    };
    [localStorage, sessionStorage].forEach(store => {
      try {
        for (let i = store.length - 1; i >= 0; i--) {
          const key = store.key(i);
          if (shouldRemove(key)) store.removeItem(key);
        }
      } catch {}
    });
  }
  function resetAccountUI(){
    try { window.supabaseSession = null; } catch {}
    try { window.supabaseProfile = null; } catch {}
    try { window.remoteOrdersCache = null; } catch {}
    try { window.remoteChefApplicationsCache = null; } catch {}
    document.body.classList.add('phx-v1642-logging-out');
    document.body.classList.remove('portal-mode');
    document.querySelectorAll('.login-entry, .mobile-login-entry').forEach(el => {
      el.hidden = false;
      el.style.display = '';
      el.setAttribute('aria-hidden','false');
    });
    document.querySelectorAll('#portalAccount,#mobilePortalEntry,.portal-account').forEach(el => {
      el.hidden = true;
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
    });
    try { if (typeof window.closeAccountDropdown === 'function') window.closeAccountDropdown(); } catch {}
    ['dashboardModal','loginModal','changePasswordModal','forgotPasswordModal','memberSignupModal','chefApplyModal'].forEach(id => {
      try { const el = window[id] || document.getElementById(id); if (el?.open) el.close(); } catch {}
    });
    try { if (typeof window.updateAccountMenuState === 'function') window.updateAccountMenuState(); } catch {}
    setTimeout(() => document.body.classList.remove('phx-v1642-logging-out'), 1500);
  }
  async function robustSignOut({message='', redirect=true} = {}){
    document.body.classList.add('phx-v1642-logging-out');
    const client = getClient();
    try { if (client?.auth?.signOut) await client.auth.signOut({ scope:'local' }); } catch {}
    removeAuthStorage();
    resetAccountUI();
    if (message) await showSystemNotice({ title:'Logged out', message, eyebrow:'Phoenix Hibachi' });
    if (redirect) {
      const target = (typeof window.cleanIndexUrl === 'function') ? window.cleanIndexUrl() : HOME_URL;
      setTimeout(() => { window.location.replace(target); }, 180);
    }
  }
  window.phoenixRobustLogout = robustSignOut;

  const originalSignOutPortal = window.signOutPortal;
  if (typeof originalSignOutPortal === 'function') {
    window.signOutPortal = async function patchedSignOutPortal(reason = ''){
      try { await originalSignOutPortal.call(this, ''); } catch {}
      await robustSignOut({ message: reason || '', redirect:false });
    };
  }
  const originalSignOutAndClosePortal = window.signOutAndClosePortal;
  if (typeof originalSignOutAndClosePortal === 'function') {
    window.signOutAndClosePortal = async function patchedSignOutAndClosePortal(){
      try { await originalSignOutAndClosePortal.call(this); } catch {}
      await robustSignOut({ redirect:true });
    };
  }

  document.addEventListener('click', async (event) => {
    const logout = event.target?.closest?.('[data-portal-logout], [data-account-action="logout"]');
    if (!logout) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await robustSignOut({ message:'You have been logged out of Phoenix Hibachi.', redirect:true });
  }, true);

  function emailForAvatar(){
    return cleanEmail(window.supabaseSession?.user?.email || window.supabaseProfile?.email || currentLoginEmail() || 'local-member') || 'local-member';
  }
  function avatarKey(){ return AVATAR_PREFIX + emailForAvatar(); }
  function setLocalAvatar(url){
    try {
      if (url) localStorage.setItem(avatarKey(), url);
      else localStorage.removeItem(avatarKey());
    } catch {}
  }
  function initials(){
    const name = window.supabaseProfile?.full_name || emailForAvatar() || 'Member';
    return String(name).trim().charAt(0).toUpperCase() || 'M';
  }
  function refreshAvatarDom(url){
    document.querySelectorAll('[data-member-avatar-preview-v133],[data-member-profile-avatar-v133]').forEach(target => {
      target.innerHTML = url ? `<img src="${esc(url)}" alt="Profile photo">` : `<span>${esc(initials())}</span>`;
    });
  }
  function setAvatarStatus(message, type='ok'){
    const block = document.querySelector('[data-member-avatar-block-v133]');
    if (!block) return;
    let status = block.querySelector('[data-v1642-avatar-status]');
    if (!status) {
      status = document.createElement('div');
      status.className = 'phx-v1642-avatar-status';
      status.setAttribute('data-v1642-avatar-status','');
      block.appendChild(status);
    }
    status.className = `phx-v1642-avatar-status ${type}`;
    status.textContent = message || '';
  }
  async function currentSessionAndProfile(){
    const client = getClient();
    if (!client) return { client:null, session:null, user:null, profile:null };
    const { data } = await client.auth.getSession().catch(() => ({ data:null }));
    const session = data?.session || window.supabaseSession || null;
    const user = session?.user || window.supabaseSession?.user || null;
    let profile = window.supabaseProfile || null;
    if (user?.id && client.from) {
      try {
        const res = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (res?.data) {
          profile = res.data;
          try { window.supabaseProfile = profile; } catch {}
        }
      } catch {}
    }
    return { client, session, user, profile };
  }
  async function syncAvatarFromSupabase(){
    const { profile } = await currentSessionAndProfile();
    const url = profile?.avatar_url || '';
    if (url) {
      setLocalAvatar(url);
      refreshAvatarDom(url);
    }
  }
  async function uploadAvatar(file){
    const { client, user } = await currentSessionAndProfile();
    if (!client || !user?.id) throw new Error('Please log in before saving a profile photo.');
    if (!file || !file.type?.startsWith('image/')) throw new Error('Please choose an image file.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    setAvatarStatus('Uploading photo to your Phoenix profile…', 'warn');
    const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, file, { cacheControl:'3600', upsert:true, contentType:file.type });
    if (uploadError) throw uploadError;
    const { data: publicData } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = publicData?.publicUrl || '';
    if (!url) throw new Error('Supabase did not return a profile photo URL.');
    const { error: profileError } = await client.from('profiles').update({ avatar_url:url, updated_at: new Date().toISOString() }).eq('id', user.id);
    if (profileError) throw profileError;
    try { window.supabaseProfile = { ...(window.supabaseProfile || {}), avatar_url:url }; } catch {}
    setLocalAvatar(url);
    refreshAvatarDom(url);
    setAvatarStatus('Profile photo saved. It will stay after refresh/login.', 'ok');
    return url;
  }
  async function removePersistentAvatar(){
    const { client, user } = await currentSessionAndProfile();
    setLocalAvatar('');
    refreshAvatarDom('');
    if (client && user?.id) {
      try {
        await client.from('profiles').update({ avatar_url:null, updated_at: new Date().toISOString() }).eq('id', user.id);
      } catch {}
      try { window.supabaseProfile = { ...(window.supabaseProfile || {}), avatar_url:null }; } catch {}
      setAvatarStatus('Profile photo removed.', 'ok');
    }
  }

  document.addEventListener('change', async (event) => {
    const input = event.target?.closest?.('[data-member-avatar-input-v133]');
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await sleep(30);
      await uploadAvatar(file);
    } catch (error) {
      setAvatarStatus(error?.message || 'Could not save this profile photo.', 'error');
      showSystemNotice({ title:'Profile photo not saved', message:error?.message || String(error), eyebrow:'Phoenix Hibachi' });
    }
  }, true);

  document.addEventListener('click', async (event) => {
    const remove = event.target?.closest?.('[data-member-avatar-remove-v133]');
    if (!remove) return;
    try { await sleep(20); await removePersistentAvatar(); }
    catch (error) { showSystemNotice({ title:'Could not remove photo', message:error?.message || String(error), eyebrow:'Phoenix Hibachi' }); }
  }, true);

  function boot(){
    addLoginHelper();
    syncAvatarFromSupabase().catch(() => {});
    const client = getClient();
    if (client?.auth?.onAuthStateChange) {
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') { removeAuthStorage(); resetAccountUI(); return; }
        if (session?.user) setTimeout(() => syncAvatarFromSupabase().catch(() => {}), 150);
      });
    }
    // If there is stale portal UI but Supabase has no session, clear it on first load.
    setTimeout(async () => {
      const client2 = getClient();
      if (!client2?.auth?.getSession) return;
      const { data } = await client2.auth.getSession().catch(() => ({ data:null }));
      if (!data?.session?.user) {
        const meta = (() => { try { return JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1') || 'null'); } catch { return null; } })();
        if (meta?.email) { removeAuthStorage(); resetAccountUI(); }
      }
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
