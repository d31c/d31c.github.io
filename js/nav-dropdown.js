(function () {
  'use strict'

  const initNavDropdowns = () => {
    const nav = document.getElementById('nav')
    if (!nav) return

    const closeOthers = keepOpenItem => {
      nav.querySelectorAll('.menus_item.open').forEach(item => {
        if (item !== keepOpenItem) item.classList.remove('open')
      })
    }

    const openItem = item => {
      closeOthers(item)
      if (!item || !item.querySelector('.menus_item_child')) return
      item.classList.add('open')
    }

    nav.addEventListener('mouseover', event => {
      const item = event.target.closest('.menus_item')
      if (item && nav.contains(item)) {
        openItem(item)
      } else {
        closeOthers(null)
      }
    })

    nav.addEventListener('mouseleave', () => {
      closeOthers(null)
    })

    nav.addEventListener('focusin', event => {
      const item = event.target.closest('.menus_item')
      if (item && nav.contains(item)) {
        openItem(item)
      } else {
        closeOthers(null)
      }
    })

    nav.addEventListener('focusout', event => {
      if (!nav.contains(event.relatedTarget)) closeOthers(null)
    })
  }

  initNavDropdowns()
  document.addEventListener('pjax:complete', initNavDropdowns)
})()