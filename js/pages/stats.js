/**
 * stats.js - 统计中心（P4）
 * 运营商分布 + 资费区间统计（自定义+最近查询）+ 客户类型 + 时间维度 + 导出
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ Store: require('../store'), TimeUtil: require('../utils/time'), UI: require('../utils/ui') });
  } else {
    root.StatsPage = factory({ Store: root.Store, TimeUtil: root.TimeUtil, UI: root.UI });
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var Store = deps.Store, TimeUtil = deps.TimeUtil, UI = deps.UI;
  var Router = (typeof window !== 'undefined' && window.Router) || (typeof global !== 'undefined' && global.Router) || null;

  var RECENT_KEY = 'bx_sj_v1_recent_ranges';
  var RECENT_LIMIT = 5;

  function getRecents() {
    try {
      if (typeof localStorage === 'undefined') return [];
      var raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveRecent(min, max) {
    if (typeof localStorage === 'undefined') return;
    var recents = getRecents();
    var key = min + '-' + max;
    recents = recents.filter(function (r) { return r !== key; });
    recents.unshift(key);
    recents = recents.slice(0, RECENT_LIMIT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recents)); } catch (e) {}
  }

  function render() {
    var s = Store.stats();
    var carriers = Store.CARRIERS;
    var cps = s.carriers;
    var maxCarrier = 1;
    carriers.forEach(function (c) { if (cps[c] > maxCarrier) maxCarrier = cps[c]; });

    var typeDefs = [
      ['government', '政企'], ['sme', '中小企'], ['individual_business', '个体'], ['home', '家庭']
    ];

    var labelMap = {};
    TimeUtil.lastNDays(7).forEach(function (x) { labelMap[x.key] = x.label; });
    var mb = maxBar(s);
    var byDayHtml = s.byDay.map(function (d) {
      var h = d.count ? Math.max(8, Math.round((d.count / mb) * 80)) : 3;
      var label = labelMap[d.date] || d.date;
      return '<div class="day-bar"><div class="bar" style="height:' + h + 'px"></div><div class="bar-label">' + label + '</div></div>';
    }).join('');

    return '<div class="page">' +
      '<div class="page-header" style="margin:-12px -14px 12px"><div class="page-title">统计中心</div></div>' +

      // 运营商
      '<div class="section-title">📡 在用运营商分布</div>' +
      '<div class="stat-blocks">' +
        carriers.map(function (c) {
          return '<div class="stat-block"><div class="sb-num">' + cps[c] + '</div><div class="sb-label">' + c + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="sub-note">※ 客户可能使用多家运营商，条数合计可大于商机总数</div>' +

      // 资费区间
      '<div class="section-title">💰 资费区间统计</div>' +
      '<div class="group-card">' +
        '<div class="range-inputs">' +
          '<input type="number" id="rangeMin" inputmode="decimal" placeholder="起(元)" min="0">' +
          '<span>—</span>' +
          '<input type="number" id="rangeMax" inputmode="decimal" placeholder="止(元)" min="0">' +
          '<button class="btn btn-sm" id="rangeBtn">统计</button>' +
        '</div>' +
        '<div class="range-recents" id="rangeRecents">' +
          getRecents().map(function (r) { return '<span class="range-chip" data-range="' + r + '">' + r + ' 元</span>'; }).join('') +
        '</div>' +
        '<div id="rangeResult"></div>' +
      '</div>' +

      // 客户类型
      '<div class="section-title">🏢 客户类型分布</div>' +
      '<div class="stat-blocks" style="grid-template-columns:repeat(4,1fr)">' +
        typeDefs.map(function (t) {
          return '<div class="stat-block"><div class="sb-num">' + (s.clientTypes[t[0]] || 0) + '</div><div class="sb-label">' + t[1] + '</div></div>';
        }).join('') +
      '</div>' +

      // 时间维度
      '<div class="section-title">📅 时间维度</div>' +
      '<div class="stat-blocks" style="grid-template-columns:repeat(3,1fr)">' +
        '<div class="stat-block"><div class="sb-num">' + s.today + '</div><div class="sb-label">今日</div></div>' +
        '<div class="stat-block"><div class="sb-num">' + s.week + '</div><div class="sb-label">本周</div></div>' +
        '<div class="stat-block"><div class="sb-num">' + s.month + '</div><div class="sb-label">本月</div></div>' +
      '</div>' +
      '<div class="group-card" style="margin-top:10px"><div style="font-size:13px;color:var(--cm-color-text-secondary);margin-bottom:6px">近 7 天录入趋势</div>' +
        '<div class="day-bars">' + byDayHtml + '</div>' +
      '</div>' +

      // 导出
      '<div style="margin:20px 0 30px">' +
        '<button class="btn btn-block" id="exportBtn">📥 导出 Excel</button>' +
      '</div>' +
    '</div>';
  }

  function maxBar(s) {
    var m = 1;
    s.byDay.forEach(function (d) { if (d.count > m) m = d.count; });
    return m;
  }

  function renderRangeResult(result, min, max) {
    var box = document.getElementById('rangeResult');
    if (!box) return;
    if (!result.count) {
      box.innerHTML = '<div class="empty" style="padding:20px"><div class="empty-desc">区间内没有商机</div></div>';
      return;
    }
    var html = '<div class="result-nums">' +
      '<div class="rn"><div class="rn-num">' + result.count + '</div><div class="rn-label">条数</div></div>' +
      '<div class="rn"><div class="rn-num">' + result.sum + '</div><div class="rn-label">月费合计(元)</div></div>' +
      '<div class="rn"><div class="rn-num">' + result.avg + '</div><div class="rn-label">平均月费(元)</div></div>' +
      '</div>' +
      '<div class="range-detail">' +
        '<div style="font-size:12px;color:var(--cm-color-text-secondary);margin-bottom:4px">区间明细（' + min + '–' + max + ' 元）</div>' +
        result.leads.map(function (l) {
          return '<div class="range-detail-item" data-id="' + l.id + '">' +
            '<span>' + UI.esc(l.customerName) + '</span>' +
            '<span style="font-weight:600;">' + l.packageFee + ' 元/月</span>' +
          '</div>';
        }).join('') +
      '</div>';
    box.innerHTML = html;
    // 点击明细进详情
    box.querySelectorAll('[data-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (Router) Router.go('detail', { id: el.getAttribute('data-id') });
      });
    });
  }

  function doRange(min, max) {
    var mi = Number(min), ma = Number(max);
    if (isNaN(mi) || min === '' || min == null) mi = null;
    if (isNaN(ma) || max === '' || max == null) ma = null;
    if (mi != null && ma != null && mi > ma) {
      UI.toast('起始金额不能大于截止金额');
      return;
    }
    if (mi == null && ma == null) {
      UI.toast('请输入区间金额');
      return;
    }
    if (mi != null && ma != null) saveRecent(mi, ma);
    var result = Store.feeRange({ min: mi, max: ma });
    renderRangeResult(result, mi == null ? '' : mi, ma == null ? '' : ma);
  }

  function bind(container, query) {
    var rangeBtn = document.getElementById('rangeBtn');
    if (rangeBtn) rangeBtn.addEventListener('click', function () {
      doRange(document.getElementById('rangeMin').value, document.getElementById('rangeMax').value);
    });
    var recents = document.getElementById('rangeRecents');
    if (recents) recents.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-range]');
      if (!chip) return;
      var parts = chip.getAttribute('data-range').split('-');
      var mi = Number(parts[0]), ma = Number(parts[1]);
      document.getElementById('rangeMin').value = isNaN(mi) ? '' : mi;
      document.getElementById('rangeMax').value = isNaN(ma) ? '' : ma;
      doRange(mi, ma);
    });
    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      if (typeof ExportUtil !== 'undefined') {
        var r = ExportUtil.exportXlsx(Store.all());
        if (r.ok) UI.toast('已导出：' + r.fileName);
        else UI.toast(r.error || '导出失败');
      } else {
        UI.toast('导出组件未加载');
      }
    });
  }

  return {
    render: render,
    mounted: bind,
    _doRange: doRange,
    _renderRangeResult: renderRangeResult,
    _saveRecent: saveRecent,
    _getRecents: getRecents
  };
});
