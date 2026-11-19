# Netlink waitlist site

A static site: plain HTML, CSS and a little JavaScript. No build step, no framework, no tracking, fonts are self-hosted.

```
website/
  index.html        the story page
  impressum.html    legal notice (fill in your details)
  privacy.html      privacy notice (fill in your details)
  config.js         PayPal handle, contact email, public Supabase settings
  styles.css, script.js
  assets/           screens, fonts, favicon, share image
  tools/            scripts that regenerate the screens and the share image
```

## Before you publish

1. **PayPal.** In `config.js` set `paypalHandle` to your PayPal.me name (the part after `paypal.me/`). The button then opens `https://paypal.me/<name>/2EUR`. While the placeholder is still there, the live site hides the PayPal button and tells people the link follows by email. On `localhost` it still shows, so you can preview it.
2. **Contact email.** Set `contactEmail` in `config.js`. It is used in the FAQ, the footer and both legal pages.
3. **Legal pages.** Fill in the highlighted `[...]` fields in `impressum.html` and `privacy.html`, and have them checked for your situation.
4. **FAQ.** The answer "Can I get the 2 € back?" promises a refund. Keep it, change it or delete it, it is your call.

## Preview locally

```bash
cd website
python3 -m http.server 4173
# open http://localhost:4173
```

## Deploy

Any static host works. Upload the `website/` folder (leave out `tools/`) to Netlify, Vercel, Cloudflare Pages or GitHub Pages. For Netlify, drag the folder onto the deploy page.

## Where the signups go

The form calls `join_waitlist()` in Supabase (`supabase/migrations/0003_waitlist.sql`, already applied). The `waitlist` table is closed to the public API, so the site can add an address but never read the list. Read it in the Supabase dashboard (Table editor, `waitlist`) or in the SQL editor:

```sql
select email, intent, paid_at, created_at from waitlist order by created_at desc;

-- after you have matched a PayPal payment to an email
update waitlist set paid_at = now() where email = 'someone@example.com';
```

`intent` is `test_group` (wants a seat, pays 2 €) or `waitlist` (free). Joining twice is fine: the entry is updated, and a test-group choice is never downgraded.

A new test-group signup also sends one email to jyzustudio@gmail.com, through FormSubmit. The free waitlist does not, and a repeat signup does not send a second mail. The first time, FormSubmit sends an activation link to that inbox. The notification mails start after that link is opened.

## Re-shoot the app screens

The screens are real screenshots of the running app, filled with sample data (`tools/state.mjs`). Nothing in the app is changed for this, and nothing is written to your account: the script feeds the app a fake session and answers its Supabase reads itself.

```bash
npx expo start --web --port 8081     # in the project root, leave it running
cd website/tools
npm install
npm run shoot                        # all screens, or: npm run shoot -- ask moves
node assets.mjs                      # share image and home-screen icon
```

It needs Google Chrome (set `CHROME=/path/to/chrome` if it is not in the default macOS location). Set `KEEP_RAW=1` to keep the full-size PNGs in `/tmp/orbit-site-raw`.
