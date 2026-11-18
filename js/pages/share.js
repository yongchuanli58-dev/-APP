/**
 * share.js - 分享预览页（P6）
 * 生成纯应用地址（不含任何数据）+ 二维码 + 复制链接 + 系统分享
 * 核心安全：分享 URL 不带 device_id、不带数据 → 同事打开即为全新空库
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ Store: require('../store'), UI: require('../utils/ui') });
  } else {
    root.SharePage = factory({ Store: root.Store, UI: root.UI });
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var Store = deps.Store, UI = deps.UI;

  /**
   * 生成分享链接：去掉 hash、query、device 等一切私有信息
   * 仅保留协议+域名+路径（静态托管地址）
   */
  function buildShareUrl() {
    var href = (typeof location !== 'undefined') ? location.href : '';
    var idx = href.search(/[?#]/);
    var base = idx >= 0 ? href.slice(0, idx) : href;
    // 去掉结尾 # 等
    return base.replace(/[#?].*$/, '');
  }

  function render() {
    var url = buildShareUrl();
    return '<div class="page">' +
      '<div class="page-header" style="margin:-12px -14px 12px"><div class="page-title">分享模板</div></div>' +

      // 预览卡片
      '<div class="group-card" style="text-align:center;padding:24px 16px">' +
        '<div style="font-size:44px;margin-bottom:10px">📡</div>' +
        '<div style="font-weight:700;font-size:17px;margin-bottom:4px">宽带线索商机</div>' +
        '<div class="sub-note" style="margin-bottom:14px">一线师傅专用商机收集工具</div>' +
        '<div style="background:var(--cm-color-bg);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--cm-color-success);margin-bottom:14px">✓ 空白模板 · 商机清单为空</div>' +
        '<div id="qrBox" style="display:flex;justify-content:center;margin-bottom:10px;background:#fff;padding:12px"></div>' +
        '<div class="sub-note" style="word-break:break-all" id="shareUrlText">' + UI.esc(url) + '</div>' +
      '</div>' +

      // 分享方式
      '<div class="section-title">分享方式</div>' +
      '<div class="group-card">' +
        '<button class="btn btn-block" id="copyBtn" style="margin-bottom:10px">📋 复制链接</button>' +
        '<button class="btn btn-outline btn-block" id="sysBtn">📤 系统分享</button>' +
      '</div>' +

      // 安全说明
      '<div class="group-card" style="border-color:var(--cm-color-success)">' +
        '<div style="font-weight:600;font-size:13px;color:var(--cm-color-success);margin-bottom:6px">🔒 安全说明</div>' +
        '<div class="sub-note">同事打开后将获得全新的空白商机库，自行录入自己的线索。</div>' +
        '<div class="sub-note">你的商机数据存放在你的手机本地，不会随分享链接泄露。</div>' +
      '</div>' +
    '</div>';
  }

  function bind(container, query) {
    var url = buildShareUrl();
    // 生成二维码：有 QRCode 库则渲染，否则显示放大链接文本（降级）
    var qrBox = document.getElementById('qrBox');
    if (typeof QRCode !== 'undefined') {
      try {
        qrBox.innerHTML = '';
        new QRCode(qrBox, { text: url, width: 150, height: 150 });
      } catch (e) {
        qrBox.innerHTML = '<div class="sub-note">二维码生成失败，请使用复制链接方式</div>';
      }
    } else {
      qrBox.innerHTML = '<div style="font-size:18px;font-weight:700;word-break:break-all;max-width:240px">' +
        UI.esc(url) + '</div><div class="sub-note" style="margin-top:6px">（可长按链接复制，或点击下方复制按钮）</div>';
    }

    document.getElementById('copyBtn').addEventListener('click', function () {
      var input = document.createElement('textarea');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      input.remove();
      if (ok) UI.toast('链接已复制');
      else {
        // 降级：显示可手动复制的文本框
        var t = document.getElementById('shareUrlText');
        t.textContent = url;
        UI.toast('请长按链接手动复制');
      }
    });

    document.getElementById('sysBtn').addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: '宽带线索商机', text: '一线师傅专用商机收集工具（空白模板）', url: url })
          .catch(function () { UI.toast('分享已取消'); });
      } else {
        // 降级：复制链接
        var input = document.createElement('textarea');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        try { document.execCommand('copy'); } catch (e) {}
        input.remove();
        UI.toast('当前环境不支持系统分享，已复制链接');
      }
    });
  }

  return {
    render: render,
    mounted: bind,
    _buildShareUrl: buildShareUrl
  };
});
