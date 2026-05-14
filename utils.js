/**
 * utils.js — Защита сайта и вспомогательные утилиты
 * ───────────────────────────────────────────────────
 * Содержит:
 *  1. Определение открытых DevTools (по разнице innerWidth / outerWidth)
 *  2. Блокировка правого клика
 *  3. Блокировка горячих клавиш разработчика (F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I и др.)
 *  4. Функцию инициализации всех защит (вызывается из app.js)
 *
 * Все защиты носят предупредительный характер — серьёзные
 * инструменты всё равно обходят их, но 99% случайных копирований
 * и поверхностного инспектирования будут заблокированы.
 */

// ── Главная функция инициализации (вызывается из app.js) ─────────
function initProtection() {
  setupRightClickProtection();
  setupHotkeyProtection();
}
window.initProtection = initProtection;

// ═══════════════════════════════════════════════════════════════
//  2. БЛОКИРОВКА ПРАВОГО КЛИКА
// ═══════════════════════════════════════════════════════════════

function setupRightClickProtection() {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Тихо блокируем — без всплывающих сообщений,
    // чтобы не раздражать администратора и случайных пользователей
  });
}

// ═══════════════════════════════════════════════════════════════
//  3. БЛОКИРОВКА ГОРЯЧИХ КЛАВИШ РАЗРАБОТЧИКА
// ═══════════════════════════════════════════════════════════════

function setupHotkeyProtection() {
  document.addEventListener('keydown', (e) => {
    const key     = e.key;
    const ctrl    = e.ctrlKey  || e.metaKey; // metaKey — для Mac
    const shift   = e.shiftKey;

    // F12 — открытие DevTools
    if (key === 'F12') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I — открытие DevTools (инспектор)
    if (ctrl && shift && (key === 'I' || key === 'i')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+J — открытие консоли DevTools
    if (ctrl && shift && (key === 'J' || key === 'j')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+C — инспектор элементов
    if (ctrl && shift && (key === 'C' || key === 'c')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U — просмотр исходного кода страницы
    if (ctrl && (key === 'U' || key === 'u')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+S — сохранение страницы
    if (ctrl && (key === 'S' || key === 's')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+A — выделение всего текста на странице (только вне полей ввода)
    // Разрешаем внутри input/textarea, блокируем на остальных элементах
    if (ctrl && (key === 'A' || key === 'a')) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
        return false;
      }
    }

    // Ctrl+P — печать (косвенно раскрывает структуру)
    if (ctrl && (key === 'P' || key === 'p')) {
      e.preventDefault();
      return false;
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  4. ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ ЦЕЛОСТНОСТИ
// ═══════════════════════════════════════════════════════════════

// Запрет перетаскивания изображений (drag-and-drop скачивание)
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG') {
    e.preventDefault();
  }
});

// Запрет выделения текста мышью вне полей ввода
// (добавляем CSS-свойство через JS для надёжности)
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    body {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    /* Разрешаем выделение только внутри полей ввода */
    input, textarea, [contenteditable] {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
    /* Разрешаем выделение в контенте праздников (для копирования названий) */
    .holiday-title, .holiday-description {
      -webkit-user-select: text;
      -moz-user-select: text;
      user-select: text;
    }
  `;
  document.head.appendChild(style);
});
