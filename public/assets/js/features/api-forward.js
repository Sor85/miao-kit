/**
 * API转发功能模块
 * @module api-forward
 */

import { $ } from '../utils/dom.js';
import { appConfirm } from '../components/modal.js';

// 转发规则缓存
let forwardRules = [];

// 预览模态框
let previewModal = null;

/**
 * 初始化预览模态框
 */
const initPreviewModal = () => {
  previewModal = document.createElement('div');
  previewModal.className = 'preview-modal';
  previewModal.innerHTML = `
    <div class="preview-modal-content">
      <div class="preview-modal-header">
        <h3>API 预览</h3>
        <div class="preview-modal-actions">
          <button class="preview-open-new-tab" title="在新标签页打开">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
          <button class="preview-close" title="关闭">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="preview-url-bar">
        <span class="preview-url-label">URL:</span>
        <code class="preview-url-text"></code>
      </div>
      <div class="preview-modal-body">
        <iframe class="preview-iframe" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>
      </div>
    </div>
  `;
  document.body.appendChild(previewModal);
  
  const closeBtn = previewModal.querySelector('.preview-close');
  closeBtn.addEventListener('click', () => previewModal.classList.remove('open'));
  
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) previewModal.classList.remove('open');
  });
  
  const openNewTabBtn = previewModal.querySelector('.preview-open-new-tab');
  openNewTabBtn.addEventListener('click', () => {
    const currentUrl = previewModal.querySelector('.preview-url-text').textContent;
    window.open(currentUrl, '_blank');
  });
};

/**
 * 显示预览模态框
 * @param {string} url - 要预览的URL
 */
const showPreviewModal = (url) => {
  if (!previewModal) initPreviewModal();
  
  const iframe = previewModal.querySelector('.preview-iframe');
  const urlText = previewModal.querySelector('.preview-url-text');
  urlText.textContent = url;
  iframe.src = url;
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      previewModal.classList.add('open');
    });
  });
};

/**
 * 加载转发规则
 */
export const loadForwardRules = async (alertFn) => {
  try {
    const res = await fetch('/api/forward/rules');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '加载失败');
    
    forwardRules = data.rules || [];
    renderForwardRules();
    toggleEmptyState();
  } catch (err) {
    alertFn?.(`加载转发规则失败: ${err.message}`);
  }
};

/**
 * 渲染转发规则列表
 */
const renderForwardRules = () => {
  const container = $('#forwardRulesContainer');
  if (!container) return;
  
  container.innerHTML = forwardRules.map((rule, index) => `
    <div class="forward-rule-card" data-id="${rule.id}" style="animation-delay: ${index * 0.1}s">
      <div class="rule-header">
        <div class="rule-title">
          <div class="rule-name">${rule.name || '未命名规则'}</div>
          <span class="rule-mode-badge ${rule.mode}">${getModeText(rule.mode)}</span>
        </div>
        <div class="rule-actions">
          <button class="icon-open-btn btn-open-rule" data-source="${rule.source}" title="预览">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button class="icon-edit-btn btn-edit-rule" data-id="${rule.id}" title="编辑规则">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-delete-btn btn-delete-rule" data-id="${rule.id}" title="删除规则">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="rule-info">
        <div class="rule-path">
          <span class="rule-label">源路径</span>
          <div class="rule-value">${rule.source}</div>
        </div>
        <div class="rule-path">
          <span class="rule-label">目标URL</span>
          <div class="rule-value">${rule.target}</div>
        </div>
      </div>
    </div>
  `).join('');
  
  // 绑定预览、编辑和删除事件
  container.querySelectorAll('.btn-open-rule').forEach(btn => 
    btn.addEventListener('click', () => {
      const source = btn.dataset.source;
      showPreviewModal(source);
    })
  );
  container.querySelectorAll('.btn-edit-rule').forEach(btn => 
    btn.addEventListener('click', () => editRule(btn.dataset.id))
  );
  container.querySelectorAll('.btn-delete-rule').forEach(btn => 
    btn.addEventListener('click', () => deleteRule(btn.dataset.id))
  );
};

/**
 * 获取模式文本
 */
const getModeText = (mode) => mode === 'redirect' ? '302重定向' : '服务器代理';

/**
 * 切换空状态显示
 */
