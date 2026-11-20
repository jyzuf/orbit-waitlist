const { sameSecret, signToken, tokenOk, bearer, withDb, mailer, fromAddress, withFooter, json, readBody } = require('./_lib')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'method' })
  }
  if (!process.env.ADMIN_PASSWORD || !process.env.SUPABASE_DB_PASSWORD) {
    return json(res, 503, { error: 'not_configured' })
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    return json(res, 400, { error: 'bad_json' })
  }

  if (body.action === 'login') {
    if (!sameSecret(body.password || '', process.env.ADMIN_PASSWORD)) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return json(res, 401, { error: 'password' })
    }
    return json(res, 200, { token: signToken() })
  }

  if (!tokenOk(bearer(req))) return json(res, 401, { error: 'password' })

  if (body.action === 'list') {
    const people = await withDb(async (db) => {
      const { rows } = await db.query(`
        select email, intent, updates_opt_in, updates_opt_in_at, unsubscribed_at, created_at, paid_at
        from public.waitlist
        order by created_at desc
      `)
      return rows
    })
    const updates = people.filter((row) => row.updates_opt_in && !row.unsubscribed_at).length
    return json(res, 200, { people, updates, mailReady: Boolean(process.env.SMTP_PASS) })
  }

  if (body.action === 'send') {
    const subject = String(body.subject || '').trim()
    const text = String(body.text || '').trim()
    if (!subject || subject.length > 120 || /[\r\n]/.test(subject)) {
      return json(res, 400, { error: 'subject' })
    }
    if (!text || text.length > 5000) return json(res, 400, { error: 'text' })

    const transport = mailer()
    if (!transport) return json(res, 503, { error: 'mail_not_configured' })

    const rows = await withDb(async (db) => {
      const result = await db.query(`
        select email, unsubscribe_token
        from public.waitlist
        where updates_opt_in and unsubscribed_at is null
        order by created_at
      `)
      return result.rows
    })
    if (!rows.length) return json(res, 200, { sent: 0, failed: [] })
    if (rows.length > 200) return json(res, 400, { error: 'too_many' })

    let sent = 0
    const failed = []
    for (const row of rows) {
      try {
        await transport.sendMail({
          from: fromAddress(),
          to: row.email,
          replyTo: 'netlink.orbit@gmail.com',
          subject,
          text: withFooter(text, row.unsubscribe_token),
        })
        sent += 1
      } catch {
        failed.push(row.email)
      }
    }
    return json(res, 200, { sent, failed })
  }

  return json(res, 400, { error: 'action' })
}
