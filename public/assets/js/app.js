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
  let previousCollectionCount = 0;
  
  // ========== 折叠状态管理 ==========
  const COLLAPSE_STATE_KEY = 'collections-collapse-state';
  
  function loadCollapseStates() {
    try {
      const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }
  
  function updateCollapseStates(updateFn) {
    try {
      const states = loadCollapseStates();
      updateFn(states);
      localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(states));
    } catch(err) {
      console.error('更新折叠状态失败:', err);
    }
  }
  
  function saveCollapseState(collectionName, isCollapsed) {
    updateCollapseStates(states => states[collectionName] = isCollapsed);
  }
  
  function getCollapseState(collectionName, defaultCollapsed) {
    const states = loadCollapseStates();
    return states[collectionName] ?? defaultCollapsed;
  }
  
  // ========== API 工具函数 ==========
  async function handleApiResponse(res, errorPrefix) {
    const text = await res.text();
    if (!res.ok) {
      const errorMsg = (() => {
        try {
          return JSON.parse(text).error || errorPrefix;
        } catch {
          return `${errorPrefix}：${text}`;
        }
      })();
      await appAlert(errorMsg, '错误');
      return false;
    }
    return true;
  }

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
      .app-modal .content { color: #334155; margin: 0; padding: 0; line-height: 1.5; word-break: break-word; white-space: pre-wrap; font-size: 14px; }
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

  function appChoice(message, title = '选择', choices = []){
    return new Promise((resolve) => {
      const isFirstTime = !appModalEl;
      const el = ensureAppModal();
      const titleEl = el.querySelector('#appModalTitle');
      const contentEl = el.querySelector('#appModalContent');
      const actionsEl = el.querySelector('.actions');
      
      titleEl.textContent = title;
      contentEl.textContent = message;
      
      // 生成选择按钮
      actionsEl.innerHTML = choices.map((choice, index) => {
        const btnClass = index === 0 ? 'btn btn-primary' : 'btn';
        return `<button class="${btnClass}" data-choice="${index}">${escapeHtml(choice)}</button>`;
      }).join('');
      
      openModal(el, isFirstTime);
      
      const cleanup = () => {
        el.classList.remove('open');
        actionsEl.querySelectorAll('button').forEach(btn => {
          btn.removeEventListener('click', onClick);
        });
        el.removeEventListener('click', onBackdrop);
      };
      
      const onClick = (e) => {
        const choiceIndex = parseInt(e.target.getAttribute('data-choice'));
        cleanup();
        resolve(choiceIndex);
      };
      
      const onBackdrop = (e) => {
        if(e.target === el) {
          cleanup();
          resolve(-1); // -1 表示取消
        }
      };
      
      actionsEl.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', onClick);
      });
      el.addEventListener('click', onBackdrop);
    });
  }

  // ========== 集合管理功能 ==========
  
  async function refreshCollections() {
    try {
      const res = await fetch('/collections');
      const data = await res.json();
      
      if (!data.collections || data.collections.length === 0) {
        collectionsContainerEl.innerHTML = '<div class="empty-state">暂无图床，请先创建图床</div>';
        previousCollectionCount = 0;
        return;
      }

      const currentCount = data.collections.length;
      const defaultShouldCollapse = currentCount > 3;
      
      // 检测从 ≤3 -> >3 的过渡（需要折叠动画）
      const shouldAnimateCollapse = previousCollectionCount > 0 && previousCollectionCount <= 3 && currentCount > 3;
      
      // 检测从 >3 -> ≤3 的过渡（需要展开动画）
      const shouldAnimateExpand = previousCollectionCount > 3 && currentCount <= 3;

      // 为每个图床创建成对的上传卡片和浏览卡片
      collectionsContainerEl.innerHTML = data.collections.map(c => {
        let initialCollapsedClass = '';
        
        if (shouldAnimateCollapse) {
          // 3→4: 保持当前状态，只对展开的图床稍后执行折叠动画
          const isCollapsed = getCollapseState(c, false); // 默认展开，使用保存的状态
          initialCollapsedClass = isCollapsed ? ' collapsed' : '';
        } else if (shouldAnimateExpand) {
          // 4→3: 保持当前状态，只对折叠的图床稍后执行展开动画
          const isCollapsed = getCollapseState(c, true); // 默认折叠，使用保存的状态
          initialCollapsedClass = isCollapsed ? ' collapsed' : '';
        } else {
          // 无动画：使用用户保存的状态，或默认规则
          const isCollapsed = getCollapseState(c, defaultShouldCollapse);
          initialCollapsedClass = isCollapsed ? ' collapsed' : '';
        }
        
        return `
        <div class="collection-pair" data-collection="${escapeHtml(c)}">
          <!-- 拖拽手柄 -->
          <div class="drag-handle" title="拖拽移动图床位置">
            <svg width="32" height="4" viewBox="0 0 32 4" fill="none">
              <rect width="32" height="4" rx="2" fill="currentColor"/>
            </svg>
          </div>
          
          <!-- 上传卡片 -->
          <div class="upload-collection-card${initialCollapsedClass}" data-collection="${escapeHtml(c)}">
            <div class="upload-card-header">
              <div class="upload-collection-name">${escapeHtml(c)}</div>
              <div class="upload-card-controls">
                <div class="upload-collection-count" data-collection="${escapeHtml(c)}">0 张</div>
                <button class="toggle-upload-btn" title="展开/折叠上传区域">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              </div>
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
              <div class="collection-header-actions">
                <button class="icon-edit-btn" data-edit-collection="${escapeHtml(c)}" title="重命名图床">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-delete-btn" data-delete-collection="${escapeHtml(c)}" title="删除图床">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="collection-url">随机地址：<code>/${escapeHtml(c)}</code></div>
            <div class="collection-actions">
              <button class="btn btn-secondary btn-sm" data-detail="${escapeHtml(c)}">查看详情</button>
              <button class="btn btn-primary btn-sm" data-random="${escapeHtml(c)}">随机打开</button>
            </div>
          </div>
        </div>
      `;
      }).join('');

      bindUploadEvents();
      bindCollectionEvents();
      bindToggleEvents();
      bindDragEvents();
      await updateCollectionCounts();
      
      // 触发过渡动画（最高优先级，覆盖之前的用户设置）
      if (shouldAnimateCollapse) {
        // 从 ≤3 -> >3: 只对当前展开的图床执行折叠动画
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            $$('.upload-collection-card').forEach(card => {
              const collectionName = card.getAttribute('data-collection');
              const isCurrentlyCollapsed = card.classList.contains('collapsed');
              
              if (!isCurrentlyCollapsed) {
                // 只对当前展开的图床执行动画
                card.classList.add('collapsed');
              }
              // 无论是否播放动画，都保存最终状态
              saveCollapseState(collectionName, true);
            });
          });
        });
      } else if (shouldAnimateExpand) {
        // 从 >3 -> ≤3: 只对当前折叠的图床执行展开动画
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            $$('.upload-collection-card').forEach(card => {
              const collectionName = card.getAttribute('data-collection');
              const isCurrentlyCollapsed = card.classList.contains('collapsed');
              
              if (isCurrentlyCollapsed) {
                // 只对当前折叠的图床执行动画
                card.classList.remove('collapsed');
              }
              // 无论是否播放动画，都保存最终状态
              saveCollapseState(collectionName, false);
            });
          });
        });
      }
      
      // 更新计数
      previousCollectionCount = currentCount;
      
    } catch(err) {
      console.error(err);
      collectionsContainerEl.innerHTML = '<div class="empty-state">加载图床失败</div>';
    }
  }

  function bindUploadEvents() {
    // 绑定拖拽事件到整个上传卡片（包括折叠状态）
    $$('.upload-collection-card').forEach(card => {
      const collectionName = card.getAttribute('data-collection');
      const dropzone = card.querySelector('.upload-dropzone');
      
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.classList.add('dragover');
        if (dropzone) dropzone.classList.add('dragover');
      });
      
      card.addEventListener('dragleave', (e) => {
        // 只有当离开整个card时才移除样式
        if (e.target === card || !card.contains(e.relatedTarget)) {
          card.classList.remove('dragover');
          if (dropzone) dropzone.classList.remove('dragover');
        }
      });
      
      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove('dragover');
        if (dropzone) dropzone.classList.remove('dragover');
        
        const allFiles = Array.from(e.dataTransfer.files);
        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
        
        // 同时检查MIME类型和文件扩展名
        const files = allFiles.filter(f => 
          f.type.startsWith('image/') || imageExtensions.test(f.name)
        );
        
        if (files.length > 0) {
          // 如果有文件被过滤掉，提示用户
          const filtered = allFiles.length - files.length;
          if (filtered > 0) {
            console.warn(`已过滤 ${filtered} 个非图片文件`);
          }
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


  function bindToggleEvents() {
    $$('.upload-card-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const card = header.closest('.upload-collection-card');
        const collectionName = card.getAttribute('data-collection');
        
        // 切换折叠状态
        card.classList.toggle('collapsed');
        
        // 保存用户的选择
        const isCollapsed = card.classList.contains('collapsed');
        saveCollapseState(collectionName, isCollapsed);
      });
    });
  }

  let draggedElement = null;

  function bindDragEvents() {
    const pairs = $$('.collection-pair');
    
    pairs.forEach(pair => {
      const dragHandle = pair.querySelector('.drag-handle');
      
      // 只有拖拽手柄可以触发拖拽
      dragHandle.addEventListener('mousedown', () => {
        pair.setAttribute('draggable', 'true');
      });
      
      dragHandle.addEventListener('mouseup', () => {
        pair.removeAttribute('draggable');
      });
      
      pair.addEventListener('dragstart', (e) => {
        draggedElement = pair;
        pair.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', pair.innerHTML);
      });
      
      pair.addEventListener('dragend', () => {
        draggedElement?.classList.remove('dragging');
        pair.removeAttribute('draggable');
        
        // 移除所有拖拽提示
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
        if (e.target === pair) {
          pair.classList.remove('drag-over');
        }
      });
      
      pair.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        pair.classList.remove('drag-over');
        
        if (draggedElement && draggedElement !== pair) {
          // 获取拖拽元素和目标元素的位置
          const allPairs = $$('.collection-pair');
          const draggedIndex = allPairs.indexOf(draggedElement);
          const targetIndex = allPairs.indexOf(pair);
          
          // 移动DOM元素
          if (draggedIndex < targetIndex) {
            pair.parentNode.insertBefore(draggedElement, pair.nextSibling);
          } else {
            pair.parentNode.insertBefore(draggedElement, pair);
          }
          
          // 保存新顺序
          await saveCollectionsOrder();
        }
      });
    });
  }

  async function saveCollectionsOrder() {
    const order = $$('.collection-pair').map(pair => pair.getAttribute('data-collection'));
    
    try {
      const res = await fetch('/api/collections-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      
      if (!res.ok) {
        console.error('保存顺序失败');
      }
    } catch(err) {
      console.error('保存顺序失败:', err);
    }
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

    $$('[data-edit-collection]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const collectionName = btn.getAttribute('data-edit-collection');
        await renameCollection(collectionName);
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

  async function renameCollection(oldName) {
    const newName = await appPrompt('请输入新的图床名称', '重命名图床', oldName);
    if (!newName || newName === oldName) return;
    
    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName })
      });
      
      if (await handleApiResponse(res, '重命名失败')) {
        // 迁移折叠状态
        updateCollapseStates(states => {
          if (oldName in states) {
            states[newName] = states[oldName];
            delete states[oldName];
          }
        });
        
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
      }
    } catch(err) {
      console.error(err);
      await appAlert(`重命名失败：${err.message}`, '错误');
    }
  }

  async function deleteCollection(collectionName) {
    const confirmed = await appConfirm(`确定要删除图床"${collectionName}"吗？\n\n此操作将删除该图床下的所有图片，且不可恢复。`, '删除图床');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(collectionName)}`, {
        method: 'DELETE'
      });

      if (await handleApiResponse(res, '删除失败')) {
        // 清除折叠状态
        updateCollapseStates(states => delete states[collectionName]);
        
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
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

    // 检查文件冲突
    try {
      const filenames = files.map(f => f.name);
      console.log('检查文件冲突，文件名:', filenames);
      
      const checkRes = await fetch(`/api/check-conflicts/${encodeURIComponent(collectionName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames })
      });
      
      if (!checkRes.ok) {
        throw new Error('检查文件冲突失败');
      }
      
      const { conflicts } = await checkRes.json();
      console.log('检测到冲突:', conflicts);
      
      // 如果有冲突，询问用户
      if (conflicts.length > 0) {
        const conflictList = conflicts.length > 5 
          ? conflicts.slice(0, 5).join('\n') + `\n... 等 ${conflicts.length} 个文件`
          : conflicts.join('\n');
        
        const choice = await appChoice(
          `检测到 ${conflicts.length} 个文件已存在：\n\n${conflictList}\n\n请选择处理方式：`,
          '文件冲突',
          ['替换', '重命名', '取消']
        );
        
        if (choice === 2 || choice === -1) {
          // 取消上传
          return;
        }
        
        // choice === 0: 替换模式
        // choice === 1: 重命名模式（默认行为）
        await doUpload(collectionName, files, choice === 0);
      } else {
        // 没有冲突，直接上传
        await doUpload(collectionName, files, false);
      }
    } catch(err) {
      console.error(err);
      await appAlert(`上传失败：${err.message}`, '错误');
    }
  }

  async function doUpload(collectionName, files, replaceMode) {
    const form = new FormData();
    files.forEach(f => form.append('files', f));

    try {
      const url = `/upload/${encodeURIComponent(collectionName)}${replaceMode ? '?replace=true' : ''}`;
      const res = await fetch(url, { 
        method: 'POST', 
        body: form 
      });
      
      if (res.ok) {
        const data = await res.json();
        const uploadedCount = data.count || 0;
        const totalCount = files.length;
        
        // 检查是否所有文件都上传成功
        if (uploadedCount === totalCount) {
          const actionText = replaceMode ? '替换' : '上传';
          await appAlert(
            `成功${actionText} ${uploadedCount} 张图片到图床"${collectionName}"`, 
            `${actionText}成功`
          );
        } else {
          await appAlert(
            `部分上传成功：${uploadedCount}/${totalCount} 张图片已上传到图床"${collectionName}"。\n` +
            `失败的文件可能不是有效的图片格式。`, 
            '部分成功'
          );
        }
        
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
      } else {
        await handleApiResponse(res, '上传失败');
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
    
    $('#galleryTitle').textContent = collectionName;
    $('#galleryCount').textContent = `${urls.length} 张`;
    
    const galleryGrid = $('#galleryGrid');
    if (urls.length === 0) {
      galleryGrid.innerHTML = '<div class="empty-state">该图床下暂无图片</div>';
    } else {
      galleryGrid.innerHTML = urls.map(url => {
        // 给画廊图片添加gallery=1参数，避免日志混乱
        const galleryUrl = url.includes('?') ? `${url}&gallery=1` : `${url}?gallery=1`;
        return `
        <div class="gallery-item" data-url="${escapeHtml(url)}">
          <input type="checkbox" class="gallery-item-checkbox" data-image-url="${escapeHtml(url)}" />
          <img src="${escapeHtml(galleryUrl)}" alt="图片" loading="lazy" />
          <div class="gallery-item-info">
            <a href="${escapeHtml(url)}" target="_blank" class="gallery-item-link">查看原图</a>
            <button class="gallery-item-delete" data-delete-image="${escapeHtml(url)}" data-collection="${escapeHtml(collectionName)}" title="删除图片">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      }).join('');

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

      // 绑定复选框事件
      const checkboxes = $$('.gallery-item-checkbox');
      const selectAllCheckbox = $('#selectAllImages');
      const batchDeleteBtn = $('#batchDeleteBtn');

      function updateBatchDeleteBtn() {
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const selectAllLabel = $('.batch-select-label');
        
        if (checkedCount > 0) {
          // 显示删除按钮和全选按钮
          batchDeleteBtn.style.display = 'flex';
          selectAllLabel.style.display = 'flex';
          
          batchDeleteBtn.textContent = '';
          batchDeleteBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            删除选中 (${checkedCount})
          `;
        } else {
          // 隐藏删除按钮和全选按钮
          batchDeleteBtn.style.display = 'none';
          selectAllLabel.style.display = 'none';
        }
      }

      checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          updateBatchDeleteBtn();
          // 更新全选状态
          const allChecked = Array.from(checkboxes).every(c => c.checked);
          const someChecked = Array.from(checkboxes).some(c => c.checked);
          selectAllCheckbox.checked = allChecked;
          selectAllCheckbox.indeterminate = someChecked && !allChecked;
        });
      });

      // 全选/取消全选
      selectAllCheckbox.addEventListener('change', () => {
        checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        updateBatchDeleteBtn();
      });

      // 批量删除
      batchDeleteBtn.addEventListener('click', async () => {
        const selectedUrls = Array.from(checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.getAttribute('data-image-url'));
        
        if (selectedUrls.length === 0) return;

        await batchDeleteImages(collectionName, selectedUrls);
      });
    }
    
    openModal(galleryModal, isFirstTime);
  }

  async function deleteImage(collectionName, imageUrl) {
    const fileName = imageUrl.split('/').pop();
    const displayName = fileName.length > 40 ? fileName.substring(0, 37) + '...' : fileName;
    const confirmed = await appConfirm(`确定要删除图片吗？\n\n文件名：${displayName}\n\n此操作不可恢复。`, '删除图片');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/images/${encodeURIComponent(collectionName)}/${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });

      if (await handleApiResponse(res, '删除失败')) {
        // 重新加载画廊
        const detailRes = await fetch(`/collections/${encodeURIComponent(collectionName)}`);
        const data = await detailRes.json();
        showImageGallery(collectionName, data.urls || []);
        
        // 刷新集合列表
        await refreshCollections();
      }
    } catch(err) {
      console.error(err);
      await appAlert(`删除失败：${err.message}`, '错误');
    }
  }

  async function batchDeleteImages(collectionName, imageUrls) {
    const count = imageUrls.length;
    const confirmed = await appConfirm(
      `确定要批量删除 ${count} 张图片吗？\n\n此操作不可恢复。`, 
      `批量删除 (${count} 张)`
    );
    if (!confirmed) return;

    try {
      let successCount = 0;
      let failCount = 0;

      // 并发删除所有图片
      const deletePromises = imageUrls.map(async (imageUrl) => {
        const fileName = imageUrl.split('/').pop();
        try {
          const res = await fetch(`/api/images/${encodeURIComponent(collectionName)}/${encodeURIComponent(fileName)}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch(err) {
          console.error('删除失败:', fileName, err);
          failCount++;
        }
      });

      await Promise.all(deletePromises);

      // 显示结果
      if (failCount === 0) {
        await appAlert(`成功删除 ${successCount} 张图片`, '删除成功');
      } else {
        await appAlert(
          `删除完成：成功 ${successCount} 张，失败 ${failCount} 张`, 
          '部分成功'
        );
      }

      // 重新加载画廊
      const detailRes = await fetch(`/collections/${encodeURIComponent(collectionName)}`);
      const data = await detailRes.json();
      showImageGallery(collectionName, data.urls || []);
      
      // 刷新集合列表
      await refreshCollections();
    } catch(err) {
      console.error(err);
      await appAlert(`批量删除失败：${err.message}`, '错误');
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
      
      if (await handleApiResponse(res, '创建失败')) {
        await Promise.all([
          refreshCollections(),
          loadCollectionsToFilter()
        ]);
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
      // 解码URL编码的路径
      let decodedPath = log.path;
      try {
        decodedPath = decodeURIComponent(log.path);
      } catch(e) {
        // 解码失败时使用原始路径
      }
      // 随机访问标识
      const randomBadge = log.isRandom ? '<span class="random-badge" title="随机访问">随机</span>' : '';
      return `
        <div class="log-item ${statusClass}" data-id="${escapeHtml(log.id)}">
          <div class="log-timestamp">${escapeHtml(timestamp)}</div>
          <div class="log-method ${escapeHtml(log.method)}">${escapeHtml(log.method)}</div>
          <div class="log-path" title="${escapeHtml(decodedPath)}">
            ${escapeHtml(decodedPath)}${randomBadge}
          </div>
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

      // 解码URL编码的路径
      let decodedPath = log.path;
      try {
        decodedPath = decodeURIComponent(log.path);
      } catch(e) {
        // 解码失败时使用原始路径
      }

      $('#detailMethod').textContent = log.method;
      // 显示路径和随机标识
      const pathElement = $('#detailPath');
      if (log.isRandom) {
        pathElement.innerHTML = `${escapeHtml(decodedPath)} <span class="random-badge" title="随机访问">随机</span>`;
      } else {
        pathElement.textContent = decodedPath;
      }
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
