/**
 * ui.js - 通用 UI 工具
 * toast 提示、自定义确认框、徽标渲染、安全 HTML 转义
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 轻量 toast */
  function toast(msg, duration) {
    var d = duration || 2000;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(function () { el.remove(); }, 320);
    }, d);
  }

  /**
   * 自定义确认框（Promise）
   * opts: { title, body, confirmText, cancelText, danger }
   * 返回 Promise<boolean>
   */
  function confirm(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML =
        '<div class="modal-box">' +
          '<div class="modal-title">' + esc(opts.title || '确认') + '</div>' +
          '<div class="modal-body">' + esc(opts.body || '') + '</div>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-outline" data-act="cancel">' + esc(opts.cancelText || '取消') + '</button>' +
            '<button class="btn' + (opts.danger ? ' btn-danger' : '') + '" data-act="ok">' + esc(opts.confirmText || '确定') + '</button>' +
          '</div>' +
        '</div>';
      mask.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        var done = function (val) {
          mask.remove();
          resolve(val);
        };
        if (act === 'ok') done(true);
        else if (act === 'cancel') done(false);
        else if (e.target === mask) done(false); // 点遮罩取消
      });
      document.body.appendChild(mask);
    });
  }

  /** 客户类型徽标 */
  function clientTypeBadge(type) {
    var map = {
      government: ['gov', '政府事业'],
      sme: ['sme', '中小企'],
      individual_business: ['ind', '个体'],
      home: ['home', '家庭']
    };
    var m = map[type] || ['sme', type];
    return '<span class="badge badge-' + m[0] + '">' + esc(m[1]) + '</span>';
  }

  /** 运营商徽标（多个） */
  function carrierBadges(carriers) {
    if (!carriers || !carriers.length) return '<span class="muted">未登记</span>';
    var map = { '移动': 'mobile', '联通': 'unicom', '电信': 'telecom', '广电': 'broadcast' };
    return carriers.map(function (c) {
      var cls = map[c] || 'mobile';
      return '<span class="badge badge-' + cls + '">' + esc(c) + '</span>';
    }).join(' ');
  }

  /** 资费水平中文 */
  function feeLevelText(v) {
    return v ? v : '未填';
  }

  /** 回流意愿中文 */
  function returnIntentText(v) {
    return v ? v : '未填';
  }

  function genderText(v) {
    return v ? v : '未填';
  }

  /** 客户类型中文（详情页用全称） */
  function clientTypeFull(type) {
    var map = {
      government: '政府事业单位',
      sme: '中小企业',
      individual_business: '个体工商户',
      home: '个人家庭'
    };
    return map[type] || '';
  }

  return {
    esc: esc,
    toast: toast,
    confirm: confirm,
    clientTypeBadge: clientTypeBadge,
    carrierBadges: carrierBadges,
    feeLevelText: feeLevelText,
    returnIntentText: returnIntentText,
    genderText: genderText,
    clientTypeFull: clientTypeFull
  };
});
