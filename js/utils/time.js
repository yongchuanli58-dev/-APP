/**
 * time.js - 时间工具
 * 提供相对时间、今日/本周/本月节点、格式化。
 * 浏览器挂 window.TimeUtil；Node 挂 module.exports
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimeUtil = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  /** 格式化 YYYY-MM-DD */
  function dateKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** 格式化 YYYY-MM-DD HH:mm */
  function formatDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 相对时间：刚刚 / x分钟前 / x小时前 / 昨天 / 日期 */
  function relativeTime(iso, now) {
    if (!iso) return '';
    var t = Date.parse(iso);
    if (isNaN(t)) return String(iso);
    var n = now ? new Date(now).getTime() : Date.now();
    var diff = n - t;
    if (diff < 0) diff = 0;
    var min = Math.floor(diff / 60000);
    var hour = Math.floor(min / 60);
    var day = Math.floor(hour / 24);

    var d = new Date(t);
    var nowD = new Date(n);
    var sameDay = d.getFullYear() === nowD.getFullYear() && d.getMonth() === nowD.getMonth() && d.getDate() === nowD.getDate();
    if (sameDay) {
      if (min < 1) return '刚刚';
      if (min < 60) return min + ' 分钟前';
      return hour + ' 小时前';
    }
    // 昨天
    var yest = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() - 1);
    if (d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate()) {
      return '昨天';
    }
    return dateKey(d);
  }

  /**
   * 今日/本周/本月起点时间戳
   * 返回 { todayStart, weekStart, monthStart }（毫秒）
   */
  function periodStarts(now) {
    now = now ? new Date(now) : new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var day = now.getDay() || 7; // 周日=7
    var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1)).getTime();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return { todayStart: todayStart, weekStart: weekStart, monthStart: monthStart };
  }

  /** 生成最近 N 天下班 key 列表（含今天） */
  function lastNDays(n, now) {
    now = now ? new Date(now) : new Date();
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push({
        key: dateKey(d),
        label: i === 0 ? '今天' : (d.getMonth() + 1) + '/' + d.getDate(),
        ts: d.getTime()
      });
    }
    return out;
  }

  return {
    dateKey: dateKey,
    formatDateTime: formatDateTime,
    relativeTime: relativeTime,
    periodStarts: periodStarts,
    lastNDays: lastNDays,
    pad: pad
  };
});
