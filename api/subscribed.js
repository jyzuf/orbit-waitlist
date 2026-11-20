const { withDb, mailer, fromAddress, withFooter, json, readBody } = require('./_lib')

const ALLOWED = new Set([
  'https://netlink-one.vercel.app',
  'https://jyzuf.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
])

function cors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

module.exports = async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'method' })
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    return json(res, 400, { error: 'bad_json' })
  }
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return json(res, 400, { error: 'email' })
  }

  const transport = mailer()
  if (!transport || !process.env.SUPABASE_DB_PASSWORD) {
    return json(res, 200, { mailed: false })
  }

  const row = await withDb(async (db) => {
    const { rows } = await db.query(
      `update public.waitlist
       set updates_notice_sent_at = now()
       where email = $1
         and updates_opt_in
         and unsubscribed_at is null
         and updates_notice_sent_at is null
       returning email, unsubscribe_token`,
      [email],
    )
    return rows[0] || null
  })
  if (!row) return json(res, 200, { mailed: false })

  try {
    await transport.sendMail({
      from: fromAddress(),
      to: row.email,
      replyTo: 'netlink.orbit@gmail.com',
      subject: 'Netlink updates',
      text: withFooter(
        'You asked us to email you occasional updates about Netlink. We only write about Netlink.',
        row.unsubscribe_token,
      ),
    })
  } catch {
    await withDb((db) => db.query(
      'update public.waitlist set updates_notice_sent_at = null where email = $1',
      [email],
    )).catch(() => {})
    return json(res, 200, { mailed: false })
  }

  return json(res, 200, { mailed: true })
}
