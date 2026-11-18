/**
 * guide.js - 首次引导页（P7）
 * 3 步滑动引导：这是什么 / 怎么录商机 / 数据存哪
 * 结束进入首页。仅首次设备显示（app.js 判断无 device_id 时跳转）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ UI: require('../utils/ui') });
  } else {
    root.GuidePage = factory({ UI: root.UI });
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var UI = deps.UI;
  var Router = (typeof window !== 'undefined' && window.Router) || (typeof global !== 'undefined' && global.Router) || null;

  var STEPS = [
    { icon: '📡', title: '宽带线索商机', desc: '一线师傅专用商机收集工具，帮您记录客户、跟踪线索、提升专线宽带份额。' },
    { icon: '📍', title: '怎么录商机', desc: '到客户处点击「打卡」自动定位，选择客户类型与在用运营商，填入资费和客户信息即可保存。' },
    { icon: '🔒', title: '数据存哪', desc: '数据只存在您的手机本地，刷新、关机、重启都不丢。分享模板给同事时，不会带出您的数据。' }
  ];

  function render() {
    return '<div class="guide-page">' +
      '<div id="guideSlides" style="flex:1;overflow:hidden;position:relative">' +
        STEPS.map(function (s, i) {
          return '<div class="guide-slide' + (i === 0 ? ' active' : '') + '" data-slide="' + i + '">' +
            '<div class="guide-icon">' + s.icon + '</div>' +
            '<div class="guide-title">' + UI.esc(s.title) + '</div>' +
            '<div class="guide-desc">' + UI.esc(s.desc) + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="guide-dots" id="guideDots">' +
        STEPS.map(function (_, i) {
          return '<span class="dot' + (i === 0 ? ' active' : '') + '" data-dot="' + i + '"></span>';
        }).join('') +
      '</div>' +
      '<div style="padding:6px 24px 30px">' +
        '<button class="btn btn-block" id="guideNext">下一步</button>' +
      '</div>' +
    '</div>';
  }

  var step = 0;

  function bind(container, query) {
    step = 0;
    var slides = document.getElementById('guideSlides');
    var btn = document.getElementById('guideNext');

    var show = function (i) {
      step = Math.max(0, Math.min(STEPS.length - 1, i));
      slides.querySelectorAll('.guide-slide').forEach(function (s, idx) {
        s.classList.toggle('active', idx === step);
      });
      document.querySelectorAll('#guideDots .dot').forEach(function (d, idx) {
        d.classList.toggle('active', idx === step);
      });
      btn.textContent = step === STEPS.length - 1 ? '立即开始' : '下一步';
    };

    btn.addEventListener('click', function () {
      if (step < STEPS.length - 1) {
        show(step + 1);
      } else {
        // 结束引导 → 首页
        if (Router) Router.go('home');
      }
    });

    // 左右滑动切换
    var startX = null;
    slides.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    slides.addEventListener('touchend', function (e) {
      if (startX == null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) {
        show(dx < 0 ? step + 1 : step - 1);
      }
    }, { passive: true });
  }

  return {
    render: render,
    mounted: bind,
    _STEPS: STEPS
  };
});
