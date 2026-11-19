(() => {
  const cfg = window.ORBIT_SITE || {}
  const $ = (selector, root = document) => root.querySelector(selector)
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const price = cfg.priceEur || 2

  // ---------- Contact address ----------
  for (const link of $$('[data-contact]')) {
    if (!cfg.contactEmail) continue
    link.href = `mailto:${cfg.contactEmail}`
  }
  for (const node of $$('[data-contact-text]')) {
    if (cfg.contactEmail) node.textContent = cfg.contactEmail
  }

  // ---------- Reveal on scroll ----------
  const reveals = $$('[data-reveal]')
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('in')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    reveals.forEach((node) => observer.observe(node))
  } else {
    reveals.forEach((node) => node.classList.add('in'))
  }

  // Moons keep orbiting unless the visitor asked for less motion.
  if (reduceMotion) $('.rings')?.pauseAnimations?.()

  // ---------- Screens slider ----------
  const stage = $('#stage')
  const track = $('#track')
  if (stage && track) {
    const slides = $$('.slide', track)
    const captions = $$('.caption', $('#captions'))
    const pipBox = $('#dots')
    const now = $('#slide-now')
    $('#slide-total').textContent = String(slides.length)
    let index = 0
    let dragStart = null
    let baseX = 0
    let moved = false

    const pips = slides.map((_, i) => {
      const dot = document.createElement('button')
      dot.type = 'button'
      dot.className = 'pip'
      dot.setAttribute('aria-label', `Show screen ${i + 1} of ${slides.length}: ${captions[i]?.querySelector('h3')?.textContent || ''}`)
      dot.addEventListener('click', () => go(i))
      pipBox.append(dot)
      return dot
    })

    const offsetFor = (i) => {
      const width = slides[0].offsetWidth
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0
      // On wide screens the stage bleeds out to the window edge. Centre on the part inside the page column.
      const bleed = Math.max(0, -parseFloat(getComputedStyle(stage).marginRight) || 0)
      return (stage.clientWidth - bleed) / 2 - (i * (width + gap) + width / 2)
    }

    function layout() {
      baseX = offsetFor(index)
      track.style.transform = `translate3d(${baseX}px,0,0)`
    }

    function go(next) {
      index = Math.max(0, Math.min(slides.length - 1, next))
      slides.forEach((slide, i) => slide.classList.toggle('active', i === index))
      captions.forEach((caption, i) => caption.classList.toggle('active', i === index))
      pips.forEach((pip, i) => {
        pip.classList.toggle('active', i === index)
        if (i === index) pip.setAttribute('aria-current', 'true')
        else pip.removeAttribute('aria-current')
      })
      now.textContent = String(index + 1)
      $('#prev').disabled = index === 0
      $('#next').disabled = index === slides.length - 1
      layout()
    }

    $('#prev').addEventListener('click', () => go(index - 1))
    $('#next').addEventListener('click', () => go(index + 1))
    $('#slider').addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { go(index - 1); event.preventDefault() }
      if (event.key === 'ArrowRight') { go(index + 1); event.preventDefault() }
    })

    // Drag or swipe the phones; a plain click on a neighbour brings it to the middle.
    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return
      dragStart = { x: event.clientX, id: event.pointerId }
      moved = false
    })
    stage.addEventListener('pointermove', (event) => {
      if (!dragStart) return
      const dx = event.clientX - dragStart.x
      if (!moved && Math.abs(dx) > 8) {
        moved = true
        stage.classList.add('dragging')
        stage.setPointerCapture?.(dragStart.id)
      }
      if (moved) track.style.transform = `translate3d(${baseX + dx}px,0,0)`
    })
    const endDrag = (event) => {
      if (!dragStart) return
      const dx = event.clientX - dragStart.x
      const wasMoved = moved
      dragStart = null
      stage.classList.remove('dragging')
      if (wasMoved) {
        const width = slides[0].offsetWidth
        go(index + (dx < -width * 0.18 ? 1 : dx > width * 0.18 ? -1 : 0))
        return
      }
      const slide = event.target.closest?.('.slide')
      if (slide) go(slides.indexOf(slide))
    }
    stage.addEventListener('pointerup', endDrag)
    stage.addEventListener('pointercancel', () => { dragStart = null; stage.classList.remove('dragging'); layout() })

    new ResizeObserver(layout).observe(stage)
    go(0)
    // The first layout runs before the fonts and images settle, so measure once more.
    addEventListener('load', layout)
  }

  // ---------- Join form ----------
  const form = $('#join-form')
  if (!form) return
  const email = $('#email')
  const submit = $('#submit')
  const submitLabel = $('#submit-label')
  const note = $('#form-note')
  const errorBox = $('#form-error')
  const done = $('#done')
  const already = $('#already')
  const paypal = $('#paypal')
  const paypalNote = $('#paypal-note')
  const paypalDirect = $('#paypal-direct')
  const upgrade = $('#upgrade')

  const handle = String(cfg.paypalHandle || '')
  const paypalReady = handle !== '' && !/^(YOUR|REPLACE)/i.test(handle)
  const isPreview = ['localhost', '127.0.0.1', ''].includes(location.hostname)
  const showPayPal = paypalReady || isPreview
  const paypalUrl = `https://paypal.me/${encodeURIComponent(handle)}/${price}EUR`
  paypal.href = paypalUrl
  paypalDirect.href = paypalUrl
  if (!showPayPal) already.hidden = true

  const NOTES = {
    test_group: 'One email, no newsletter spam. After this you pay 2 € with PayPal to confirm your seat.',
    waitlist: 'One email, no newsletter spam. We only write about Netlink.',
  }
  const intent = () => form.elements.intent.value

  function refresh() {
    const test = intent() === 'test_group'
    submitLabel.textContent = test ? `Join the test group · ${price} €` : 'Join the waitlist'
    note.textContent = NOTES[intent()]
  }
  form.addEventListener('change', refresh)
  refresh()

  // Every call-to-action on the page picks the matching option before it scrolls to the form.
  for (const link of $$('[data-intent]')) {
    link.addEventListener('click', () => {
      const radio = form.querySelector(`input[name="intent"][value="${link.dataset.intent}"]`)
      if (radio) { radio.checked = true; refresh() }
      if (matchMedia('(pointer: fine)').matches) setTimeout(() => email.focus({ preventScroll: true }), 700)
    })
  }

  const showError = (message) => {
    errorBox.textContent = message
    errorBox.hidden = false
  }

  const validEmail = (value) => value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)

  async function save(address, choice) {
    try {
      const response = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/join_waitlist`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: cfg.supabaseAnonKey,
          authorization: `Bearer ${cfg.supabaseAnonKey}`,
        },
        body: JSON.stringify({ p_email: address, p_intent: choice, p_source: 'website' }),
      })
      if (response.ok) return 'ok'
      const body = await response.json().catch(() => ({}))
      return body.message === 'invalid_email' ? 'email' : 'server'
    } catch {
      return 'network'
    }
  }

  function showDone(address, choice) {
    form.hidden = true
    done.hidden = false
    const test = choice === 'test_group'
    $('#done-title').textContent = test ? 'Your seat is reserved.' : 'You are on the list.'
    const text = $('#done-text')
    text.textContent = ''
    if (test) {
      text.append('Last step: pay ', `${price} €`, ' with PayPal to confirm it. We match payments to emails by hand, so if your PayPal email is not ')
      const strong = document.createElement('strong')
      strong.textContent = address
      text.append(strong, ', just write to us.')
    } else {
      text.append('We will write to ')
      const strong = document.createElement('strong')
      strong.textContent = address
      text.append(strong, ' when Netlink opens up to more people.')
    }
    paypal.hidden = !(test && showPayPal)
    paypal.textContent = `Pay ${price} € with PayPal`
    paypalNote.hidden = !test
    paypalNote.textContent = showPayPal
      ? 'Opens PayPal in a new tab. Your seat is confirmed once we see the payment.'
      : 'We will email you the PayPal link shortly.'
    upgrade.hidden = test
    upgrade.onclick = async () => {
      upgrade.disabled = true
      const result = await save(address, 'test_group')
      upgrade.disabled = false
      if (result === 'ok') showDone(address, 'test_group')
    }
    already.hidden = true
    done.focus({ preventScroll: true })
    done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorBox.hidden = true
    email.removeAttribute('aria-invalid')
    const address = email.value.trim().toLowerCase()
    const choice = intent()

    if (!validEmail(address)) {
      email.setAttribute('aria-invalid', 'true')
      showError('That email does not look right. Could you check it?')
      email.focus()
      return
    }
    // A hidden field that only bots fill in. Pretend it worked, store nothing.
    if (form.elements.company.value) return showDone(address, choice)

    submit.disabled = true
    submitLabel.textContent = 'Saving…'
    const result = await save(address, choice)
    submit.disabled = false
    refresh()
    if (result === 'ok') return showDone(address, choice)
    if (result === 'email') {
      email.setAttribute('aria-invalid', 'true')
      return showError('That email does not look right. Could you check it?')
    }
    const contact = cfg.contactEmail ? ` or write to ${cfg.contactEmail}` : ''
    showError(result === 'network'
      ? `We could not reach the server. Check your connection and try again${contact}.`
      : `Something went wrong on our side. Please try again${contact}.`)
  })
})()
