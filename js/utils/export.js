/**
 * export.js - 商机数据导出（零依赖实现）
 * -------------------------------------------------
 * 提供两种可被 Excel / WPS 打开的文件：
 *  1. .xlsx（SpreadsheetML 2003 XML 格式，Excel/WPS 可直接打开，支持中文）
 *  2. .csv（UTF-8 BOM，Excel/WPS 可直接打开）
 * 无需外部库（SheetJS 因内网无法下载），纯文本生成，离线可用。
 * 双环境兼容（浏览器触发下载 / Node 返回内容供测试）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ExportUtil = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 客户类型中文 */
  function clientTypeText(t) {
    var map = {
      government: '政府事业单位',
      sme: '中小企业',
      individual_business: '个体工商户',
      home: '个人家庭'
    };
    return map[t] || t || '';
  }

  /** 运营商多选 → 顿号分隔 */
  function carriersText(carriers) {
    return (carriers || []).join('、');
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 表头（与 PRD 6.1 对齐） */
  function header() {
    return ['客户名称', '客户类型', '在用运营商', '套餐名称', '套餐金额(元/月)',
      '联系电话', '性别', '资费水平', '回流意愿', '地址', '定位时间', '录入时间'];
  }

  /** 单条商机 → 行数组 */
  function toRow(l) {
    return [
      l.customerName || '',
      clientTypeText(l.clientType),
      carriersText(l.carriers),
      l.packageName || '',
      l.packageFee != null ? l.packageFee : '',
      l.phone || '',
      l.gender || '',
      l.feeLevel || '',
      l.returnIntent || '',
      (l.location && l.location.address) || '',
      formatTime(l.location && l.location.locatedAt),
      formatTime(l.createTime)
    ];
  }

  // ============ CSV ============
  function toCSV(leads) {
    var rows = [header()].concat(leads.map(toRow));
    return rows.map(function (row) {
      return row.map(csvCell).join(',');
    }).join('\r\n');
  }
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // ============ SpreadsheetML (xlsx) ============
  function xmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toXlsxXml(leads) {
    var rows = [header()].concat(leads.map(toRow));
    var body = rows.map(function (row, ri) {
      var cells = row.map(function (v, ci) {
        var numLike = (typeof v === 'number') || (/^\d+(\.\d+)?$/.test(String(v)));
        // 第 6 列（联系电话，下标5）与第 1 列（客户名称，下标0）强制文本，避免长数字转科学计数
        var forceText = (ci === 5) || (ci === 0);
        if (numLike && !forceText) {
          return '<Cell ss:Index="' + (ci + 1) + '"><Data ss:Type="Number">' + v + '</Data></Cell>';
        }
        return '<Cell ss:Index="' + (ci + 1) + '"><Data ss:Type="String">' + xmlEsc(v) + '</Data></Cell>';
      });
      return '<Row>' + cells.join('') + '</Row>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Worksheet ss:Name="商机清单"><Table>' + body + '</Table></Worksheet></Workbook>';
  }

  // ============ 浏览器下载 ============
  function download(content, fileName, mime) {
    var blob = new Blob(['\ufeff' + content], { type: mime + ';charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 200);
  }

  function dateStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /**
   * 导出 Excel 表格（SpreadsheetML 2003，后缀 .xls，Excel/WPS 直接打开）
   * 浏览器：触发下载；Node：返回 { ok, content, fileName }
   */
  function exportXlsx(leads, fileName) {
    if (!leads || !leads.length) return { ok: false, error: '暂无可导出的商机数据' };
    var name = fileName || ('宽带线索商机_' + dateStamp() + '.xls');
    var content = toXlsxXml(leads);
    if (typeof document !== 'undefined') {
      download(content, name, 'application/vnd.ms-excel');
      return { ok: true, fileName: name };
    }
    return { ok: true, content: content, fileName: name, format: 'xlsx' };
  }

  /** 导出 .csv（Excel/WPS 可打开） */
  function exportCsv(leads, fileName) {
    if (!leads || !leads.length) return { ok: false, error: '暂无可导出的商机数据' };
    var name = fileName || ('宽带线索商机_' + dateStamp() + '.csv');
    var content = toCSV(leads);
    if (typeof document !== 'undefined') {
      download(content, name, 'text/csv');
      return { ok: true, fileName: name };
    }
    return { ok: true, content: content, fileName: name, format: 'csv' };
  }

  return {
    clientTypeText: clientTypeText,
    carriersText: carriersText,
    formatTime: formatTime,
    dateStamp: dateStamp,
    header: header,
    toRow: toRow,
    toCSV: toCSV,
    toXlsxXml: toXlsxXml,
    exportXlsx: exportXlsx,
    exportCsv: exportCsv
  };
});
