/**
 * 日志管理功能
 * @module features/logs
 */

import { $, $$, escapeHtml, formatTimestamp, openModal } from '../utils/dom.js';
import { fetchLogs, fetchLogById, fetchCollections } from '../services/api.js';

const LOGS_PER_PAGE = 10;
let state = {
  currentPage: 1,
  totalPages: 1,
  allLogs: [],
  autoRefreshTimer: null
};

/**
 * @param {function} showAlert
 */
export const loadCollectionsToFilter = async (showAlert) => {
  try {
    const filterCollectionEl = $('#filterCollection');
    if (!filterCollectionEl) return;

    const data = await fetchCollections();
    const currentValue = filterCollectionEl.value;
    
    const wrapper = filterCollectionEl.closest('.custom-select-wrapper');
    if (wrapper) {
      const parent = wrapper.parentNode;
      parent.insertBefore(filterCollectionEl, wrapper);
      wrapper.remove();
    }
    
    filterCollectionEl.innerHTML = '<option value="all">全部</option>' + 
      data.collections.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    
    if (currentValue) filterCollectionEl.value = currentValue;
    
    createCustomSelect(filterCollectionEl);
  } catch(err) {
    console.error('加载图床列表失败:', err);
  }
};

/**
 * @param {boolean} resetPage
 * @param {function} showAlert
 */
export const loadLogs = async (resetPage, showAlert) => {
  if (resetPage) state.currentPage = 1;
  
  try {
    const params = {
      method: $('#filterMethod')?.value,
      status: $('#filterStatus')?.value,
      collection: $('#filterCollection')?.value,
      timeRange: $('#filterTimeRange')?.value || '24',
      limit: '1000'
    };
    
    Object.keys(params).forEach(key => {
      if (params[key] === 'all') delete params[key];
    });

    const data = await fetchLogs(params);

    $('#statTotal').textContent = data.stats.total;
    $('#statSuccess').textContent = data.stats.success;
    $('#statError').textContent = data.stats.error;
    $('#statErrorCount').textContent = data.stats.error;

    state.allLogs = data.logs || [];
    renderLogsPage();
  } catch(err) {
    console.error('加载日志失败:', err);
    const logListEl = $('#logList');
    if (logListEl) {
      logListEl.innerHTML = `<div class="empty-state">加载日志失败: ${err.message}</div>`;
    }
    const paginationEl = $('#pagination');
    if (paginationEl) paginationEl.style.display = 'none';
  }
};

const renderLogsPage = () => {
  const logListEl = $('#logList');
  const paginationEl = $('#pagination');
  
  if (!state.allLogs || state.allLogs.length === 0) {
    logListEl.innerHTML = '<div class="empty-state">暂无日志记录<br><small style="margin-top:8px;display:block;">上传图片或访问随机图片后会显示日志</small></div>';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  state.totalPages = Math.ceil(state.allLogs.length / LOGS_PER_PAGE);
  const start = (state.currentPage - 1) * LOGS_PER_PAGE;
  const end = start + LOGS_PER_PAGE;
  const pageLogs = state.allLogs.slice(start, end);

  logListEl.innerHTML = pageLogs.map(log => {
    const timestamp = formatTimestamp(log.timestamp);
    const statusClass = log.success ? 'success' : 'error';
    const decodedPath = safeDecodeURIComponent(log.path);
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

  updatePagination();
};

const updatePagination = () => {
  const paginationEl = $('#pagination');
  const pageInfoEl = $('#pageInfo');
  const prevPageEl = $('#prevPage');
  const nextPageEl = $('#nextPage');
  
  if (state.totalPages <= 1) {
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  if (paginationEl) paginationEl.style.display = 'flex';
  if (pageInfoEl) pageInfoEl.textContent = `第 ${state.currentPage} 页 / 共 ${state.totalPages} 页`;
  
  if (prevPageEl) prevPageEl.disabled = state.currentPage <= 1;
  if (nextPageEl) nextPageEl.disabled = state.currentPage >= state.totalPages;
};

export const goToPage = (page) => {
  if (page < 1 || page > state.totalPages) return;
  state.currentPage = page;
  renderLogsPage();
};

export const getCurrentPage = () => state.currentPage;

const safeDecodeURIComponent = (str) => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

const showLogDetail = async (logId) => {
  try {
    const log = await fetchLogById(logId);
    const logModalEl = $('#logModal');
    const decodedPath = safeDecodeURIComponent(log.path);

    $('#detailMethod').textContent = log.method;
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
  }
};

export const startAutoRefresh = (loadLogsFn) => {
  if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
  state.autoRefreshTimer = setInterval(() => loadLogsFn(false), 10000);
};

export const stopAutoRefresh = () => {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
};

const createTrigger = (selectedText) => {
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
  return trigger;
};

const createOption = (option, index, selectElement, trigger, dropdown, wrapper) => {
  const optionEl = document.createElement('div');
  optionEl.className = 'custom-select-option';
  if (index === selectElement.selectedIndex) optionEl.classList.add('selected');
  optionEl.textContent = option.text;
  optionEl.dataset.value = option.value;
  optionEl.dataset.index = index;
  
  optionEl.addEventListener('click', (e) => {
    e.stopPropagation();
    selectElement.selectedIndex = index;
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    trigger.querySelector('.custom-select-text').textContent = option.text;
    dropdown.querySelectorAll('.custom-select-option').forEach(opt => 
      opt.classList.remove('selected')
    );
    optionEl.classList.add('selected');
    wrapper.classList.remove('active');
  });
  
  return optionEl;
};

const createCustomSelect = (selectElement) => {
  if (selectElement.parentElement.classList.contains('custom-select-wrapper')) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const selectedText = selectedOption ? selectedOption.text : '';
  
  const trigger = createTrigger(selectedText);
  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown';
  
  Array.from(selectElement.options).forEach((option, index) => {
    const optionEl = createOption(option, index, selectElement, trigger, dropdown, wrapper);
    dropdown.appendChild(optionEl);
  });
  
  selectElement.parentNode.insertBefore(wrapper, selectElement);
  wrapper.appendChild(selectElement);
  wrapper.appendChild(trigger);
  wrapper.appendChild(dropdown);
  
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    $$('.custom-select-wrapper.active').forEach(w => {
      if (w !== wrapper) w.classList.remove('active');
    });
    wrapper.classList.toggle('active');
  });
  
  document.addEventListener('click', () => wrapper.classList.remove('active'));
  dropdown.addEventListener('click', (e) => e.stopPropagation());
};

export const initCustomSelects = () => {
  document.querySelectorAll('.input-group select').forEach(select => 
    createCustomSelect(select)
  );
};

