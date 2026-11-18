/**
 * amap.js - 高德地图定位封装
 * 依赖 config/amap-key.js（window.AMAP_CONFIG）
 * 使用高德 JS API（AMap.Geolocation）完成打卡定位。
 * 若高德脚本未加载成功，回退到浏览器 Geolocation API。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AmapUtil = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOADED = false;
  var LOADING = false;
  var callbacks = [];

  /** 动态加载高德 JS API 脚本（v2.0，带安全密钥） */
  function loadSDK() {
    return new Promise(function (resolve, reject) {
      if (LOADED) { resolve(); return; }
      if (LOADING) { callbacks.push(resolve); return; }
      LOADING = true;
      var cfg = (typeof window !== 'undefined' && window.AMAP_CONFIG) || {};
      if (!cfg.key || String(cfg.key).indexOf('替换') >= 0) {
        LOADING = false;
        reject(new Error('未配置高德 Key'));
        return;
      }
      var win = window;
      if (cfg.securityJsCode && String(cfg.securityJsCode).indexOf('替换') < 0) {
        win._AMapSecurityConfig = { securityJsCode: cfg.securityJsCode };
      }
      var script = document.createElement('script');
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(cfg.key);
      script.async = true;
      script.onload = function () {
        LOADED = true;
        LOADING = false;
        callbacks.forEach(function (cb) { cb(); });
        callbacks = [];
        resolve();
      };
      script.onerror = function () {
        LOADING = false;
        reject(new Error('高德地图脚本加载失败'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 定位：返回 Promise<{address, lng, lat, locatedAt}>
   * 高德优先，失败降级浏览器 Geolocation，仍失败 rethrow
   */
  function locate() {
    return new Promise(function (resolve, reject) {
      var locatedAt = new Date().toISOString();
      var finish = function (lng, lat, address) {
        resolve({
          lng: lng,
          lat: lat,
          address: address || '',
          locatedAt: locatedAt,
          source: typeof window !== 'undefined' && window.AMap ? 'amap' : 'browser'
        });
      };

      // 尝试高德
      var tryAmap = function () {
        if (typeof window === 'undefined' || !window.AMap) {
          tryBrowser();
          return;
        }
        try {
          var geo = new window.AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            zoomToAccuracy: true
          });
          window.AMap.plugin('AMap.Geolocation', function () {
            geo.getCurrentPosition(function (status, result) {
              if (status === 'complete' && result && result.position) {
                var p = result.position;
                var address = result.formattedAddress ||
                  (result.addressComponent ? (
                    (result.addressComponent.province || '') +
                    (result.addressComponent.city || '') +
                    (result.addressComponent.district || '') +
                    (result.addressComponent.street || '')
                  ) : '');
                finish(p.getLng(), p.getLat(), address);
              } else {
                tryBrowser();
              }
            });
          });
        } catch (e) {
          tryBrowser();
        }
      };

      // 浏览器 Geolocation 兜底
      var tryBrowser = function () {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          reject(new Error('当前设备不支持定位'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            finish(pos.coords.longitude, pos.coords.latitude, '');
          },
          function (err) {
            reject(new Error('定位失败，请点击重试或手动填写地址'));
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      };

      // 若高德加载失败，直接浏览器兜底；如果没配置 Key 也用浏览器
      loadSDK().then(tryAmap, function () {
        tryBrowser();
      });
    });
  }

  /**
   * 打开高德导航
   * opts: { lng, lat, name }
   * 优先调起高德 App（androidamap/iosamap），失败降级网页版
   */
  function openNavigation(opts) {
    if (!opts || !opts.lng || !opts.lat) {
      return Promise.reject(new Error('缺少坐标'));
    }
    var name = encodeURIComponent(opts.name || '客户位置');
    var lng = opts.lng, lat = opts.lat;
    var ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    var done = function () {
      // 网页兜底
      var web = 'https://uri.amap.com/navigation?to=' + lng + ',' + lat + ',' + name + '&coordinate=gaode&mode=car';
      window.location.href = web;
    };

    if (/Android/i.test(ua)) {
      window.location.href = 'androidamap://navi?sourceApplication=bx_sj&lat=' + lat + '&lon=' + lng + '&dev=0';
      setTimeout(done, 600);
    } else if (/iPhone|iPad/i.test(ua)) {
      window.location.href = 'iosamap://path?sourceApplication=bx_sj&dname=' + name + '&dlat=' + lat + '&dlon=' + lng + '&dev=0';
      setTimeout(done, 600);
    } else {
      done();
    }
    return Promise.resolve();
  }

  return {
    loadSDK: loadSDK,
    locate: locate,
    openNavigation: openNavigation
  };
});
