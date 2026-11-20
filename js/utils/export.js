/**
 * export.js - 商机数据导出（零依赖实现）
 * -------------------------------------------------
 * 提供两种可被 Excel / WPS / 手机表格打开的文件：
 *  1. .xlsx —— 真实 OOXML 格式（内部 zip 打包，STORED 不压缩），任何表格软件原生识别
 *  2. .csv  —— UTF-8 BOM，Excel/WPS 可直接打开
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

  // ============ ZIP 打包（STORED，无压缩） ============
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  /** CRC32（二进制字符串） */
  function crc32(str) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < str.length; i++) {
      c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function toU16(v) { return String.fromCharCode(v & 0xFF, (v >>> 8) & 0xFF); }
  function toU32(v) {
    v = v >>> 0;
    return String.fromCharCode(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
  }

  /**
   * 生成 ZIP 二进制字符串（仅 STORED 条目）
   * @param {Array<{name:string, content:string}>} files 无需排序，按传序
   * @returns {string} 二进制字符串（UTF-8 已由调用方处理）
   */
  function zipStore(files) {
    var localParts = [], centralParts = [];
    var offset = 0;
    var utf8 = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    files.forEach(function (f) {
      var name = f.name;
      var data = utf8 ? utf8.encode(f.content) : f.content;
      // 转成二进制字符串（Uint8Array → char）
      var dataStr = '';
      if (utf8) {
        for (var i = 0; i < data.length; i++) dataStr += String.fromCharCode(data[i]);
      } else {
        dataStr = data;
      }
      var crc = crc32(dataStr);
      var size = dataStr.length;
      var nameBytes = utf8 ? utf8.encode(name) : name;
      var nameStr = '';
      if (utf8) { for (var j = 0; j < nameBytes.length; j++) nameStr += String.fromCharCode(nameBytes[j]); }
      else nameStr = name;
      var nameLen = nameStr.length;

      // 本地文件头
      var local =
        'PK\x03\x04' +                 // signature
        toU16(20) +                    // version needed (2.0)
        toU16(0x0800) +                // flags: UTF-8 names
        toU16(0) +                     // compression: stored
        toU16(0) + toU16(0) +          // mod time/date
        toU32(crc) +
        toU32(size) + toU32(size) +
        toU16(nameLen) + toU16(0) +    // name len, extra len 0
        nameStr + dataStr;
      localParts.push(local);

      // 中央目录
      var central =
        'PK\x01\x02' +                 // signature
        toU16(20) + toU16(20) +        // version made by/needed
        toU16(0x0800) +                // flags
        toU16(0) +                     // method
        toU16(0) + toU16(0) +          // time/date
        toU32(crc) +
        toU32(size) + toU32(size) +
        toU16(nameLen) + toU16(0) + toU16(0) + toU16(0) + toU16(0) +
        toU32(0) +                     // external attr
        toU32(offset) +                // local header offset
        nameStr;
      centralParts.push(central);
      offset += local.length;
    });

    var centralAll = centralParts.join('');
    var centralSize = centralAll.length;
    var centralOffset = offset;
    var eocd =
      'PK\x05\x06' +
      toU16(0) + toU16(0) +
      toU16(files.length) + toU16(files.length) +
      toU32(centralSize) + toU32(centralOffset) +
      toU16(0);
    return localParts.join('') + centralAll + eocd;
  }

  // ============ OOXML (xlsx) ============
  function xmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 工作表 XML */
  function sheetXml(leads) {
    var rows = [header()].concat(leads.map(toRow));
    var body = rows.map(function (row, ri) {
      var cells = row.map(function (v, ci) {
        var isNum = (typeof v === 'number') || (/^\d+(\.\d+)?$/.test(String(v)));
        // 电话列（下标5）与客户名称（下标0）强制 inline string，防科学计数法
        var forceText = (ci === 5) || (ci === 0);
        var s = String(v == null ? '' : v);
        if (isNum && !forceText) {
          return '<c r="' + cellRef(ci) + '" t="n"><v>' + xmlEsc(s) + '</v></c>';
        }
        return '<c r="' + cellRef(ci) + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(s) + '</t></is></c>';
      });
      return '<row r="' + (ri + 1) + '">' + cells.join('') + '</row>';
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' + body + '</sheetData></worksheet>';
  }

  /** 列号转 Excel 字母（A, B, ..., Z, AA...） */
  function cellRef(ci) {
    var s = '', n = ci + 1;
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function rootRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
  }

  function workbookXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="商机清单" sheetId="1" r:id="rId1"/></sheets></workbook>';
  }

  function workbookRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>';
  }

  /**
   * 生成 .xlsx 二进制内容（zip STORED）
   * @returns {ArrayBuffer} 二进制
   */
  function toXlsxBuffer(leads) {
    var files = [
      { name: '[Content_Types].xml', content: contentTypesXml() },
      { name: '_rels/.rels', content: rootRels() },
      { name: 'xl/workbook.xml', content: workbookXml() },
      { name: 'xl/_rels/workbook.xml.rels', content: workbookRels() },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml(leads) }
    ];
    var zip = zipStore(files);
    var bytes = new Uint8Array(zip.length);
    for (var i = 0; i < zip.length; i++) bytes[i] = zip.charCodeAt(i) & 0xFF;
    return bytes.buffer;
  }

  function contentTypesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>';
  }

  // ============ 浏览器下载 ============
  function downloadBlob(blob, fileName) {
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
   * 导出 Excel 表格（真实 .xlsx，OOXML+ZIP）
   * 浏览器：触发下载；Node：返回 { ok, content(ArrayBuffer), fileName }
   */
  function exportXlsx(leads, fileName) {
    if (!leads || !leads.length) return { ok: false, error: '暂无可导出的商机数据' };
    var name = fileName || ('宽带线索商机_' + dateStamp() + '.xlsx');
    var buf = toXlsxBuffer(leads);
    if (typeof document !== 'undefined') {
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, name);
      return { ok: true, fileName: name };
    }
    return { ok: true, content: buf, fileName: name, format: 'xlsx' };
  }

  /** 导出 .csv（Excel/WPS 可打开） */
  function exportCsv(leads, fileName) {
    if (!leads || !leads.length) return { ok: false, error: '暂无可导出的商机数据' };
    var name = fileName || ('宽带线索商机_' + dateStamp() + '.csv');
    var content = toCSV(leads);
    if (typeof document !== 'undefined') {
      var blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, name);
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
    crc32: crc32,
    zipStore: zipStore,
    cellRef: cellRef,
    sheetXml: sheetXml,
    contentTypesXml: contentTypesXml,
    toXlsxBuffer: toXlsxBuffer,
    exportXlsx: exportXlsx,
    exportCsv: exportCsv
  };
});
