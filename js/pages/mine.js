/**
 * mine.js - 我的（P5）
 * 数据概览 + 分享模板入口 + 数据管理（导出/备份/导入/清空）+ 关于
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ Store: require('../store'), UI: require('../utils/ui') });
  } else {
    root.MinePage = factory({ Store: root.Store, UI: root.UI });
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';

  var Store = deps.Store, UI = deps.UI;
  var Router = (typeof window !== 'undefined' && window.Router) || (typeof global !== 'undefined' && global.Router) || null;

  function render() {
    var s = Store.stats();
    var deviceId = Store.getDeviceId();
    return '<div class="page">' +
      '<div class="page-header" style="margin:-12px -14px 12px"><div class="page-title">我的</div></div>' +

      // 身份/数据概览
      '<div class="group-card">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">' +
          '<div class="loc-icon">👤</div>' +
          '<div><div style="font-weight:700">本机商机库</div>' +
          '<div class="sub-note">数据仅存于本机</div></div>' +
        '</div>' +
        '<div class="stat-blocks" style="grid-template-columns:repeat(3,1fr)">' +
          '<div class="stat-block"><div class="sb-num">' + s.total + '</div><div class="sb-label">商机总数</div></div>' +
          '<div class="stat-block"><div class="sb-num">' + s.month + '</div><div class="sb-label">本月录入</div></div>' +
          '<div class="stat-block"><div class="sb-num">' + s.today + '</div><div class="sb-label">今日录入</div></div>' +
        '</div>' +
        '<div class="sub-note" style="margin-top:8px">设备标识：' + UI.esc(deviceId.slice(0, 12)) + '…</div>' +
      '</div>' +

      // 分享
      '<div class="group-card" style="border:1.5px solid var(--cm-color-primary);background:rgba(0,114,227,0.04)">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:4px">📤 分享给同事</div>' +
        '<div class="sub-note" style="margin-bottom:10px">分享空白商机模板，同事打开即为全新空库，你的数据不会随分享发出。</div>' +
        '<button class="btn btn-block" id="shareBtn">分享空白模板</button>' +
      '</div>' +

      // 数据管理
      '<div class="section-title">🗂️ 数据管理</div>' +
      '<div class="group-card">' +
        '<button class="btn btn-outline btn-block" id="exportBtn" style="margin-bottom:10px">📥 导出 Excel 清单</button>' +
        '<button class="btn btn-outline btn-block" id="backupBtn" style="margin-bottom:10px">💾 备份数据(JSON)</button>' +
        '<button class="btn btn-outline btn-block" id="importBtn" style="margin-bottom:10px">📂 导入备份</button>' +
        '<input type="file" id="importFile" accept=".json,application/json" class="hidden">' +
        '<button class="btn btn-danger btn-block" id="clearBtn">🗑️ 清空全部数据</button>' +
      '</div>' +

      // 关于
      '<div class="section-title">ℹ️ 关于</div>' +
      '<div class="group-card">' +
        '<div class="sub-note" style="margin-bottom:4px">宽带线索商机 v1.0</div>' +
        '<div class="sub-note">一线师傅专用商机收集工具 · 数据本地存储 · 免登录</div>' +
      '</div>' +
    '</div>';
  }

  function backupJSON() {
    var leads = Store.all();
    var name = '宽带线索商机备份_' + dateStamp() + '.json';
    var blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast('已备份 ' + leads.length + ' 条商机');
  }

  function importFromFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('备份文件格式不正确');
        UI.confirm({
          title: '导入备份',
          body: '将导入 ' + data.length + ' 条商机（与现有记录合并，重复 id 覆盖）。确认？',
          confirmText: '导入'
        }).then(function (ok) {
          if (!ok) return;
          var count = 0;
          data.forEach(function (item) {
            try {
              if (Store.get(item.id)) Store.update(item.id, item);
              else Store.add(item);
              count++;
            } catch (e) { /* 跳过无效项 */ }
          });
          UI.toast('导入完成：' + count + ' 条');
        });
      } catch (e) {
        UI.toast('备份文件解析失败');
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    UI.confirm({
      title: '清空全部数据',
      body: '这将删除本机全部商机，且不可恢复！请输入「清空」确认。',
      confirmText: '下一步',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      // 第二次确认：输入清空
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.innerHTML =
        '<div class="modal-box">' +
          '<div class="modal-title">确认清空</div>' +
          '<div class="modal-body">请输入「清空」以确认删除全部数据</div>' +
          '<input type="text" id="confirmClearInput" placeholder="输入：清空" style="margin-bottom:14px">' +
          '<div class="modal-actions">' +
            '<button class="btn btn-outline" data-act="keep">取消</button>' +
            '<button class="btn btn-danger" data-act="do">确认清空</button>' +
          '</div>' +
        '</div>';
      mask.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'keep' || e.target === mask) { mask.remove(); return; }
        if (act === 'do') {
          var input = document.getElementById('confirmClearInput');
          if (input && input.value.trim() === '清空') {
            Store.clearAll();
            UI.toast('已清空全部数据');
            mask.remove();
            if (Router) Router.go('home');
          } else {
            UI.toast('请输入正确文字');
          }
        }
      });
      document.body.appendChild(mask);
    });
  }

  function dateStamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function bind(container, query) {
    document.getElementById('shareBtn').addEventListener('click', function () { if (Router) Router.go('share'); });
    document.getElementById('exportBtn').addEventListener('click', function () {
      if (typeof ExportUtil !== 'undefined') {
        var r = ExportUtil.exportXlsx(Store.all());
        if (r.ok) UI.toast('已导出：' + r.fileName);
        else UI.toast(r.error || '导出失败');
      } else UI.toast('导出组件未加载');
    });
    document.getElementById('backupBtn').addEventListener('click', backupJSON);
    document.getElementById('importBtn').addEventListener('click', function () {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', function () {
      if (this.files && this.files[0]) importFromFile(this.files[0]);
      this.value = '';
    });
    document.getElementById('clearBtn').addEventListener('click', clearAll);
  }

  return {
    render: render,
    mounted: bind,
    _backupJSON: backupJSON,
    _clearAll: clearAll,
    _importFromFile: importFromFile
  };
});
