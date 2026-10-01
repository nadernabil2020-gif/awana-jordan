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

// 2) إيميل حساب المدير (مسؤول الشرق الأوسط) - إيميل حقيقي عشان «نسيت كلمة المرور» يوصلك
//    لازم يكون نفس الإيميل في Authentication > Users وفي firestore.rules
window.AWANA_ADMIN_EMAIL = "nadernabil2020@gmail.com";

// 3) اختياري: حماية إضافية ضد تخمين كلمات المرور (Firebase App Check + reCAPTCHA v3)
//    سيبه فاضي لحد ما تفعّله (الخطوات في ملف اقرأني)
window.RECAPTCHA_V3_SITE_KEY = "";

// كلمات مرور مسؤول الأردن والعرض ومديري الأندية تُدار من داخل التطبيق: الإعدادات (للمدير فقط)
