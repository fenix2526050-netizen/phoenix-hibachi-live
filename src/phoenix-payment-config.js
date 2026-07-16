/* Phoenix Hibachi public payment configuration.
   This file may contain public URLs and a Stripe publishable key only.
   Never place Stripe secret, webhook secret, or Supabase service-role key here. */
(function initPhoenixPaymentConfig(){
  const params = new URLSearchParams(window.location.search || '');
  let sandboxEnabled = params.get('stripe_test') === '1';
  try {
    if (sandboxEnabled) sessionStorage.setItem('phoenix_stripe_sandbox', '1');
    else sandboxEnabled = sessionStorage.getItem('phoenix_stripe_sandbox') === '1';
  } catch {}

  window.PHOENIX_PAYMENT_CONFIG = Object.freeze({
    mode: sandboxEnabled ? 'sandbox' : 'production_waiting',
    stripePublishableKey: 'pk_test_51TtL8mH39SJxAuT7487B378g1RHg0mCkbdCTCKxBHxc7aZHbZOqqeyWB1XY718D0FfmTZMznfasLBPaQgU2KszZEO0YwStGyjd',
    supabaseFunctionsBaseUrl: 'https://kyjiwwsqeyhllmzhncap.supabase.co/functions/v1',
    createCheckoutFunction: 'create-stripe-checkout-session',
    applyBenefitsFunction: 'apply-booking-benefits',
    purchaseCreditFunction: 'purchase-phoenix-credit',
    updatePreferenceFunction: 'update-booking-payment-preference',
    lookupBookingFunction: 'lookup-booking-status',
    depositAmountCents: 20000,
    currency: 'usd',
    features: Object.freeze({
      preferenceUpdate: false,
      stripe: sandboxEnabled,
      benefits: false,
      creditTopup: false,
      loyalty: false
    })
  });
})();
