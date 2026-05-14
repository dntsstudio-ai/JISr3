/**
 * app.js — Главный файл приложения «Праздничный Календарь»
 * ──────────────────────────────────────────────────────────
 * Здесь происходит:
 *  1. Хэш-роутинг (SPA без перезагрузки страницы)
 *  2. Отслеживание авторизации и определение роли (admin / user)
 *  3. Обновление навигации в зависимости от роли
 *  4. Рендер главной страницы с праздниками
 *  5. Счётчик посещений
 *
 * Требует: Firebase (инициализирован в firebase-config.js), utils.js
 */

// ── Глобальные переменные приложения ────────────────────────────
const db   = firebase.firestore();   // ссылка на Firestore
const auth = firebase.auth();        // ссылка на Auth

// Текущий пользователь и его роль (заполняются при авторизации)
window.currentUser = null;
window.isAdmin     = false;

// Дата, которая сейчас отображается на главной
let currentHomeDateKey = null;

// Таймер для проверки смены суток
let midnightTimer = null;

// ── Список маршрутов ─────────────────────────────────────────────
const ROUTES = {
  '/'         : renderHome,
  '/calendar' : () => renderCalendarPage(),
  '/login'    : () => renderLoginPage(),
  '/profile'  : () => renderProfilePage(),
  '/stats'    : () => renderStatsPage(),
  '/contacts' : () => renderContactsPage(),
};

// ── Точка входа: запускается после загрузки DOM ─────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Установить год в футере
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // Инициализируем защиту (utils.js)
  initProtection();

  // Слушаем изменения хэша (навигация)
  window.addEventListener('hashchange', handleRoute);

  // Слушаем авторизацию Firebase
  auth.onAuthStateChanged(async (user) => {
    window.currentUser = user;

    if (user) {
      // Проверяем, является ли пользователь администратором
      try {
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        window.isAdmin = adminDoc.exists;
      } catch (e) {
        // Если правила Firestore не дают читать — значит не admin
        window.isAdmin = false;
      }
    } else {
      window.isAdmin = false;
    }

    // Обновляем навигационное меню
    updateNavVisibility();

    // Запускаем роутер (отображаем нужную страницу)
    handleRoute();
  });
});

// ── Роутер ───────────────────────────────────────────────────────
function handleRoute() {
  const hash  = window.location.hash || '#/';
  const path  = hash.replace('#', '') || '/';

  // Найти совпадающий маршрут
  const renderFn = ROUTES[path];

  if (!renderFn) {
    // Неизвестный маршрут — редирект на главную
    window.location.hash = '#/';
    return;
  }

  // Маршруты только для авторизованных
  if (path === '/profile' && !window.currentUser) {
    window.location.hash = '#/login';
    return;
  }

  // Маршруты только для администраторов
  if (path === '/stats' && !window.isAdmin) {
    window.location.hash = '#/';
    return;
  }

  // Подсветить активный пункт меню
  highlightActiveNav(path);

  // Вызываем функцию рендера страницы
  renderFn();
}

// ── Подсветка активного пункта навигации ────────────────────────
function highlightActiveNav(path) {
  const routeMap = {
    '/'         : 'home',
    '/calendar' : 'calendar',
    '/login'    : 'login',
    '/profile'  : 'profile',
    '/stats'    : 'stats',
    '/contacts' : 'contacts',
  };

  const activeRoute = routeMap[path] || 'home';

  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === activeRoute);
  });
}

// ── Обновление видимости элементов навигации ────────────────────
function updateNavVisibility() {
  // Элементы только для авторизованных
  document.querySelectorAll('.auth-only').forEach(el => {
    el.classList.toggle('hidden', !window.currentUser);
  });

  // Элементы только для гостей
  document.querySelectorAll('.guest-only').forEach(el => {
    el.classList.toggle('hidden', !!window.currentUser);
  });

  // Элементы только для администраторов
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !window.isAdmin);
  });
}

// ── Главная страница ─────────────────────────────────────────────
async function renderHome() {
  const main = document.getElementById('main-content');

  // Показываем загрузчик пока грузим данные
  showLoading();

  const today = new Date();
  const dateKey = formatDateKey(today); // "MM-DD"
  currentHomeDateKey = dateKey;

  // Увеличить счётчик посещений (fire-and-forget, не блокируем UI)
  incrementVisitCount(today);

  // Загрузить праздники из Firestore
  let events = [];
  try {
    const doc = await db.collection('holidays').doc(dateKey).get();
    if (doc.exists) {
      events = doc.data().events || [];
    }
  } catch (e) {
    console.error('Ошибка загрузки праздников:', e);
  }

  // Сформировать HTML страницы
  main.innerHTML = buildHomePage(today, dateKey, events);

  // Обновить тег <title> и og:title динамически
  updatePageTitle(events);

  // Запустить рекламу (ads.js)
  if (typeof showAd === 'function') {
    setTimeout(() => showAd('home'), 1500);
  }

  // Настроить таймер для автоматического обновления в полночь
  scheduleMidnightRefresh();
}

