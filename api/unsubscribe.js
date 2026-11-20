const { withDb } = require('./_lib')

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function page(res, status, title, body, token) {
  const button = token
    ? `<form method="post"><button type="submit">Unsubscribe</button></form>`
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
    return page(res, 404, 'Link not recognised', 'This unsubscribe link does not match anyone on the list.')
  }
  if (!process.env.SUPABASE_DB_PASSWORD) {
    return page(res, 503, 'Try again shortly', 'Unsubscribing is not available at this moment.')
  }

  if (req.method === 'GET') {
    return page(
      res,
      200,
      'Stop update mails?',
      'This stops occasional Netlink updates. It does not remove your address from the list.',
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
       set updates_opt_in = false, unsubscribed_at = coalesce(unsubscribed_at, now())
       where unsubscribe_token = $1
       returning email`,
      [token],
    )
    return rows.length > 0
  })
  if (!found) {
    return page(res, 404, 'Link not recognised', 'This unsubscribe link does not match anyone on the list.')
  }
  return page(res, 200, 'You are unsubscribed', 'We will not send you update mails. Your place on the list is unchanged.')
}
