const crypto = require('crypto')
const { Client } = require('pg')
const nodemailer = require('nodemailer')

const SITE = 'https://netlink-one.vercel.app'
const TOKEN_MS = 12 * 60 * 60 * 1000

function sameSecret(given, expected) {
  const left = crypto.createHash('sha256').update(String(given)).digest()
  const right = crypto.createHash('sha256').update(String(expected)).digest()
  return crypto.timingSafeEqual(left, right)
}

function signToken() {
  const exp = String(Date.now() + TOKEN_MS)
  const sig = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD).update(exp).digest('base64url')
  return `${exp}.${sig}`
}

function tokenOk(token) {
  if (!process.env.ADMIN_PASSWORD || typeof token !== 'string') return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const expected = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD).update(exp).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function bearer(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

async function withDb(run) {
  const client = new Client({
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.fcpfixxcrloxlhvrgfsp',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end()
  }
}

function mailer() {
  if (!process.env.SMTP_PASS) return null
  const port = Number(process.env.SMTP_PORT || 465)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER || 'netlink.orbit@gmail.com',
      pass: process.env.SMTP_PASS,
    },
  })
}

const SENDER = 'netlink.orbit@gmail.com'

function fromAddress() {
  const user = process.env.SMTP_USER || SENDER
  return `Netlink <${user}>`
}

function mailReady() {
  return Boolean(process.env.BREVO_API_KEY || process.env.SMTP_PASS)
}

async function deliverMail({ to, subject, text }) {
  if (process.env.BREVO_API_KEY) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Netlink', email: SENDER },
        to: [{ email: to }],
        replyTo: { email: SENDER },
        subject,
        textContent: text,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error('brevo')
    return
  }
  const transport = mailer()
  if (!transport) throw new Error('mail')
  await transport.sendMail({
    from: fromAddress(),
    to,
    replyTo: SENDER,
    subject,
    text,
  })
}

function unsubscribeUrl(token) {
  return `${SITE}/api/unsubscribe?token=${token}`
}

function confirmUrl(token) {
  return `${SITE}/api/confirm?token=${token}`
}

function withFooter(text, token) {
  return `${text.trim()}\n\n—\nYou asked for occasional Netlink updates. Stop these mails:\n${unsubscribeUrl(token)}\n`
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body)
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('bad_json'))
      }
    })
    req.on('error', reject)
  })
}

module.exports = {
  SITE,
  sameSecret,
  signToken,
  tokenOk,
  bearer,
  withDb,
  mailer,
  fromAddress,
  mailReady,
  deliverMail,
  withFooter,
  confirmUrl,
  json,
  readBody,
}
