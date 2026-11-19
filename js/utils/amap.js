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
  /** 最近一次 SDK 加载状态（诊断用） */
  var lastError = '';

  /** 动态加载高德 JS API 脚本（v2.0，带安全密钥） */
  function loadSDK() {
    return new Promise(function (resolve, reject) {
      if (LOADED) { resolve(); return; }
      if (LOADING) { callbacks.push(resolve); return; }
      LOADING = true;
      var cfg = (typeof window !== 'undefined' && window.AMAP_CONFIG) || {};
      if (!cfg.key || String(cfg.key).indexOf('替换') >= 0) {
        LOADING = false;
        lastError = '未配置高德 Key';
        reject(new Error(lastError));
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
        lastError = '';
        callbacks.forEach(function (cb) { cb(); });
        callbacks = [];
        resolve();
      };
      script.onerror = function () {
        LOADING = false;
        lastError = '高德脚本加载失败（网络/域名被拦截，请确认 key 白名单）';
        reject(new Error(lastError));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 逆地理编码：用高德 JS API 把经纬度转成地址
   * 注意：Geocoder 是插件，必须先 AMap.plugin 加载再 new，否则必然失败
   * 返回 Promise<string>，失败返回 ''
   */
  function reverseGeocode(lng, lat) {
    return new Promise(function (resolve) {
      if (typeof window === 'undefined' || !window.AMap) {
        resolve('');
        return;
      }
      window.AMap.plugin('AMap.Geocoder', function () {
        try {
          var geocoder = new window.AMap.Geocoder({ extensions: 'all' });
          geocoder.getAddress([lng, lat], function (status, result) {
            if (status === 'complete' && result && result.regeocode) {
              resolve(compactAddress(result.regeocode));
            } else {
              resolve('');
            }
          });
        } catch (e) {
          resolve('');
        }
      });
    });
  }

  /** 精简地址：去掉重复的「省」「市」层级冗余，保留 省(去后缀)+市/区+街道+门牌 */
  function compactAddress(regeocode) {
    try {
      var a = regeocode.addressComponent || {};
      var parts = [];
      if (a.province) parts.push(String(a.province).replace(/省$/, ''));
      if (a.city && a.city !== a.province) parts.push(String(a.city).replace(/市$/, ''));
      if (a.district) parts.push(String(a.district));
      // 拼接街道 + 编号
      var road = a.streetNumber && a.streetNumber.street ? String(a.streetNumber.street) : '';
      var num = a.streetNumber && a.streetNumber.number ? String(a.streetNumber.number) : '';
      if (road) parts.push(road + num);
      var addr = parts.join('');
      // 空兜底：formattedAddress 原样
      if (!addr && regeocode.formattedAddress) addr = String(regeocode.formattedAddress);
      return addr;
    } catch (e) {
      return (regeocode && regeocode.formattedAddress) ? String(regeocode.formattedAddress) : '';
    }
  }

  /** 定位：返回 Promise<{address, lng, lat, locatedAt}>
   * 高德优先，失败降级浏览器 Geolocation（再用高德 Geocoder 补地址），仍失败 rethrow
   */
  function locate() {
    return new Promise(function (resolve, reject) {
      var locatedAt = new Date().toISOString();
      var finish = function (lng, lat, address, source) {
        // 地址为空时，尝试用高德 Geocoder 补全（浏览器兜底时尤其重要）
        var finalize = function (addr) {
          resolve({ lng: lng, lat: lat, address: (addr || address || ''), locatedAt: locatedAt, source: source });
        };
        if (address) { finalize(address); return; }
        reverseGeocode(lng, lat).then(finalize);
      };

      // 尝试高德
      var tryAmap = function () {
        if (typeof window === 'undefined' || !window.AMap) {
          tryBrowser();
          return;
        }
        // 先加载插件，再 new Geolocation（高德 2.0 强制）
        window.AMap.plugin('AMap.Geolocation', function () {
          try {
            var geo = new window.AMap.Geolocation({
              enableHighAccuracy: true,
              timeout: 10000,
              zoomToAccuracy: true
            });
            geo.getCurrentPosition(function (status, result) {
              if (status === 'complete' && result && result.position) {
                var p = result.position;
                var address = '';
                if (result.formattedAddress) address = String(result.formattedAddress);
                else if (result.addressComponent) {
                  var a = result.addressComponent;
                  address = (a.province || '') + (a.city || '') + (a.district || '') + (a.street || '');
                }
                finish(p.getLng(), p.getLat(), address, 'amap');
              } else {
                tryBrowser();
              }
            });
          } catch (e) {
            tryBrowser();
          }
        });
      };

      // 浏览器 Geolocation 兜底
      var tryBrowser = function () {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          reject(new Error('当前设备不支持定位'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            // 浏览器只给经纬度，地址由高德 Geocoder 补全
            finish(pos.coords.longitude, pos.coords.latitude, '', 'browser');
          },
          function (err) {
            var msg = '定位失败';
            if (err && err.code === 1) msg = '定位被拒绝，请在浏览器设置中允许定位';
            else if (err && err.code === 2) msg = '无法获取位置信号，请到开阔处重试';
            else if (err && err.code === 3) msg = '定位超时，请重试';
            reject(new Error(msg));
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
    openNavigation: openNavigation,
    reverseGeocode: reverseGeocode,
    compactAddress: compactAddress,
    lastError: function () { return lastError; }
  };
});
