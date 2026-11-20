(() => {
  const $ = (selector) => document.querySelector(selector)
  const login = $('#login')
  const desk = $('#desk')
  const people = $('#people')
  const count = $('#count')
  const mailBanner = $('#mail-banner')
  const sendButton = $('#send')
  const sendNote = $('#send-note')
  const sendError = $('#send-error')
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin',
  })

  let token = sessionStorage.getItem('netlink-admin') || ''
  let updates = 0
  let mailReady = false

  async function call(action, extra) {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, ...extra }),
    })
    const body = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, body }
  }

  function statusOf(row) {
    if (row.updates_opt_in && !row.unsubscribed_at) return 'Updates confirmed'
    const asked = row.updates_requested_at && (!row.unsubscribed_at || new Date(row.updates_requested_at) > new Date(row.unsubscribed_at))
    if (asked && !row.updates_opt_in) return 'Waiting for confirm'
    if (row.unsubscribed_at) return 'Unsubscribed'
    return 'Updates no'
  }

  function render(body) {
    updates = body.updates || 0
    mailReady = Boolean(body.mailReady)
    mailBanner.hidden = mailReady
    const total = body.people.length
    const waiting = body.waiting || 0
    count.textContent = waiting
      ? `${total} on the list. ${updates} confirmed updates. ${waiting} still have to click the mail.`
      : `${total} on the list. ${updates} confirmed updates.`
    people.replaceChildren()
    for (const row of body.people) {
      const item = document.createElement('li')
      const address = document.createElement('strong')
      address.textContent = row.email
      const meta = document.createElement('span')
      const choice = row.intent === 'test_group' ? 'Test group' : 'Waitlist'
      const when = row.created_at ? date.format(new Date(row.created_at)) : ''
      const paid = row.paid_at ? ' · Paid' : ''
      meta.textContent = `${choice} · ${statusOf(row)} · ${when}${paid}`
      item.append(address, meta)
      people.append(item)
    }
    sendButton.textContent = updates ? `Send to ${updates}` : 'Nobody to send to'
    sendButton.disabled = !body.mailReady || updates === 0
    login.hidden = true
    desk.hidden = false
  }

  async function openList() {
    const result = await call('list')
    if (result.status === 401) {
      token = ''
      sessionStorage.removeItem('netlink-admin')
      return false
    }
    if (!result.ok) throw new Error('list')
    render(result.body)
    return true
  }

  login.addEventListener('submit', async (event) => {
    event.preventDefault()
    const error = $('#login-error')
    error.hidden = true
    const button = $('#login-btn')
    button.disabled = true
    try {
      const result = await call('login', { password: $('#password').value })
      if (!result.ok) {
        error.textContent = result.status === 503
          ? 'The team page is not switched on yet.'
          : 'That password is wrong.'
        error.hidden = false
        return
      }
      token = result.body.token
      sessionStorage.setItem('netlink-admin', token)
      await openList()
    } catch {
      error.textContent = 'We could not reach the server.'
      error.hidden = false
    } finally {
      button.disabled = false
    }
  })

  $('#compose').addEventListener('submit', async (event) => {
    event.preventDefault()
    sendError.hidden = true
    sendNote.hidden = true
    const subject = $('#subject').value.trim()
    const text = $('#message').value.trim()
    if (!subject || !text) return
    if (!window.confirm(`Send this update to ${updates} ${updates === 1 ? 'person' : 'people'} who agreed?`)) return
    sendButton.disabled = true
    try {
      const result = await call('send', { subject, text })
      if (result.status === 401) {
        token = ''
        sessionStorage.removeItem('netlink-admin')
        desk.hidden = true
        login.hidden = false
        return
      }
      if (!result.ok) {
        sendError.textContent = result.body.error === 'mail_not_configured'
          ? 'Sending is not connected yet.'
          : 'The update was not sent. Please try again.'
        sendError.hidden = false
        return
      }
      const failed = result.body.failed || []
      sendNote.textContent = failed.length
        ? `Sent to ${result.body.sent}. Not delivered: ${failed.join(', ')}`
        : `Sent to ${result.body.sent}.`
      sendNote.hidden = false
    } catch {
      sendError.textContent = 'We could not reach the server.'
      sendError.hidden = false
    } finally {
      sendButton.disabled = !mailReady || updates === 0
    }
  })

  if (token) {
    openList().catch(() => {
      token = ''
      sessionStorage.removeItem('netlink-admin')
    })
  }
})()
