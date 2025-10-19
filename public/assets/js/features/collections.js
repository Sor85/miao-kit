/**
 * 图床管理功能
 * @module features/collections
 */

import { $, $$, escapeHtml } from '../utils/dom.js';
import { getCollapseState, saveCollapseState, updateCollapseStates } from '../utils/storage.js';
import { 
  fetchCollections, 
  createCollection as apiCreateCollection,
  renameCollection as apiRenameCollection,
  deleteCollection as apiDeleteCollection,
  fetchCollectionDetail,
  saveOrder
} from '../services/api.js';
import { appPrompt, appConfirm } from '../components/modal.js';
import { showImageGallery } from '../components/gallery.js';

let previousCollectionCount = 0;

/**
 * @param {string} collection
 * @param {boolean} defaultShouldCollapse
 * @returns {string}
 */
const getInitialCollapseClass = (collection, defaultShouldCollapse) => {
  const isCollapsed = getCollapseState(collection, defaultShouldCollapse);
  return isCollapsed ? ' collapsed' : '';
};

/**
 * @param {string} collection
 * @returns {string}
 */
const createCollectionHTML = (collection, collapseClass) => `
  <div class="collection-pair" data-collection="${escapeHtml(collection)}">
    <div class="drag-handle" title="拖拽移动图床位置">
      <svg width="32" height="4" viewBox="0 0 32 4" fill="none">
        <rect width="32" height="4" rx="2" fill="currentColor"/>
      </svg>
    </div>
    
    <div class="upload-collection-card${collapseClass}" data-collection="${escapeHtml(collection)}">
      <div class="upload-card-header">
        <div class="upload-collection-name">${escapeHtml(collection)}</div>
        <div class="upload-card-controls">
          <div class="upload-collection-count" data-collection="${escapeHtml(collection)}">0 张</div>
          <button class="toggle-upload-btn" title="展开/折叠上传区域">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="upload-dropzone" data-collection="${escapeHtml(collection)}">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
        <p>拖拽图片到这里</p>
        <span>或</span>
        <button class="btn btn-secondary btn-sm upload-select-btn">上传图片</button>
        <input type="file" class="upload-file-input" accept="image/*" multiple style="display:none;" data-collection="${escapeHtml(collection)}" />
      </div>
    </div>
    
    <div class="collection-card">
      <div class="collection-header">
        <div class="collection-name">${escapeHtml(collection)}</div>
        <div class="collection-header-actions">
          <button class="icon-edit-btn" data-edit-collection="${escapeHtml(collection)}" title="重命名图床">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-delete-btn" data-delete-collection="${escapeHtml(collection)}" title="删除图床">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="collection-url">随机地址：<code>/${escapeHtml(collection)}</code></div>
      <div class="collection-actions">
        <button class="btn btn-secondary btn-sm" data-detail="${escapeHtml(collection)}">查看详情</button>
        <button class="btn btn-primary btn-sm" data-random="${escapeHtml(collection)}">随机打开</button>
      </div>
    </div>
  </div>
`;

/**
 * @param {function} bindUploadEvents
 * @param {function} bindCollectionEvents
 * @param {function} bindToggleEvents
 * @param {function} bindDragEvents
 * @param {function} updateCollectionCounts
 */
