/**
 * 上传管理功能
 * @module features/upload
 */

import { $$, $ } from '../utils/dom.js';
import { checkConflicts, uploadFiles as apiUploadFiles } from '../services/api.js';
import { appAlert, appChoice } from '../components/modal.js';

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * @param {File[]} files
 * @returns {File[]}
 */
const filterImageFiles = (files) =>
  files.filter(f => f.type.startsWith('image/') || IMAGE_EXTENSIONS.test(f.name));

/**
 * @param {string} collectionName
 * @param {File[]} files
 * @param {boolean} replaceMode
 * @param {function} showAlert
 * @param {function} refresh
 * @param {function} loadCollectionsToFilter
 */
const doUpload = async (collectionName, files, replaceMode, showAlert, refresh, loadCollectionsToFilter) => {
  try {
    const data = await apiUploadFiles(collectionName, files, replaceMode);
    const uploadedCount = data.count || 0;
    const totalCount = files.length;
    
    if (uploadedCount === totalCount) {
      const actionText = replaceMode ? '替换' : '上传';
      await appAlert(
        `成功${actionText} ${uploadedCount} 张图片到图床"${collectionName}"`, 
        `${actionText}成功`
      );
    } else {
      await showAlert(
        `部分上传成功：${uploadedCount}/${totalCount} 张图片已上传到图床"${collectionName}"。\n` +
        `失败的文件可能不是有效的图片格式。`, 
        '部分成功'
      );
    }
    
    await Promise.all([refresh(), loadCollectionsToFilter()]);
  } catch(err) {
    console.error(err);
    await showAlert(`上传失败：${err.message}`, '错误');
  }
};

/**
 * @param {string} collectionName
 * @param {File[]} files
 * @param {function} showAlert
 * @param {function} refresh
 * @param {function} loadCollectionsToFilter
 */
export const uploadFiles = async (collectionName, files, showAlert, refresh, loadCollectionsToFilter) => {
  const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
  
  if (oversizedFiles.length > 0) {
    await appAlert(`以下文件超过10MB限制：\n${oversizedFiles.map(f => f.name).join('\n')}`, '文件过大');
    return;
  }

  try {
    const filenames = files.map(f => f.name);
    const { conflicts } = await checkConflicts(collectionName, filenames);
    
    if (conflicts.length > 0) {
      const conflictList = conflicts.length > 5 
        ? conflicts.slice(0, 5).join('\n') + `\n... 等 ${conflicts.length} 个文件`
        : conflicts.join('\n');
      
      const choice = await appChoice(
        `检测到 ${conflicts.length} 个文件已存在：\n\n${conflictList}\n\n请选择处理方式：`,
        '文件冲突',
        ['替换', '重命名', '取消']
      );
      
      if (choice === 2 || choice === -1) return;
      
      await doUpload(collectionName, files, choice === 0, showAlert, refresh, loadCollectionsToFilter);
    } else {
      await doUpload(collectionName, files, false, showAlert, refresh, loadCollectionsToFilter);
    }
  } catch(err) {
    console.error(err);
    await showAlert(`上传失败：${err.message}`, '错误');
  }
};

/**
 * @param {function} uploadHandler
 */
export const bindUploadEvents = (uploadHandler) => {
  $$('.upload-collection-card').forEach(card => {
    const collectionName = card.getAttribute('data-collection');
    const dropzone = card.querySelector('.upload-dropzone');
    
    const isCardDrag = (e) => e.dataTransfer.types.includes('application/x-collection-card');
    const toggleDragover = (add) => {
      card.classList.toggle('dragover', add);
      if (dropzone) dropzone.classList.toggle('dragover', add);
    };
    
    card.addEventListener('dragover', (e) => {
      if (isCardDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      toggleDragover(true);
    });
    
    card.addEventListener('dragleave', (e) => {
      if (isCardDrag(e)) return;
      if (e.target === card || !card.contains(e.relatedTarget)) {
        toggleDragover(false);
      }
    });
    
    card.addEventListener('drop', async (e) => {
      if (isCardDrag(e)) {
        toggleDragover(false);
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      toggleDragover(false);
      
      const allFiles = Array.from(e.dataTransfer.files);
      const files = filterImageFiles(allFiles);
      
      if (files.length > 0) {
        const filtered = allFiles.length - files.length;
        if (filtered > 0) console.warn(`已过滤 ${filtered} 个非图片文件`);
        await uploadHandler(collectionName, files);
      }
    });
  });

  $$('.upload-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.upload-collection-card');
      const input = card.querySelector('.upload-file-input');
      input.click();
    });
  });

  $$('.upload-file-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const collectionName = input.getAttribute('data-collection');
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        await uploadHandler(collectionName, files);
        input.value = '';
      }
    });
  });
};

