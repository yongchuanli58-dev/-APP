/**
 * store.js - 宽带线索商机数据层
 * -------------------------------------------------
 * 设计目标：
 *  1. 浏览器：数据持久化到 localStorage（刷新/关闭/重启不丢）
 *  2. Node（测试）：通过注入内存后端运行同一套逻辑，可做单元测试
 *  3. 多用户隔离：每台设备独立存储键（device_id），互不可见
 *
 * 用法（浏览器）：
 *  <script src="js/store.js"></script>
 *  Store.add({...}); Store.list(); ...
 *
 * 用法（Node 测试）：
 *  const Store = require('../js/store');
 *  Store._useMemory();        // 切换内存后端
 *  Store._reset();            // 清空
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Store = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ============ 常量 ============
  var STORAGE_PREFIX = 'bx_sj_v1_';
  var KEY_LEADS = STORAGE_PREFIX + 'leads';
  var KEY_DEVICE = STORAGE_PREFIX + 'device_id';

  /** 合法枚举（与 PRD 数据模型一致） */
  var CLIENT_TYPES = {
    government: '政府事业单位',
    sme: '中小企业',
    individual_business: '个体工商户',
    home: '个人家庭'
  };
  var CARRIERS = ['移动', '联通', '电信', '广电'];
  var GENDERS = ['男', '女'];
  var FEE_LEVELS = ['低', '中', '高'];
  var RETURN_INTENTS = ['强烈', '一般', '暂无'];

  // ============ 存储后端 ============
  var memStore = {};        // Node 内存后端
  var useMemory = false;

  // 自增序号：保证同毫秒录入也有稳定先后顺序（倒序稳定）
  var seqCounter = 0;

  function restoreSeqCounter(leads) {
    for (var i = 0; i < leads.length; i++) {
      if (typeof leads[i].seq === 'number' && leads[i].seq > seqCounter) seqCounter = leads[i].seq;
    }
  }

  function nextSeq() { return ++seqCounter; }

  function hasLocalStorage() {
    try {
      var s = 'test';
      return typeof localStorage !== 'undefined' && (localStorage.setItem(s, '1'), localStorage.removeItem(s), true);
    } catch (e) {
      return false;
    }
  }

  function read(key) {
    if (useMemory) return memStore[key];
    if (hasLocalStorage()) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    return null;
  }

  function write(key, value) {
    if (useMemory) { memStore[key] = value; return; }
    if (hasLocalStorage()) {
      try { localStorage.setItem(key, value); } catch (e) { throw new Error('存储写入失败，可能已满或处于隐私模式'); }
    } else {
      throw new Error('当前环境不支持本地存储（隐私模式？）');
    }
  }

  function remove(key) {
    if (useMemory) { delete memStore[key]; return; }
    if (hasLocalStorage()) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  }

  // ============ 内部工具 ============
  function genId() {
    // 时间戳 + 随机数 + 计数器，避免碰撞
    return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function genDeviceId() {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function loadLeads() {
    var raw = read(KEY_LEADS);
    var arr;
    if (!raw) return [];
    try {
      arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
    } catch (e) {
      return [];
    }
    restoreSeqCounter(arr);
    return arr;
  }

  function saveLeads(leads) {
    write(KEY_LEADS, JSON.stringify(leads));
  }

  function isPlainObject(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o);
  }

  /**
   * 清洗单条商机：剔除未知字段、强制类型
   * 返回 null 表示无效必填缺失
   */
  function sanitizeLead(raw) {
    if (!isPlainObject(raw)) return null;

    var l = {};
    l.id = typeof raw.id === 'string' && raw.id ? raw.id : genId();
    l.createTime = typeof raw.createTime === 'string' && !isNaN(Date.parse(raw.createTime))
      ? raw.createTime
      : new Date().toISOString();
    l.updateTime = typeof raw.updateTime === 'string' && !isNaN(Date.parse(raw.updateTime))
      ? raw.updateTime
      : l.createTime;
    // 序号：新增时分配；保留已有数据的 seq
    l.seq = typeof raw.seq === 'number' ? raw.seq : nextSeq();

    // 客户类型（必填）
    l.clientType = CLIENT_TYPES[raw.clientType] ? raw.clientType : null;

    // 运营商多选
    var carriers = Array.isArray(raw.carriers)
      ? raw.carriers.filter(function (c) { return CARRIERS.indexOf(c) >= 0; })
      : [];
    l.carriers = carriers;

    // 资费
    l.packageName = typeof raw.packageName === 'string' ? String(raw.packageName).slice(0, 100) : '';
    var fee = Number(raw.packageFee);
    l.packageFee = (typeof raw.packageFee === 'string' || typeof raw.packageFee === 'number')
      && !isNaN(fee) && fee >= 0 ? fee : null;

    // 客户信息
    l.customerName = typeof raw.customerName === 'string' ? String(raw.customerName).slice(0, 80) : '';
    l.phone = typeof raw.phone === 'string' ? String(raw.phone).trim().slice(0, 20) : '';
    l.gender = GENDERS.indexOf(raw.gender) >= 0 ? raw.gender : '';
    l.feeLevel = FEE_LEVELS.indexOf(raw.feeLevel) >= 0 ? raw.feeLevel : '';
    l.returnIntent = RETURN_INTENTS.indexOf(raw.returnIntent) >= 0 ? raw.returnIntent : '';

    // 定位
    if (isPlainObject(raw.location)) {
      l.location = {
        address: typeof raw.location.address === 'string' ? String(raw.location.address).slice(0, 200) : '',
        lng: isFinite(Number(raw.location.lng)) ? Number(raw.location.lng) : null,
        lat: isFinite(Number(raw.location.lat)) ? Number(raw.location.lat) : null,
        locatedAt: typeof raw.location.locatedAt === 'string' ? raw.location.locatedAt : ''
      };
    } else {
      l.location = { address: '', lng: null, lat: null, locatedAt: '' };
    }

    return l;
  }

  /** 校验必填（不抛异常，返回错误信息数组） */
  function validateLead(l) {
    var errors = [];
    if (!l.clientType) errors.push('请选择客户类型');
    if (!l.customerName || !String(l.customerName).trim()) errors.push('请填写客户名称');
    if (!l.phone) errors.push('请填写联系电话');
    else if (!/^1\d{10}$/.test(l.phone)) errors.push('手机号格式不正确');
    return errors;
  }

  // ============ 对外 API ============
  var Store = {

    CLIENT_TYPES: CLIENT_TYPES,
    CARRIERS: CARRIERS,
    GENDERS: GENDERS,
    FEE_LEVELS: FEE_LEVELS,
    RETURN_INTENTS: RETURN_INTENTS,

    /** 获取（或创建）本机设备 ID —— 实现多用户隔离 */
    getDeviceId: function () {
      var id = read(KEY_DEVICE);
      if (!id) {
        id = genDeviceId();
        write(KEY_DEVICE, id);
      }
      return id;
    },

    /** 新增商机，返回新对象（含 id/time） */
    add: function (raw) {
      var l = sanitizeLead(raw);
      if (!l) throw new Error('商机数据格式不正确');
      var l2;
      // 再次校验必填
      var errs = validateLead(l);
      if (errs.length) {
        throw new Error(errs.join('；'));
      }
      l2 = l;
      var leads = loadLeads();
      leads.push(l2);
      saveLeads(leads);
      return l2;
    },

    /** 更新商机（按 id），返回更新后对象；不存在返回 null */
    update: function (id, raw) {
      if (!id) return null;
      var leads = loadLeads();
      var idx = -1;
      for (var i = 0; i < leads.length; i++) {
        if (leads[i].id === id) { idx = i; break; }
      }
      if (idx < 0) return null;
      var merged = sanitizeLead(Object.assign({}, leads[idx], raw));
      if (!merged) throw new Error('商机数据格式不正确');
      var errs = validateLead(merged);
      if (errs.length) throw new Error(errs.join('；'));
      merged.id = id;
      merged.createTime = leads[idx].createTime;
      merged.updateTime = new Date().toISOString();
      leads[idx] = merged;
      saveLeads(leads);
      return merged;
    },

    /** 删除商机 */
    remove: function (id) {
      var leads = loadLeads();
      var next = leads.filter(function (l) { return l.id !== id; });
      if (next.length === leads.length) return false;
      saveLeads(next);
      return true;
    },

    /** 查询单条 */
    get: function (id) {
      var leads = loadLeads();
      for (var i = 0; i < leads.length; i++) {
        if (leads[i].id === id) return leads[i];
      }
      return null;
    },

    /**
     * 列表查询
     * opts: {
     *   keyword: 字符串（匹配名称/电话/地址）,
     *   clientType: 字符串或数组,
     *   carrier: '移动' 等（含任一）,
     *   from: ISO 时间（含）,
     *   to: ISO 时间（不含）,
     *   sort: 'desc'(默认) | 'asc',
     *   limit: 数量上限
     * }
     */
    list: function (opts) {
      opts = opts || {};
      var leads = loadLeads().slice();
      var kw = (opts.keyword || '').toString().trim().toLowerCase();

      var filtered = leads.filter(function (l) {
        if (kw) {
          var hay = (l.customerName + ' ' + l.phone + ' ' + (l.location && l.location.address || '')).toLowerCase();
          if (hay.indexOf(kw) < 0) return false;
        }
        if (opts.clientType) {
          var types = Array.isArray(opts.clientType) ? opts.clientType : [opts.clientType];
          if (types.indexOf(l.clientType) < 0) return false;
        }
        if (opts.carrier) {
          var c = Array.isArray(opts.carrier) ? opts.carrier : [opts.carrier];
          var hit = false;
          for (var i = 0; i < c.length; i++) {
            if (l.carriers && l.carriers.indexOf(c[i]) >= 0) { hit = true; break; }
          }
          if (!hit) return false;
        }
        if (opts.from && l.createTime < opts.from) return false;
        if (opts.to && l.createTime >= opts.to) return false;
        return true;
      });

      filtered.sort(function (a, b) {
        if (opts.sort === 'asc') {
          return (a.seq || 0) - (b.seq || 0) || a.createTime.localeCompare(b.createTime);
        }
        return (b.seq || 0) - (a.seq || 0) || b.createTime.localeCompare(a.createTime);
      });

      if (opts.limit && opts.limit > 0) filtered = filtered.slice(0, opts.limit);
      return filtered;
    },

    /** 全部商机（导出用） */
    all: function () {
      return loadLeads().slice();
    },

    /** 商机总数 */
    count: function () {
      return loadLeads().length;
    },

    /** 清空全部 */
    clearAll: function () {
      saveLeads([]);
    },

    /**
     * 统计聚合
     * 返回:
     * {
     *   total, today, week, month,
     *   carriers: { '移动': n, ... },
     *   clientTypes: { government: n, ... },
     *   byDay: [{date:'YYYY-MM-DD', count:n}, ...最近7天]
     * }
     */
    stats: function () {
      var leads = loadLeads();
      var now = new Date();
      // 今日起点
      var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      // 本周一
      var day = now.getDay() || 7; // 周日=7
      var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1)).getTime();
      // 本月
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      var carriers = { '移动': 0, '联通': 0, '电信': 0, '广电': 0 };
      var clientTypes = {};
      var today = 0, week = 0, month = 0;

      // 近7天
      var byDayMap = {};
      for (var i = 6; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        byDayMap[key] = 0;
      }
      var todayKey = todayStart;

      leads.forEach(function (l) {
        var t = Date.parse(l.createTime) || 0;
        if (t >= todayStart) today++;
        if (t >= weekStart) week++;
        if (t >= monthStart) month++;

        if (t >= todayStart - (7 * 24 * 3600 * 1000)) {
          var dk = new Date(t);
          var k = dk.getFullYear() + '-' + String(dk.getMonth() + 1).padStart(2, '0') + '-' + String(dk.getDate()).padStart(2, '0');
          if (k in byDayMap) byDayMap[k]++;
        }

        if (l.carriers) l.carriers.forEach(function (c) {
          if (c in carriers) carriers[c]++;
        });

        var ct = l.clientType;
        clientTypes[ct] = (clientTypes[ct] || 0) + 1;
      });

      var byDay = [];
      for (var k2 in byDayMap) byDay.push({ date: k2, count: byDayMap[k2] });

      return {
        total: leads.length,
        today: today,
        week: week,
        month: month,
        carriers: carriers,
        clientTypes: clientTypes,
        byDay: byDay
      };
    },

    /**
     * 资费区间统计
     * opts: { min, max }
     */
    feeRange: function (opts) {
      opts = opts || {};
      var min = isFinite(Number(opts.min)) ? Number(opts.min) : null;
      var max = isFinite(Number(opts.max)) ? Number(opts.max) : null;
      var leads = loadLeads().filter(function (l) {
        if (l.packageFee == null) return false;       // 空金额不纳入
        if (min != null && l.packageFee < min) return false;
        if (max != null && l.packageFee > max) return false;
        return true;
      });
      var sum = leads.reduce(function (acc, l) { return acc + l.packageFee; }, 0);
      return {
        count: leads.length,
        sum: sum,
        avg: leads.length ? Math.round((sum / leads.length) * 100) / 100 : 0,
        leads: leads
      };
    },

    // ============ 测试辅助 ============
    /** 切换为内存后端（测试用） */
    _useMemory: function () { useMemory = true; },
    /** 切换回 localStorage */
    _useLocalStorage: function () { useMemory = false; },
    /** 清空所有键（内存与 localStorage） */
    _reset: function () {
      memStore = {};
      remove(KEY_LEADS);
      remove(KEY_DEVICE);
    },
    /** 生成 id（测试用） */
    _genId: genId,

    /** 数据完整性校验器（测试/导出前用） */
    _sanitize: sanitizeLead,
    _validate: validateLead
  };

  return Store;
});
