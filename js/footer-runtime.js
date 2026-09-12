(function () {
  'use strict'

  const pad = value => String(value).padStart(2, '0')

  const updateFooterRuntime = () => {
    const element = document.getElementById('footer-runtime')
    if (!element) return

    const startTime = Date.parse(element.dataset.start)
    if (Number.isNaN(startTime)) {
      element.textContent = '本站已运行：时间配置错误'
      return
    }

    const totalSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000))
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    element.textContent = `本站已运行：${days} 天 ${pad(hours)} 小时 ${pad(minutes)} 分 ${pad(seconds)} 秒`
  }

  updateFooterRuntime()
  if (window.__footerRuntimeTimer) window.clearInterval(window.__footerRuntimeTimer)
  window.__footerRuntimeTimer = window.setInterval(updateFooterRuntime, 1000)
  document.addEventListener('pjax:complete', updateFooterRuntime)
})()