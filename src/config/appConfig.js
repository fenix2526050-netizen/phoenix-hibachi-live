export const PHOENIX_APP_VERSION = 'V235_MAKE_NOTIFICATIONS_SMS_CONSENT';

export const CONTACT_DEFAULTS = Object.freeze({
  businessName: 'Phoenix Hibachi',
  adminEmail: 'phoenixhibachi.team@gmail.com',
  phone: '5165183325',
  email: 'booking@phoenix-hibachi.com',
  website: 'https://phoenix-hibachi.com',
  businessHours: 'Daily 9:00 AM–9:00 PM',
  serviceArea: 'NY, NJ, CT, PA',
});

export const STORAGE_BUCKETS = Object.freeze({
  orderPdfs: 'order-pdfs',
  chefFiles: 'chef-application-files',
});

export const TABLES = Object.freeze({
  bookings: 'bookings',
  contactSettings: 'contact_settings',
  chefApplications: 'chef_applications',
});

export const LOCAL_STORAGE_KEYS = Object.freeze({
  draftBooking: 'phoenix_booking_draft',
  legacyOrders: 'phoenix_orders',
  contactSettings: 'phoenix_contact_settings_v60',
});