const toggleEmptyState = () => {
  const empty = $('#emptyForwardState');
  const container = $('#forwardRulesContainer');
  if (!empty || !container) return;
  
  empty.style.display = forwardRules.length ? 'none' : 'block';
  container.style.display = forwardRules.length ? 'grid' : 'none';
};

// 当前编辑的规则ID
let editingRuleId = null;

/**
 * 显示/隐藏表单
 */
export const toggleForm = (show, ruleId = null) => {
  const formCard = $('#forwardFormCard');
  const formTitle = formCard?.querySelector('h3');
  if (!formCard) return;
  
  if (show) {
    editingRuleId = ruleId;
    if (formTitle) formTitle.textContent = ruleId ? '编辑转发规则' : '新增转发规则';
    formCard.style.display = 'block';
    
    // 平滑滚动到表单
    requestAnimationFrame(() => {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  } else {
    editingRuleId = null;
    
    // 延迟重置表单，等动画结束
    setTimeout(() => {
      if (formCard.style.display === 'none') resetForm();
    }, 400);
    
    formCard.style.display = 'none';
  }
};

/**
 * 重置表单
 */
const resetForm = () => {
  const form = $('#forwardForm');
  if (form) form.reset();
  editingRuleId = null;
};

/**
 * 添加或更新转发规则
 */
export const saveForwardRule = async (data, ruleId, alertFn) => {
  try {
    const url = ruleId ? `/api/forward/rules/${ruleId}` : '/api/forward/rules';
    const method = ruleId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || (ruleId ? '更新失败' : '添加失败'));
    
    await loadForwardRules(alertFn);
    toggleForm(false);
  } catch (err) {
    alertFn?.(`${ruleId ? '更新' : '添加'}转发规则失败: ${err.message}`);
  }
};

/**
 * 编辑转发规则
 */
const editRule = (id) => {
  const rule = forwardRules.find(r => r.id === id);
  if (!rule) return;
  
  // 填充表单
  const nameInput = $('#forwardName');
  const modeSelect = $('#forwardMode');
  const endpointInput = $('#forwardEndpoint');
  const targetInput = $('#forwardTarget');
  
  if (nameInput) nameInput.value = rule.name || '';
  if (modeSelect) modeSelect.value = rule.mode;
  if (endpointInput) endpointInput.value = rule.endpoint || rule.source.replace('/api', '');
  if (targetInput) targetInput.value = rule.target;
  
  toggleForm(true, id);
};

/**
 * 验证并构建规则数据
 */
const validateAndBuildRuleData = (endpoint, targetServer, alertFn) => {
  if (!endpoint || !targetServer) {
    alertFn?.('请填写API端点和目标URL');
    return null;
  }
  
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const source = `/api${normalizedEndpoint}`;
  
  try {
    new URL(targetServer);
  } catch {
    alertFn?.('目标URL格式不正确');
    return null;
  }
  
  return {
    name: $('#forwardName')?.value?.trim() || '',
    mode: $('#forwardMode')?.value,
    source,
    target: targetServer,
    endpoint: normalizedEndpoint
  };
};

/**
 * 处理表单提交
 */
const handleFormSubmit = async (alertFn) => {
  const endpoint = $('#forwardEndpoint')?.value?.trim();
  const targetServer = $('#forwardTarget')?.value?.trim();
  
  const data = validateAndBuildRuleData(endpoint, targetServer, alertFn);
  if (!data) return;
  
  await saveForwardRule(data, editingRuleId, alertFn);
};

/**
 * 删除转发规则
 */
const deleteRule = async (id) => {
  const confirmed = await appConfirm('确定要删除这条转发规则吗？', '删除确认');
  if (!confirmed) return;
  
  try {
    const res = await fetch(`/api/forward/rules/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || '删除失败');
    
    await loadForwardRules();
  } catch (err) {
    alert(`删除转发规则失败: ${err.message}`);
  }
};

/**
 * 绑定表单事件
 */
export const bindForwardFormEvents = (alertFn) => {
  const btnAdd = $('#btnAddForward');
  const btnClose = $('#btnCloseForm');
  const btnCancel = $('#btnCancelForm');
  const form = $('#forwardForm');
  
  btnAdd?.addEventListener('click', () => toggleForm(true));
  btnClose?.addEventListener('click', () => toggleForm(false));
  btnCancel?.addEventListener('click', () => toggleForm(false));
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit(alertFn);
  });
};

