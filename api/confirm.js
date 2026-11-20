const { withDb } = require('./_lib')

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function page(res, status, title, body, token) {
  const button = token
    ? `<form method="post"><button type="submit">Click here to confirm you want these updates.</button></form>`
    : ''
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title}</title>
  <style>
    body { margin: 0; background: #EDF0F7; color: #0B1024; font-family: Inter, system-ui, sans-serif; }
    main { max-width: 440px; margin: 12vh auto; background: #fff; border-radius: 28px; padding: 36px 28px; text-align: center; }
    h1 { font-size: 1.6rem; letter-spacing: -0.03em; margin: 0 0 12px; }
    p { margin: 0; color: #3B4263; line-height: 1.5; }
    button { margin-top: 22px; min-height: 52px; padding: 0 24px; border: 0; border-radius: 999px; background: #0B1024; color: #fff; font: inherit; font-weight: 650; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    ${button}
  </main>
</body>
</html>`)
}

function tokenFrom(req) {
  const url = new URL(req.url, 'https://netlink-one.vercel.app')
  const token = url.searchParams.get('token') || ''
  return TOKEN.test(token) ? token : ''
}

module.exports = async function handler(req, res) {
  const token = tokenFrom(req)
  if (!token) {
    return page(res, 404, 'Link not recognised', 'This confirmation link does not match anyone on the list.')
  }
  if (!process.env.SUPABASE_DB_PASSWORD) {
    return page(res, 503, 'Try again shortly', 'Confirming updates is not available at this moment.')
  }

  if (req.method === 'GET') {
    const pending = await withDb(async (db) => {
      const { rows } = await db.query(
        `select updates_opt_in, unsubscribed_at is null as still_on
         from public.waitlist
         where confirm_token = $1 and updates_requested_at is not null`,
        [token],
      )
      return rows[0] || null
    })
    if (!pending) {
      return page(res, 404, 'Link not recognised', 'This confirmation link does not match anyone on the list.')
    }
    if (pending.updates_opt_in && pending.still_on) {
      return page(res, 200, 'Updates confirmed', 'You are set to receive occasional Netlink updates. Every mail has a link to stop them.')
    }
    return page(
      res,
      200,
      'Confirm Netlink updates',
      'One click confirms that Netlink may email you occasional updates. You can stop them from any mail.',
      token,
    )
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    return res.end('Method not allowed')
  }

  const found = await withDb(async (db) => {
    const { rows } = await db.query(
      `update public.waitlist
       set updates_opt_in = true,
           updates_opt_in_at = now(),
           unsubscribed_at = null
       where confirm_token = $1
         and updates_requested_at is not null
       returning email`,
      [token],
    )
    return rows.length > 0
  })
  if (!found) {
    return page(res, 404, 'Link not recognised', 'This confirmation link does not match anyone on the list.')
  }
  return page(res, 200, 'Updates confirmed', 'You are set to receive occasional Netlink updates. Every mail has a link to stop them.')
}
