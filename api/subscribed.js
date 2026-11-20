const { withDb, mailer, fromAddress, confirmUrl, json, readBody } = require('./_lib')

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
  if (!process.env.SUPABASE_DB_PASSWORD) return json(res, 200, { mailed: false })

  const current = await withDb(async (db) => {
    const { rows } = await db.query(
      `select updates_opt_in, unsubscribed_at, updates_requested_at
       from public.waitlist where email = $1`,
      [email],
    )
    return rows[0] || null
  })
  if (current && current.updates_opt_in && !current.unsubscribed_at) {
    return json(res, 200, { mailed: false, confirmed: true })
  }
  if (!current || !current.updates_requested_at) return json(res, 200, { mailed: false })

  const transport = mailer()
  if (!transport) return json(res, 200, { mailed: false })

  const row = await withDb(async (db) => {
    const { rows } = await db.query(
      `update public.waitlist
       set updates_notice_sent_at = now()
       where email = $1
         and updates_requested_at is not null
         and not (updates_opt_in and unsubscribed_at is null)
         and updates_notice_sent_at is null
         and confirm_token is not null
       returning email, confirm_token`,
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
      subject: 'Confirm Netlink updates',
      text: `Click here to confirm you want these updates:\n${confirmUrl(row.confirm_token)}\n\nIf you did not ask for Netlink updates, you can ignore this mail.\n`,
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
