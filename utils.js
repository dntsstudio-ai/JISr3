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
  setupDevToolsDetection();
  setupRightClickProtection();
  setupHotkeyProtection();
}
window.initProtection = initProtection;

// ═══════════════════════════════════════════════════════════════
//  1. ОБНАРУЖЕНИЕ ИНСТРУМЕНТОВ РАЗРАБОТЧИКА
// ═══════════════════════════════════════════════════════════════

// Пороговое значение разницы ширин для срабатывания
// (обычно DevTools занимают минимум ~100px)
const DEVTOOLS_WIDTH_THRESHOLD = 150;
const DEVTOOLS_HEIGHT_THRESHOLD = 150;

// Флаг состояния (чтобы не дёргать DOM каждый кадр)
let devToolsCurrentlyOpen = true;

function setupDevToolsDetection() {
  // Проверяем каждые 1000ms
  // Метод 1: разница между outerWidth и innerWidth (боковая панель)
  // Метод 2: разница между outerHeight и innerHeight (нижняя панель)
  const checkInterval = setInterval(() => {
    const widthDiff  = window.outerWidth  - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    const detected = widthDiff > DEVTOOLS_WIDTH_THRESHOLD
                  || heightDiff > DEVTOOLS_HEIGHT_THRESHOLD;

    if (detected && !devToolsCurrentlyOpen) {
      // DevTools только что открыли
      devToolsCurrentlyOpen = true;
      showDevToolsOverlay();
    } else if (!detected && devToolsCurrentlyOpen) {
      // DevTools закрыли — восстанавливаем контент
      devToolsCurrentlyOpen = false;
      hideDevToolsOverlay();
    }
  }, 1000);

  // Дополнительный метод: console.log с getter-ловушкой
  // При открытой консоли DevTools браузер вычисляет toString объекта
  try {
    const devToolsTrap = /./;
    devToolsTrap.toString = () => {
      // Этот код выполняется только если объект логируется в консоли
      if (!devToolsCurrentlyOpen) {
        devToolsCurrentlyOpen = true;
        showDevToolsOverlay();
      }
      return 'protected';
    };
    // Периодически логируем ловушку (молча — пользователь не видит)
    // Это срабатывает при открытии DevTools в некоторых браузерах
    setInterval(() => {
      // Специальный вызов, который активирует ловушку только в DevTools
      console.log('%c', devToolsTrap);
    }, 2000);
  } catch (e) {
    // Игнорируем ошибки ловушки — она не критична
  }
}

// Показать заглушку поверх всего контента
function showDevToolsOverlay() {
  const overlay = document.getElementById('devtools-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

// Скрыть заглушку и вернуть контент
function hideDevToolsOverlay() {
  const overlay = document.getElementById('devtools-overlay');
  if (overlay) overlay.classList.add('hidden');
}

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
