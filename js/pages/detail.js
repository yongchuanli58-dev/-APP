/**
 * detail.js - 商机详情页（P3）
 * 功能：完整展示、拨打、导航、编辑入口、删除（二次确认）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ Store: require('../store'), TimeUtil: require('../utils/time'), UI: require('../utils/ui') });
  } else {
    root.DetailPage = factory({ Store: root.Store, TimeUtil: root.TimeUtil, UI: root.UI });
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var Store = deps.Store, TimeUtil = deps.TimeUtil, UI = deps.UI;
  var Router = (typeof window !== 'undefined' && window.Router) || (typeof global !== 'undefined' && global.Router) || null;
  var AmapUtil = (typeof window !== 'undefined' && window.AmapUtil) || (typeof global !== 'undefined' && global.AmapUtil) || null;

  function render(query) {
    var id = query && query.id ? String(query.id) : '';
    var lead = Store.get(id);
    if (!lead) {
      return '<div class="page">' +
        '<div class="empty">' +
          '<div class="empty-icon">🔍</div>' +
          '<div class="empty-title">商机不存在</div>' +
          '<div class="empty-desc">该商机可能已被删除</div>' +
          '<button class="btn" onclick="location.hash=\'#/home\'">返回首页</button>' +
        '</div>' +
      '</div>';
    }
    var loc = lead.location || {};
    return '<div class="page">' +
      // 返回 + 标题
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<button class="icon-btn" id="backBtn">←</button>' +
        '<div style="flex:1;font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.esc(lead.customerName) + '</div>' +
      '</div>' +

      '<div class="group-card">' +
        '<div class="lead-badges" style="margin-bottom:8px">' + UI.clientTypeBadge(lead.clientType) +
          ' <span style="margin-left:6px;font-size:12px;color:var(--cm-color-text-secondary)">' + UI.clientTypeFull(lead.clientType) + '</span></div>' +
        '<div class="lead-meta" style="font-size:14px;margin-bottom:4px"><span>在用运营商</span></div>' +
        '<div class="lead-badges" style="margin-bottom:10px">' + UI.carrierBadges(lead.carriers) + '</div>' +
        '<div class="lead-meta" style="font-size:14px;margin-bottom:4px">套餐资费</div>' +
        '<div class="lead-meta" style="margin-bottom:2px">' +
          UI.esc(lead.packageName || '未填套餐名称') + ' · ' +
          (lead.packageFee != null ? '<b>' + lead.packageFee + ' 元/月</b>' : '<span class="muted">资费未知</span>') +
        '</div>' +
      '</div>' +

      '<div class="group-card">' +
        '<div class="lead-meta" style="font-size:14px;margin-bottom:4px">客户信息</div>' +
        infoRow('联系电话', lead.phone, '📞') +
        infoRow('性别', UI.genderText(lead.gender)) +
        infoRow('资费水平', UI.feeLevelText(lead.feeLevel)) +
        infoRow('回流意愿', UI.returnIntentText(lead.returnIntent)) +
      '</div>' +

      '<div class="group-card">' +
        '<div class="lead-meta" style="font-size:14px;margin-bottom:4px">位置信息</div>' +
        infoRow('打卡地址', loc.address || '未打卡定位') +
        infoRow('定位时间', loc.locatedAt ? TimeUtil.formatDateTime(loc.locatedAt) : '—') +
      '</div>' +

      '<div class="lead-meta" style="font-size:12px;color:var(--cm-color-text-placeholder);margin:6px 4px 12px">' +
        '录入于 ' + TimeUtil.formatDateTime(lead.createTime) +
        (lead.updateTime !== lead.createTime ? ' · 更新于 ' + TimeUtil.formatDateTime(lead.updateTime) : '') +
      '</div>' +

      '<div style="display:flex;gap:10px;margin-bottom:40px">' +
        '<button class="btn btn-outline" id="callBtn">📞 拨打客户</button>' +
        '<button class="btn btn-outline" id="navBtn">🧭 点击导航</button>' +
      '</div>' +

      '<div style="display:flex;gap:10px">' +
        '<button class="btn" id="editBtn" style="flex:1">✏️ 编辑</button>' +
        '<button class="btn btn-danger" id="delBtn" style="flex:1">🗑️ 删除</button>' +
      '</div>' +
    '</div>';
  }

  function infoRow(label, val, icon) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #f2f3f5">' +
      '<span style="color:var(--cm-color-text-secondary)">' + (icon || '') + ' ' + UI.esc(label) + '</span>' +
      '<span style="font-weight:500;text-align:right;word-break:break-all">' + UI.esc(val || '—') + '</span>' +
    '</div>';
  }

  function bind(container, query) {
    var id = query && query.id ? String(query.id) : '';
    var lead = Store.get(id);
    if (!lead) return;

    document.getElementById('backBtn').addEventListener('click', function () { Router.go('home'); });
    document.getElementById('callBtn').addEventListener('click', function () {
      UI.confirm({ title: '拨打客户', body: '拨打 ' + UI.esc(lead.phone) + '？', confirmText: '拨打' }).then(function (ok) {
        if (ok) window.location.href = 'tel:' + lead.phone;
      });
    });
    document.getElementById('navBtn').addEventListener('click', function () {
      var loc = lead.location;
      if (!loc || !loc.lng || !loc.lat) { UI.toast('该商机没有打卡定位，无法导航'); return; }
      UI.confirm({ title: '导航前往', body: '使用高德导航前往「' + UI.esc(lead.customerName) + '」？', confirmText: '导航' }).then(function (ok) {
        if (ok) AmapUtil.openNavigation({ lng: loc.lng, lat: loc.lat, name: lead.customerName });
      });
    });
    document.getElementById('editBtn').addEventListener('click', function () { Router.go('input', { id: id }); });
    document.getElementById('delBtn').addEventListener('click', function () {
      UI.confirm({
        title: '删除商机',
        body: '确定删除「' + UI.esc(lead.customerName) + '」？删除后不可恢复。',
        confirmText: '删除',
        danger: true
      }).then(function (ok) {
        if (ok) {
          Store.remove(id);
          UI.toast('已删除');
          Router.go('home');
        }
      });
    });
  }

  return {
    render: render,
    mounted: bind,
    _infoRow: infoRow
  };
});
