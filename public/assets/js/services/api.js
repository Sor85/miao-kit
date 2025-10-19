/**
 * API 服务层
 * @module services/api
 */

/**
 * @param {Response} res
 * @param {string} errorPrefix
 * @param {function(string, string): Promise<void>} showAlert
 * @returns {Promise<boolean>}
 */
export const handleApiResponse = async (res, errorPrefix, showAlert) => {
  const text = await res.text();
  
  if (!res.ok) {
    const errorMsg = (() => {
      try {
        return JSON.parse(text).error || errorPrefix;
      } catch {
        return `${errorPrefix}：${text}`;
      }
    })();
    await showAlert(errorMsg, '错误');
    return false;
  }
  
  return true;
};

/** @returns {Promise<{collections: string[]}>} */
export const fetchCollections = async () => {
  const res = await fetch('/collections');
  if (!res.ok) throw new Error('获取图床列表失败');
  return res.json();
};

/** @param {string} collection */
export const fetchCollectionDetail = async (collection) => {
  const res = await fetch(`/collections/${encodeURIComponent(collection)}`);
  if (!res.ok) throw new Error('获取图床详情失败');
  return res.json();
};

/** @param {Object} params */
export const fetchLogs = async (params) => {
  const query = new URLSearchParams(params);
  const res = await fetch(`/api/logs?${query}`);
  if (!res.ok) throw new Error('获取日志失败');
  return res.json();
};

/** @param {string} id */
export const fetchLogById = async (id) => {
  const res = await fetch(`/api/logs/${id}`);
  if (!res.ok) throw new Error('获取日志详情失败');
  return res.json();
};

/**
 * @param {string} name
 * @param {function(Response, string, function): Promise<boolean>} handleResponse
 * @param {function(string, string): Promise<void>} showAlert
 */
export const createCollection = async (name, handleResponse, showAlert) => {
  const res = await fetch(`/api/collections/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return handleResponse(res, '创建失败', showAlert);
};

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {function(Response, string, function): Promise<boolean>} handleResponse
 * @param {function(string, string): Promise<void>} showAlert
 */
export const renameCollection = async (oldName, newName, handleResponse, showAlert) => {
  const res = await fetch(`/api/collections/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName })
  });
  return handleResponse(res, '重命名失败', showAlert);
};

/**
 * @param {string} collection
 * @param {function(Response, string, function): Promise<boolean>} handleResponse
 * @param {function(string, string): Promise<void>} showAlert
 */
export const deleteCollection = async (collection, handleResponse, showAlert) => {
  const res = await fetch(`/api/collections/${encodeURIComponent(collection)}`, {
    method: 'DELETE'
  });
  return handleResponse(res, '删除失败', showAlert);
};

/**
 * @param {string} collection
 * @param {string} filename
 * @param {function(Response, string, function): Promise<boolean>} handleResponse
 * @param {function(string, string): Promise<void>} showAlert
 */
export const deleteImage = async (collection, filename, handleResponse, showAlert) => {
  const res = await fetch(
    `/api/images/${encodeURIComponent(collection)}/${encodeURIComponent(filename)}`,
    { method: 'DELETE' }
  );
  return handleResponse(res, '删除失败', showAlert);
};

/**
 * @param {string} collection
 * @param {string[]} filenames
 */
export const checkConflicts = async (collection, filenames) => {
  const res = await fetch(`/api/images/check-conflicts/${encodeURIComponent(collection)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filenames })
  });
  
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = '检查文件冲突失败';
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || errorMsg;
    } catch {
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }
  
  return res.json();
};

/**
 * @param {string} collection
 * @param {File[]} files
 * @param {boolean} replaceMode
 */
export const uploadFiles = async (collection, files, replaceMode) => {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  
  const url = `/upload/${encodeURIComponent(collection)}${replaceMode ? '?replace=true' : ''}`;
  const res = await fetch(url, { method: 'POST', body: form });
  
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = '上传失败';
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || errorMsg;
    } catch {
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }
  
  return res.json();
};

/** @param {string[]} order */
export const saveOrder = (order) =>
  fetch('/api/collections-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });

