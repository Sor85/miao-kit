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
  
  async init() {
    await Promise.all([
      this.refresh(),
      loadCollectionsToFilter(appAlert),
      loadLogs(true, appAlert)
    ]);
    
    initCustomSelects();
    startAutoRefresh(() => loadLogs(false, appAlert));
  }
};

// 事件绑定
$('#btnCreateCollection')?.addEventListener('click', () => 
  createCollection(app.handleResponse, appAlert, app.refresh.bind(app), loadCollectionsToFilter)
);

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

const logModalEl = $('#logModal');
$('#closeLogModal')?.addEventListener('click', () => logModalEl?.classList.remove('open'));
logModalEl?.addEventListener('click', (e) => {
      if (e.target === logModalEl) logModalEl.classList.remove('open');
    });

// 初始化
window.addEventListener('load', () => app.init());
  window.addEventListener('beforeunload', stopAutoRefresh);
