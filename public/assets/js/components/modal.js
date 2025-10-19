/**
 * 模态框组件
 * @module components/modal
 */

import { escapeHtml, openModal } from '../utils/dom.js';

let modalEl = null;

const ensureModal = () => {
  if (modalEl) return modalEl;
  
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
    .app-modal .content { color: #334155; margin: 0; padding: 0; line-height: 1.5; word-break: break-word; font-size: 14px; }
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
  
  modalEl = overlay;
  return modalEl;
};

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<boolean>}
 */
export const appAlert = (message, title = '提示') =>
  new Promise((resolve) => {
    const isFirstTime = !modalEl;
    const el = ensureModal();
    const titleEl = el.querySelector('#appModalTitle');
    const contentEl = el.querySelector('#appModalContent');
    const actionsEl = el.querySelector('.actions');
    
    titleEl.textContent = title;
    contentEl.textContent = message;
    
    actionsEl.innerHTML = '<button class="btn btn-primary" id="appModalOk">确定</button>';
    const okBtn = el.querySelector('#appModalOk');
    
    openModal(el, isFirstTime);

    const cleanup = () => {
      el.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      el.removeEventListener('click', onBackdrop);
    };
    
    const onOk = () => { cleanup(); resolve(true); };
    const onBackdrop = (e) => e.target === el && onOk();
    
    okBtn.addEventListener('click', onOk);
    el.addEventListener('click', onBackdrop);
  });

/**
 * @param {string} message
 * @param {string} title
 * @param {string} placeholder
 * @returns {Promise<string|null>}
 */
export const appPrompt = (message, title = '输入', placeholder = '') =>
  new Promise((resolve) => {
    const isFirstTime = !modalEl;
    const el = ensureModal();
    const titleEl = el.querySelector('#appModalTitle');
    const contentEl = el.querySelector('#appModalContent');
    const actionsEl = el.querySelector('.actions');
    
    titleEl.textContent = title;
    contentEl.innerHTML = `<label for="promptInput">${escapeHtml(message)}</label><input type="text" id="promptInput" placeholder="${escapeHtml(placeholder)}" />`;
    
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
      [okBtn, cancelBtn].forEach(btn => btn.removeEventListener('click', cleanup));
      el.removeEventListener('click', onBackdrop);
      input.removeEventListener('keydown', onKeydown);
    };
    
    const onOk = () => { 
      const value = input.value.trim();
      cleanup(); 
      resolve(value || null); 
    };
    
    const onCancel = () => { cleanup(); resolve(null); };
    const onBackdrop = (e) => e.target === el && onCancel();
    const onKeydown = (e) => {
      if (e.key === 'Enter') onOk();
      if (e.key === 'Escape') onCancel();
    };
    
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    el.addEventListener('click', onBackdrop);
    input.addEventListener('keydown', onKeydown);
  });

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<boolean>}
 */
export const appConfirm = (message, title = '确认') =>
  new Promise((resolve) => {
    const isFirstTime = !modalEl;
    const el = ensureModal();
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
    const onBackdrop = (e) => e.target === el && onCancel();
    
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    el.addEventListener('click', onBackdrop);
  });

/**
 * @param {string} message
 * @param {string} title
 * @param {string[]} choices
 * @returns {Promise<number>}
 */
export const appChoice = (message, title = '选择', choices = []) =>
  new Promise((resolve) => {
    const isFirstTime = !modalEl;
    const el = ensureModal();
    const titleEl = el.querySelector('#appModalTitle');
    const contentEl = el.querySelector('#appModalContent');
    const actionsEl = el.querySelector('.actions');
    
    titleEl.textContent = title;
    contentEl.textContent = message;
    
    actionsEl.innerHTML = choices.map((choice, index) => {
      const btnClass = index === 0 ? 'btn btn-primary' : 'btn';
      return `<button class="${btnClass}" data-choice="${index}">${escapeHtml(choice)}</button>`;
    }).join('');
    
    openModal(el, isFirstTime);
    
    const cleanup = () => {
      el.classList.remove('open');
      actionsEl.querySelectorAll('button').forEach(btn => 
        btn.removeEventListener('click', onClick)
      );
      el.removeEventListener('click', onBackdrop);
    };
    
    const onClick = (e) => {
      const choiceIndex = parseInt(e.target.getAttribute('data-choice'));
      cleanup();
      resolve(choiceIndex);
    };
    
    const onBackdrop = (e) => {
      if (e.target === el) {
        cleanup();
        resolve(-1);
      }
    };
    
    actionsEl.querySelectorAll('button').forEach(btn => 
      btn.addEventListener('click', onClick)
    );
    el.addEventListener('click', onBackdrop);
  });

