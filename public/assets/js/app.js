/**
 * 主应用入口
 * @module app
 */

import { $ } from './utils/dom.js';
import { handleApiResponse } from './services/api.js';
import { appAlert } from './components/modal.js';
import { 
  refreshCollections, 
  createCollection, 
  bindCollectionEvents,
  bindToggleEvents,
  bindDragEvents,
  updateCollectionCounts
} from './features/collections.js';
import { uploadFiles, bindUploadEvents } from './features/upload.js';
import { 
  loadLogs, 
  goToPage,
  getCurrentPage,
  startAutoRefresh, 
  stopAutoRefresh,
  loadCollectionsToFilter,
  initCustomSelects
} from './features/logs.js';
import {
  loadForwardRules,
  bindForwardFormEvents
} from './features/api-forward.js';
import {
  loadForwardLogs,
  goToForwardPage,
  getCurrentForwardPage,
  startForwardAutoRefresh,
  stopForwardAutoRefresh
} from './features/forward-logs.js';

// Tab切换逻辑
const switchTab = (tabName) => {
  // 标记已切换，禁用初始状态 CSS 规则（最佳实践：无条件设置，确保所有切换都正确）
  document.documentElement.setAttribute('data-switched', 'true');
  
  // 更新Tab按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // 更新内容区域
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.content === tabName);
  });
  
  // 更新URL hash
  window.location.hash = tabName === 'image-bed' ? '' : `#${tabName}`;
  
  // 加载对应页面数据
  if (tabName === 'api-forward') {
    loadForwardRules(appAlert);
    loadForwardLogs(true, appAlert);
    startForwardAutoRefresh(() => loadForwardLogs(false, appAlert));
  } else {
    stopForwardAutoRefresh();
  }
};

// 应用状态
const app = {
  async refresh() {
    await refreshCollections(
      () => bindUploadEvents(this.uploadHandler),
      () => bindCollectionEvents(this.handleResponse, appAlert, this.refresh.bind(this), loadCollectionsToFilter),
      bindToggleEvents,
      bindDragEvents,
      updateCollectionCounts
    );
  },
  
  uploadHandler: async (collection, files) => {
    await uploadFiles(collection, files, appAlert, app.refresh.bind(app), loadCollectionsToFilter);
  },
  
  handleResponse: (res, errorPrefix) => handleApiResponse(res, errorPrefix, appAlert),
  
  bindTabEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  },
  
  bindCollectionEvents() {
    $('#btnCreateCollection')?.addEventListener('click', () => 
      createCollection(this.handleResponse, appAlert, this.refresh.bind(this), loadCollectionsToFilter)
    );
  },
  
  bindLogEvents() {
    $('#refreshLogs')?.addEventListener('click', async () => {
      const btn = $('#refreshLogs');
      btn.style.transform = 'rotate(360deg)';
      setTimeout(() => btn.style.transform = '', 500);
      await Promise.all([
        loadCollectionsToFilter(appAlert),
        loadLogs(true, appAlert)
      ]);
    });
    
    ['filterMethod', 'filterStatus', 'filterCollection', 'filterTimeRange'].forEach(id => {
      $(`#${id}`)?.addEventListener('change', () => loadLogs(true, appAlert));
    });
    
    $('#prevPage')?.addEventListener('click', () => goToPage(getCurrentPage() - 1));
    $('#nextPage')?.addEventListener('click', () => goToPage(getCurrentPage() + 1));
  },
  
  bindModalEvents() {
    const logModalEl = $('#logModal');
    $('#closeLogModal')?.addEventListener('click', () => logModalEl?.classList.remove('open'));
    logModalEl?.addEventListener('click', (e) => {
      if (e.target === logModalEl) logModalEl.classList.remove('open');
    });
    
    const forwardLogModalEl = $('#forwardLogModal');
    $('#closeForwardLogModal')?.addEventListener('click', () => forwardLogModalEl?.classList.remove('open'));
    forwardLogModalEl?.addEventListener('click', (e) => {
      if (e.target === forwardLogModalEl) forwardLogModalEl.classList.remove('open');
    });
  },
  
  bindForwardLogEvents() {
    $('#refreshForwardLogs')?.addEventListener('click', async () => {
      const btn = $('#refreshForwardLogs');
      btn.style.transform = 'rotate(360deg)';
      setTimeout(() => btn.style.transform = '', 500);
      await loadForwardLogs(true, appAlert);
    });
    
    ['fwdFilterMethod', 'fwdFilterStatus', 'fwdFilterMode', 'fwdFilterTimeRange'].forEach(id => {
      $(`#${id}`)?.addEventListener('change', () => loadForwardLogs(true, appAlert));
    });
    
    $('#fwdPrevPage')?.addEventListener('click', () => goToForwardPage(getCurrentForwardPage() - 1));
    $('#fwdNextPage')?.addEventListener('click', () => goToForwardPage(getCurrentForwardPage() + 1));
  },
  
  initTabFromHash() {
    const hash = window.location.hash.replace('#', '');
    const initialTab = document.documentElement.getAttribute('data-initial-tab');
    
    // 如果已经通过 CSS 预设了初始 tab，直接激活对应功能
    if (initialTab) {
      // 标记已切换，禁用初始状态 CSS 规则（最佳实践：与 switchTab 保持一致）
      document.documentElement.setAttribute('data-switched', 'true');
      
      // 添加 .active 类，让后续切换正常工作
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === initialTab);
      });
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.content === initialTab);
      });
      
      // 加载对应页面数据
      if (initialTab === 'api-forward') {
        loadForwardRules(appAlert);
        loadForwardLogs(true, appAlert);
        startForwardAutoRefresh(() => loadForwardLogs(false, appAlert));
      }
    } else if (hash && ['api-forward'].includes(hash)) {
      // 没有预设时，使用传统方式切换
      switchTab(hash);
    } else {
      // 默认显示简易图床（最佳实践：确保所有初始化路径都禁用 CSS 初始状态规则）
      document.documentElement.setAttribute('data-switched', 'true');
      document.querySelector('.tab-btn[data-tab="image-bed"]')?.classList.add('active');
      document.querySelector('.tab-content[data-content="image-bed"]')?.classList.add('active');
    }
  },
  
  async init() {
    this.bindTabEvents();
    this.bindCollectionEvents();
    this.bindLogEvents();
    this.bindForwardLogEvents();
    this.bindModalEvents();
    
    await Promise.all([
      this.refresh(),
      loadCollectionsToFilter(appAlert),
      loadLogs(true, appAlert)
    ]);
    
    initCustomSelects();
    startAutoRefresh(() => loadLogs(false, appAlert));
    bindForwardFormEvents(appAlert);
    this.initTabFromHash();
  }
};

// 初始化
window.addEventListener('load', () => app.init());
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
  stopForwardAutoRefresh();
});