// Строим HTML для главной страницы
function buildHomePage(today, dateKey, events) {
  const dayNum    = today.getDate();
  const monthName = today.toLocaleDateString('ru-RU', { month: 'long' });
  const year      = today.getFullYear();
  const weekday   = today.toLocaleDateString('ru-RU', { weekday: 'long' });

  // Кнопки администратора (видны только admin)
  const adminActionsHTML = window.isAdmin ? `
    <div class="today-admin-actions">
      <button class="btn btn-primary" onclick="openAddHolidayModal('${dateKey}')">
        <i class="fa-solid fa-plus"></i> Добавить праздник
      </button>
      <button class="btn btn-outline" onclick="openManageAdsModal()">
        <i class="fa-solid fa-rectangle-ad"></i> Реклама
      </button>
    </div>` : '';

  // Список праздников или пустое состояние
  let holidaysHTML;
  if (events.length === 0) {
    holidaysHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-calendar-xmark"></i>
        <h3>Праздников не найдено</h3>
        <p>На сегодня, ${dayNum} ${monthName}, праздников не записано.</p>
        ${window.isAdmin ? `<button class="btn btn-primary" style="margin-top:16px" onclick="openAddHolidayModal('${dateKey}')">
          <i class="fa-solid fa-plus"></i> Добавить праздник
        </button>` : ''}
      </div>`;
  } else {
    holidaysHTML = events.map((ev, idx) => buildHolidayCard(ev, idx, dateKey)).join('');
  }

  return `
    <div class="home-page">
      <!-- Большая карточка «сегодняшний день» -->
      <div class="today-hero">
        <div class="today-date">
          <div class="today-day-num">${dayNum}</div>
          <div class="today-month-year">${monthName} ${year}</div>
          <div class="today-weekday">${capitalize(weekday)}</div>
        </div>
        <div class="today-divider"></div>
        <div class="today-label">
          <h1><i class="fa-solid fa-star"></i> Праздники сегодня</h1>
          <p>Официальные, народные, международные и необычные праздники</p>
        </div>
        ${adminActionsHTML}
      </div>

      <!-- Список праздников -->
      <div class="holidays-section">
        <h2 class="section-title">
          <i class="fa-solid fa-list-ul"></i>
          ${events.length > 0 ? `Найдено праздников: ${events.length}` : 'Список праздников'}
        </h2>
        <div class="holidays-list">
          ${holidaysHTML}
        </div>
      </div>
    </div>
  `;
}

// Построить карточку одного праздника
function buildHolidayCard(ev, idx, dateKey) {
  const typeLabel = {
    official:      'Официальный',
    folk:          'Народный',
    international: 'Международный',
    fun:           'Необычный',
  };

  const typeIcon = {
    official:      'fa-flag',
    folk:          'fa-seedling',
    international: 'fa-globe',
    fun:           'fa-face-smile',
  };

  const type        = ev.type || 'fun';
  const label       = typeLabel[type] || type;
  const icon        = typeIcon[type] || 'fa-calendar';
  const emojiHTML   = ev.emoji ? `<span class="holiday-emoji">${ev.emoji}</span>` : '';
  const descHTML    = ev.description
    ? `<p class="holiday-description">${escapeHtml(ev.description)}</p>` : '';

  // Кнопки редактирования и удаления для администратора
  const adminBtns = window.isAdmin ? `
    <div class="holiday-actions">
      <button class="btn-icon" title="Редактировать" onclick="openEditHolidayModal('${dateKey}', ${idx})">
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
      <button class="btn-icon danger" title="Удалить" onclick="confirmDeleteEvent('${dateKey}', ${idx})">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>` : '';

  return `
    <div class="holiday-card" data-type="${type}">
      <div class="holiday-icon ${type}">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="holiday-body">
        <span class="holiday-badge ${type}">
          <i class="fa-solid ${icon}"></i>
          ${label}
        </span>
        <h3 class="holiday-title">${emojiHTML}${escapeHtml(ev.title)}</h3>
        ${descHTML}
      </div>
      ${adminBtns}
    </div>
  `;
}

// ── Страница: Календарь ──────────────────────────────────────────
function renderCalendarPage() {
  showLoading();
  // Рендер делегирован в calendar.js
  if (typeof initCalendarPage === 'function') {
    initCalendarPage();
  }
  if (typeof showAd === 'function') {
    setTimeout(() => showAd('calendar'), 1500);
  }
}

// ── Страница: Вход / Регистрация ─────────────────────────────────
function renderLoginPage() {
  if (window.currentUser) {
    // Уже вошли — идём на главную
    window.location.hash = '#/';
    return;
  }
  showLoading();
  if (typeof initAuthPage === 'function') initAuthPage();
}

// ── Страница: Профиль ────────────────────────────────────────────
function renderProfilePage() {
  const main = document.getElementById('main-content');
  const user = window.currentUser;

  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  const roleBadge = window.isAdmin
    ? `<span class="role-badge admin"><i class="fa-solid fa-crown"></i> Администратор</span>`
    : `<span class="role-badge user"><i class="fa-solid fa-user"></i> Пользователь</span>`;

  main.innerHTML = `
    <div class="profile-page">
      <div class="profile-card">
        <div class="profile-avatar">
          <i class="fa-solid fa-circle-user"></i>
        </div>
        <p class="profile-email">${escapeHtml(user.email)}</p>
        <div class="profile-role">${roleBadge}</div>
        <hr class="divider">
        <button class="btn btn-danger btn-full" onclick="handleSignOut()">
          <i class="fa-solid fa-right-from-bracket"></i> Выйти из аккаунта
        </button>
      </div>
    </div>
  `;
}

// ── Страница: Статистика ─────────────────────────────────────────
function renderStatsPage() {
  if (!window.isAdmin) {
    window.location.hash = '#/';
    return;
  }
  showLoading();
  if (typeof initStatsPage === 'function') initStatsPage();
}

// ── Страница: Контакты ────────────────────────────────────────────
function renderContactsPage() {
  showLoading();
  if (typeof initContactsPage === 'function') initContactsPage();
}

// ── Выход из аккаунта ────────────────────────────────────────────
async function handleSignOut() {
  try {
    await auth.signOut();
    window.location.hash = '#/';
    showToast('Вы вышли из аккаунта', 'success');
  } catch (e) {
    console.error('Ошибка выхода:', e);
    showToast('Ошибка выхода', 'error');
  }
}

// ── Счётчик посещений ─────────────────────────────────────────────
async function incrementVisitCount(today) {
  const todayStr = formatFullDate(today); // "YYYY-MM-DD"
  try {
    const increment = firebase.firestore.FieldValue.increment(1);

    // Общий счётчик
    await db.collection('statistics').doc('counters').set({
      totalVisits: increment,
    }, { merge: true });

    // Суточный счётчик
    await db.collection('statistics').doc('daily').collection('daily').doc(todayStr).set({
      visits: increment,
    }, { merge: true });
  } catch (e) {
    // Молча проглатываем — статистика не должна ломать UX
    console.warn('Не удалось обновить счётчик посещений:', e);
  }
}

// ── Обновление заголовка страницы ────────────────────────────────
function updatePageTitle(events) {
  let title = 'Праздничный Календарь — Какой сегодня праздник?';
  if (events.length > 0) {
    title = `Какой сегодня праздник? – ${events[0].title}`;
  }
  document.title = title;

  // Обновляем og:title (для динамических шеринг-превью это важно)
  const ogTitle = document.getElementById('og-title');
  if (ogTitle) ogTitle.setAttribute('content', title);
}

// ── Таймер обновления в полночь ──────────────────────────────────
function scheduleMidnightRefresh() {
  // Сбросить предыдущий таймер, если был
  if (midnightTimer) clearTimeout(midnightTimer);

  const now   = new Date();
  const msUntilMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime()
    - now.getTime();

  midnightTimer = setTimeout(() => {
    // Если всё ещё на главной — перерисуем
    const hash = window.location.hash || '#/';
    if (hash === '#/' || hash === '#') renderHome();
  }, msUntilMidnight);
}

// ── Вспомогательные функции отображения ─────────────────────────
function showLoading() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-loading">
      <div class="spinner"><i class="fa-solid fa-calendar-star fa-spin"></i></div>
      <p>Загрузка...</p>
    </div>
  `;
}

// Показать уведомление (toast)
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check' : type === 'error' ? 'fa-xmark' : 'fa-info';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);

  // Автоматически удалить через 3 секунды
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}
window.showToast = showToast; // делаем глобальной для других модулей

// ── Вспомогательные утилиты ──────────────────────────────────────

// Форматирует дату в "MM-DD" (ключ документа Firestore)
function formatDateKey(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}
window.formatDateKey = formatDateKey;

// Форматирует дату в "YYYY-MM-DD" (ключ суточной статистики)
function formatFullDate(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
window.formatFullDate = formatFullDate;

// Экранирование HTML для защиты от XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
window.escapeHtml = escapeHtml;

// Строка с первой заглавной буквой
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
window.capitalize = capitalize;

// ── Открытие и закрытие глобального модального окна ─────────────
function openModal(contentHTML) {
  document.getElementById('global-modal-content').innerHTML = contentHTML;
  document.getElementById('global-modal-overlay').classList.remove('hidden');

  // Закрытие по кнопке
  document.getElementById('global-modal-close').onclick = closeModal;

  // Закрытие по клику на оверлей
  document.getElementById('global-modal-overlay').onclick = (e) => {
    if (e.target === document.getElementById('global-modal-overlay')) closeModal();
  };
}
window.openModal = openModal;

function closeModal() {
  document.getElementById('global-modal-overlay').classList.add('hidden');
  document.getElementById('global-modal-content').innerHTML = '';
}
window.closeModal = closeModal;
