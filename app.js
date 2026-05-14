/**
 * app.js — Главный файл приложения «Праздничный Календарь»
 * ──────────────────────────────────────────────────────────
 * Исправления:
 *  - Бургер-меню на мобильных (инициализация через initBurgerMenu)
 *  - Защита счётчика посещений: не более 1 раза за сессию браузера
 *  - Закрытие мобильного меню при навигации
 */

const db   = firebase.firestore();
const auth = firebase.auth();

window.currentUser = null;
window.isAdmin     = false;

let currentHomeDateKey = null;
let midnightTimer      = null;

const ROUTES = {
  '/'         : renderHome,
  '/calendar' : renderCalendarPage,
  '/login'    : renderLoginPage,
  '/profile'  : renderProfilePage,
  '/stats'    : renderStatsPage,
  '/contacts' : renderContactsPage,
};

// ── Точка входа ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // Инициализируем защиту (без детектора DevTools)
  if (typeof initProtection === 'function') initProtection();

  // Бургер-меню — важно инициализировать здесь, не в HTML
  initBurgerMenu();

  window.addEventListener('hashchange', handleRoute);

  auth.onAuthStateChanged(async (user) => {
    window.currentUser = user;
    if (user) {
      try {
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        window.isAdmin = adminDoc.exists;
      } catch (e) {
        window.isAdmin = false;
      }
    } else {
      window.isAdmin = false;
    }
    updateNavVisibility();
    handleRoute();
  });
});

// ── Бургер-меню (мобильный) ──────────────────────────────────────
function initBurgerMenu() {
  const burgerBtn  = document.getElementById('burger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!burgerBtn || !mobileMenu) return;

  burgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !mobileMenu.classList.contains('hidden');
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  // Клик по ссылке в мобильном меню — закрыть меню
  mobileMenu.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => closeMobileMenu());
  });

  // Клик вне меню — закрыть
  document.addEventListener('click', (e) => {
    if (!mobileMenu.classList.contains('hidden')
        && !mobileMenu.contains(e.target)
        && !burgerBtn.contains(e.target)) {
      closeMobileMenu();
    }
  });
}

function openMobileMenu() {
  const burgerBtn  = document.getElementById('burger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  mobileMenu.classList.remove('hidden');
  burgerBtn.classList.add('open');
  burgerBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileMenu() {
  const burgerBtn  = document.getElementById('burger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (!mobileMenu) return;
  mobileMenu.classList.add('hidden');
  burgerBtn.classList.remove('open');
  burgerBtn.setAttribute('aria-expanded', 'false');
}

// ── Роутер ────────────────────────────────────────────────────────
function handleRoute() {
  // Закрываем мобильное меню при смене страницы
  closeMobileMenu();

  const hash     = window.location.hash || '#/';
  const path     = hash.replace('#', '') || '/';
  const renderFn = ROUTES[path];

  if (!renderFn) { window.location.hash = '#/'; return; }
  if (path === '/profile' && !window.currentUser) { window.location.hash = '#/login'; return; }
  if (path === '/stats'   && !window.isAdmin)     { window.location.hash = '#/'; return; }

  highlightActiveNav(path);
  renderFn();
}

function highlightActiveNav(path) {
  const routeMap = {
    '/':'home', '/calendar':'calendar', '/login':'login',
    '/profile':'profile', '/stats':'stats', '/contacts':'contacts',
  };
  const activeRoute = routeMap[path] || 'home';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === activeRoute);
  });
}

function updateNavVisibility() {
  document.querySelectorAll('.auth-only').forEach(el =>
    el.classList.toggle('hidden', !window.currentUser));
  document.querySelectorAll('.guest-only').forEach(el =>
    el.classList.toggle('hidden', !!window.currentUser));
  document.querySelectorAll('.admin-only').forEach(el =>
    el.classList.toggle('hidden', !window.isAdmin));
}

