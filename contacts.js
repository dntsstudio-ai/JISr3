/**
 * contacts.js — Страница «Контакты»
 * ────────────────────────────────────
 * Форма обратной связи:
 *  - Поля: Имя, Email, Сообщение
 *  - Валидация на стороне клиента
 *  - Сохранение в коллекцию Firestore `messages`
 *  - Отображение успешного результата
 */

// ── Инициализация страницы контактов ─────────────────────────────
function initContactsPage() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
    <div class="contacts-page">
      <!-- Заголовок страницы -->
      <h1 class="page-title">
        <i class="fa-solid fa-envelope-open-text"></i>
        Обратная связь
      </h1>

      <div class="contacts-card">
        <!-- Краткое описание -->
        <p style="color:var(--clr-text-muted);margin-bottom:28px;line-height:1.6">
          Если у вас есть вопросы, предложения по наполнению календаря
          или вы нашли ошибку — напишите нам. Мы отвечаем на все обращения.
        </p>

        <!-- Блок сообщения об успехе (скрыт по умолчанию) -->
        <div id="contact-success" class="form-success" style="display:none">
          <i class="fa-solid fa-circle-check"></i>
          Спасибо! Ваше сообщение успешно отправлено. Мы свяжемся с вами в ближайшее время.
        </div>

        <!-- Блок ошибки -->
        <div id="contact-error" class="form-error" style="margin-bottom:16px;display:none">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span id="contact-error-text"></span>
        </div>

        <!-- Форма обратной связи -->
        <div id="contact-form">
          <!-- Поле «Имя» -->
          <div class="form-group">
            <label class="form-label" for="contact-name">
              <i class="fa-solid fa-user"></i> Ваше имя
            </label>
            <input
              type="text"
              id="contact-name"
              class="form-input"
              placeholder="Иван Иванов"
              autocomplete="name"
              maxlength="100">
          </div>

          <!-- Поле «Email» -->
          <div class="form-group">
            <label class="form-label" for="contact-email">
              <i class="fa-solid fa-envelope"></i> Email для ответа
            </label>
            <input
              type="email"
              id="contact-email"
              class="form-input"
              placeholder="your@email.com"
              autocomplete="email">
          </div>

          <!-- Поле «Сообщение» -->
          <div class="form-group">
            <label class="form-label" for="contact-message">
              <i class="fa-solid fa-comment-dots"></i> Сообщение
            </label>
            <textarea
              id="contact-message"
              class="form-input"
              rows="5"
              placeholder="Напишите ваш вопрос или предложение..."
              maxlength="2000"></textarea>
            <div style="text-align:right;margin-top:4px">
              <span id="char-counter" class="text-muted" style="font-size:0.78rem">0 / 2000</span>
            </div>
          </div>

          <!-- Кнопка отправки -->
          <button class="btn btn-primary btn-full" id="contact-submit-btn" onclick="submitContactForm()">
            <i class="fa-solid fa-paper-plane"></i> Отправить сообщение
          </button>
        </div>
      </div>
    </div>
  `;

  // Счётчик символов в поле сообщения
  const messageInput  = document.getElementById('contact-message');
  const charCounter   = document.getElementById('char-counter');

  messageInput.addEventListener('input', () => {
    const len = messageInput.value.length;
    charCounter.textContent = `${len} / 2000`;
    // Предупреждение при приближении к лимиту
    charCounter.style.color = len > 1800
      ? 'var(--clr-danger)'
      : 'var(--clr-text-muted)';
  });
}

// ── Отправка формы обратной связи ────────────────────────────────
async function submitContactForm() {
  // Скрыть предыдущие сообщения
  hideContactMessages();

  const name    = document.getElementById('contact-name')?.value?.trim();
  const email   = document.getElementById('contact-email')?.value?.trim();
  const message = document.getElementById('contact-message')?.value?.trim();

  // ── Валидация ──────────────────────────────────────────────────

  if (!name) {
    showContactError('Пожалуйста, введите ваше имя');
    document.getElementById('contact-name')?.focus();
    return;
  }

  if (!email) {
    showContactError('Пожалуйста, введите email для ответа');
    document.getElementById('contact-email')?.focus();
    return;
  }

  if (!isValidEmailContact(email)) {
    showContactError('Введите корректный email адрес');
    document.getElementById('contact-email')?.classList.add('error');
    document.getElementById('contact-email')?.focus();
    return;
  }

  if (!message) {
    showContactError('Сообщение не может быть пустым');
    document.getElementById('contact-message')?.focus();
    return;
  }

  if (message.length < 10) {
    showContactError('Сообщение слишком короткое (минимум 10 символов)');
    return;
  }

  // ── Сохранение в Firestore ────────────────────────────────────

  // Блокируем кнопку, чтобы предотвратить двойную отправку
  const submitBtn = document.getElementById('contact-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Отправка...`;
  }

  try {
    await db.collection('messages').add({
      name:      name,
      email:     email,
      message:   message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Успех: скрываем форму и показываем благодарность
    document.getElementById('contact-form').style.display    = 'none';
    document.getElementById('contact-success').style.display = 'flex';

    // Прокрутить к сообщению об успехе
    document.getElementById('contact-success').scrollIntoView({ behavior: 'smooth' });

  } catch (e) {
    console.error('Ошибка отправки сообщения:', e);

    // Разблокируем кнопку при ошибке
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Отправить сообщение`;
    }

    showContactError('Не удалось отправить сообщение. Проверьте интернет-соединение и попробуйте снова.');
  }
}
window.submitContactForm = submitContactForm;

// ── Вспомогательные функции ───────────────────────────────────────

function showContactError(text) {
  const el   = document.getElementById('contact-error');
  const span = document.getElementById('contact-error-text');
  if (el && span) {
    span.textContent = text;
    el.style.display = 'flex';
  }
}

function hideContactMessages() {
  const errorEl   = document.getElementById('contact-error');
  const successEl = document.getElementById('contact-success');
  if (errorEl)   errorEl.style.display   = 'none';
  if (successEl) successEl.style.display = 'none';

  // Убираем класс ошибки с полей
  document.querySelectorAll('.form-input.error').forEach(el => {
    el.classList.remove('error');
  });
}

function isValidEmailContact(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
