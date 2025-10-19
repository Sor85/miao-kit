/**
 * 本地存储工具
 * @module utils/storage
 */

const COLLAPSE_STATE_KEY = 'collections-collapse-state';

/**
 * @returns {Record<string, boolean>}
 */
export const loadCollapseStates = () => {
  try {
    const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

/**
 * @param {function(Record<string, boolean>): void} updateFn
 */
export const updateCollapseStates = (updateFn) => {
  try {
    const states = loadCollapseStates();
    updateFn(states);
    localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(states));
  } catch(err) {
    console.error('更新折叠状态失败:', err);
  }
};

/**
 * @param {string} collectionName
 * @param {boolean} isCollapsed
 */
export const saveCollapseState = (collectionName, isCollapsed) => {
  updateCollapseStates(states => states[collectionName] = isCollapsed);
};

/**
 * @param {string} collectionName
 * @param {boolean} defaultCollapsed
 * @returns {boolean}
 */
export const getCollapseState = (collectionName, defaultCollapsed) => {
  const states = loadCollapseStates();
  return states[collectionName] ?? defaultCollapsed;
};

