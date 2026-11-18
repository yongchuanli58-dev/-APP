/**
 * router.js - 轻量 hash 路由
 * 用 location.hash 驱动页面切换（#/home、#/input?id=xxx、#/detail?id=xxx）
 * 页面注册：Router.register('home', { render: fn, onLeave: fn? })
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Router = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 解析 hash 为 { path, query }。如 '#/detail?id=3' → {path:'detail', query:{id:'3'}} */
  function parseHash(hash) {
    var h = (hash || '').replace(/^#\/?/, '');
    if (!h) return { path: '', query: {} };
    var parts = h.split('?');
    var path = parts[0].replace(/\/$/, '');
    var query = {};
    if (parts.length > 1 && parts[1]) {
      parts[1].split('&').forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf('=');
        var k = i < 0 ? kv : kv.slice(0, i);
        var v = i < 0 ? '' : kv.slice(i + 1);
        try { query[decodeURIComponent(k)] = decodeURIComponent(v); }
        catch (e) { query[k] = v; }
      });
    }
    return { path: path, query: query };
  }

  var routes = {};
  var current = null;

  var Router = {
    /** 注册页面路由 */
    register: function (path, handler) {
      routes[path] = handler;
      return this;
    },

    /** 获取当前路由路径 */
    path: function () {
      return parseHash(location.hash).path;
    },

    /** 获取当前路由 query */
    query: function () {
      return parseHash(location.hash).query;
    },

    /** 解析 hash（供外部测试/使用） */
    parse: parseHash,

    /** 跳转：Router.go('detail', {id:'3'}) 或 Router.go('detail?id=3') */
    go: function (target, query) {
      var s;
      if (typeof target === 'string' && target.indexOf('?') >= 0) {
        s = '#/' + target;
      } else {
        s = '#/' + target;
        if (query) {
          var qs = Object.keys(query).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
          }).join('&');
          if (qs) s += '?' + qs;
        }
      }
      location.hash = s;
    },

    /** 渲染当前路由（监听 hashchange 时调用） */
    render: function () {
      var p = parseHash(location.hash);
      var handler = routes[p.path];
      if (!handler) {
        handler = routes['home']; // 兜底回首页
        p = { path: 'home', query: {} };
      }
      if (current && current.path !== p.path && routes[current.path] && routes[current.path].onLeave) {
        try { routes[current.path].onLeave(); } catch (e) { /* ignore */ }
      }
      current = p;
      var container = document.getElementById('page-container');
      if (handler && typeof handler.render === 'function') {
        container.innerHTML = handler.render(p.query);
        if (typeof handler.mounted === 'function') {
          handler.mounted(container, p.query);
        }
      }
      // 同步 Tab 高亮
      var tabbar = document.getElementById('tabbar');
      if (tabbar) {
        var tabs = tabbar.querySelectorAll('[data-route]');
        for (var i = 0; i < tabs.length; i++) {
          var t = tabs[i];
          if (t.getAttribute('data-route') === p.path) t.classList.add('active');
          else t.classList.remove('active');
        }
      }
    },

    /** 启动路由监听 */
    start: function () {
      var self = this;
      window.addEventListener('hashchange', function () { self.render(); });
      this.render();
    }
  };

  return Router;
});
