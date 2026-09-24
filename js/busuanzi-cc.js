(function () {
  'use strict'

  if (window.__busuanziCcInitialized) return
  window.__busuanziCcInitialized = true

  const endpoint = 'https://cdn.busuanzi.cc/api.php'
  const fields = [
    'site_pv',
    'site_uv',
    'page_pv',
    'page_uv',
    'today_pv',
    'today_uv'
  ]

  const render = data => {
    fields.forEach(field => {
      const value = data[`busuanzi_${field}`]
      if (value === undefined) return

      document
        .querySelectorAll(`#busuanzi_${field}, #busuanzi_value_${field}`)
        .forEach(element => {
          element.textContent = value
        })
    })
  }

  const update = () => {
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: window.location.href,
        referrer: document.referrer
      })
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(render)
      .catch(error => {
        console.error('Busuanzi.cc request failed:', error)
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update, { once: true })
  } else {
    update()
  }

  document.addEventListener('pjax:complete', update)
})()
