/**
 * utils.js — Защита сайта (без детектора DevTools)
 * ──────────────────────────────────────────────────
 * Оставлены:
 *  - Блокировка правого клика
 *  - Блокировка горячих клавиш (F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I/J/C)
 *  - Запрет drag изображений
 *  - Запрет выделения текста вне полей ввода
 *
 * Детектор DevTools удалён по просьбе владельца.
 */

function initProtection() {
  setupRightClickProtection();
  setupHotkeyProtection();
}
window.initProtection = initProtection;

function setupRightClickProtection() {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupHotkeyProtection() {
  document.addEventListener('keydown', (e) => {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key   = e.key;

    if (key === 'F12') { e.preventDefault(); return false; }
    if (ctrl && shift && ['I','i','J','j','C','c'].includes(key)) { e.preventDefault(); return false; }
    if (ctrl && ['U','u','S','s','P','p'].includes(key)) { e.preventDefault(); return false; }
    if (ctrl && ['A','a'].includes(key)) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') { e.preventDefault(); return false; }
    }
  });
}

document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG') e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    body { -webkit-user-select:none; -moz-user-select:none; user-select:none; }
    input, textarea, [contenteditable] {
      -webkit-user-select:text; -moz-user-select:text; user-select:text;
    }
    .holiday-title, .holiday-description {
      -webkit-user-select:text; -moz-user-select:text; user-select:text;
    }
  `;
  document.head.appendChild(style);
});