export const refreshCollections = async (
  bindUploadEvents,
  bindCollectionEvents,
  bindToggleEvents,
  bindDragEvents,
  updateCollectionCounts
) => {
  const container = $('#collectionsContainer');
  
  try {
    const data = await fetchCollections();
    
    if (!data.collections || data.collections.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无图床，请先创建图床</div>';
      previousCollectionCount = 0;
      return;
    }

    const currentCount = data.collections.length;
    const defaultShouldCollapse = currentCount > 3;
    
    const shouldAnimateCollapse = previousCollectionCount > 0 && previousCollectionCount <= 3 && currentCount > 3;
    const shouldAnimateExpand = previousCollectionCount > 3 && currentCount <= 3;

    // 在过渡动画期间，使用过渡前的默认状态，忽略用户保存的状态
    const initialCollapseState = shouldAnimateExpand ? true : (shouldAnimateCollapse ? false : null);
    
    container.innerHTML = data.collections
      .map(c => {
        // 如果有过渡动画，使用过渡前的状态；否则使用正常逻辑
        const collapseClass = initialCollapseState !== null 
          ? (initialCollapseState ? ' collapsed' : '')
          : getInitialCollapseClass(c, defaultShouldCollapse);
        return createCollectionHTML(c, collapseClass);
      })
      .join('');

    bindUploadEvents();
    bindCollectionEvents();
    bindToggleEvents();
    bindDragEvents();
    await updateCollectionCounts();
    
    if (shouldAnimateCollapse) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          $$('.upload-collection-card').forEach(card => {
            const collectionName = card.getAttribute('data-collection');
            const isCurrentlyCollapsed = card.classList.contains('collapsed');
            
            if (!isCurrentlyCollapsed) card.classList.add('collapsed');
            saveCollapseState(collectionName, true);
          });
        });
      });
    } else if (shouldAnimateExpand) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          $$('.upload-collection-card').forEach(card => {
            const collectionName = card.getAttribute('data-collection');
            const isCurrentlyCollapsed = card.classList.contains('collapsed');
            
            if (isCurrentlyCollapsed) card.classList.remove('collapsed');
            saveCollapseState(collectionName, false);
          });
        });
      });
    }
    
    previousCollectionCount = currentCount;
  } catch(err) {
    console.error(err);
    container.innerHTML = '<div class="empty-state">加载图床失败</div>';
  }
};

/**
 * @param {function} handleResponse
 * @param {function} showAlert
 * @param {function} refresh
 * @param {function} loadCollectionsToFilter
 */
export const createCollection = async (handleResponse, showAlert, refresh, loadCollectionsToFilter) => {
  const name = await appPrompt('请输入图床名称', '创建图床', '');
  if (!name) return;
  
  try {
    if (await apiCreateCollection(name, handleResponse, showAlert)) {
      await Promise.all([refresh(), loadCollectionsToFilter()]);
    }
  } catch(err) {
    console.error(err);
    await showAlert(`创建失败：${err.message}`, '错误');
  }
};

/**
 * @param {string} oldName
 * @param {function} handleResponse
 * @param {function} showAlert
 * @param {function} refresh
 * @param {function} loadCollectionsToFilter
 */
export const renameCollection = async (oldName, handleResponse, showAlert, refresh, loadCollectionsToFilter) => {
  const newName = await appPrompt('请输入新的图床名称', '重命名图床', oldName);
  if (!newName || newName === oldName) return;
  
  try {
    if (await apiRenameCollection(oldName, newName, handleResponse, showAlert)) {
      updateCollapseStates(states => {
        if (oldName in states) {
          states[newName] = states[oldName];
          delete states[oldName];
        }
      });
      
      await Promise.all([refresh(), loadCollectionsToFilter()]);
    }
  } catch(err) {
    console.error(err);
    await showAlert(`重命名失败：${err.message}`, '错误');
  }
};

/**
 * @param {string} collectionName
 * @param {function} handleResponse
 * @param {function} showAlert
 * @param {function} refresh
 * @param {function} loadCollectionsToFilter
 */
export const deleteCollection = async (collectionName, handleResponse, showAlert, refresh, loadCollectionsToFilter) => {
  const confirmed = await appConfirm(
    `确定要删除图床"${collectionName}"吗？\n\n此操作将删除该图床下的所有图片，且不可恢复。`, 
    '删除图床'
  );
  if (!confirmed) return;

  try {
    if (await apiDeleteCollection(collectionName, handleResponse, showAlert)) {
      updateCollapseStates(states => delete states[collectionName]);
      await Promise.all([refresh(), loadCollectionsToFilter()]);
    }
  } catch(err) {
    console.error(err);
    await showAlert(`删除失败：${err.message}`, '错误');
  }
};

