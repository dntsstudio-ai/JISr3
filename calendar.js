/**
 * calendar.js — Страница «Календарь»
 * ────────────────────────────────────
 * Отображает сетку месяцев на выбранный год.
 * При клике на день загружает праздники из Firestore и показывает popover.
 * Администратор видит кнопки «Редактировать» и «Удалить» в popover.
 */

// Текущий год для навигации по календарю
let calendarYear = new Date().getFullYear();

// Ссылка на открытый popover (чтобы не плодить несколько)
let activePopover = null;

// Кэш загруженных данных по дням, чтобы не делать лишних запросов
const holidayCache = {};

// Русские названия месяцев
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель',
  'Май', 'Июнь', 'Июль', 'Август',
  'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Сокращённые названия дней недели (начиная с понедельника по РФ-стандарту)
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// ── Инициализация страницы ────────────────────────────────────────
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
          <button onclick="changeCalendarYear(-1)" title="Предыдущий год" aria-label="Предыдущий год">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <span class="year-display" id="year-display">${calendarYear}</span>
          <button onclick="changeCalendarYear(1)" title="Следующий год" aria-label="Следующий год">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
      <div class="months-grid" id="months-grid">
        <!-- Месяцы рендерятся ниже -->
      </div>
    </div>
  `;

  // Закрывать popover при клике вне него
  document.addEventListener('click', onDocumentClick);

  // Отрисовать все месяцы
  renderAllMonths();

  // После рендера — подсветить дни с праздниками (асинхронно)
  preloadHolidayDots();
}

// ── Смена года ────────────────────────────────────────────────────
function changeCalendarYear(delta) {
  calendarYear += delta;
  document.getElementById('year-display').textContent = calendarYear;

  // Перерисовать календарь
  renderAllMonths();
  preloadHolidayDots();
}
window.changeCalendarYear = changeCalendarYear;

// ── Отрисовка всех 12 месяцев ────────────────────────────────────
function renderAllMonths() {
  const grid = document.getElementById('months-grid');
  if (!grid) return;

  let html = '';
  for (let m = 0; m < 12; m++) {
    html += buildMonthHTML(calendarYear, m);
  }
  grid.innerHTML = html;
}

// ── Построить HTML одного месяца ──────────────────────────────────
function buildMonthHTML(year, monthIndex) {
  const today     = new Date();
  const isThisYear = year === today.getFullYear();

  // Первый день месяца и количество дней
  const firstDay     = new Date(year, monthIndex, 1);
  const daysInMonth  = new Date(year, monthIndex + 1, 0).getDate();

  // День недели первого числа (0=вс, 1=пн...) — пересчитаем на ПН-старт
  let startWeekday = firstDay.getDay(); // 0=Sun
  startWeekday = (startWeekday === 0) ? 6 : startWeekday - 1; // 0=Mon..6=Sun

  // Заголовки дней недели
  const weekdayLabels = WEEKDAYS.map((wd, i) =>
    `<div class="weekday-label ${i >= 5 ? 'weekend' : ''}">${wd}</div>`
  ).join('');

  // Пустые ячейки до первого числа
  const emptyCells = Array(startWeekday).fill('<div class="cal-day empty"></div>').join('');

  // Ячейки дней
  let daysCells = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const date       = new Date(year, monthIndex, d);
    const dayOfWeek  = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend  = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday    = isThisYear
      && monthIndex === today.getMonth()
      && d === today.getDate();

    const mm        = String(monthIndex + 1).padStart(2, '0');
    const dd        = String(d).padStart(2, '0');
    const dateKey   = `${mm}-${dd}`;

    const classes = [
      'cal-day',
      isToday   ? 'today'   : '',
      isWeekend ? 'weekend' : '',
    ].filter(Boolean).join(' ');

    daysCells += `
      <div class="${classes}"
           data-date="${dateKey}"
           data-label="${d} ${MONTHS_RU[monthIndex]}"
           onclick="onDayClick(event, '${dateKey}', '${d} ${MONTHS_RU[monthIndex]}')"
           role="button"
           tabindex="0"
           aria-label="${d} ${MONTHS_RU[monthIndex]} ${year}">
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

// ── Предзагрузка точек-маркеров для дней с праздниками ───────────
async function preloadHolidayDots() {
  // Загружаем все документы коллекции holidays разом
  try {
    const snapshot = await db.collection('holidays').get();
    snapshot.forEach(doc => {
      // Добавляем в кэш
      holidayCache[doc.id] = doc.data().events || [];

      // Найти все ячейки с этой датой и добавить класс has-holiday
      const cells = document.querySelectorAll(`[data-date="${doc.id}"]`);
      cells.forEach(cell => cell.classList.add('has-holiday'));
    });
  } catch (e) {
    console.warn('Не удалось загрузить маркеры праздников:', e);
  }
}

