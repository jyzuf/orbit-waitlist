// Public settings for the waitlist site. Nothing in here is secret:
// the Supabase anon key only allows calling join_waitlist(), the table itself is closed to the public API (see supabase/migrations/0003_waitlist.sql).
window.ORBIT_SITE = {
  supabaseUrl: 'https://fcpfixxcrloxlhvrgfsp.supabase.co',
  supabaseAnonKey: 'sb_publishable_UrhYORFrpZlGGVIozlST0A_2zJqAugl',

  // Your PayPal.me name, the part after paypal.me/. Replace the placeholder before you publish.
  // The button then opens https://paypal.me/<paypalHandle>/2EUR
  paypalHandle: 'YOUR-PAYPAL-NAME',
  priceEur: 2,

  // Contact links open a mail to this address. Leave empty until you have one.
  contactEmail: 'netlink.orbit@gmail.com',
}
