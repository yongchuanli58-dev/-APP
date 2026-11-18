/**
 * app.js - 应用初始化与全局装配
 * 职责：注册路由、绑定 Tab、检测存储模式、启动路由
 */
(function () {
  'use strict';

  function initTabbar() {
    var tabbar = document.getElementById('tabbar');
    if (!tabbar) return;
    tabbar.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-route]');
      if (!tab) return;
      var route = tab.getAttribute('data-route');
      Router.go(route);
    });
  }

  /** 存储模式检测：隐私模式提示 */
  function checkStorageMode() {
    var banner = document.getElementById('banner-container');
    if (!banner) return;
    try {
      var k = '__bx_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      banner.innerHTML = ''; // 正常模式，无需提示
    } catch (e) {
      banner.innerHTML =
        '<div class="banner banner-danger">当前为隐私/无痕模式，数据将不会被保存；请改用普通模式浏览。</div>';
    }
  }

  /** Tab 高亮由 Router.render 管理 */
  function registerRoutes() {
    Router.register('home', { render: HomePage.render, mounted: HomePage.mounted });
    Router.register('input', { render: InputPage.render, mounted: InputPage.mounted });
    Router.register('detail', { render: DetailPage.render, mounted: DetailPage.mounted });
    Router.register('stats', { render: StatsPage.render, mounted: StatsPage.mounted });
    Router.register('mine', { render: MinePage.render, mounted: MinePage.mounted });
    Router.register('share', { render: SharePage.render, mounted: SharePage.mounted });
    Router.register('guide', { render: GuidePage.render, mounted: GuidePage.mounted });
  }

  function boot() {
    // 首次使用：先看引导页（无 device_id 即新设备）
    var devId = Store.getDeviceId();
    if (!devId) {
      Router.go('guide');
    }
    initTabbar();
    registerRoutes();
    checkStorageMode();
    Router.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
