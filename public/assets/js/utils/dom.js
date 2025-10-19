/**
 * DOM 工具函数
 * @module utils/dom
 */

/** @param {string} sel */
export const $ = (sel) => document.querySelector(sel);

/** @param {string} sel */
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** @param {string} s */
export const escapeHtml = (s) => {
  if (typeof s !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, m => map[m]);
};

/**
 * @param {string} iso
 * @returns {string}
 */
export const formatTimestamp = (iso) => {
  const date = new Date(iso);
  const diff = Date.now() - date;
  
  return diff < 86400000
    ? date.toLocaleTimeString('zh-CN', { hour12: false })
    : date.toLocaleString('zh-CN', { 
        month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit', 
        hour12: false 
      });
};

/**
 * @param {HTMLElement} modalElement
 * @param {boolean} isFirstTime
 */
export const openModal = (modalElement, isFirstTime) => {
  const addOpenClass = () => modalElement.classList.add('open');
  
  if (isFirstTime) {
    requestAnimationFrame(() => requestAnimationFrame(addOpenClass));
  } else {
    requestAnimationFrame(addOpenClass);
  }
};

