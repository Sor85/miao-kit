const fs = require('fs');

/**
 * @param {string} orderFile
 * @returns {string[]}
 */
const loadOrder = (orderFile) => {
  try {
    return fs.existsSync(orderFile) 
      ? JSON.parse(fs.readFileSync(orderFile, 'utf8'))
      : [];
  } catch (err) {
    console.error('读取顺序文件失败:', err);
    return [];
  }
};

/**
 * @param {string} orderFile
 * @param {string[]} order
 */
const saveOrder = (orderFile, order) => {
  try {
    fs.writeFileSync(orderFile, JSON.stringify(order, null, 2), 'utf8');
  } catch (err) {
    console.error('保存顺序文件失败:', err);
  }
};

/**
 * @param {string[]} allItems
 * @param {string[]} savedOrder
 * @returns {string[]}
 */
const mergeOrder = (allItems, savedOrder) => {
  const allSet = new Set(allItems);
  const ordered = savedOrder.filter(name => allSet.has(name));
  const orderedSet = new Set(ordered);
  const newItems = allItems.filter(name => !orderedSet.has(name));
  return [...ordered, ...newItems];
};

module.exports = { loadOrder, saveOrder, mergeOrder };

