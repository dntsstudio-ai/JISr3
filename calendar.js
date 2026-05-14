/**
 * calendar.js — Страница «Календарь»
 * ─────────────────────────────────────
 * Исправления:
 *  - Popover на мобильных: всегда внутри экрана, не уходит за край
 *  - На очень маленьких экранах popover становится нижней шторкой
 *  - Закрытие popover по клавише Escape
 */

let calendarYear  = new Date().getFullYear();
let activePopover = null;
const holidayCache = {};

const MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ── Инициализация ─────────────────────────────────────────────────
async function initCalendarPage() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="calendar-page" id="calendar-page">
      <div class="calendar-header">
        <h2 class="page-title" style="margin-bottom:0">
          <i class="fa-solid fa-calendar-days"></i>
          Календарь праздников
        </h2>
        <div class="year-nav">
          <button onclick="changeCalendarYear(-1)" aria-label="Предыдущий год">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <span class="year-display" id="year-display">${calendarYear}</span>
          <button onclick="changeCalendarYear(1)" aria-label="Следующий год">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
      <div class="months-grid" id="months-grid"></div>
    </div>
  `;

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onEscKey);
  renderAllMonths();
  preloadHolidayDots();
}

// ── Смена года ────────────────────────────────────────────────────
function changeCalendarYear(delta) {
  calendarYear += delta;
  document.getElementById('year-display').textContent = calendarYear;
  closePopover();
  renderAllMonths();
  preloadHolidayDots();
}
window.changeCalendarYear = changeCalendarYear;

// ── Рендер месяцев ────────────────────────────────────────────────
function renderAllMonths() {
  const grid = document.getElementById('months-grid');
  if (!grid) return;
  let html = '';
  for (let m = 0; m < 12; m++) html += buildMonthHTML(calendarYear, m);
  grid.innerHTML = html;
}

function buildMonthHTML(year, monthIndex) {
  const today      = new Date();
  const isThisYear = year === today.getFullYear();
  const firstDay   = new Date(year, monthIndex, 1);
  const daysInMonth= new Date(year, monthIndex + 1, 0).getDate();
  let startWeekday = firstDay.getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

  const weekdayLabels = WEEKDAYS.map((wd, i) =>
    `<div class="weekday-label ${i>=5?'weekend':''}">${wd}</div>`
  ).join('');

  const emptyCells = Array(startWeekday).fill('<div class="cal-day empty"></div>').join('');

  let daysCells = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const date      = new Date(year, monthIndex, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday   = isThisYear && monthIndex === today.getMonth() && d === today.getDate();
    const mm        = String(monthIndex+1).padStart(2,'0');
    const dd        = String(d).padStart(2,'0');
    const dateKey   = `${mm}-${dd}`;
    const label     = `${d} ${MONTHS_RU[monthIndex]}`;
    const classes   = ['cal-day', isToday?'today':'', isWeekend?'weekend':''].filter(Boolean).join(' ');

    daysCells += `
      <div class="${classes}" data-date="${dateKey}"
           onclick="onDayClick(event,'${dateKey}','${label}')"
           role="button" tabindex="0"
           aria-label="${label} ${year}">
        ${d}
      </div>`;
  }

  return `
    <div class="month-card" id="month-${monthIndex}">
      <div class="month-title">${MONTHS_RU[monthIndex]}</div>
      <div class="month-weekdays">${weekdayLabels}</div>
      <div class="month-days">${emptyCells}${daysCells}</div>
    </div>
  `;
}

// ── Маркеры праздников ────────────────────────────────────────────
async function preloadHolidayDots() {
  try {
    const snapshot = await db.collection('holidays').get();
    snapshot.forEach(doc => {
      holidayCache[doc.id] = doc.data().events || [];
      document.querySelectorAll(`[data-date="${doc.id}"]`).forEach(cell =>
        cell.classList.add('has-holiday'));
    });
  } catch (e) { console.warn('Маркеры праздников:', e); }
}

// ── Клик по дню → popover ─────────────────────────────────────────
async function onDayClick(event, dateKey, label) {
  event.stopPropagation();
  closePopover();

  const targetCell = event.currentTarget;
  const popover = createPopover(label, `
    <div style="text-align:center;padding:20px;color:var(--clr-text-muted)">
      <i class="fa-solid fa-spinner fa-spin"></i> Загрузка...
    </div>
  `);

  positionPopover(popover, targetCell);
  activePopover = popover;

  let events = [];
  if (holidayCache[dateKey] !== undefined) {
    events = holidayCache[dateKey];
  } else {
    try {
      const doc = await db.collection('holidays').doc(dateKey).get();
      events = doc.exists ? (doc.data().events || []) : [];
      holidayCache[dateKey] = events;
    } catch (e) { console.error('Ошибка загрузки дня:', e); }
  }

  const body = popover.querySelector('.popover-body');
  if (body) body.innerHTML = buildPopoverBody(events, dateKey);
}
window.onDayClick = onDayClick;

function buildPopoverBody(events, dateKey) {
  if (events.length === 0) {
    const addBtn = window.isAdmin
      ? `<button class="btn btn-primary btn-sm" style="margin-top:10px"
               onclick="openAddHolidayModal('${dateKey}');closePopover()">
           <i class="fa-solid fa-plus"></i> Добавить
         </button>`
      : '';
    return `<div class="popover-no-events">
      <i class="fa-regular fa-calendar-xmark"></i><br>Праздников нет${addBtn?'<br>'+addBtn:''}
    </div>`;
  }

  return events.map((ev, idx) => {
    const typeIcon = {official:'fa-flag',folk:'fa-seedling',international:'fa-globe',fun:'fa-face-smile'}[ev.type]||'fa-calendar';
    const adminBtns = window.isAdmin ? `
      <div class="popover-event-actions">
        <button class="btn-icon" title="Редактировать"
                onclick="openEditHolidayModal('${dateKey}',${idx});closePopover()">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-icon danger" title="Удалить"
                onclick="confirmDeleteEvent('${dateKey}',${idx});closePopover()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>` : '';

    return `
      <div class="popover-event">
        <i class="fa-solid ${typeIcon}" style="color:var(--clr-accent);margin-top:3px;flex-shrink:0"></i>
        <div class="popover-event-info">
          <div class="popover-event-title">${ev.emoji?ev.emoji+' ':''}${escapeHtml(ev.title)}</div>
          <div class="popover-event-type">${getTypeName(ev.type)}</div>
        </div>
        ${adminBtns}
      </div>`;
  }).join('');
}

