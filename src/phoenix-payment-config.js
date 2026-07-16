/* Phoenix Hibachi public payment configuration.
   This file may contain public URLs and a Stripe publishable key only.
   Never place Stripe secret, webhook secret, or Supabase service-role key here. */
window.PHOENIX_PAYMENT_CONFIG = Object.freeze({
  mode: 'setup_required',
  stripePublishableKey: '',
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
    stripe: false,
    benefits: false,
    creditTopup: false,
    loyalty: false
  })
});
