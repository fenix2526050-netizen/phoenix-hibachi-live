/* Phoenix Hibachi V2.3.0 Stripe client: resilient booking context + secure server checkout. */
(function initPhoenixStripeClient(){
  if(window.__PHX_STRIPE_CLIENT__) return; window.__PHX_STRIPE_CLIENT__=true;
  const cfg=window.PHOENIX_PAYMENT_CONFIG||{};
  const payBtn=document.getElementById('payStripeDepositBtn');
  const message=document.getElementById('stripeDepositMessage');
  let stripe=null, checkout=null;
  const stripeEnabled=cfg.features?.stripe===true;
  const sandboxMode=cfg.mode==='sandbox';

  function cleanBookingNumber(value=''){
    const raw=String(value||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
    const match=raw.toUpperCase().match(/PHX-\d{6}-[A-Z0-9]{4,12}/);
    return match?.[0]||raw;
  }
  function readStoredContext(){
    try{return JSON.parse(sessionStorage.getItem('phoenix_last_payment_context_v230')||'{}')||{}}catch{return {}}
  }
  function context(){
    let order={};
    try{ if(typeof lastSubmittedOrder!=='undefined'&&lastSubmittedOrder) order=lastSubmittedOrder }catch{}
    const stored=readStoredContext();
    const receipt=document.getElementById('successReceipt');
    const bookingNumber=cleanBookingNumber(
      order.booking_number||order.bookingNumber||order.id||
      receipt?.dataset?.bookingId||
      receipt?.querySelector('[data-booking-reference]')?.textContent?.trim()||
      window.lastSubmittedBookingId||stored.bookingNumber||''
    );
    const customerEmail=String(
      order.customer_email||order.customerEmail||order.email||stored.customerEmail||''
    ).trim().toLowerCase();
    let paymentAccessToken='';
    try{
      paymentAccessToken=sessionStorage.getItem(`phoenix_payment_access_${bookingNumber}`)||stored.paymentAccessToken||'';
      if(bookingNumber&&customerEmail){
        sessionStorage.setItem('phoenix_last_payment_context_v230',JSON.stringify({bookingNumber,customerEmail,paymentAccessToken,savedAt:Date.now()}));
      }
    }catch{}
    return {bookingNumber,customerEmail,paymentAccessToken,paymentType:'deposit'};
  }

  async function startCheckout(){
    if(!stripeEnabled||!cfg.stripePublishableKey||!cfg.supabaseFunctionsBaseUrl){
      message.textContent='Stripe test connection is not configured yet. Add the publishable key and Supabase Functions URL after deploying the secure backend.';
      message.className='phx-v224-payment-message error';return;
    }
    const payload=context();
    if(!payload.bookingNumber||!payload.customerEmail){message.textContent='Booking reference or customer email is missing. Submit a new booking request, then open card payment from the confirmation window.';message.className='phx-v224-payment-message error';return}
    payBtn.disabled=true;message.textContent=`Opening secure Stripe checkout for ${payload.bookingNumber}…`;message.className='phx-v224-payment-message';
    try{
      stripe=stripe||window.Stripe(cfg.stripePublishableKey);
      const endpoint=`${cfg.supabaseFunctionsBaseUrl.replace(/\/$/,'')}/${cfg.createCheckoutFunction}`;
      let authHeader={};try{const client=typeof initSupabaseClient==='function'?initSupabaseClient():null;const session=client?(await client.auth.getSession()).data.session:null;if(session?.access_token)authHeader={Authorization:`Bearer ${session.access_token}`}}catch{}
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...authHeader},body:JSON.stringify(payload)});
      let data={};try{data=await res.json()}catch{}
      if(!res.ok) throw new Error(data.error||`Unable to create checkout session (${res.status})`);
      if(data.resolvedBookingNumber&&data.resolvedBookingNumber!==payload.bookingNumber){
        try{
          window.lastSubmittedBookingId=data.resolvedBookingNumber;
          sessionStorage.setItem('phoenix_last_payment_context_v230',JSON.stringify({...payload,bookingNumber:data.resolvedBookingNumber,savedAt:Date.now()}));
        }catch{}
      }
      if(data.alreadyPaid||data.coveredByBenefits){window.dispatchEvent(new CustomEvent('phoenix:stripe-deposit-verified'));message.textContent=data.coveredByBenefits?'Deposit is fully covered by verified gift card or Phoenix Credit.':'Deposit is already paid.';return}
      if(data.clientSecret&&stripe.initEmbeddedCheckout){
        if(checkout?.destroy) checkout.destroy();
        checkout=await stripe.initEmbeddedCheckout({clientSecret:data.clientSecret});
        document.getElementById('stripePaymentMount').innerHTML='';
        checkout.mount('#stripePaymentMount');
        message.textContent=`Use the secure Stripe form to pay ${(Number(data.amountDue||20000)/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}.`;
      } else if(data.url){location.assign(data.url)} else throw new Error('Checkout session did not return a client secret or URL');
    }catch(err){message.textContent=`Payment setup error: ${err.message}`;message.className='phx-v224-payment-message error';payBtn.disabled=false}
  }
  if(payBtn&&stripeEnabled&&sandboxMode){
    payBtn.disabled=false;
    payBtn.textContent='Test the $200 deposit (Sandbox)';
    const panel=payBtn.closest('[data-payment-panel="stripe"]');
    if(panel&&!panel.querySelector('.phx-stripe-sandbox-banner')){
      const banner=document.createElement('div');
      banner.className='phx-stripe-sandbox-banner';
      banner.innerHTML='<b>Stripe Sandbox Test</b><span>No real money is charged. Use only Stripe test card details.</span>';
      panel.insertBefore(banner,panel.firstChild);
    }
    if(message){message.textContent='Sandbox test only. Submit a new booking using booking@phoenix-hibachi.com, then pay from that confirmation window.';message.className='phx-v224-payment-message';}
  } else if(payBtn&&!stripeEnabled){payBtn.disabled=true;payBtn.textContent='Online card payment setup in progress';if(message){message.textContent='Choose cash, Zelle, or Venmo for now. Card payment will appear only after the secure Stripe backend is activated.';message.className='phx-v224-payment-message';}}
  payBtn?.addEventListener('click',startCheckout);
})();
