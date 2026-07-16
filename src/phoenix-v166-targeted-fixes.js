/* Phoenix Hibachi V166 — targeted stability runtime.
   Keeps V1653 business logic; only fixes requested login, profile/avatar,
   dashboard timing/layout, and V163 print ownership. */
(function phoenixV166TargetedStability(){
  if(window.__PHX_V166_TARGETED_STABILITY__) return;
  window.__PHX_V166_TARGETED_STABILITY__=true;
  window.PHX_BUILD_VERSION='V166_TARGETED_STABILITY';

  const PRINT_PATCH_CLASSES=[
    'phx-v1653-print-hard','phx-v1652-print','phx-v1651-print','phx-v1650-print-fill',
    'phx-v1649-print-max','phx-v1648-print-fill','phx-v1645-readable-print',
    'phx-v1643-print-polish','phx-force-one-page-v1641'
  ];
  let dashboardFrame=0;
  let avatarSyncing=false;

  function safeClick(el){
    if(!el) return false;
    try{el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return true;}catch{return false;}
  }

  function ensureProfileButton(){
    const btn=document.getElementById('dashAssistantBtn');
    if(btn){
      if(btn.textContent.trim()!=='Profile') btn.textContent='Profile';
      btn.setAttribute('aria-label','Open profile');
      btn.setAttribute('data-phx-profile-button','1');
      btn.classList.add('phx-v166-profile-button');
      btn.removeAttribute('hidden');
      btn.style.removeProperty('display');
    }
    const panel=document.getElementById('dashboardAssistantPanel');
    if(panel){panel.hidden=true;panel.setAttribute('aria-hidden','true');}
  }

  function openProfile(){
    const candidates=[
      '[data-account-action="profile"]','#memberProfileBtnV133','[data-member-profile-open]',
      '#dashProfileBtnV134','#dashProfileBtn'
    ];
    for(const sel of candidates){
      const el=document.querySelector(sel);
      if(el && el.id!=='dashAssistantBtn' && safeClick(el)) return;
    }
    const modal=document.getElementById('changePasswordModal')||document.getElementById('profileModal');
    if(!modal) return;
    try{if(typeof modal.showModal==='function'&&!modal.open) modal.showModal();else modal.setAttribute('open','');}catch{modal.setAttribute('open','');}
  }

  function currentEmail(){
    try{return String(window.supabaseSession?.user?.email||window.supabaseProfile?.email||JSON.parse(localStorage.getItem('phoenixPortalSessionMetaV1')||'{}')?.email||'').trim().toLowerCase();}catch{return '';}
  }
  function localAvatar(){
    const email=currentEmail()||'local-member';
    try{return window.supabaseProfile?.avatar_url||window.supabaseSession?.user?.user_metadata?.avatar_url||localStorage.getItem('phoenix_member_avatar_v133_'+email)||'';}catch{return '';}
  }
  function avatarInitial(){
    const text=String(window.supabaseProfile?.full_name||currentEmail()||'Member').trim();
    return (text.charAt(0)||'M').toUpperCase();
  }
  function applyAvatar(url){
    const finalUrl=String(url||localAvatar()||'');
    document.querySelectorAll('[data-member-avatar-preview-v133],[data-member-profile-avatar-v133]').forEach(target=>{
      target.innerHTML=finalUrl?`<img src="${finalUrl.replace(/"/g,'&quot;')}" alt="Profile photo">`:`<span>${avatarInitial()}</span>`;
    });
    const header=document.getElementById('accountAvatar');
    if(header){
      header.classList.toggle('has-photo-v166',!!finalUrl);
      header.innerHTML=finalUrl?`<img src="${finalUrl.replace(/"/g,'&quot;')}" alt="Profile photo">`:avatarInitial();
    }
  }
  async function syncAvatar(){
    if(avatarSyncing) return;
    avatarSyncing=true;
    try{
      applyAvatar(localAvatar());
      const client=typeof window.initSupabaseClient==='function'?window.initSupabaseClient():null;
      const user=window.supabaseSession?.user||(await client?.auth?.getSession?.().catch(()=>({data:null})))?.data?.session?.user;
      if(client&&user?.id){
        const result=await client.from('profiles').select('avatar_url,full_name,email').eq('id',user.id).maybeSingle();
        if(result?.data){
          window.supabaseProfile={...(window.supabaseProfile||{}),...result.data};
          const url=result.data.avatar_url||'';
          if(url){try{localStorage.setItem('phoenix_member_avatar_v133_'+String(user.email||currentEmail()).toLowerCase(),url);}catch{}}
          applyAvatar(url);
        }
      }
    }catch(error){console.warn('V166 avatar sync warning:',error);}finally{avatarSyncing=false;}
  }

  function normalizePrint(){
    const area=document.getElementById('printArea');
    if(!area) return;
    PRINT_PATCH_CLASSES.forEach(cls=>area.classList.remove(cls));
    delete area.dataset.v1645Density; delete area.dataset.v1648PrintFit;
    delete area.dataset.v1649PrintMode; delete area.dataset.v1650PrintMode;
    delete area.dataset.v1651PrintMode; delete area.dataset.v1652PrintMode;
    delete area.dataset.phxPrintVersion;
    area.classList.add('phx-v166-v163-print','phx-one-page-fit');
    const sheet=area.querySelector('.guest-invoice, .chef-settlement-sheet');
    if(sheet){
      const textLength=(sheet.innerText||'').replace(/\s+/g,' ').trim().length;
      const rowCount=sheet.querySelectorAll('.invoice-row,.invoice-labels div,.invoice-totals div,.invoice-rule-box span,.tip-suggestions div,.tip-suggestions-final tr,.invoice-payment-grid-v164 div,.invoice-ledger-grid-v164 div,.settlement-grid div,.settlement-money div,.settlement-checks label').length;
      const addonCount=sheet.querySelectorAll('.invoice-row').length;
      let mode='fill';
      if(textLength>2200||rowCount>28||addonCount>8) mode='normal';
      if(textLength>2800||rowCount>32||addonCount>9) mode='tight';
      area.dataset.printFit=mode;
    }
    const invoice=area.querySelector('.guest-invoice');
    if(invoice){
      invoice.classList.remove('phx-v1653-invoice-hard','phx-v1654-invoice','phx-v1649-print-invoice');
      invoice.style.removeProperty('transform');
      invoice.style.removeProperty('width');
      invoice.style.removeProperty('--phx-print-scale');
      invoice.style.removeProperty('--phx-print-width');
    }
  }

  function renderDashboardNow(){
    cancelAnimationFrame(dashboardFrame);
    dashboardFrame=requestAnimationFrame(()=>{
      ensureProfileButton();
      const modal=document.getElementById('dashboardModal');
      if(!modal?.open) return;
      modal.classList.add('phx-v166-ready');
      try{window.PHX_RENDER_ORDERS_BOARD_V166?.('force');}catch{}
      document.dispatchEvent(new CustomEvent('phoenix:v166-dashboard-ready'));
      syncAvatar();
    });
  }

  document.addEventListener('click',event=>{
    const profile=event.target?.closest?.('#dashAssistantBtn');
    if(profile){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
      ensureProfileButton();openProfile();return;
    }
    if(event.target?.closest?.('[data-dashboard-tab="orders"], [data-open-login], [data-account-action="profile"], #memberProfileBtnV133')){
      setTimeout(renderDashboardNow,0);
      setTimeout(syncAvatar,0);
    }
    if(event.target?.closest?.('#runPrintBtn')){
      document.body.classList.add('printing-invoice');
      queueMicrotask(normalizePrint);
    }
  },true);

  document.addEventListener('change',event=>{
    if(event.target?.closest?.('[data-member-avatar-input-v133]')) setTimeout(syncAvatar,120);
  },true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-member-avatar-remove-v133]')) setTimeout(syncAvatar,120);
  },false);

  window.addEventListener('beforeprint',()=>{document.body.classList.add('printing-invoice');normalizePrint();});
  window.addEventListener('afterprint',()=>document.body.classList.remove('printing-invoice'));

  function boot(){
    ensureProfileButton();normalizePrint();applyAvatar(localAvatar());
    const modal=document.getElementById('dashboardModal');
    if(modal){
      new MutationObserver(()=>{if(modal.open) renderDashboardNow();}).observe(modal,{attributes:true,attributeFilter:['open']});
      if(modal.open) renderDashboardNow();
    }
    const printArea=document.getElementById('printArea');
    if(printArea){
      new MutationObserver(()=>queueMicrotask(normalizePrint)).observe(printArea,{childList:true});
    }
    try{
      const client=typeof window.initSupabaseClient==='function'?window.initSupabaseClient():null;
      client?.auth?.onAuthStateChange?.((event)=>{
        if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED') setTimeout(()=>{syncAvatar();renderDashboardNow();},0);
      });
    }catch{}
    setTimeout(syncAvatar,0);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
