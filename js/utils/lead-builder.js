/**
 * lead-builder.js - 商机表单数据组装（纯逻辑，可测试）
 * 把录入页表单原始值组装为符合 Store 数据模型的对象。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LeadBuilder = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 组装商机数据
   * form: {
   *   clientType, carriers[], packageName, packageFee(string|''),
   *   customerName, phone, gender, returnIntent, remark
   * }
   * loc: { address, lng, lat, locatedAt } | {旧定位}
   * 返回符合 Store.add/update 的数据对象
   */
  function build(form, loc) {
    var locObj = (loc && typeof loc === 'object') ? loc : {};
    return {
      clientType: form.clientType,
      carriers: Array.isArray(form.carriers) ? form.carriers : [],
      packageName: typeof form.packageName === 'string' ? form.packageName.trim() : '',
      packageFee: (form.packageFee === '' || form.packageFee == null) ? null : Number(form.packageFee),
      customerName: typeof form.customerName === 'string' ? form.customerName.trim() : '',
      phone: typeof form.phone === 'string' ? form.phone.trim() : '',
      gender: form.gender || '',
      remark: typeof form.remark === 'string' ? form.remark.trim() : '',
      returnIntent: form.returnIntent || '',
      location: {
        address: typeof locObj.address === 'string' ? locObj.address : '',
        lng: isFinite(Number(locObj.lng)) ? Number(locObj.lng) : null,
        lat: isFinite(Number(locObj.lat)) ? Number(locObj.lat) : null,
        locatedAt: locObj.locatedAt || ''
      }
    };
  }

  return {
    build: build
  };
});