// ── Главная страница ──────────────────────────────────────────────
async function renderHome() {
  showLoading();
  const today   = new Date();
  const dateKey = formatDateKey(today);
  currentHomeDateKey = dateKey;

  // Счётчик посещений — не чаще раза за сессию браузера
  incrementVisitCount(today);

  let events = [];
  try {
    const doc = await db.collection('holidays').doc(dateKey).get();
    if (doc.exists) events = doc.data().events || [];
  } catch (e) { console.error('Ошибка загрузки праздников:', e); }

  document.getElementById('main-content').innerHTML = buildHomePage(today, dateKey, events);
  updatePageTitle(events);

  if (typeof showAd === 'function') setTimeout(() => showAd('home'), 1500);
  scheduleMidnightRefresh();
}

function buildHomePage(today, dateKey, events) {
  const dayNum    = today.getDate();
  const monthName = today.toLocaleDateString('ru-RU', { month: 'long' });
  const year      = today.getFullYear();
  const weekday   = today.toLocaleDateString('ru-RU', { weekday: 'long' });

  const adminActionsHTML = window.isAdmin ? `
    <div class="today-admin-actions">
      <button class="btn btn-primary" onclick="openAddHolidayModal('${dateKey}')">
        <i class="fa-solid fa-plus"></i> Добавить праздник
      </button>
      <button class="btn btn-outline" onclick="openManageAdsModal()">
        <i class="fa-solid fa-rectangle-ad"></i> Реклама
      </button>
    </div>` : '';

  let holidaysHTML;
  if (events.length === 0) {
    holidaysHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-calendar-xmark"></i>
        <h3>Праздников не найдено</h3>
        <p>На сегодня, ${dayNum} ${monthName}, праздников не записано.</p>
        ${window.isAdmin ? `<button class="btn btn-primary" style="margin-top:16px"
          onclick="openAddHolidayModal('${dateKey}')">
          <i class="fa-solid fa-plus"></i> Добавить праздник
        </button>` : ''}
      </div>`;
  } else {
    holidaysHTML = events.map((ev, idx) => buildHolidayCard(ev, idx, dateKey)).join('');
  }

  return `
    <div class="home-page">
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
      <div class="holidays-section">
        <h2 class="section-title">
          <i class="fa-solid fa-list-ul"></i>
          ${events.length > 0 ? `Найдено праздников: ${events.length}` : 'Список праздников'}
        </h2>
        <div class="holidays-list">${holidaysHTML}</div>
      </div>
    </div>
  `;
}

function buildHolidayCard(ev, idx, dateKey) {
  const typeLabel = { official:'Официальный', folk:'Народный', international:'Международный', fun:'Необычный' };
  const typeIcon  = { official:'fa-flag', folk:'fa-seedling', international:'fa-globe', fun:'fa-face-smile' };
  const type      = ev.type || 'fun';
  const icon      = typeIcon[type] || 'fa-calendar';
  const emojiHTML = ev.emoji ? `<span class="holiday-emoji">${ev.emoji}</span>` : '';
  const descHTML  = ev.description ? `<p class="holiday-description">${escapeHtml(ev.description)}</p>` : '';
  const adminBtns = window.isAdmin ? `
    <div class="holiday-actions">
      <button class="btn-icon" title="Редактировать" onclick="openEditHolidayModal('${dateKey}',${idx})">
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
      <button class="btn-icon danger" title="Удалить" onclick="confirmDeleteEvent('${dateKey}',${idx})">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>` : '';

  return `
    <div class="holiday-card" data-type="${type}">
      <div class="holiday-icon ${type}"><i class="fa-solid ${icon}"></i></div>
      <div class="holiday-body">
        <span class="holiday-badge ${type}"><i class="fa-solid ${icon}"></i> ${typeLabel[type]||type}</span>
        <h3 class="holiday-title">${emojiHTML}${escapeHtml(ev.title)}</h3>
        ${descHTML}
      </div>
      ${adminBtns}
    </div>
  `;
}

// ── Страницы ──────────────────────────────────────────────────────
function renderCalendarPage() {
  showLoading();
  if (typeof initCalendarPage === 'function') initCalendarPage();
  if (typeof showAd === 'function') setTimeout(() => showAd('calendar'), 1500);
}

function renderLoginPage() {
  if (window.currentUser) { window.location.hash = '#/'; return; }
  showLoading();
  if (typeof initAuthPage === 'function') initAuthPage();
}

function renderProfilePage() {
  const user = window.currentUser;
  if (!user) { window.location.hash = '#/login'; return; }

  const roleBadge = window.isAdmin
    ? `<span class="role-badge admin"><i class="fa-solid fa-crown"></i> Администратор</span>`
    : `<span class="role-badge user"><i class="fa-solid fa-user"></i> Пользователь</span>`;

  document.getElementById('main-content').innerHTML = `
    <div class="profile-page">
      <div class="profile-card">
        <div class="profile-avatar"><i class="fa-solid fa-circle-user"></i></div>
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

function renderStatsPage() {
  if (!window.isAdmin) { window.location.hash = '#/'; return; }
  showLoading();
  if (typeof initStatsPage === 'function') initStatsPage();
}

function renderContactsPage() {
  showLoading();
  if (typeof initContactsPage === 'function') initContactsPage();
}

// ── Выход ─────────────────────────────────────────────────────────
async function handleSignOut() {
  try {
    await auth.signOut();
    window.location.hash = '#/';
    showToast('Вы вышли из аккаунта', 'success');
  } catch (e) { showToast('Ошибка выхода', 'error'); }
}

// ── Счётчик посещений — защита от флуда через F5 ─────────────────
async function incrementVisitCount(today) {
  // Ключ сессии: дата + флаг "уже засчитано"
  const sessionKey = `visit_counted_${formatFullDate(today)}`;
  if (sessionStorage.getItem(sessionKey)) {
    // Уже засчитано в этой сессии — не дублируем
    return;
  }
  sessionStorage.setItem(sessionKey, '1');

  const todayStr  = formatFullDate(today);
  const increment = firebase.firestore.FieldValue.increment(1);
  try {
    await db.collection('statistics').doc('counters').set(
      { totalVisits: increment }, { merge: true }
    );
    await db.collection('statistics').doc('daily').collection('daily').doc(todayStr).set(
      { visits: increment }, { merge: true }
    );
  } catch (e) { console.warn('Счётчик посещений:', e); }
}

function updatePageTitle(events) {
  const title = events.length > 0
    ? `Какой сегодня праздник? – ${events[0].title}`
    : 'Праздничный Календарь — Какой сегодня праздник?';
  document.title = title;
  const og = document.getElementById('og-title');
  if (og) og.setAttribute('content', title);
}

function scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const msUntilMidnight = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5
  ).getTime() - now.getTime();
  midnightTimer = setTimeout(() => {
    const hash = window.location.hash || '#/';
    if (hash === '#/' || hash === '#') renderHome();
  }, msUntilMidnight);
}

// ── Общие утилиты ─────────────────────────────────────────────────
function showLoading() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-loading">
      <div class="spinner"><i class="fa-solid fa-calendar-star fa-spin"></i></div>
      <p>Загрузка...</p>
    </div>`;
}

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
  const icon = type==='success'?'fa-check':type==='error'?'fa-xmark':'fa-info';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}
window.showToast = showToast;

function formatDateKey(date) {
  return `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
window.formatDateKey = formatDateKey;

function formatFullDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
window.formatFullDate = formatFullDate;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escapeHtml = escapeHtml;

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
window.capitalize = capitalize;

function openModal(contentHTML) {
  document.getElementById('global-modal-content').innerHTML = contentHTML;
  document.getElementById('global-modal-overlay').classList.remove('hidden');
  document.getElementById('global-modal-close').onclick = closeModal;
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
