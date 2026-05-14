/**
 * firebase-config.js — Конфигурация Firebase
 * ─────────────────────────────────────────────
 *
 *
 */

const firebaseConfig = {
  apiKey:            "AIzaSyA3md4FZD3D8gaIVlkQ7gJ4Ss-_VuOUOTU",
  authDomain:        "holidays-bs-bd.firebaseapp.com",
  projectId:         "holidays-bs-bd",
  storageBucket:     "holidays-bs-bd.firebasestorage.app",
  messagingSenderId: "135732383959",
  appId:             "1:135732383959:web:faac17c4326d1999b6a092",
};

// Инициализируем Firebase один раз при загрузке страницы
firebase.initializeApp(firebaseConfig);

// Глобальные ссылки на сервисы (используются во всех модулях)
// db и auth инициализируются в app.js через firebase.firestore() и firebase.auth()
console.log("Firebase инициализирован:", firebaseConfig.projectId);
