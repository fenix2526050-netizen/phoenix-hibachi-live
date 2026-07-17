/* Phoenix Hibachi public payment configuration.
   Public keys and URLs only. Never place a Stripe secret, webhook secret,
   Make API key, or Supabase service-role key in this file. */
(function initPhoenixPaymentConfig(){
  const params = new URLSearchParams(window.location.search || '');
  let sandboxEnabled = params.get('stripe_test') === '1';
  try {
    if (sandboxEnabled) sessionStorage.setItem('phoenix_stripe_sandbox', '1');
    else sandboxEnabled = sessionStorage.getItem('phoenix_stripe_sandbox') === '1';
  } catch {}

  // Leave blank until Stripe live mode is approved and the live webhook is tested.
  const liveStripePublishableKey = ''; // Paste your Stripe pk_live_... public key here to activate live card payments.
  const testStripePublishableKey = 'pk_test_51TtL8mH39SJxAuT7487B378g1RHg0mCkbdCTCKxBHxc7aZHbZOqqeyWB1XY718D0FfmTZMznfasLBPaQgU2KszZEO0YwStGyjd';
  const liveStripeEnabled = /^pk_live_/.test(liveStripePublishableKey);

  window.PHOENIX_PAYMENT_CONFIG = Object.freeze({
    mode: sandboxEnabled ? 'sandbox' : (liveStripeEnabled ? 'production' : 'production_manual_payments'),
    stripePublishableKey: sandboxEnabled ? testStripePublishableKey : liveStripePublishableKey,
    supabaseFunctionsBaseUrl: 'https://kyjiwwsqeyhllmzhncap.supabase.co/functions/v1',
    createCheckoutFunction: 'create-stripe-checkout-session',
    applyBenefitsFunction: 'apply-booking-benefits',
    purchaseCreditFunction: 'purchase-phoenix-credit',
    updatePreferenceFunction: 'update-booking-payment-preference',
    lookupBookingFunction: 'booking-lifecycle',
    bookingLifecycleFunction: 'booking-lifecycle',
    depositAmountCents: 10000,
    currency: 'usd',
    features: Object.freeze({
      preferenceUpdate: false,
      stripe: sandboxEnabled || liveStripeEnabled,
      benefits: false,
      creditTopup: false,
      loyalty: false
    })
  });
})();