export const updateCollectionCounts = async () => {
  const countElements = $$('.upload-collection-count');
  await Promise.all(countElements.map(async (el) => {
    const collectionName = el.getAttribute('data-collection');
    try {
      const data = await fetchCollectionDetail(collectionName);
      el.textContent = `${data.images ? data.images.length : 0} 张`;
    } catch {
      el.textContent = '0 张';
    }
  }));
};

export const bindToggleEvents = () => {
  $$('.upload-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.upload-collection-card');
      const collectionName = card.getAttribute('data-collection');
      
      card.classList.toggle('collapsed');
      saveCollapseState(collectionName, card.classList.contains('collapsed'));
    });
  });
};

let draggedElement = null;

export const bindDragEvents = () => {
  $$('.collection-pair').forEach(pair => {
    const dragHandle = pair.querySelector('.drag-handle');
    
    dragHandle.addEventListener('mousedown', () => pair.setAttribute('draggable', 'true'));
    dragHandle.addEventListener('mouseup', () => pair.removeAttribute('draggable'));
    
    pair.addEventListener('dragstart', (e) => {
      draggedElement = pair;
      pair.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', pair.innerHTML);
      e.dataTransfer.setData('application/x-collection-card', 'true'); // 标记为卡片拖拽
    });
    
    pair.addEventListener('dragend', () => {
      draggedElement?.classList.remove('dragging');
      pair.removeAttribute('draggable');
      $$('.collection-pair').forEach(p => p.classList.remove('drag-over'));
      draggedElement = null;
    });
    
    pair.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedElement && draggedElement !== pair) {
        pair.classList.add('drag-over');
      }
    });
    
    pair.addEventListener('dragleave', (e) => {
      if (e.target === pair) pair.classList.remove('drag-over');
    });
    
    pair.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      pair.classList.remove('drag-over');
      
      if (draggedElement && draggedElement !== pair) {
        const allPairs = $$('.collection-pair');
        const draggedIndex = allPairs.indexOf(draggedElement);
        const targetIndex = allPairs.indexOf(pair);
        
        if (draggedIndex < targetIndex) {
          pair.parentNode.insertBefore(draggedElement, pair.nextSibling);
        } else {
          pair.parentNode.insertBefore(draggedElement, pair);
        }
        
        const order = $$('.collection-pair').map(p => p.getAttribute('data-collection'));
        try {
          await saveOrder(order);
        } catch(err) {
          console.error('保存顺序失败:', err);
        }
      }
    });
  });
};

/**
 * @param {function} handleResponse
 * @param {function} showAlert
 * @param {function} refresh
 */
export const bindCollectionEvents = (handleResponse, showAlert, refresh, loadCollectionsToFilter) => {
  $$('[data-detail]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const collectionName = btn.getAttribute('data-detail');
      try {
        const data = await fetchCollectionDetail(collectionName);
        showImageGallery(collectionName, data.urls || [], refresh, handleResponse, showAlert);
      } catch(err) {
        console.error(err);
        await showAlert('获取图床详情失败', '错误');
      }
    });
  });

  $$('[data-random]').forEach(btn => {
    btn.addEventListener('click', () => {
      const collectionName = btn.getAttribute('data-random');
      window.open(`/${encodeURIComponent(collectionName)}`, '_blank');
    });
  });

  $$('[data-edit-collection]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const collectionName = btn.getAttribute('data-edit-collection');
      await renameCollection(collectionName, handleResponse, showAlert, refresh, loadCollectionsToFilter);
    });
  });

  $$('[data-delete-collection]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const collectionName = btn.getAttribute('data-delete-collection');
      await deleteCollection(collectionName, handleResponse, showAlert, refresh, loadCollectionsToFilter);
    });
  });
};

