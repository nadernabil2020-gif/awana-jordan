// ===== إعدادات تطبيق أندية أوانا الأردن =====
// 1) بيانات مشروع Firebase (awana-jordan) - جاهزة
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAv3bumU5xM8ukAihvT7F9zSRWsz8uIlJg",
  authDomain: "awana-jordan.firebaseapp.com",
  projectId: "awana-jordan",
  storageBucket: "awana-jordan.firebasestorage.app",
  messagingSenderId: "782295690828",
  appId: "1:782295690828:web:ba527d4e6c84e1e4bc0ee9"
};

// 2) إيميل حساب المدير (مسؤول الشرق الأوسط) - نفس الإيميل في Authentication > Users
//    لو غيّرته هنا غيّره كمان في firestore.rules
window.AWANA_ADMIN_EMAIL = "admin@awanajo.app";

// كلمات مرور مسؤول الأردن والعرض تُدار من داخل التطبيق: الإعدادات (للمدير فقط)
