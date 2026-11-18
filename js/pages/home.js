/**
 * home.js - 商机首页（P1）
 * 概览 + 清单 + 搜索 + 筛选 + 拨打/导航 + 左滑删除 + 懒加载
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node 测试环境：注入 store/time/ui；Router/AmapUtil 用 global（测试桩）
    module.exports = factory({ Store: require('../store'), TimeUtil: require('../utils/time'), UI: require('../utils/ui') });
  } else {
    root.HomePage = factory({ Store: root.Store, TimeUtil: root.TimeUtil, UI: root.UI });
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var Store = deps.Store, TimeUtil = deps.TimeUtil, UI = deps.UI;
  var Router = (typeof window !== 'undefined' && window.Router) || (typeof global !== 'undefined' && global.Router) || null;
  var AmapUtil = (typeof window !== 'undefined' && window.AmapUtil) || (typeof global !== 'undefined' && global.AmapUtil) || null;

  var PAGE_SIZE = 50;
  var state = {
    keyword: '',
    filter: 'all',       // all | today | week
    offset: 0,
    loaded: []
  };

  function render() {
    var s = Store.stats();
    return '' +
      // 页头
      '<div class="page-header">' +
        '<div class="page-title">宽带线索商机</div>' +
        '<div class="header-actions">' +
          '<button class="icon-btn" id="searchToggle">🔍</button>' +
        '</div>' +
      '</div>' +
      // 概览
      '<div class="page">' +
        '<div class="overview">' +
          ov('今日', s.today) + ov('本周', s.week) + ov('总数', s.total) +
        '</div>' +
        // 搜索框（默认隐藏）
        '<div class="search-bar hidden" id="searchWrap" style="margin:10px 0 4px">' +
          '<span class="search-icon">🔍</span>' +
          '<input type="search" id="searchInput" placeholder="搜索：名称 / 电话 / 地点">' +
        '</div>' +
        // 筛选
        '<div class="filter-chips scroll-x" id="filterChips">' +
          chip('all', '全部') + chip('today', '今天') + chip('week', '本周') +
        '</div>' +
        '<div id="leadList"></div>' +
        '<div class="load-more" id="loadMore">上拉加载更多</div>' +
      '</div>';
  }

  function ov(label, n) {
    return '<div class="ov-item"><div class="ov-num">' + n + '</div><div class="ov-label">' + label + '</div></div>';
  }

  function chip(val, label) {
    return '<span class="filter-chip' + (state.filter === val ? ' active' : '') + '" data-filter="' + val + '">' + label + '</span>';
  }

  /** 组装 list 查询参数（纯函数） */
  function buildOpts(filter, keyword, offset) {
    var opts = { keyword: keyword || '', limit: (offset || 0) + PAGE_SIZE, sort: 'desc' };
    var now = new Date();
    if (filter === 'today') {
      var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      opts.from = t0.toISOString();
    } else if (filter === 'week') {
      var day = now.getDay() || 7;
      var w0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
      opts.from = w0.toISOString();
    }
    return opts;
  }

  function loadMore() {
    var opts = buildOpts(state.filter, state.keyword, state.offset);
    var all = Store.list(opts);
    state.loaded = all;
    state.offset = all.length;
    renderList(all);
  }

  function renderList(leads) {
    var el = document.getElementById('leadList');
    if (!el) return;
    var html;
    if (!leads.length) {
      html = '<div class="empty">' +
        '<div class="empty-icon">🗂️</div>' +
        '<div class="empty-title">' + (state.keyword ? '没有找到相关商机' : '还没有商机') + '</div>' +
        '<div class="empty-desc">' + (state.keyword ? '换个关键词试试' : '点击下方【录入】开始记录第一条') + '</div>' +
      '</div>';
    } else {
      html = leads.map(cardHtml).join('');
    }
    el.innerHTML = html;
    var lm = document.getElementById('loadMore');
    if (lm) {
      var total = Store.count();
      lm.textContent = leads.length >= total ? (total ? '已全部加载 (' + total + ' 条)' : '') : '上拉加载更多';
    }
  }

  function cardHtml(l) {
    var addr = (l.location && l.location.address) || '';
    return '<div class="lead-card" data-id="' + (l.id || '') + '">' +
      '<div class="lead-card-head">' +
        '<div class="lead-name">' + UI.esc(l.customerName) + '</div>' +
        '<div class="lead-badges">' + UI.clientTypeBadge(l.clientType) + '</div>' +
      '</div>' +
      '<div class="lead-badges" style="margin-bottom:6px">' + UI.carrierBadges(l.carriers) + '</div>' +
      '<div class="lead-meta">' +
        '<span>' + (l.packageFee != null ? l.packageFee + ' 元/月' : '资费未知') + '</span>' +
        '<span>📍' + UI.esc(addr || '未定位') + '</span>' +
      '</div>' +
      '<div class="lead-meta" style="width:100%"><span>🕒' + TimeUtil.relativeTime(l.createTime) + '</span></div>' +
      '<div class="lead-actions">' +
        '<button class="btn btn-sm btn-outline" data-act="call">📞 拨打客户</button>' +
        '<button class="btn btn-sm btn-outline" data-act="nav">🧭 点击导航</button>' +
      '</div>' +
    '</div>';
  }

  function bind(container) {
    var searchToggle = document.getElementById('searchToggle');
    if (searchToggle) searchToggle.addEventListener('click', function () {
      document.getElementById('searchWrap').classList.toggle('hidden');
      var input = document.getElementById('searchInput');
      if (!document.getElementById('searchWrap').classList.contains('hidden')) input.focus();
    });

    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', function () {
      state.keyword = this.value;
      debounceReload();
    });

    var chips = document.getElementById('filterChips');
    if (chips) chips.addEventListener('click', function (e) {
      var c = e.target.closest('[data-filter]');
      if (!c) return;
      state.filter = c.getAttribute('data-filter');
      this.querySelectorAll('.filter-chip').forEach(function (x) { x.classList.remove('active'); });
      c.classList.add('active');
      reload();
    });

    var list = document.getElementById('leadList');
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      var card = e.target.closest('.lead-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      if (btn) {
        var act = btn.getAttribute('data-act');
        var lead = Store.get(id);
        if (!lead) return;
        if (act === 'call') doCall(lead);
        else if (act === 'nav') doNav(lead);
        return;
      }
      // 点卡片主体进详情（点击按钮外区域）
      if (e.target.closest('.lead-actions')) return;
      Router.go('detail', { id: id });
    });

    // 左滑删除：通过 touch 事件
    list.addEventListener('touchstart', onTouchStart, { passive: true });
    list.addEventListener('touchend', onTouchEnd, { passive: true });

    // 上拉加载（滚动到容器底部）
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var touchStartX = null, touchStartY = null, touchId = null;

  function onTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (touchStartX == null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = touchStartY = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      // 左滑
      if (dx < 0) {
        var card = e.target.closest('.lead-card');
        if (!card) return;
        var id = card.getAttribute('data-id');
        UI.confirm({
          title: '删除商机',
          body: '确定删除「' + (Store.get(id) || {}).customerName + '」这条商机？',
          confirmText: '删除',
          danger: true
        }).then(function (ok) {
          if (ok) {
            Store.remove(id);
            UI.toast('已删除');
            reload();
          }
        });
      }
    }
  }

  function onScroll() {
    var doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 40) {
      loadMore();
    }
  }

  var timer = null;
  function debounceReload() {
    clearTimeout(timer);
    timer = setTimeout(reload, 250);
  }
  function reload() {
    state.offset = 0;
    loadMore();
  }

  function doCall(lead) {
    UI.confirm({
      title: '拨打客户',
      body: '拨打 ' + UI.esc(lead.phone) + '？',
      confirmText: '拨打'
    }).then(function (ok) {
      if (ok) {
        window.location.href = 'tel:' + lead.phone;
      }
    });
  }

  function doNav(lead) {
    var loc = lead.location;
    if (!loc || !loc.lng || !loc.lat) {
      UI.toast('该商机没有打卡定位，无法导航');
      return;
    }
    UI.confirm({
      title: '导航前往',
      body: '使用高德导航前往「' + UI.esc(lead.customerName) + '」？',
      confirmText: '导航'
    }).then(function (ok) {
      if (ok) {
        AmapUtil.openNavigation({ lng: loc.lng, lat: loc.lat, name: lead.customerName })
          .catch(function () { UI.toast('无法打开导航'); });
      }
    });
  }

  function onLeave() {
    window.removeEventListener('scroll', onScroll);
  }

  return {
    render: render,
    mounted: function (container) {
      bind(container);
      reload();
    },
    onLeave: onLeave,
    /** 测试辅助 */
    _reload: reload,
    _state: state,
    _buildOpts: buildOpts,
    _cardHtml: cardHtml,
    _PAGE_SIZE: PAGE_SIZE
  };
});
