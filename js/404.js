// 404页面点击返回首页
(function() {
  if (document.querySelector('.type-404')) {
    document.querySelector('.error-info').addEventListener('click', function() {
      window.location.href = '/';
    });
  }
})();