function createPopover(title, bodyHTML) {
  const popover = document.createElement('div');
  popover.className = 'day-popover';
  popover.id = 'day-popover';
  popover.innerHTML = `
    <div class="popover-header">
      <h4><i class="fa-regular fa-calendar"></i> ${escapeHtml(title)}</h4>
      <button class="popover-close" onclick="closePopover()" aria-label="Закрыть">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="popover-body">${bodyHTML}</div>
  `;
  document.body.appendChild(popover);
  return popover;
}

/**
 * Позиционирование popover — всегда в пределах экрана.
 * На мобильных (< 600px) показывается как нижняя шторка на весь экран.
 */
function positionPopover(popover, targetEl) {
  const isMobile = window.innerWidth < 600;

  if (isMobile) {
    // На телефоне: фиксированная шторка снизу
    popover.style.position  = 'fixed';
    popover.style.left      = '0';
    popover.style.right     = '0';
    popover.style.bottom    = '0';
    popover.style.top       = 'auto';
    popover.style.width     = '100%';
    popover.style.maxWidth  = '100%';
    popover.style.borderRadius = '16px 16px 0 0';
    popover.style.maxHeight = '70vh';
    popover.style.overflowY = 'auto';
    popover.style.zIndex    = '300';
    popover.style.animation = 'slideUp 0.22s ease';
    return;
  }

  // Десктоп: рядом с ячейкой, не выходя за края
  const rect  = targetEl.getBoundingClientRect();
  const pw    = 300;
  const ph    = 260;
  const gap   = 8;
  const vw    = window.innerWidth;
  const vh    = window.innerHeight;

  let left = rect.right + gap;
  let top  = rect.top + window.scrollY;

  // Не выходить за правый край
  if (left + pw > vw - gap) left = rect.left - pw - gap;
  // Снова проверить — вдруг и слева не помещается
  if (left < gap) left = gap;

  // Не выходить за нижний край экрана
  const topAbsolute = rect.top + window.scrollY;
  if (rect.top + ph > vh - gap) {
    top = topAbsolute - ph + rect.height;
  }
  if (top < window.scrollY + gap) top = window.scrollY + gap;

  popover.style.position = 'absolute';
  popover.style.left     = left + 'px';
  popover.style.top      = top + 'px';
  popover.style.width    = pw + 'px';
  popover.style.maxWidth = pw + 'px';
  popover.style.zIndex   = '300';
}

function closePopover() {
  if (activePopover) { activePopover.remove(); activePopover = null; }
}
window.closePopover = closePopover;

function onDocumentClick(e) {
  if (activePopover && !activePopover.contains(e.target)) closePopover();
}

function onEscKey(e) {
  if (e.key === 'Escape') closePopover();
}

function getTypeName(type) {
  return { official:'Официальный', folk:'Народный', international:'Международный', fun:'Необычный' }[type] || type;
}
window.getTypeName = getTypeName;

window.calendarCleanup = function() {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onEscKey);
  closePopover();
};