// ── Клик по дню — показать popover ───────────────────────────────
async function onDayClick(event, dateKey, label) {
  // Предотвратить всплытие, чтобы onDocumentClick не закрыл popover сразу
  event.stopPropagation();

  // Закрыть предыдущий popover
  closePopover();

  const targetCell = event.currentTarget;

  // Показать popover с загрузчиком
  const popover = createPopover(label, `
    <div style="text-align:center;padding:20px;color:var(--clr-text-muted)">
      <i class="fa-solid fa-spinner fa-spin"></i> Загрузка...
    </div>
  `);

  positionPopover(popover, targetCell);
  activePopover = popover;

  // Загрузить данные (из кэша или Firestore)
  let events = [];
  if (holidayCache[dateKey] !== undefined) {
    events = holidayCache[dateKey];
  } else {
    try {
      const doc = await db.collection('holidays').doc(dateKey).get();
      events = doc.exists ? (doc.data().events || []) : [];
      holidayCache[dateKey] = events;
    } catch (e) {
      console.error('Ошибка загрузки дня:', e);
    }
  }

  // Обновить содержимое popover
  const body = popover.querySelector('.popover-body');
  body.innerHTML = buildPopoverBody(events, dateKey);
}
window.onDayClick = onDayClick;

// ── Построить тело popover ────────────────────────────────────────
function buildPopoverBody(events, dateKey) {
  if (events.length === 0) {
    const addBtn = window.isAdmin
      ? `<button class="btn btn-primary btn-sm" style="margin-top:10px"
               onclick="openAddHolidayModal('${dateKey}'); closePopover()">
           <i class="fa-solid fa-plus"></i> Добавить
         </button>`
      : '';
    return `<div class="popover-no-events">
      <i class="fa-regular fa-calendar-xmark"></i><br>Праздников нет${addBtn ? '<br>' + addBtn : ''}
    </div>`;
  }

  return events.map((ev, idx) => {
    const typeIcon = {
      official: 'fa-flag', folk: 'fa-seedling',
      international: 'fa-globe', fun: 'fa-face-smile',
    }[ev.type] || 'fa-calendar';

    const adminBtns = window.isAdmin ? `
      <div class="popover-event-actions">
        <button class="btn-icon" title="Редактировать" onclick="openEditHolidayModal('${dateKey}', ${idx}); closePopover()">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-icon danger" title="Удалить" onclick="confirmDeleteEvent('${dateKey}', ${idx}); closePopover()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>` : '';

    return `
      <div class="popover-event">
        <i class="fa-solid ${typeIcon}" style="color:var(--clr-accent);margin-top:3px;flex-shrink:0"></i>
        <div class="popover-event-info">
          <div class="popover-event-title">${ev.emoji ? ev.emoji + ' ' : ''}${escapeHtml(ev.title)}</div>
          <div class="popover-event-type">${getTypeName(ev.type)}</div>
        </div>
        ${adminBtns}
      </div>`;
  }).join('');
}

// ── Создать DOM-элемент popover ───────────────────────────────────
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

// ── Позиционировать popover рядом с ячейкой ──────────────────────
function positionPopover(popover, targetEl) {
  const rect   = targetEl.getBoundingClientRect();
  const pw     = 320; // примерная ширина popover
  const ph     = 240; // примерная высота

  let left = rect.right + 8;
  let top  = rect.top;

  // Не выходить за правый край экрана
  if (left + pw > window.innerWidth - 8) {
    left = rect.left - pw - 8;
  }

  // Не выходить за нижний край экрана
  if (top + ph > window.innerHeight - 8) {
    top = window.innerHeight - ph - 8;
  }

  // Не выходить за верхний край
  if (top < 8) top = 8;

  popover.style.left = `${left + window.scrollX}px`;
  popover.style.top  = `${top + window.scrollY}px`;
}

// ── Закрыть popover ───────────────────────────────────────────────
function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}
window.closePopover = closePopover;

// Закрываем popover при клике вне него
function onDocumentClick(e) {
  if (activePopover && !activePopover.contains(e.target)) {
    closePopover();
  }
}

// ── Утилита: русское название типа праздника ──────────────────────
function getTypeName(type) {
  const names = {
    official:      'Официальный',
    folk:          'Народный',
    international: 'Международный',
    fun:           'Необычный/Развлекательный',
  };
  return names[type] || type;
}
window.getTypeName = getTypeName;

// Очищаем слушатель при уходе со страницы (вызывается роутером)
window.calendarCleanup = function () {
  document.removeEventListener('click', onDocumentClick);
  closePopover();
};
