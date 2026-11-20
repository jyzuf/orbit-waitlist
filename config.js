// Public settings for the waitlist site. Nothing in here is secret:
// the Supabase anon key only allows calling join_waitlist(), the table itself is closed to the public API (see supabase/migrations/0003_waitlist.sql).
window.ORBIT_SITE = {
  supabaseUrl: 'https://fcpfixxcrloxlhvrgfsp.supabase.co',
  supabaseAnonKey: 'sb_publishable_UrhYORFrpZlGGVIozlST0A_2zJqAugl',

  // PayPal hosted button. The client id is public, it only renders this button.
  paypalClientId: 'BAAuz6lJU6b19_caSL27iZA9d2edZDmLsPq4dPMzzldYNE0vzRzy3Uxd3F9tfcSZ_MonyZog69GB5Cmlrs',
  paypalButtonId: 'A8EYKN2GV4N7Y',
  priceEur: 2,

  // Contact links open a mail to this address. Leave empty until you have one.
  contactEmail: 'netlink.orbit@gmail.com',
}
