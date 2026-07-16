/* Phoenix Hibachi V2.2.5 — payment preference is optional; server owns all money/benefit decisions. */
(function initPhoenixV225(){
  if(window.__PHX_V225__) return; window.__PHX_V225__=true;
  const cfg=window.PHOENIX_PAYMENT_CONFIG||{};
  const radios=[...document.querySelectorAll('input[name="paymentPreference"]')];
  const panels=[...document.querySelectorAll('[data-payment-panel]')];
  const confirmBtn=document.getElementById('confirmBookingRequestBtn');
  const choiceStatus=document.getElementById('depositChoiceStatus');
  const benefitStatus=document.getElementById('phoenixBenefitStatus');
  const depositState=document.getElementById('v225DepositState');
  const depositDue=document.getElementById('v225DepositDue');
  let depositVerified=false;
  const features=cfg.features||{};

  function selected(){return radios.find(r=>r.checked)?.value||'cash'}
  function bookingRef(){
    try{ if(typeof lastSubmittedOrder!=='undefined'&&lastSubmittedOrder?.id) return lastSubmittedOrder.id }catch{}
    const receipt=document.getElementById('successReceipt');
    return receipt?.dataset?.bookingId||receipt?.querySelector('[data-booking-reference]')?.textContent?.trim()||window.lastSubmittedBookingId||'';
  }
  function paymentAccessToken(ref=bookingRef()){
    if(!ref) return '';
    try{return sessionStorage.getItem(`phoenix_payment_access_${ref}`)||''}catch{return ''}
  }
  function statusCopy(method){
    if(depositVerified) return 'Stripe verified the $200 deposit. The request still requires manager approval.';
    if(method==='cash') return 'Cash selected. You can submit the request without paying now.';
    if(method==='stripe') return 'Online payment selected. Paying now is optional; you can still submit the request.';
    if(method==='zelle') return document.getElementById('zelleVerificationAcknowledge')?.checked?'Zelle payment claimed. Staff must verify it.':'Zelle selected. You can submit now and pay later.';
    return document.getElementById('venmoVerificationAcknowledge')?.checked?'Venmo payment claimed. Staff must verify it.':'Venmo selected. You can submit now and pay later.';
  }
  function render(){
    const m=selected();
    panels.forEach(p=>p.hidden=p.dataset.paymentPanel!==m);
    if(confirmBtn) confirmBtn.disabled=false;
    if(choiceStatus) choiceStatus.textContent=statusCopy(m);
    if(depositState) depositState.textContent=depositVerified?'Paid / verified':'Optional now';
    if(depositDue) depositDue.textContent=depositVerified?'$0.00':'$200.00';
    try{localStorage.setItem('phoenix_payment_preference_v225',m)}catch{}
  }
  radios.forEach(r=>r.addEventListener('change',()=>setTimeout(render,0)));
  ['zelleVerificationAcknowledge','venmoVerificationAcknowledge'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>setTimeout(render,0)));

  async function persistPreference(){
    const ref=bookingRef(), method=selected();
    if(!ref||features.preferenceUpdate!==true||!cfg.supabaseFunctionsBaseUrl||!cfg.updatePreferenceFunction){if(choiceStatus)choiceStatus.textContent='Booking saved. Cash remains the default until the secure payment-update service is activated.';return;}
    try{
      let customerEmail='';try{if(typeof lastSubmittedOrder!=='undefined'&&lastSubmittedOrder)customerEmail=lastSubmittedOrder.email||''}catch{}
      let authHeader={};try{const client=typeof initSupabaseClient==='function'?initSupabaseClient():null;const session=client?(await client.auth.getSession()).data.session:null;if(session?.access_token)authHeader={Authorization:`Bearer ${session.access_token}`}}catch{}
      const manualPaymentClaimed=method==='zelle'?!!document.getElementById('zelleVerificationAcknowledge')?.checked:method==='venmo'?!!document.getElementById('venmoVerificationAcknowledge')?.checked:false;
      const endpoint=`${cfg.supabaseFunctionsBaseUrl.replace(/\/$/,'')}/${cfg.updatePreferenceFunction}`;
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...authHeader},body:JSON.stringify({bookingNumber:ref,customerEmail,paymentAccessToken:paymentAccessToken(ref),paymentPreference:method,manualPaymentClaimed})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to save payment preference');
    }catch(err){console.warn('V225 secure payment preference save failed; booking request remains stored.',err);if(choiceStatus)choiceStatus.textContent='Booking is saved, but the payment choice could not be updated online. Please tell staff when they contact you.';}
  }
  confirmBtn?.addEventListener('click',persistPreference,{capture:true});

  async function applyBenefit(type){
    const ref=bookingRef();
    const code=type==='coupon'?document.getElementById('phoenixCouponCode')?.value.trim():type==='gift_card'?document.getElementById('phoenixGiftCardCode')?.value.trim():'';
    let customerEmail=''; try{ if(typeof lastSubmittedOrder!=='undefined'&&lastSubmittedOrder) customerEmail=lastSubmittedOrder.email||'' }catch{}
    if((type==='coupon'||type==='gift_card')&&!code){benefitStatus.textContent='Enter a code first.';benefitStatus.className='phx-v225-benefit-status error';return}
    if(features.benefits!==true||!cfg.supabaseFunctionsBaseUrl||!cfg.applyBenefitsFunction){
      benefitStatus.textContent='Benefit lookup is prepared but not connected yet. Codes and balances must be verified by the Supabase Edge Function, never by browser-only code.';
      benefitStatus.className='phx-v225-benefit-status';return;
    }
    try{
      benefitStatus.textContent='Checking secure balance…';benefitStatus.className='phx-v225-benefit-status';
      const endpoint=`${cfg.supabaseFunctionsBaseUrl.replace(/\/$/,'')}/${cfg.applyBenefitsFunction}`;
      let authHeader={}; try{const client=typeof initSupabaseClient==='function'?initSupabaseClient():null; const session=client?(await client.auth.getSession()).data.session:null; if(session?.access_token) authHeader={Authorization:`Bearer ${session.access_token}`}}catch{}
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...authHeader},body:JSON.stringify({bookingNumber:ref,customerEmail,type,code,paymentAccessToken:paymentAccessToken(ref)})});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'Unable to apply benefit');
      document.getElementById('v225DiscountTotal').textContent=data.discountFormatted||'$0.00';
      document.getElementById('v225StoredValueTotal').textContent=data.storedValueFormatted||'$0.00';
      document.getElementById('v225DepositDue').textContent=data.depositDueFormatted||'$200.00';const balanceEl=document.getElementById('v225OrderBalance');if(balanceEl)balanceEl.textContent=data.balanceDueFormatted||'Calculated securely';
      benefitStatus.textContent=data.message||'Benefit applied.';benefitStatus.className='phx-v225-benefit-status success';
    }catch(err){benefitStatus.textContent=err.message;benefitStatus.className='phx-v225-benefit-status error'}
  }
  document.querySelectorAll('[data-v225-apply]').forEach(btn=>btn.addEventListener('click',()=>applyBenefit(btn.dataset.v225Apply)));


  const topupModal=document.getElementById('phoenixCreditTopupModal');
  const topupStatus=document.getElementById('v225TopupStatus');
  const topupStart=document.getElementById('v225StartTopup');
  let topupStripe=null,topupCheckout=null,topupRequestId='';
  document.querySelectorAll('[data-v225-topup]').forEach(btn=>btn.addEventListener('click',()=>{
    topupRequestId=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);
    if(typeof topupModal?.showModal==='function') topupModal.showModal();
  }));
  document.querySelectorAll('[data-close-v225-topup]').forEach(btn=>btn.addEventListener('click',()=>topupModal?.close()));
  topupStart?.addEventListener('click',async()=>{
    const amount=Number(document.querySelector('input[name="v225TopupAmount"]:checked')?.value||0);
    if(features.creditTopup!==true||!cfg.stripePublishableKey||!cfg.supabaseFunctionsBaseUrl||!cfg.purchaseCreditFunction){topupStatus.textContent='Top-up is prepared but not connected. Test keys, the Edge Function, and approved top-up rules are still required.';topupStatus.className='phx-v225-benefit-status';return}
    try{
      const client=typeof initSupabaseClient==='function'?initSupabaseClient():null;
      const session=client?(await client.auth.getSession()).data.session:null;
      if(!session?.access_token) throw new Error('Login is required to recharge Phoenix Credit');
      topupStart.disabled=true;topupStatus.textContent='Opening secure Stripe top-up…';topupStatus.className='phx-v225-benefit-status';
      const endpoint=`${cfg.supabaseFunctionsBaseUrl.replace(/\/$/,'')}/${cfg.purchaseCreditFunction}`;
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({amountCents:amount,requestId:topupRequestId})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Unable to start top-up');
      topupStripe=topupStripe||window.Stripe(cfg.stripePublishableKey);
      if(topupCheckout?.destroy)topupCheckout.destroy();
      topupCheckout=await topupStripe.initEmbeddedCheckout({clientSecret:data.clientSecret});
      document.getElementById('v225TopupStripeMount').innerHTML='';topupCheckout.mount('#v225TopupStripeMount');
      topupStatus.textContent=`Secure checkout opened for ${(amount/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}. Credit is added only after Stripe webhook verification.`;
    }catch(err){topupStatus.textContent=err.message;topupStatus.className='phx-v225-benefit-status error';topupStart.disabled=false}
  });

  const stripeRadio=document.querySelector('input[name="paymentPreference"][value="stripe"]');
  if(stripeRadio&&features.stripe!==true){stripeRadio.disabled=true;stripeRadio.closest('label')?.setAttribute('title','Card payment is not active until Stripe test deployment is completed.');}
  if(features.benefits!==true){document.querySelectorAll('[data-v225-apply]').forEach(btn=>{btn.disabled=true;btn.title='Benefit redemption activates after the secure Supabase functions are deployed.';});}
  if(features.creditTopup!==true){document.querySelectorAll('[data-v225-topup]').forEach(btn=>{btn.disabled=true;btn.title='Phoenix Credit recharge is not active yet.';});}

  window.addEventListener('phoenix:stripe-deposit-verified',()=>{depositVerified=true;render()});
  const modal=document.getElementById('successModal');
  if(modal&&window.MutationObserver){new MutationObserver(()=>{if(modal.open){depositVerified=false;radios.forEach(r=>r.checked=r.value==='cash');render()}}).observe(modal,{attributes:true,attributeFilter:['open']})}
  setTimeout(render,0);
})();
