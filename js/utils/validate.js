/**
 * validate.js - 表单校验
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Validate = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MOBILE_RE = /^1\d{10}$/;
  var FEE_RE = /^\d+(\.\d{1,2})?$/;

  function isValidPhone(p) {
    return MOBILE_RE.test(String(p || '').trim());
  }

  function isValidFee(v) {
    return FEE_RE.test(String(v || '').trim());
  }

  /**
   * 表单校验（录入页用）
   * data: { clientType, customerName, phone, packageFee }
   * 返回错误对象 { field: message }，空对象表示通过
   */
  function validateLeadForm(data) {
    var errors = {};
    if (!data.clientType) errors.clientType = '请选择客户类型';
    if (!data.customerName || !String(data.customerName).trim()) errors.customerName = '请填写客户名称';
    if (!data.phone) errors.phone = '请填写联系电话';
    else if (!isValidPhone(data.phone)) errors.phone = '请输入正确的11位手机号';
    if (data.packageFee !== '' && data.packageFee != null && !isValidFee(data.packageFee)) {
      errors.packageFee = '请输入正确的金额（如 68 或 68.5）';
    }
    return errors;
  }

  return {
    isValidPhone: isValidPhone,
    isValidFee: isValidFee,
    validateLeadForm: validateLeadForm
  };
});
