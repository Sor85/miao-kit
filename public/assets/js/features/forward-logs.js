/**
 * 转发日志管理功能
 * @module features/forward-logs
 */

import { $, $$, escapeHtml, formatTimestamp, openModal } from '../utils/dom.js';
import { fetchForwardLogs, fetchForwardLogById } from '../services/api.js';

const LOGS_PER_PAGE = 10;
let state = {
  currentPage: 1,
  totalPages: 1,
  allLogs: [],
  autoRefreshTimer: null
};

/**
 * 加载转发日志
 * @param {boolean} resetPage
 * @param {function} showAlert
 */
export const loadForwardLogs = async (resetPage, showAlert) => {
  if (resetPage) state.currentPage = 1;
  
  try {
    const params = {
      method: $('#fwdFilterMethod')?.value,
      status: $('#fwdFilterStatus')?.value,
      mode: $('#fwdFilterMode')?.value,
      timeRange: $('#fwdFilterTimeRange')?.value || '24',
      limit: '1000'
    };
    
    Object.keys(params).forEach(key => {
      if (params[key] === 'all') delete params[key];
    });

    const data = await fetchForwardLogs(params);

    $('#fwdStatTotal').textContent = data.stats.total;
    $('#fwdStatSuccess').textContent = data.stats.success;
    $('#fwdStatError').textContent = data.stats.error;
    $('#fwdStatRedirect').textContent = data.stats.modes.redirect;
    $('#fwdStatProxy').textContent = data.stats.modes.proxy;

    state.allLogs = data.logs || [];
    renderForwardLogsPage();
  } catch(err) {
    console.error('加载转发日志失败:', err);
    const logListEl = $('#forwardLogList');
    if (logListEl) {
      logListEl.innerHTML = `<div class="empty-state">加载转发日志失败: ${err.message}</div>`;
    }
    const paginationEl = $('#forwardPagination');
    if (paginationEl) paginationEl.style.display = 'none';
  }
};

const renderForwardLogsPage = () => {
  const logListEl = $('#forwardLogList');
  const paginationEl = $('#forwardPagination');
  
  if (!state.allLogs || state.allLogs.length === 0) {
    logListEl.innerHTML = '<div class="empty-state">暂无转发日志<br><small style="margin-top:8px;display:block;">配置转发规则并访问后会显示日志</small></div>';
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
    const modeBadge = `<span class="mode-badge ${log.forwardMode}" title="${getModeText(log.forwardMode)}">${getModeText(log.forwardMode)}</span>`;
    return `
      <div class="log-item ${statusClass}" data-id="${escapeHtml(log.id)}">
        <div class="log-timestamp">${escapeHtml(timestamp)}</div>
        <div class="log-method ${escapeHtml(log.method)}">${escapeHtml(log.method)}</div>
        <div class="log-path" title="${escapeHtml(log.sourcePath)}">
          ${escapeHtml(log.ruleName)}${modeBadge}
        </div>
        <div class="log-status ${statusClass}">${escapeHtml(String(log.status))}</div>
        <div class="log-duration">${escapeHtml(log.duration)}</div>
      </div>
    `;
  }).join('');

  $$('.log-item').forEach(item => {
    item.addEventListener('click', () => showForwardLogDetail(item.getAttribute('data-id')));
  });

  updateForwardPagination();
};

const getModeText = (mode) => mode === 'redirect' ? '重定向' : '代理';

const updateForwardPagination = () => {
  const paginationEl = $('#forwardPagination');
  const pageInfoEl = $('#fwdPageInfo');
  const prevPageEl = $('#fwdPrevPage');
  const nextPageEl = $('#fwdNextPage');
  
  if (state.totalPages <= 1) {
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  if (paginationEl) paginationEl.style.display = 'flex';
  if (pageInfoEl) pageInfoEl.textContent = `第 ${state.currentPage} 页 / 共 ${state.totalPages} 页`;
  
  if (prevPageEl) prevPageEl.disabled = state.currentPage <= 1;
  if (nextPageEl) nextPageEl.disabled = state.currentPage >= state.totalPages;
};

export const goToForwardPage = (page) => {
  if (page < 1 || page > state.totalPages) return;
  state.currentPage = page;
  renderForwardLogsPage();
};

export const getCurrentForwardPage = () => state.currentPage;

const showForwardLogDetail = async (logId) => {
  try {
    const log = await fetchForwardLogById(logId);
    const logModalEl = $('#forwardLogModal');

    $('#fwdDetailRuleName').textContent = log.ruleName;
    $('#fwdDetailMode').textContent = getModeText(log.forwardMode);
    $('#fwdDetailSource').textContent = log.sourcePath;
    $('#fwdDetailTarget').textContent = log.targetUrl;
    $('#fwdDetailMethod').textContent = log.method;
    $('#fwdDetailStatus').textContent = log.status;
    $('#fwdDetailStatus').className = `detail-value ${log.success ? 'stat-success' : 'stat-error'}`;
    $('#fwdDetailDuration').textContent = log.duration;
    $('#fwdDetailTimestamp').textContent = new Date(log.timestamp).toLocaleString('zh-CN');
    $('#fwdDetailSize').textContent = log.responseSize ? `${log.responseSize} bytes` : '-';
    $('#fwdDetailIP').textContent = log.ip || '-';
    $('#fwdDetailUA').textContent = log.userAgent || '-';

    const querySection = $('#fwdQuerySection');
    if (log.query && Object.keys(log.query).length > 0) {
      $('#fwdDetailQuery').textContent = JSON.stringify(log.query, null, 2);
      querySection.style.display = 'block';
    } else {
      querySection.style.display = 'none';
    }

    const bodySection = $('#fwdBodySection');
    if (log.requestBody) {
      $('#fwdDetailBody').textContent = JSON.stringify(log.requestBody, null, 2);
      bodySection.style.display = 'block';
    } else {
      bodySection.style.display = 'none';
    }

    const errorSection = $('#fwdErrorSection');
    if (log.errorMessage) {
      $('#fwdDetailError').textContent = log.errorMessage;
      errorSection.style.display = 'block';
    } else {
      errorSection.style.display = 'none';
    }

    openModal(logModalEl, false);
  } catch(err) {
    console.error(err);
  }
};

export const startForwardAutoRefresh = (loadFn) => {
  if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
  state.autoRefreshTimer = setInterval(() => loadFn(false), 10000);
};

export const stopForwardAutoRefresh = () => {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
};

