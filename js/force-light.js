// 强制亮色模式 - 彻底清除深色残留
(function() {
  'use strict';
  
  // 立即设置亮色
  function forceLight() {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark-mode');
    document.body.classList.remove('dark-mode');
    
    // 清除存储
    try {
      localStorage.removeItem('theme');
      localStorage.setItem('theme', 'light');
      sessionStorage.removeItem('theme');
      document.cookie = 'theme=light;path=/;max-age=31536000';
    } catch(e) {}
  }
  
  // 立即执行
  forceLight();
  
  // DOM加载后再次确保
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceLight);
  } else {
    forceLight();
  }
  
  // 监听任何主题切换尝试并阻止
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'data-theme' && value === 'dark') {
      value = 'light';
    }
    return originalSetAttribute.call(this, name, value);
  };
  
  // 阻止类名添加
  const originalAdd = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function() {
    const args = Array.from(arguments).map(function(item) {
      return item === 'dark-mode' ? 'light-mode' : item;
    });
    return originalAdd.apply(this, args);
  };
})();