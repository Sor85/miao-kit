/**
 * 图片画廊组件
 * @module components/gallery
 */

import { $, $$, escapeHtml, openModal } from '../utils/dom.js';
import { appConfirm, appAlert } from './modal.js';
import { deleteImage, fetchCollectionDetail } from '../services/api.js';

let galleryModal = null;

/**
 * @param {string} collectionName
 * @param {string} imageUrl
 * @param {function} onDeleted
 * @param {function} handleResponse
 * @param {function} showAlert
 */
const handleDelete = async (collectionName, imageUrl, onDeleted, handleResponse, showAlert) => {
  const fileName = imageUrl.split('/').pop();
  const displayName = fileName.length > 40 ? fileName.substring(0, 37) + '...' : fileName;
  
  const confirmed = await appConfirm(
    `确定要删除图片吗？\n\n文件名：${displayName}\n\n此操作不可恢复。`, 
    '删除图片'
  );
  
  if (!confirmed) return;

  if (await deleteImage(collectionName, fileName, handleResponse, showAlert)) {
    onDeleted();
  }
};

/**
 * @param {string} collectionName
 * @param {string[]} imageUrls
 * @param {function} onDeleted
 */
const handleBatchDelete = async (collectionName, imageUrls, onDeleted) => {
  const count = imageUrls.length;
  const confirmed = await appConfirm(
    `确定要批量删除 ${count} 张图片吗？\n\n此操作不可恢复。`, 
    `批量删除 (${count} 张)`
  );
  
  if (!confirmed) return;

  const results = await Promise.allSettled(
    imageUrls.map(url => {
      const fileName = url.split('/').pop();
      return fetch(
        `/api/images/${encodeURIComponent(collectionName)}/${encodeURIComponent(fileName)}`,
        { method: 'DELETE' }
      );
    })
  );

  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
  const failCount = count - successCount;

  onDeleted(successCount, failCount);
};

/**
 * @param {string} collectionName
 * @param {string[]} urls
 * @param {function} refreshCollections
 * @param {function} handleResponse
 * @param {function} showAlert
 */
export const showImageGallery = async (collectionName, urls, refreshCollections, handleResponse, showAlert) => {
  const isFirstTime = !galleryModal;
  
  if (!galleryModal) {
    galleryModal = document.createElement('div');
    galleryModal.id = 'galleryModal';
    galleryModal.className = 'modal';
    galleryModal.innerHTML = `
      <div class="modal-content gallery-modal">
        <div class="modal-header">
          <div class="gallery-title-wrapper">
            <h2 id="galleryTitle">图床详情</h2>
            <span class="gallery-count-badge" id="galleryCount">0 张</span>
          </div>
          <div class="gallery-actions">
            <button class="btn btn-secondary btn-sm" id="batchDeleteBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              删除选中
            </button>
            <label class="batch-select-label">
              <input type="checkbox" id="selectAllImages" />
              <span>全选</span>
            </label>
            <span class="close" id="closeGalleryModal">&times;</span>
          </div>
        </div>
        <div class="gallery-body">
          <div id="galleryGrid" class="gallery-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(galleryModal);
    
    $('#closeGalleryModal').addEventListener('click', () => galleryModal.classList.remove('open'));
    galleryModal.addEventListener('click', (e) => {
      if (e.target === galleryModal) galleryModal.classList.remove('open');
    });
  }
  
  const reloadGallery = async () => {
    const data = await fetchCollectionDetail(collectionName);
    showImageGallery(collectionName, data.urls || [], refreshCollections, handleResponse, showAlert);
  };
  
  $('#galleryTitle').textContent = collectionName;
  $('#galleryCount').textContent = `${urls.length} 张`;
  
  const galleryGrid = $('#galleryGrid');
  
  if (urls.length === 0) {
    galleryGrid.innerHTML = '<div class="empty-state">该图床下暂无图片</div>';
  } else {
    galleryGrid.innerHTML = urls.map(url => {
      const galleryUrl = url.includes('?') ? `${url}&gallery=1` : `${url}?gallery=1`;
      return `
        <div class="gallery-item" data-url="${escapeHtml(url)}">
          <input type="checkbox" class="gallery-item-checkbox" data-image-url="${escapeHtml(url)}" />
          <img src="${escapeHtml(galleryUrl)}" alt="图片" loading="lazy" />
          <div class="gallery-item-info">
            <a href="${escapeHtml(url)}" target="_blank" class="gallery-item-link">查看原图</a>
            <button class="gallery-item-delete" data-delete-image="${escapeHtml(url)}" title="删除图片">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定删除事件
    $$('.gallery-item-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const imageUrl = btn.getAttribute('data-delete-image');
        await handleDelete(collectionName, imageUrl, async () => {
          await reloadGallery();
          await refreshCollections();
        }, handleResponse, showAlert);
      });
    });

    // 批量选择逻辑
    const checkboxes = $$('.gallery-item-checkbox');
    const selectAllCheckbox = $('#selectAllImages');
    const batchDeleteBtn = $('#batchDeleteBtn');

    const updateBatchDeleteBtn = () => {
      const checkedCount = checkboxes.filter(cb => cb.checked).length;
      const selectAllLabel = $('.batch-select-label');
      
      if (checkedCount > 0) {
        batchDeleteBtn.style.display = 'flex';
        selectAllLabel.style.display = 'flex';
        batchDeleteBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          删除选中 (${checkedCount})
        `;
      } else {
        batchDeleteBtn.style.display = 'none';
        selectAllLabel.style.display = 'none';
      }
    };

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        updateBatchDeleteBtn();
        const allChecked = checkboxes.every(c => c.checked);
        const someChecked = checkboxes.some(c => c.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
      });
    });

    selectAllCheckbox.addEventListener('change', () => {
      checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
      updateBatchDeleteBtn();
    });

    batchDeleteBtn.addEventListener('click', async () => {
      const selectedUrls = checkboxes
        .filter(cb => cb.checked)
        .map(cb => cb.getAttribute('data-image-url'));
      
      if (selectedUrls.length === 0) return;

      await handleBatchDelete(collectionName, selectedUrls, async (successCount, failCount) => {
        if (failCount === 0) {
          await showAlert(`成功删除 ${successCount} 张图片`, '删除成功');
        } else {
          await showAlert(
            `删除完成：成功 ${successCount} 张，失败 ${failCount} 张`, 
            '部分成功'
          );
        }
        await reloadGallery();
        await refreshCollections();
      });
    });
  }
  
  openModal(galleryModal, isFirstTime);
};

