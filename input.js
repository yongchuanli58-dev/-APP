/**
 * input.js - 商机录入页（P2）
 * 功能：打卡定位、客户类型单选、运营商多选、资费、客户信息、保存校验、编辑模式
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./../store'), require('./../utils/validate'));
  } else {
    root.InputPage = factory(root.Store, root.Validate);
  }
})(typeof self !== 'undefined' ? self : this, function (Store, Validate) {
  'use strict';

  /** 编辑模式当前 id */
  var editId = null;

  function render(query) {
    editId = query && query.id ? String(query.id) : null;
    var editing = editId ? Store.get(editId) : null;
    var title = editing ? '编辑商机' : '录入商机';
    var prefix = editing ? ('<a class="icon-btn" href="#/detail?id=' + editId + '">←</a>') : '';

    var ct = editing ? editing.clientType : '';
    var ckCarrier = function (c) {
      return editing && editing.carriers && editing.carriers.indexOf(c) >= 0
        ? '<span class="opt-card selected" data-cv="' + c + '"><span class="ck">✓</span>' + c + '</span>'
        : '<span class="opt-card" data-cv="' + c + '"><span class="ck"></span>' + c + '</span>';
    };
    var g = editing ? (editing.gender || '') : '';
    var ri = editing ? (editing.returnIntent || '') : '';
    var remark = editing ? (editing.remark || '') : '';
    var loc = (editing && editing.location) || { address: '', locatedAt: '' };

    return '<div class="page">' +
      // 定位卡片
      '<div class="group-card loc-card">' +
        '<div class="loc-icon">📍</div>' +
        '<div class="loc-info">' +
          (loc.address
            ? '<div class="loc-addr" id="locAddr">' + UI.esc(loc.address) + '</div>'
            : (loc.lng && loc.lat
              ? '<div class="loc-addr" id="locAddr">已定位 ' + UI.esc(String(loc.lng)) + ',' + UI.esc(String(loc.lat)) + '</div>'
              : '<div class="loc-addr" id="locAddr">未打卡定位</div>')) +
          '<div class="loc-meta" id="locMeta">' +
            (loc.locatedAt ? '打卡时间：' + TimeUtil.formatDateTime(loc.locatedAt) : '点击打卡获取当前位置') +
          '</div>' +
        '</div>' +
        '<button class="btn btn-sm loc-btn' + ((loc.address || (loc.lng && loc.lat)) ? ' located' : '') + '" id="locBtn">' +
          ((loc.address || (loc.lng && loc.lat)) ? '重定位' : '打卡') +
        '</button>' +
      '</div>' +

      // 客户类型
      '<div class="section-title"><span class="required">客户类型</span></div>' +
      '<div class="opt-grid" id="clientTypeGroup">' +
        typeCard('government', '政府事业单位', '政企/机关', ct) +
        typeCard('sme', '中小企业', '公司/个体商户', ct) +
        typeCard('individual_business', '个体工商户', '店铺/门面', ct) +
        typeCard('home', '个人家庭', '住宅客户', ct) +
      '</div>' +
      '<div class="field-error" id="errClientType"></div>' +

      // 运营商多选
      '<div class="section-title">在用运营商（可多选）</div>' +
      '<div class="check-row" id="carrierGroup">' +
        carrierCard('移动') + carrierCard('联通') + carrierCard('电信') + carrierCard('广电') +
      '</div>' +

      // 资费
      '<div class="section-title">客户当前使用资费</div>' +
      '<div class="group-card">' +
        '<div class="form-row">' +
          '<div class="form-label">套餐名称</div>' +
          '<input type="text" id="packageName" placeholder="如：移动200M家庭宽带" value="' + UI.esc(editing ? editing.packageName : '') + '">' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-label">套餐金额（元/月）</div>' +
          '<input type="number" id="packageFee" inputmode="decimal" min="0" step="0.01" placeholder="如：68" value="' + (editing && editing.packageFee != null ? editing.packageFee : '') + '">' +
          '<div class="field-error" id="errPackageFee"></div>' +
        '</div>' +
      '</div>' +

      // 客户信息
      '<div class="section-title"><span class="required">客户信息</span></div>' +
      '<div class="group-card">' +
        '<div class="form-row">' +
          '<div class="form-label"><span class="required">客户名称</span></div>' +
          '<input type="text" id="customerName" placeholder="单位/店铺/家庭名称" value="' + UI.esc(editing ? editing.customerName : '') + '">' +
          '<div class="field-error" id="errCustomerName"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-label"><span class="required">联系电话</span></div>' +
          '<input type="tel" id="phone" placeholder="11位手机号" value="' + UI.esc(editing ? editing.phone : '') + '">' +
          '<div class="field-error" id="errPhone"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-label">性别</div>' +
          '<div class="seg" id="genderGroup">' +
            segCard('男', g) + segCard('女', g) +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-label">回流意愿</div>' +
          '<div class="seg" id="returnIntentGroup">' +
            segCard('强烈', ri) + segCard('一般', ri) + segCard('暂无', ri) +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-label">备注</div>' +
          '<textarea id="remark" rows="3" maxlength="500" placeholder="可填写重要客户信息，如：客户偏好、预约时间、跟进要点等">' + UI.esc(remark) + '</textarea>' +
        '</div>' +
      '</div>' +

      // 保存栏
      '<div class="save-bar">' +
        '<button class="btn btn-block" id="saveBtn">保存商机</button>' +
      '</div>' +
    '</div>' +
    '<style>.page-header-sub{display:none}</style>';
  }

  function typeCard(val, label, sub, selectedVal) {
    var sel = val === selectedVal ? ' selected' : '';
    return '<div class="opt-card' + sel + '" data-type="' + val + '">' +
      label + '<span class="opt-sub">' + sub + '</span></div>';
  }

  function carrierCard(cv) {
    return '<div class="check-item" data-cv="' + cv + '">' +
      '<span class="ck"></span>' + cv +
    '</div>';
  }

  function segCard(val, selVal, label) {
    var sel = val === selVal ? ' selected' : '';
    return '<div class="opt-card' + sel + '" data-val="' + val + '">' +
      '<span class="opt-sub">' + (label || (val || '未填')) + '</span>' +
    '</div>';
  }

  /** 读取表单数据 */
  function readForm() {
    function selVal(sel) {
      var el = document.querySelector(sel);
      return el ? el.getAttribute('data-val') || el.getAttribute('data-type') || '' : '';
    }
    var ctSel = document.querySelector('#clientTypeGroup .selected');
    return {
      clientType: ctSel ? ctSel.getAttribute('data-type') : null,
      carriers: Array.prototype.map.call(
        document.querySelectorAll('#carrierGroup .check-item.selected'),
        function (el) { return el.getAttribute('data-cv'); }
      ),
      packageName: document.getElementById('packageName').value.trim(),
      packageFee: document.getElementById('packageFee').value.trim(),
      customerName: document.getElementById('customerName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      gender: document.querySelector('#genderGroup .selected') ? document.querySelector('#genderGroup .selected').getAttribute('data-val') : '',
      remark: document.getElementById('remark').value.trim(),
      returnIntent: document.querySelector('#returnIntentGroup .selected') ? document.querySelector('#returnIntentGroup .selected').getAttribute('data-val') : ''
    };
  }

  function bind() {
    // 客户类型单选
    document.getElementById('clientTypeGroup').addEventListener('click', function (e) {
      var t = e.target.closest('[data-type]');
      if (!t) return;
      document.querySelectorAll('#clientTypeGroup .opt-card').forEach(function (el) { el.classList.remove('selected'); });
      t.classList.add('selected');
      document.getElementById('errClientType').textContent = '';
    });
    // 运营商多选
    document.getElementById('carrierGroup').addEventListener('click', function (e) {
      var t = e.target.closest('[data-cv]');
      if (!t) return;
      t.classList.toggle('selected');
    });
    // 性别/回流意愿 单选组
    ['genderGroup', 'returnIntentGroup'].forEach(function (gid) {
      var g = document.getElementById(gid);
      g.addEventListener('click', function (e) {
        var t = e.target.closest('[data-val]');
        if (!t) return;
        g.querySelectorAll('.opt-card').forEach(function (el) { el.classList.remove('selected'); });
        t.classList.add('selected');
      });
    });
    // 打卡定位
    document.getElementById('locBtn').addEventListener('click', function () {
      doLocate();
    });
    // 保存
    document.getElementById('saveBtn').addEventListener('click', function () {
      doSave();
    });
  }

  /** 定位流程 */
  function doLocate() {
    var btn = document.getElementById('locBtn');
    btn.disabled = true;
    btn.textContent = '定位中…';
    AmapUtil.locate().then(function (r) {
      var locText = r.address || ('已定位 ' + r.lng.toFixed(5) + ',' + r.lat.toFixed(5));
      document.getElementById('locAddr').textContent = r.address ? ('📍 ' + r.address) : locText;
      document.getElementById('locMeta').textContent = '打卡时间：' + TimeUtil.formatDateTime(r.locatedAt);
      btn.textContent = '重定位';
      btn.classList.add('located');
      // 存储本次定位到 window，供保存使用
      window._lastLocation = { address: r.address, lng: r.lng, lat: r.lat, locatedAt: r.locatedAt };
      UI.toast('打卡成功');
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = '重试打卡';
      UI.toast(err.message || '定位失败');
    });
  }

  /** 保存流程 */
  function doSave() {
    var form = readForm();
    var errs = Validate.validateLeadForm({
      clientType: form.clientType,
      customerName: form.customerName,
      phone: form.phone,
      packageFee: form.packageFee
    });
    ['clientType', 'customerName', 'phone', 'packageFee'].forEach(function (f) {
      var el = document.getElementById('err' + f.charAt(0).toUpperCase() + f.slice(1));
      var input = document.getElementById(f);
      if (el) el.textContent = errs[f] || '';
      if (input) input.classList.toggle('input-error', !!errs[f]);
    });
    if (Object.keys(errs).length) {
      UI.toast('请完善必填项');
      return;
    }
    var loc = window._lastLocation || { address: '', lng: null, lat: null, locatedAt: '' };
    // 若编辑已有定位但未重新打卡，保留原定位
    if (!loc.address && editId) {
      var old = Store.get(editId);
      if (old && old.location) loc = old.location;
    }
    var data = LeadBuilder.build(form, loc);

    try {
      if (editId) {
        Store.update(editId, data);
        UI.toast('已更新');
        Router.go('detail', { id: editId });
      } else {
        Store.add(data);
        UI.toast('已保存');
        Router.go('home');
      }
    } catch (e) {
      UI.toast(e.message || '保存失败');
    }
  }

  return {
    render: render,
    mounted: function (container, query) {
      bind();
    },
    /** 测试辅助：读取当前表单 */
    _readForm: readForm
  };
});
