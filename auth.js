/**
 * auth.js — Страница входа и регистрации
 * ────────────────────────────────────────
 * Реализует:
 *  - Форму входа по email/password
 *  - Форму регистрации по email/password
 *  - Вход через Google (popup)
 *  - Переключение между вкладками «Вход» / «Регистрация»
 *  - Подсчёт регистраций в statistics
 */

// ── Инициализация страницы авторизации ───────────────────────────
function initAuthPage() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <!-- Логотип вверху карточки -->
        <div class="auth-logo">
          <i class="fa-solid fa-calendar-star"></i>
          <h2>Праздничный Календарь</h2>
        </div>

        <!-- Вкладки: «Вход» и «Регистрация» -->
        <div class="auth-tabs">
          <div class="auth-tab active" id="tab-login" onclick="switchAuthTab('login')">
            <i class="fa-solid fa-right-to-bracket"></i> Вход
          </div>
          <div class="auth-tab" id="tab-register" onclick="switchAuthTab('register')">
            <i class="fa-solid fa-user-plus"></i> Регистрация
          </div>
        </div>

        <!-- Сообщение об ошибке/успехе -->
        <div id="auth-message" style="display:none"></div>

        <!-- Форма входа -->
        <div id="login-form-block">
          <div class="form-group">
            <label class="form-label" for="login-email">
              <i class="fa-solid fa-envelope"></i> Email
            </label>
            <input type="email" id="login-email" class="form-input"
                   placeholder="your@email.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">
              <i class="fa-solid fa-lock"></i> Пароль
            </label>
            <input type="password" id="login-password" class="form-input"
                   placeholder="Ваш пароль" autocomplete="current-password">
          </div>
          <button class="btn btn-primary btn-full" onclick="handleLogin()">
            <i class="fa-solid fa-right-to-bracket"></i> Войти
          </button>
        </div>

        <!-- Форма регистрации (скрыта по умолчанию) -->
        <div id="register-form-block" style="display:none">
          <div class="form-group">
            <label class="form-label" for="reg-email">
              <i class="fa-solid fa-envelope"></i> Email
            </label>
            <input type="email" id="reg-email" class="form-input"
                   placeholder="your@email.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">
              <i class="fa-solid fa-lock"></i> Пароль (минимум 6 символов)
            </label>
            <input type="password" id="reg-password" class="form-input"
                   placeholder="Придумайте пароль" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password-2">
              <i class="fa-solid fa-lock"></i> Повтор пароля
            </label>
            <input type="password" id="reg-password-2" class="form-input"
                   placeholder="Повторите пароль" autocomplete="new-password">
          </div>
          <button class="btn btn-primary btn-full" onclick="handleRegister()">
            <i class="fa-solid fa-user-plus"></i> Зарегистрироваться
          </button>
        </div>

        <!-- Разделитель -->
        <div class="auth-divider">или</div>

        <!-- Кнопка Google -->
        <button class="btn-google" onclick="handleGoogleSignIn()">
          <i class="fa-brands fa-google"></i>
          Продолжить с Google
        </button>
      </div>
    </div>
  `;
}

// ── Переключение вкладок ─────────────────────────────────────────
function switchAuthTab(tab) {
  const isLogin = tab === 'login';

  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);

  document.getElementById('login-form-block').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('register-form-block').style.display = isLogin ? 'none' : 'block';

  // Сбросить сообщение
  hideAuthMessage();
}
window.switchAuthTab = switchAuthTab;

// ── Вход по email/password ───────────────────────────────────────
async function handleLogin() {
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showAuthMessage('Заполните все поля', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showAuthMessage('Введите корректный email', 'error');
    return;
  }

  showAuthMessage('Вход...', 'info');

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged в app.js обработает дальнейшую логику
    window.location.hash = '#/';
  } catch (e) {
    console.error('Ошибка входа:', e);
    showAuthMessage(getFirebaseErrorMessage(e.code), 'error');
  }
}
window.handleLogin = handleLogin;

// ── Регистрация по email/password ────────────────────────────────
async function handleRegister() {
  const email  = document.getElementById('reg-email')?.value?.trim();
  const pass1  = document.getElementById('reg-password')?.value;
  const pass2  = document.getElementById('reg-password-2')?.value;

  if (!email || !pass1 || !pass2) {
    showAuthMessage('Заполните все поля', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showAuthMessage('Введите корректный email', 'error');
    return;
  }

  if (pass1.length < 6) {
    showAuthMessage('Пароль должен содержать минимум 6 символов', 'error');
    return;
  }

  if (pass1 !== pass2) {
    showAuthMessage('Пароли не совпадают', 'error');
    return;
  }

  showAuthMessage('Регистрация...', 'info');

  try {
    await auth.createUserWithEmailAndPassword(email, pass1);

    // Увеличить счётчик регистраций
    incrementRegistrationCount();

    window.location.hash = '#/';
  } catch (e) {
    console.error('Ошибка регистрации:', e);
    showAuthMessage(getFirebaseErrorMessage(e.code), 'error');
  }
}
window.handleRegister = handleRegister;

// ── Вход через Google ────────────────────────────────────────────
async function handleGoogleSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();

  showAuthMessage('Открываю вход через Google...', 'info');

  try {
    const result = await auth.signInWithPopup(provider);

    // Если это новый пользователь — записать в статистику
    if (result.additionalUserInfo?.isNewUser) {
      incrementRegistrationCount();
    }

    window.location.hash = '#/';
  } catch (e) {
    console.error('Ошибка Google Sign-In:', e);
    if (e.code !== 'auth/popup-closed-by-user') {
      showAuthMessage(getFirebaseErrorMessage(e.code), 'error');
    } else {
      hideAuthMessage();
    }
  }
}
window.handleGoogleSignIn = handleGoogleSignIn;

// ── Счётчик регистраций ───────────────────────────────────────────
async function incrementRegistrationCount() {
  try {
    const today    = new Date();
    const todayStr = formatFullDate(today);
    const inc      = firebase.firestore.FieldValue.increment(1);

    await db.collection('statistics').doc('counters').set({
      totalRegistrations: inc,
    }, { merge: true });

    await db.collection('statistics').doc('daily').collection('daily').doc(todayStr).set({
      registrations: inc,
    }, { merge: true });
  } catch (e) {
    console.warn('Не удалось записать регистрацию:', e);
  }
}

// ── Отображение сообщений ─────────────────────────────────────────
function showAuthMessage(text, type) {
  const el = document.getElementById('auth-message');
  if (!el) return;

  const icons = { success: 'fa-check', error: 'fa-circle-exclamation', info: 'fa-spinner fa-spin' };
  const icon  = icons[type] || 'fa-info';

  el.className = type === 'error' ? 'form-error' : (type === 'success' ? 'form-success' : 'form-info-msg');
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${escapeHtml(text)}`;
  el.style.display = 'flex';
}

function hideAuthMessage() {
  const el = document.getElementById('auth-message');
  if (el) el.style.display = 'none';
}

// ── Вспомогательные функции ───────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Перевод кодов ошибок Firebase на русский
function getFirebaseErrorMessage(code) {
  const messages = {
    'auth/user-not-found':       'Пользователь с таким email не найден',
    'auth/wrong-password':       'Неверный пароль',
    'auth/email-already-in-use': 'Этот email уже зарегистрирован',
    'auth/weak-password':        'Пароль слишком слабый (минимум 6 символов)',
    'auth/invalid-email':        'Некорректный email',
    'auth/too-many-requests':    'Слишком много попыток. Повторите позже',
    'auth/network-request-failed': 'Ошибка сети. Проверьте интернет-соединение',
    'auth/invalid-credential':   'Неверный email или пароль',
  };
  return messages[code] || `Ошибка: ${code}`;
}
