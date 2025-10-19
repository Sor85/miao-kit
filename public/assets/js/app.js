(function(){
  'use strict';
  
  // ========== 工具函数 ==========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  
  function escapeHtml(s){
    if(typeof s !== 'string') return '';
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function formatTimestamp(iso) {
    const date = new Date(iso);
    const diff = Date.now() - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('zh-CN', { hour12: false });
    }
    
    return date.toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  }

  // ========== DOM 元素 ==========
  const btnCreateCollectionEl = $('#btnCreateCollection');
  const collectionsContainerEl = $('#collectionsContainer');
  const refreshLogsEl = $('#refreshLogs');
  const filterMethodEl = $('#filterMethod');
  const filterStatusEl = $('#filterStatus');
  const filterCollectionEl = $('#filterCollection');
  const filterTimeRangeEl = $('#filterTimeRange');
  const logListEl = $('#logList');
  const logModalEl = $('#logModal');
  const closeLogModalEl = $('#closeLogModal');
  const paginationEl = $('#pagination');
  const prevPageEl = $('#prevPage');
  const nextPageEl = $('#nextPage');
  const pageInfoEl = $('#pageInfo');
  
  let autoRefreshTimer = null;
  let currentPage = 1;
  let totalPages = 1;
  let allLogs = [];
  const LOGS_PER_PAGE = 10;

  // ========== 弹窗功能 ==========
  let appModalEl = null;
  
  // 通用函数：打开模态框并触发动画
  function openModal(modalElement, isFirstTime) {
    if (isFirstTime) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          modalElement.classList.add('open');
        });
      });
    } else {
      requestAnimationFrame(() => {
        modalElement.classList.add('open');
      });
    }
  }
  
  function ensureAppModal(){
    if(appModalEl) return appModalEl;
    
    const overlay = document.createElement('div');
    overlay.className = 'app-modal';
    overlay.innerHTML = `
      <div class="box">
        <div class="title" id="appModalTitle">提示</div>
        <div class="content" id="appModalContent"></div>
        <div class="actions">
          <button class="btn btn-primary" id="appModalOk">确定</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    
    const style = document.createElement('style');
    style.textContent = `
      .app-modal { position: fixed; inset: 0; background: rgba(15,23,42,0); z-index: 1100; align-items: center; justify-content: center; transition: background .2s ease; display: flex; visibility: hidden; opacity: 0; }
      .app-modal.open { visibility: visible; opacity: 1; background: rgba(15,23,42,0.35); }
      .app-modal .box { width: 92%; max-width: 420px; margin: 0; padding: 20px; border-radius: 12px; background: #ffffff; border: 1px solid #e5f1ff; box-shadow: 0 10px 24px rgba(30,144,255,0.18); max-height: 70vh; overflow: auto; word-break: break-word; transform: translateY(30px) scale(0.95); opacity: 0; transition: all .3s cubic-bezier(0.34, 1.56, 0.64, 1); }
      .app-modal.open .box { transform: translateY(0) scale(1); opacity: 1; }
      .app-modal .title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; padding: 0; line-height: 1.3; }
      .app-modal .content { color: #334155; margin: 0; padding: 0; line-height: 0; word-break: break-word; white-space: pre-wrap; font-size: 0; }
      .app-modal .content label { display: block; margin: 0 0 8px 0; padding: 0; color: #94a3b8; font-size: 13px; line-height: 1.3; }
      .app-modal .content input[type="text"] { width: 100%; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; background: #f9fafb; color: #1f2937; transition: all .2s ease; margin: 0; box-sizing: border-box; }
      .app-modal .content input[type="text"]:hover { border-color: #d1d5db; background: #ffffff; }
      .app-modal .content input[type="text"]:focus { border-color: #1e90ff; background: #ffffff; box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1); }
      .app-modal .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
      .app-modal .actions .btn { padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; border: 1px solid #cfe6ff; background: #e7f2ff; color: #0f172a; transition: all .2s ease; }
      .app-modal .actions .btn:hover { background: #d9ecff; transform: translateY(-1px); }
      .app-modal .actions .btn-primary { background: #1e90ff; color: #fff; border-color: #1e90ff; }
      .app-modal .actions .btn-primary:hover { background: #1778d6; }
    `;
    document.head.appendChild(style);
    
    appModalEl = overlay;
    return appModalEl;
  }
  
  function appAlert(message, title = '提示'){
    return new Promise((resolve) => {
      const isFirstTime = !appModalEl;
      const el = ensureAppModal();
      const titleEl = el.querySelector('#appModalTitle');
      const contentEl = el.querySelector('#appModalContent');
      const actionsEl = el.querySelector('.actions');
      
      titleEl.textContent = title;
      contentEl.textContent = message;
      
      // 重置为单按钮
      actionsEl.innerHTML = '<button class="btn btn-primary" id="appModalOk">确定</button>';
      const okBtn = el.querySelector('#appModalOk');
      
      openModal(el, isFirstTime);

      const cleanup = () => {
        el.classList.remove('open');
        okBtn.removeEventListener('click', onOk);
        el.removeEventListener('click', onBackdrop);
      };
      const onOk = () => { cleanup(); resolve(true); };
      const onBackdrop = (e) => { if(e.target === el) onOk(); };
      
      okBtn.addEventListener('click', onOk);
      el.addEventListener('click', onBackdrop);
    });
  }

  function appPrompt(message, title = '输入', placeholder = ''){
    return new Promise((resolve) => {
      const isFirstTime = !appModalEl;
      const el = ensureAppModal();
      const titleEl = el.querySelector('#appModalTitle');
      const contentEl = el.querySelector('#appModalContent');
      const actionsEl = el.querySelector('.actions');
      
      titleEl.textContent = title;
      contentEl.innerHTML = `
        <label for="promptInput">${escapeHtml(message)}</label>
        <input type="text" id="promptInput" placeholder="${escapeHtml(placeholder)}" />
      `;
      
      actionsEl.innerHTML = `
        <button class="btn" id="appModalCancel">取消</button>
        <button class="btn btn-primary" id="appModalOk">确定</button>
      `;
      
      const input = el.querySelector('#promptInput');
      const okBtn = el.querySelector('#appModalOk');
      const cancelBtn = el.querySelector('#appModalCancel');
      
      openModal(el, isFirstTime);
      setTimeout(() => input.focus(), 100);

      const cleanup = () => {
        el.classList.remove('open');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        el.removeEventListener('click', onBackdrop);
        input.removeEventListener('keydown', onKeydown);
      };
      
      const onOk = () => { 
        const value = input.value.trim();
        cleanup(); 
        resolve(value || null); 
      };
      
      const onCancel = () => { cleanup(); resolve(null); };
      const onBackdrop = (e) => { if(e.target === el) onCancel(); };
      const onKeydown = (e) => {
        if (e.key === 'Enter') onOk();
        if (e.key === 'Escape') onCancel();
      };
      
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      el.addEventListener('click', onBackdrop);
      input.addEventListener('keydown', onKeydown);
    });
  }

  // ========== 集合管理功能 ==========
  
  async function refreshCollections() {
    try {
      const res = await fetch('/collections');
      const data = await res.json();
      
      if (!data.collections || data.collections.length === 0) {
        collectionsContainerEl.innerHTML = '<div class="empty-state">暂无图床，请先创建图床</div>';
        return;
      }

      // 为每个图床创建成对的上传卡片和浏览卡片
      collectionsContainerEl.innerHTML = data.collections.map(c => `
        <div class="collection-pair">
          <!-- 上传卡片 -->
          <div class="upload-collection-card" data-collection="${escapeHtml(c)}">
            <div class="upload-card-header">
              <div class="upload-collection-name">${escapeHtml(c)}</div>
              <div class="upload-collection-count" data-collection="${escapeHtml(c)}">0 张</div>
            </div>
            <div class="upload-dropzone" data-collection="${escapeHtml(c)}">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <p>拖拽图片到这里</p>
              <span>或</span>
              <button class="btn btn-secondary btn-sm upload-select-btn">上传图片</button>
              <input type="file" class="upload-file-input" accept="image/*" multiple style="display:none;" data-collection="${escapeHtml(c)}" />
            </div>
          </div>
          
          <!-- 浏览卡片 -->
          <div class="collection-card">
            <div class="collection-header">
              <div class="collection-name">${escapeHtml(c)}</div>
              <button class="icon-delete-btn" data-delete-collection="${escapeHtml(c)}" title="删除图床">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
            <div class="collection-url">随机地址：<code>/${escapeHtml(c)}</code></div>
            <div class="collection-actions">
              <button class="btn btn-secondary btn-sm" data-detail="${escapeHtml(c)}">查看详情</button>
              <button class="btn btn-primary btn-sm" data-random="${escapeHtml(c)}">随机打开</button>
            </div>
          </div>
        </div>
      `).join('');

      bindUploadEvents();
      bindCollectionEvents();
      await updateCollectionCounts();
    } catch(err) {
      console.error(err);
      collectionsContainerEl.innerHTML = '<div class="empty-state">加载图床失败</div>';
    }
  }

  function bindUploadEvents() {
    // 绑定拖拽事件
    $$('.upload-dropzone').forEach(zone => {
      const collectionName = zone.getAttribute('data-collection');
      
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
      });
      
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
          await uploadFiles(collectionName, files);
        }
      });
    });

    // 绑定手动上传按钮
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
          await uploadFiles(collectionName, files);
          input.value = '';
        }
      });
    });
  }


  function bindCollectionEvents() {
    $$('[data-detail]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const collectionName = btn.getAttribute('data-detail');
        await showCollectionDetail(collectionName);
      });
    });

    $$('[data-random]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const collectionName = btn.getAttribute('data-random');
        window.open(`/${encodeURIComponent(collectionName)}`, '_blank');
      });
    });

    $$('[data-delete-collection]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const collectionName = btn.getAttribute('data-delete-collection');
        await deleteCollection(collectionName);
      });
    });
  }

  async function deleteCollection(collectionName) {
    const confirmed = await appConfirm(`确定要删除图床"${collectionName}"吗？\n\n此操作将删除该图床下的所有图片，且不可恢复。`, '删除图床');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(collectionName)}`, {
        method: 'DELETE'
      });

      const text = await res.text();

      if (res.ok) {
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
      } else {
        try {
          const data = JSON.parse(text);
          await appAlert(data.error || '删除失败', '错误');
        } catch {
          await appAlert(`删除失败：${text}`, '错误');
        }
      }
    } catch(err) {
      console.error(err);
      await appAlert(`删除失败：${err.message}`, '错误');
    }
  }

  function appConfirm(message, title = '确认'){
    return new Promise((resolve) => {
      const isFirstTime = !appModalEl;
      const el = ensureAppModal();
      const titleEl = el.querySelector('#appModalTitle');
      const contentEl = el.querySelector('#appModalContent');
      const actionsEl = el.querySelector('.actions');
      
      titleEl.textContent = title;
      contentEl.textContent = message;
      
      actionsEl.innerHTML = `
        <button class="btn" id="appModalCancel">取消</button>
        <button class="btn btn-primary" id="appModalOk">确定</button>
      `;
      
      const okBtn = el.querySelector('#appModalOk');
      const cancelBtn = el.querySelector('#appModalCancel');
      
      openModal(el, isFirstTime);

      const cleanup = () => {
        el.classList.remove('open');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        el.removeEventListener('click', onBackdrop);
      };
      const onOk = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };
      const onBackdrop = (e) => { if(e.target === el) onCancel(); };
      
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      el.addEventListener('click', onBackdrop);
    });
  }

  async function updateCollectionCounts() {
    const countElements = $$('.upload-collection-count');
    const promises = Array.from(countElements).map(async (el) => {
      const collectionName = el.getAttribute('data-collection');
      try {
        const res = await fetch(`/collections/${encodeURIComponent(collectionName)}`);
        const data = await res.json();
        el.textContent = `${data.images ? data.images.length : 0} 张`;
      } catch {
        el.textContent = '0 张';
      }
    });
    
    await Promise.all(promises);
  }

  async function uploadFiles(collectionName, files) {
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      await appAlert(`以下文件超过10MB限制：\n${oversizedFiles.map(f => f.name).join('\n')}`, '文件过大');
      return;
    }

    const form = new FormData();
    files.forEach(f => form.append('files', f));

    try {
      const res = await fetch(`/upload/${encodeURIComponent(collectionName)}`, { 
        method: 'POST', 
        body: form 
      });
      
      const text = await res.text();
      
      if (res.ok) {
        await appAlert(`成功上传 ${files.length} 个文件到图床"${collectionName}"`, '上传成功');
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
      } else {
        try {
          const data = JSON.parse(text);
          await appAlert(data.error || '上传失败', '错误');
        } catch {
          await appAlert(`上传失败：${text}`, '错误');
        }
      }
    } catch(err) {
      console.error(err);
      await appAlert(`上传失败：${err.message}`, '错误');
    }
  }

  async function showCollectionDetail(collectionName) {
    try {
      const res = await fetch(`/collections/${encodeURIComponent(collectionName)}`);
      const data = await res.json();
      showImageGallery(collectionName, data.urls || []);
    } catch(err) {
      console.error(err);
      await appAlert('获取图床详情失败', '错误');
    }
  }

  function showImageGallery(collectionName, urls) {
    let galleryModal = $('#galleryModal');
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
            <span class="close" id="closeGalleryModal">&times;</span>
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
    
    $('#galleryTitle').textContent = collectionName;
    $('#galleryCount').textContent = `${urls.length} 张`;
    
    const galleryGrid = $('#galleryGrid');
    if (urls.length === 0) {
      galleryGrid.innerHTML = '<div class="empty-state">该图床下暂无图片</div>';
    } else {
      galleryGrid.innerHTML = urls.map(url => `
        <div class="gallery-item">
          <img src="${escapeHtml(url)}" alt="图片" loading="lazy" />
          <div class="gallery-item-info">
            <a href="${escapeHtml(url)}" target="_blank" class="gallery-item-link">查看原图</a>
            <button class="gallery-item-delete" data-delete-image="${escapeHtml(url)}" data-collection="${escapeHtml(collectionName)}" title="删除图片">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');

      // 绑定删除图片事件
      $$('.gallery-item-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const imageUrl = btn.getAttribute('data-delete-image');
          const collection = btn.getAttribute('data-collection');
          await deleteImage(collection, imageUrl);
        });
      });
    }
    
    openModal(galleryModal, isFirstTime);
  }

  async function deleteImage(collectionName, imageUrl) {
    const fileName = imageUrl.split('/').pop();
    // 如果文件名过长，进行截断显示
    const displayName = fileName.length > 40 ? fileName.substring(0, 37) + '...' : fileName;
    const confirmed = await appConfirm(`确定要删除图片吗？\n\n文件名：${displayName}\n\n此操作不可恢复。`, '删除图片');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/images/${encodeURIComponent(collectionName)}/${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });

      const text = await res.text();

      if (res.ok) {
        // 重新加载画廊
        const detailRes = await fetch(`/collections/${encodeURIComponent(collectionName)}`);
        const data = await detailRes.json();
        showImageGallery(collectionName, data.urls || []);
        
        // 刷新集合列表
        await refreshCollections();
      } else {
        try {
          const data = JSON.parse(text);
          await appAlert(data.error || '删除失败', '错误');
        } catch {
          await appAlert(`删除失败：${text}`, '错误');
        }
      }
    } catch(err) {
      console.error(err);
      await appAlert(`删除失败：${err.message}`, '错误');
    }
  }

  async function createCollection() {
    const name = await appPrompt('请输入图床名称', '创建图床', '');
    if (!name) return;
    
    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const text = await res.text();
      
      if (res.ok) {
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
      } else {
        try {
          const data = JSON.parse(text);
          await appAlert(data.error || '创建失败', '错误');
        } catch {
          await appAlert(`创建失败：${text}`, '错误');
        }
      }
    } catch(err) {
      console.error(err);
      await appAlert(`创建失败：${err.message}`, '错误');
    }
  }

  // ========== 日志功能 ==========

  async function loadCollectionsToFilter() {
    try {
      const res = await fetch('/collections');
      const data = await res.json();
      
      if (filterCollectionEl && data.collections) {
        const currentValue = filterCollectionEl.value;
        
        // 如果已经有自定义下拉，需要先移除包装器
        const wrapper = filterCollectionEl.closest('.custom-select-wrapper');
        if (wrapper) {
          const parent = wrapper.parentNode;
          parent.insertBefore(filterCollectionEl, wrapper);
          wrapper.remove();
        }
        
        filterCollectionEl.innerHTML = '<option value="all">全部</option>' + 
          data.collections.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        
        if (currentValue) filterCollectionEl.value = currentValue;
        
        // 重新创建自定义下拉
        createCustomSelect(filterCollectionEl);
      }
    } catch(err) {
      console.error('加载图床列表失败:', err);
    }
  }

  async function loadLogs(resetPage = true) {
    if (resetPage) currentPage = 1;
    
    try {
      const params = new URLSearchParams();
      const method = filterMethodEl?.value;
      const status = filterStatusEl?.value;
      const collection = filterCollectionEl?.value;
      const timeRange = filterTimeRangeEl?.value || '24';
      
      if (method && method !== 'all') params.append('method', method);
      if (status && status !== 'all') params.append('status', status);
      if (collection && collection !== 'all') params.append('collection', collection);
      if (timeRange && timeRange !== 'all') params.append('timeRange', timeRange);
      params.append('limit', '1000');

      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();

      // 更新统计
      $('#statTotal').textContent = data.stats.total;
      $('#statSuccess').textContent = data.stats.success;
      $('#statError').textContent = data.stats.error;
      $('#statErrorCount').textContent = data.stats.error;

      // 保存所有日志
      allLogs = data.logs || [];
      
      // 渲染当前页
      renderLogsPage();
    } catch(err) {
      console.error('加载日志失败:', err);
      if (logListEl) {
        logListEl.innerHTML = `<div class="empty-state">加载日志失败: ${err.message}</div>`;
      }
      if (paginationEl) paginationEl.style.display = 'none';
    }
  }

  function renderLogsPage() {
    if (!allLogs || allLogs.length === 0) {
      logListEl.innerHTML = '<div class="empty-state">暂无日志记录<br><small style="margin-top:8px;display:block;">上传图片或访问随机图片后会显示日志</small></div>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    // 计算分页
    totalPages = Math.ceil(allLogs.length / LOGS_PER_PAGE);
    const start = (currentPage - 1) * LOGS_PER_PAGE;
    const end = start + LOGS_PER_PAGE;
    const pageLogs = allLogs.slice(start, end);

    // 渲染日志
    logListEl.innerHTML = pageLogs.map(log => {
      const timestamp = formatTimestamp(log.timestamp);
      const statusClass = log.success ? 'success' : 'error';
      return `
        <div class="log-item ${statusClass}" data-id="${escapeHtml(log.id)}">
          <div class="log-timestamp">${escapeHtml(timestamp)}</div>
          <div class="log-method ${escapeHtml(log.method)}">${escapeHtml(log.method)}</div>
          <div class="log-path" title="${escapeHtml(log.path)}">${escapeHtml(log.path)}</div>
          <div class="log-status ${statusClass}">${escapeHtml(String(log.status))}</div>
          <div class="log-duration">${escapeHtml(log.duration)}</div>
        </div>
      `;
    }).join('');

    $$('.log-item').forEach(item => {
      item.addEventListener('click', () => showLogDetail(item.getAttribute('data-id')));
    });

    // 更新分页器
    updatePagination();
  }

  function updatePagination() {
    if (totalPages <= 1) {
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    if (paginationEl) paginationEl.style.display = 'flex';
    if (pageInfoEl) pageInfoEl.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
    
    if (prevPageEl) prevPageEl.disabled = currentPage <= 1;
    if (nextPageEl) nextPageEl.disabled = currentPage >= totalPages;
  }

  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderLogsPage();
  }

  async function showLogDetail(logId) {
    try {
      const res = await fetch(`/api/logs/${logId}`);
      const log = await res.json();

      $('#detailMethod').textContent = log.method;
      $('#detailPath').textContent = log.path;
      $('#detailStatus').textContent = log.status;
      $('#detailStatus').className = `detail-value ${log.success ? 'stat-success' : 'stat-error'}`;
      $('#detailDuration').textContent = log.duration;
      $('#detailTimestamp').textContent = new Date(log.timestamp).toLocaleString('zh-CN');
      $('#detailSize').textContent = log.responseSize ? `${log.responseSize} bytes` : '-';
      $('#detailIP').textContent = log.ip || '-';
      $('#detailUA').textContent = log.userAgent || '-';

      const querySection = $('#querySection');
      if (log.query && Object.keys(log.query).length > 0) {
        $('#detailQuery').textContent = JSON.stringify(log.query, null, 2);
        querySection.style.display = 'block';
      } else {
        querySection.style.display = 'none';
      }

      const bodySection = $('#bodySection');
      if (log.requestBody) {
        $('#detailBody').textContent = JSON.stringify(log.requestBody, null, 2);
        bodySection.style.display = 'block';
      } else {
        bodySection.style.display = 'none';
      }

      openModal(logModalEl, false);
    } catch(err) {
      console.error(err);
      await appAlert('获取日志详情失败', '错误');
    }
  }

  function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => loadLogs(false), 10000);
  }
  
  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  // ========== 事件绑定 ==========
  
  if (btnCreateCollectionEl) {
    btnCreateCollectionEl.addEventListener('click', createCollection);
  }

  if (refreshLogsEl) {
    refreshLogsEl.addEventListener('click', async () => {
      refreshLogsEl.style.transform = 'rotate(360deg)';
      setTimeout(() => refreshLogsEl.style.transform = '', 500);
      
      await loadCollectionsToFilter();
      await loadLogs();
    });
  }
  
  if (filterMethodEl) filterMethodEl.addEventListener('change', () => loadLogs(true));
  if (filterStatusEl) filterStatusEl.addEventListener('change', () => loadLogs(true));
  if (filterCollectionEl) filterCollectionEl.addEventListener('change', () => loadLogs(true));
  if (filterTimeRangeEl) filterTimeRangeEl.addEventListener('change', () => loadLogs(true));
  
  if (prevPageEl) prevPageEl.addEventListener('click', () => goToPage(currentPage - 1));
  if (nextPageEl) nextPageEl.addEventListener('click', () => goToPage(currentPage + 1));
  
  if (closeLogModalEl) {
    closeLogModalEl.addEventListener('click', () => logModalEl.classList.remove('open'));
  }
  
  if (logModalEl) {
    logModalEl.addEventListener('click', (e) => {
      if (e.target === logModalEl) logModalEl.classList.remove('open');
    });
  }

  // ========== 自定义下拉组件 ==========
  
  function createCustomSelect(selectElement) {
    // 检查是否已经转换过
    if (selectElement.parentElement.classList.contains('custom-select-wrapper')) {
      return;
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    
    // 获取当前选中的选项
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const selectedText = selectedOption ? selectedOption.text : '';
    
    // 创建触发器
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `
      <span class="custom-select-text">${selectedText}</span>
      <span class="custom-select-arrow">
        <svg viewBox="0 0 12 12">
          <path d="M6 9L1.5 4.5h9L6 9z"/>
        </svg>
      </span>
    `;
    
    // 创建下拉列表
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    
    // 添加选项
    Array.from(selectElement.options).forEach((option, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'custom-select-option';
      if (index === selectElement.selectedIndex) {
        optionEl.classList.add('selected');
      }
      optionEl.textContent = option.text;
      optionEl.dataset.value = option.value;
      optionEl.dataset.index = index;
      
      optionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 更新原生select
        selectElement.selectedIndex = index;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 更新UI
        trigger.querySelector('.custom-select-text').textContent = option.text;
        dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        optionEl.classList.add('selected');
        
        // 关闭下拉
        wrapper.classList.remove('active');
      });
      
      dropdown.appendChild(optionEl);
    });
    
    // 包装原生select
    selectElement.parentNode.insertBefore(wrapper, selectElement);
    wrapper.appendChild(selectElement);
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    
    // 点击触发器切换下拉
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 关闭其他打开的下拉
      document.querySelectorAll('.custom-select-wrapper.active').forEach(w => {
        if (w !== wrapper) {
          w.classList.remove('active');
        }
      });
      
      wrapper.classList.toggle('active');
    });
    
    // 点击外部关闭
    document.addEventListener('click', () => {
      wrapper.classList.remove('active');
    });
    
    // 阻止下拉内部点击冒泡
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  function initCustomSelects() {
    // 转换所有input-group中的select
    document.querySelectorAll('.input-group select').forEach(select => {
      createCustomSelect(select);
    });
  }

  // ========== 初始化 ==========
  
  window.addEventListener('load', async () => {
    await Promise.all([
      refreshCollections(),
      loadCollectionsToFilter(),
      loadLogs()
    ]);
    
    // 初始化自定义下拉组件
    initCustomSelects();
    
    startAutoRefresh();
  });
  
  window.addEventListener('beforeunload', stopAutoRefresh);
})();
