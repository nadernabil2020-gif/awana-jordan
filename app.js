import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, writeBatch, arrayUnion, arrayRemove, query, where, orderBy, limit, deleteField } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(() => {
"use strict";

// ================= language =================
let LANG = "ar";
try{ LANG = localStorage.getItem("awana-lang")==="en" ? "en" : "ar"; }catch{}
const L = (ar,en) => LANG==="en" ? en : ar;
function applyLang(){ document.documentElement.lang=LANG; document.documentElement.dir=LANG==="en"?"ltr":"rtl"; document.title=L("أندية أوانا الأردن","Awana Jordan"); const j=document.getElementById("logoJo"); if(j) j.textContent=L("الأردن","JORDAN"); }
applyLang();

// ================= constants =================
const PROGRAMS = [
  {k:"puggles",n:"Puggles",ar:"باغلز (سنتين)",en:"Puggles (age 2)",c:"--p-puggles"},
  {k:"cubbies",n:"Cubbies",ar:"كَبيز (3–4 سنوات)",en:"Cubbies (ages 3–4)",c:"--p-cubbies"},
  {k:"sparks",n:"Sparks",ar:"سباركس (KG – ثاني)",en:"Sparks (K – 2nd)",c:"--p-sparks"},
  {k:"tt",n:"T&T",ar:"T&T (ثالث – سادس)",en:"T&T (3rd – 6th)",c:"--p-tt"},
  {k:"trek",n:"Trek",ar:"تريك (إعدادي)",en:"Trek (middle school)",c:"--p-trek"},
  {k:"journey",n:"Journey",ar:"جيرني (ثانوي)",en:"Journey (high school)",c:"--p-journey"},
];
const PMAP = Object.fromEntries(PROGRAMS.map(p=>[p.k,p]));
const pLabel = k => k&&PMAP[k] ? L(PMAP[k].ar,PMAP[k].en) : "—";
const TYPE_EN = {"كنيسة":"Church","مدرسة":"School","حضانة":"Nursery","أخرى":"Other"};
const CITY_EN = {"عمّان":"Amman","إربد":"Irbid","الزرقاء":"Zarqa","السلط":"Salt","مادبا":"Madaba","الفحيص":"Fuheis","العقبة":"Aqaba","الكرك":"Karak","جرش":"Jerash","عجلون":"Ajloun","المفرق":"Mafraq","الطفيلة":"Tafilah","معان":"Ma'an","أخرى":"Other"};
const DAY_EN = {"السبت":"Saturday","الأحد":"Sunday","الإثنين":"Monday","الثلاثاء":"Tuesday","الأربعاء":"Wednesday","الخميس":"Thursday","الجمعة":"Friday"};
const ROLE_EN = {"مساعد مدير":"Assistant director","قائد مرحلة":"Program leader","معلم / مرشد مجموعة":"Small-group leader","مسؤول الألعاب":"Game director","سكرتير / مسجّل":"Secretary / registrar","مسؤول المتجر والجوائز":"Store & awards","مسؤول العبادة والترانيم":"Worship & songs","متطوع":"Volunteer"};
const STATUS_EN = {"نشط":"Active","متوقف":"Inactive","تخرّج":"Graduated"};
const GENDER_EN = {"ولد":"Boy","بنت":"Girl"};
const tr = (map,v) => v ? (LANG==="en" && map[v] ? map[v] : v) : "";
const TYPES = Object.keys(TYPE_EN), CITIES = Object.keys(CITY_EN), DAYS = Object.keys(DAY_EN), ROLES = Object.keys(ROLE_EN);
const CONSENT = {"":["—","—"],"yes":["نعم، موافقون على التصوير","Yes, photos allowed"],"no":["لا، ممنوع تصوير الطفل","No photos of this child"]};
const ACC = {
  admin:{ar:"مسؤول الشرق الأوسط",en:"Middle East coordinator"},
  jordan:{ar:"مسؤول أندية الأردن",en:"Jordan clubs coordinator"},
  view:{ar:"عرض واستخراج فقط",en:"View & export only"},
  club:{ar:"مدير نادي",en:"Club director"},
};
const accLabel = r => ACC[r] ? L(ACC[r].ar,ACC[r].en) : "";
const ADMIN_EMAIL = String(window.AWANA_ADMIN_EMAIL||"").toLowerCase();

const progOpts = {t:"select",o:[""].concat(PROGRAMS.map(p=>p.k)),ol:pLabel};
const CLUB_FORM = [
  {legend:["بيانات النادي","Club details"], fields:[
    {k:"name",l:["اسم النادي","Club name"],req:1,wide:1},
    {k:"type",l:["نوع المكان","Venue type"],t:"select",o:TYPES,ol:v=>tr(TYPE_EN,v)},
    {k:"host",l:["اسم الكنيسة / المدرسة / الحضانة","Church / school / nursery name"]},
    {k:"city",l:["المدينة","City"],t:"select",o:CITIES,ol:v=>tr(CITY_EN,v)},
    {k:"area",l:["المنطقة / الحي","Area"]},
    {k:"address",l:["العنوان بالتفصيل","Full address"],wide:1},
    {k:"meetingDay",l:["يوم الاجتماع","Meeting day"],t:"select",o:DAYS,ol:v=>tr(DAY_EN,v)},
    {k:"meetingTime",l:["وقت الاجتماع","Meeting time"],t:"time"},
    {k:"startDate",l:["تاريخ تأسيس النادي","Club start date"],t:"date"},
    {k:"capacity",l:["السعة المتوقعة (عدد الأطفال)","Expected capacity (children)"],t:"number"},
    {k:"programs",l:["المراحل الموجودة في النادي","Programs in this club"],t:"programs",wide:1},
    {k:"phone",l:["هاتف النادي","Club phone"],t:"tel"},
    {k:"email",l:["البريد الإلكتروني","Email"],t:"email"},
    {k:"photo",l:["لوجو النادي","Club logo"],t:"photo",wide:1},
    {k:"notes",l:["ملاحظات عن النادي","Notes"],t:"textarea",wide:1},
  ]},
  {legend:["مدير النادي","Club director"], fields:[
    {k:"dirName",l:["اسم المدير","Director name"]},
    {k:"dirPhone",l:["رقم الهاتف","Phone"],t:"tel"},
    {k:"dirEmail",l:["البريد الإلكتروني","Email"],t:"email"},
    {k:"dirJob",l:["المهنة","Occupation"]},
    {k:"dirChurch",l:["الكنيسة التابع لها","Home church"]},
    {k:"dirSince",l:["مدير منذ","Director since"],t:"date"},
    {k:"dirTraining",l:["التدريبات التي حضرها","Trainings attended"],wide:1},
    {k:"dirPhoto",l:["صورة المدير","Director photo"],t:"photo",wide:1},
    {k:"dirNotes",l:["ملاحظات عن المدير","Notes"],t:"textarea",wide:1},
  ]},
];
const LEADER_FORM = [{legend:["بيانات المسؤول","Leader details"], fields:[
  {k:"name",l:["الاسم الكامل","Full name"],req:1,wide:1},
  {k:"role",l:["الدور في النادي","Role"],t:"select",o:ROLES,ol:v=>tr(ROLE_EN,v)},
  {k:"program",l:["المرحلة التي يخدم فيها","Program"],...progOpts},
  {k:"phone",l:["رقم الهاتف","Phone"],t:"tel"},
  {k:"email",l:["البريد الإلكتروني","Email"],t:"email"},
  {k:"birthdate",l:["تاريخ الميلاد","Date of birth"],t:"date"},
  {k:"joined",l:["بدأ الخدمة في","Serving since"],t:"date"},
  {k:"job",l:["المهنة","Occupation"]},
  {k:"church",l:["الكنيسة","Church"]},
  {k:"training",l:["التدريبات التي حضرها","Trainings attended"],wide:1},
  {k:"photo",l:["الصورة","Photo"],t:"photo",wide:1},
  {k:"notes",l:["ملاحظات","Notes"],t:"textarea",wide:1},
]}];
function kidFormDef(isEdit){
  const clubField = isEdit && S.canTransfer ? [{k:"clubId",l:["النادي (للنقل لنادٍ آخر)","Club (to transfer)"],t:"select",o:S.clubs.map(c=>c.id),ol:id=>(club(id)||{}).name||id,wide:1}] : [];
  return [
  {legend:["بيانات الطفل","Child details"], fields:[
    {k:"name",l:["اسم الطفل الكامل","Child's full name"],req:1,wide:1},
    ...clubField,
    {k:"gender",l:["الجنس","Gender"],t:"select",o:["","ولد","بنت"],ol:v=>v?tr(GENDER_EN,v):"—"},
    {k:"birthdate",l:["تاريخ الميلاد","Date of birth"],t:"date"},
    {k:"program",l:["المرحلة هذه السنة","Program this year"],...progOpts},
    {k:"grade",l:["الصف الدراسي","School grade"]},
    {k:"school",l:["المدرسة","School"]},
    {k:"church",l:["الكنيسة","Church"]},
    {k:"joined",l:["تاريخ الانضمام للنادي","Joined the club on"],t:"date"},
    {k:"status",l:["الحالة","Status"],t:"select",o:Object.keys(STATUS_EN),ol:v=>tr(STATUS_EN,v)},
    {k:"photo",l:["صورة الطفل","Child photo"],t:"photo",wide:1},
  ]},
  {legend:["الأهل والتواصل","Parents & contact"], fields:[
    {k:"parentName",l:["اسم ولي الأمر","Parent / guardian"]},
    {k:"parentPhone",l:["هاتف ولي الأمر","Parent phone"],t:"tel"},
    {k:"parent2",l:["ولي أمر ثانٍ / هاتف بديل","Second contact / phone"]},
    {k:"address",l:["العنوان","Address"]},
    {k:"photoOk",l:["موافقة الأهل على تصوير الطفل ونشر صوره","Parent consent for photos"],t:"select",o:["","yes","no"],ol:v=>L(...CONSENT[v]),wide:1},
    {k:"health",l:["ملاحظات صحية / حساسية (لا تظهر لحساب العرض)","Health notes / allergies (hidden from view-only)"],t:"textarea",wide:1},
  ]},
  {legend:["الكتيّب والجوائز","Handbook & awards"], fields:[
    {k:"book",l:["الكتيّب الحالي","Current handbook"]},
    {k:"awards",l:["الجوائز والشارات (افصل بفاصلة)","Awards & badges (comma separated)"],wide:1,ph:["مثال: شارة الكتيّب الأول، جائزة الحضور الكامل","e.g. First book badge, Perfect attendance"]},
    {k:"notes",l:["ملاحظات","Notes"],t:"textarea",wide:1},
  ]},
  {legend:["رصيد سابق (قبل استخدام البرنامج)","Earlier balance (before using this app)"], hint:["النقاط والأقسام والآيات تُسجَّل أسبوعياً من صفحة الأسبوع. هذه الخانات فقط لرصيد الطفل من السنين السابقة.","Points, sections and verses are recorded weekly on the meeting page. Use these only for a child's balance from earlier years."], fields:[
    {k:"points",l:["نقاط سابقة","Earlier points"],t:"number"},
    {k:"sections",l:["أقسام مكتملة سابقاً","Earlier sections"],t:"number"},
    {k:"verses",l:["آيات محفوظة سابقاً","Earlier verses"],t:"number"},
  ]}];
}
const WEEK_FORM = [{legend:["بيانات الأسبوع","Meeting details"], fields:[
  {k:"date",l:["تاريخ الاجتماع","Meeting date"],t:"date",req:1},
  {k:"title",l:["عنوان / موضوع الأسبوع","Title / theme"]},
  {k:"theme",l:["ليلة مميزة (اختياري)","Special night (optional)"],ph:["مثال: ليلة الألوان، ليلة الأبطال","e.g. Crazy Hair Night"]},
  {k:"visitors",l:["عدد الزوار","Visitors"],t:"number"},
  {k:"leadersCount",l:["مسؤولون إضافيون غير مسجّلين (متطوعون/ضيوف)","Extra helpers not on the leader list"],t:"number"},
  {k:"lesson",l:["الدرس / الآية الأساسية","Lesson / key verse"],wide:1},
  {k:"notes",l:["ملاحظات عن الاجتماع","Meeting notes"],t:"textarea",wide:1},
]}];

// ================= state =================
const S = {raw:{clubs:[],kids:[],leaders:[],weeks:[]}, clubs:[],kids:[],leaders:[],weeks:[], priv:{}, sessions:[], keys:null, trash:[], audit:[], meta:{},
  loaded:{clubs:0,kids:0,leaders:0,weeks:0},
  route:{v:"home"}, q:"", typeF:"", kidQ:"", progF:"", season:"", repClub:"", repMonth:"", auditF:"",
  canWrite:false, canUpload:false, canTransfer:false, isOwner:false, isClub:false, err:""};
let fs=null, auth=null, APP=null, CFG=null, ROLE="", CLUB_ID="", unsubs=[], loggingIn=false, pendingMsg="";
let assets=null;

// ================= helpers =================
const $ = (s,el=document)=>el.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = Number(v); return isFinite(n)?n:0; };
const loc = () => LANG==="en"?"en-GB":"ar-JO";
const fmtDate = d => { if(!d) return ""; try{ return new Date(d+"T00:00:00").toLocaleDateString(loc(),{day:"numeric",month:"long",year:"numeric"}); }catch{ return d; } };
const fmtDateShort = d => { if(!d) return ""; try{ return new Date(d+"T00:00:00").toLocaleDateString(loc(),{day:"numeric",month:"short"}); }catch{ return d; } };
const fmtStamp = iso => { if(!iso) return ""; try{ return new Date(iso).toLocaleString(loc(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }catch{ return iso; } };
const monthName = ym => { try{ const [y,m]=ym.split("-").map(Number); return new Date(y,m-1,1).toLocaleDateString(loc(),{month:"short",year:"2-digit"}); }catch{ return ym; } };
const age = (b,at) => { if(!b) return ""; const d=new Date(b+"T00:00:00"), n=at?new Date(at+"T00:00:00"):new Date(); let a=n.getFullYear()-d.getFullYear(); if(n.getMonth()<d.getMonth()||(n.getMonth()==d.getMonth()&&n.getDate()<d.getDate())) a--; return a>=0&&a<100?a:""; };
const initial = s => (String(s||"?").replace(/^\s*(نادي|نادٍ|أندية|awana)\s+(أوانا\s*[–-]?\s*)?/i,"").trim()[0]||"?");
const pgChip = k => PMAP[k] ? `<span class="pg" style="--c:var(${PMAP[k].c})">${esc(PMAP[k].n)}</span>` : "";
const hue = s => { let h=0; for(const ch of String(s||"")) h=(h*31+ch.charCodeAt(0))>>>0; return "c"+(h%4); };
const avatar = (photo,name,cls="") => `<span class="avatar ${hue(name)} ${cls}">${photo?`<img data-ph="${esc(photo)}" alt="">`:esc(initial(name))}</span>`;
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const nowIso = () => new Date().toISOString();
const SEP = () => L("‹","›");
const norm = s => String(s??"").toLowerCase().replace(/[ً-ٰٟـ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s+/g," ").trim();
const digits = s => norm(s).replace(/\D/g,"").slice(-8);
const has = (parts,q) => norm(parts.join(" ")).includes(norm(q));
const seasonOf = d => { if(!d) return ""; const [y,m]=String(d).split("-").map(Number); if(!y) return ""; const s=m>=8?y:y-1; return s+"–"+(s+1); };
const curSeason = () => seasonOf(today());
const isActive = k => (k.status||"نشط")==="نشط";
const noPhoto = k => k.photoOk==="no";
const presentIn = (w,id) => !!(w.present||{})[id];
const presentCount = w => Object.values(w.present||{}).filter(Boolean).length;
const leaderIn = (w,id) => !!(w.leadersPresent||{})[id];
const leadersCountOf = w => Object.values(w.leadersPresent||{}).filter(Boolean).length + num(w.leadersCount);
const BY = () => ROLE==="club" ? "club:"+CLUB_ID : ROLE;
const byLabel = b => { b=String(b||""); if(b.startsWith("club:")){ const c=S.raw.clubs.find(x=>x.id===b.slice(5)); return accLabel("club")+(c?" – "+c.name:""); } return accLabel(b)||b; };
const sameJSON = (a,b) => JSON.stringify(a??"")===JSON.stringify(b??"");

const ICON = {
  plus:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  edit:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
  x:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  cam:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  nocam:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><path d="M3 3l18 18"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  dl:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
  up:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"/></svg>',
  trash:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  lock:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  gear:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  phone:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M12 18h.01"/></svg>',
  globe:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>',
  copy:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>',
  chart:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  undo:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  star:'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
};
let toastT;
function toast(msg){ let t=$("#toast"); if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");document.body.appendChild(t);} t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3600); }
function dbErr(e){ const c=e&&e.code; if(c==="permission-denied") return L("هذا الحساب لا يملك صلاحية هذا الإجراء.","This account isn't allowed to do that."); if(c==="resource-exhausted") return L("تم تجاوز الحد المجاني اليومي أو امتلأت المساحة. حاول غداً أو راجع Firebase.","The free daily limit or storage is used up. Try tomorrow or check Firebase."); if(c==="unavailable") return L("لا يوجد اتصال. سيتم الحفظ تلقائياً عند عودة الإنترنت.","No connection. Changes will sync when you're back online."); return L("تعذّر الحفظ. تحقّق من الاتصال ثم حاول مجدداً.","Couldn't save. Check your connection and try again."); }
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast(L("تم النسخ","Copied")); }catch{ toast(t); } }

// serialized writes per doc; offline writes are queued by Firestore and sent later
const chains = {};
function write(path, fn){
  const p=(chains[path]||Promise.resolve()).catch(()=>{}).then(fn); chains[path]=p;
  if(!navigator.onLine){ p.catch(e=>toast(dbErr(e))); toast(L("لا يوجد إنترنت: تم الحفظ على الجهاز وسيُرسل تلقائياً عند عودة الاتصال.","Offline: saved on this device and will sync when you're back online.")); return Promise.resolve(); }
  return p;
}
const saveDoc = (col,id,data) => write(col+"/"+id, ()=>setDoc(doc(fs,col,id),data));
const updDoc  = (col,id,data) => write(col+"/"+id, ()=>updateDoc(doc(fs,col,id),data));
function newId(col){ return doc(collection(fs,col)).id; }

// ---- #1 activity log: every account writes under its own name; the rules reject forged names ----
function audit(action, col, id, name, clubId, extra){
  if(!S.canWrite) return;
  const d={at:nowIso(), by:BY(), action, col:col||"", ref:id||"", name:String(name||"").slice(0,120), clubId:clubId||""};
  if(extra) d.extra=String(extra).slice(0,300);
  setDoc(doc(collection(fs,"audit")), d).catch(()=>{});
}

// ================= photos =================
const phCache = new Map();
function loadPhoto(id, full){
  const key=(full?"f:":"t:")+id;
  if(!phCache.has(key)) phCache.set(key, getDoc(doc(fs, full?"photos":"thumbs", id)).then(d=>d.exists()?d.data().data:"").catch(()=>{ phCache.delete(key); return ""; }));
  return phCache.get(key);
}
function hydrate(root=document){
  root.querySelectorAll("img[data-ph]:not([src]),img[data-full]:not([src])").forEach(img=>{
    const full=!!img.dataset.full, id=img.dataset.full||img.dataset.ph;
    loadPhoto(id,full).then(src=>{ if(src) img.src=src; else img.classList.add("missing"); });
  });
}
new MutationObserver(()=>{ if(fs&&ROLE) hydrate(); }).observe(document.body,{childList:true,subtree:true});
function toJpeg(bmp, max, q){
  const r=Math.min(1, max/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(bmp.width*r)); c.height=Math.max(1,Math.round(bmp.height*r));
  const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(bmp,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",q);
}
async function makeJpegs(fileOrBlob){
  let bmp; try{ bmp=await createImageBitmap(fileOrBlob); }catch{ throw {code:"unsupported_type"}; }
  let full=""; for(const [m,q] of [[1280,.78],[1280,.65],[1024,.62],[900,.55],[720,.5]]){ full=toJpeg(bmp,m,q); if(full.length<900000) break; }
  if(full.length>=900000) throw {code:"too_large"};
  return {full, thumb:toJpeg(bmp,360,.7)};
}
async function uploadImage(file, clubId){
  if(!assets) throw {code:"not_granted"};
  if(!navigator.onLine) throw {code:"offline"};
  const {full,thumb}=await makeJpegs(file);
  const id=newId("photos"), meta={createdAt:nowIso(), by:BY(), clubId:clubId||CLUB_ID||""};
  await setDoc(doc(fs,"thumbs",id),{data:thumb,...meta});
  await setDoc(doc(fs,"photos",id),{data:full,...meta});
  phCache.set("t:"+id,Promise.resolve(thumb)); phCache.set("f:"+id,Promise.resolve(full));
  return id;
}
// photos nobody points at any more: the admin deletes them; anyone else sends them to the admin's trash
function dropAssets(ids, info={}){
  ids=[...new Set(ids.filter(Boolean))]; if(!ids.length||!assets) return;
  if(S.isOwner) return purgePhotos(ids);
  for(const id of ids) setDoc(doc(collection(fs,"trash")),{type:"unused",photoId:id,label:info.label||"",clubId:info.clubId||"",at:nowIso(),by:BY()}).catch(()=>{});
}
function purgePhotos(ids){ for(const id of new Set(ids.filter(Boolean))){ deleteDoc(doc(fs,"photos",id)).catch(()=>{}); deleteDoc(doc(fs,"thumbs",id)).catch(()=>{}); phCache.delete("t:"+id); phCache.delete("f:"+id); } }
function upErr(e){ const c=e&&e.code; return c==="too_large"?L("تعذّر ضغط الصورة بما يكفي. جرّب صورة أخرى.","Couldn't shrink this photo enough. Try another one."):c==="unsupported_type"?L("نوع الصورة غير مدعوم. استخدم JPG أو PNG.","Unsupported image type. Use JPG or PNG."):c==="resource-exhausted"?L("امتلأت المساحة المجانية أو تجاوزت حد اليوم.","Free storage or today's limit is used up."):c==="permission-denied"||c==="not_granted"?L("رفع الصور غير مسموح لهذا الحساب.","This account can't upload photos."):c==="offline"?L("رفع الصور يحتاج اتصال بالإنترنت.","Uploading photos needs an internet connection."):L("تعذّر رفع الصورة. تحقّق من الاتصال وحاول مجدداً.","Upload failed. Check your connection and try again."); }

// ================= derived data =================
const alive = x => !x.deleted;
function recompute(){
  S.clubs = S.raw.clubs.filter(alive);
  const live = new Set(S.clubs.map(c=>c.id));
  for(const col of ["kids","leaders","weeks"]) S[col] = S.raw[col].filter(x=>alive(x)&&live.has(x.clubId));
}
const club = id => S.clubs.find(c=>c.id===id);
const clubKids = id => S.kids.filter(k=>k.clubId===id);
const clubLeaders = id => S.leaders.filter(k=>k.clubId===id);
const clubWeeksAll = id => S.weeks.filter(k=>k.clubId===id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
const inSeason = w => !S.season||seasonOf(w.date)===S.season;
const clubWeeks = id => clubWeeksAll(id).filter(inSeason);
// #13 a child keeps attendance from every club they belonged to
function memberAt(k,w){
  const h=k.clubHistory;
  if(!h||!h.length) return w.clubId===k.clubId && (!k.joined||String(w.date)>=k.joined);
  return h.some(e=>e.clubId===w.clubId && (!e.from||String(w.date)>=e.from) && (!e.to||String(w.date)<=e.to));
}
const kidWeeks = (k,season) => S.weeks.filter(w=>(!season||seasonOf(w.date)===season) && memberAt(k,w));
function kidStats(k, season){
  let pts=0,sec=0,vrs=0,n=0,of=0;
  for(const w of kidWeeks(k,season)){
    of++; if(presentIn(w,k.id)) n++;
    const p=(w.progress||{})[k.id]; if(p){ pts+=num(p.pts); sec+=num(p.sec); vrs+=num(p.vrs); }
  }
  return {pts,sec,vrs,n,of,p:of?Math.round(n*100/of):null};
}
function kidTotal(k){ const a=kidStats(k,""); return {pts:a.pts+num(k.points), sec:a.sec+num(k.sections), vrs:a.vrs+num(k.verses)}; }
function leaderStats(id, clubId, season){ const ws=S.weeks.filter(w=>w.clubId===clubId&&(!season||seasonOf(w.date)===season)); const n=ws.filter(w=>leaderIn(w,id)).length; return {n,of:ws.length,p:ws.length?Math.round(n*100/ws.length):null}; }
function seasons(){ const s=new Set([curSeason()]); S.weeks.forEach(w=>{ const x=seasonOf(w.date); if(x) s.add(x); }); return [...s].sort().reverse(); }
const seasonLabel = s => s ? L("سنة ","Year ")+s : L("كل السنوات","All years");
function seasonSelect(){ return `<label class="season"><span>${L("السنة","Year")}</span><select id="seasonSel">${seasons().map(s=>`<option value="${s}" ${s===S.season?"selected":""}>${s}${s===curSeason()?L(" (الحالية)"," (current)"):""}</option>`).join("")}<option value="" ${!S.season?"selected":""}>${L("كل السنوات","All years")}</option></select></label>`; }

// ================= header tools =================
let installEvt=null;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const canInstall = () => !isStandalone() && (!!installEvt || isIOS());
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); installEvt=e; renderTools(); if(!ROLE&&fs) loginView(pendingMsg); });
window.addEventListener("appinstalled",()=>{ installEvt=null; renderTools(); toast(L("تم تثبيت التطبيق","App installed")); });
function simpleModal(title, body, foot){
  $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><div class="modal" role="dialog" aria-modal="true">
    <div class="modal-h"><h2>${title}</h2><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
    <div class="modal-b">${body}</div>${foot?`<div class="modal-f">${foot}</div>`:""}</div></div>`;
}
async function doInstall(){
  if(installEvt){ installEvt.prompt(); try{ await installEvt.userChoice; }catch{} installEvt=null; renderTools(); return; }
  // #8 iPhone keeps the installed app's sign-in separate from Safari
  simpleModal(L("تثبيت التطبيق على الآيفون","Install on iPhone / iPad"), `<div class="install-steps">
      <div class="istep"><b>1</b><span>${L("افتح الرابط من متصفح Safari.","Open this link in Safari.")}</span></div>
      <div class="istep"><b>2</b><span>${L("اضغط زر المشاركة (المربع والسهم لأعلى) أسفل الشاشة.","Tap the Share button (square with an up arrow).")}</span></div>
      <div class="istep"><b>3</b><span>${L("اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».","Choose “Add to Home Screen”, then “Add”.")}</span></div>
      <div class="istep"><b>4</b><span>${L("افتح أيقونة Awana Jordan واختر حسابك واكتب كلمة المرور مرة واحدة. الآيفون بيعتبر التطبيق المثبّت جهاز جديد.","Open the Awana Jordan icon, choose your account and enter the password once. iPhone treats the installed app as a new device.")}</span></div>
    </div>${ROLE==="club"?`<p class="note">${L("رمز ناديك (هتحتاجه للدخول من التطبيق المثبّت):","Your club code (needed to sign in from the installed app):")} <b class="mono sel">${esc(CLUB_ID)}</b></p>`:""}`);
  $("#modalRoot").onclick=e=>{ if(e.target.id==="scrim"||e.target.closest("[data-close]")) closeModal(); };
}
function renderTools(){
  const el=$("#tools"); if(!el) return;
  const c=ROLE==="club"&&club(CLUB_ID);
  el.innerHTML=`${canInstall()?`<button type="button" class="tbtn" data-install>${ICON.phone}<span>${L("تثبيت التطبيق","Install app")}</span></button>`:""}
    <button type="button" class="tbtn" data-lang>${ICON.globe}<span>${L("English","عربي")}</span></button>
    ${ROLE?`<button type="button" class="tbtn" data-reports>${ICON.chart}<span>${L("التقارير","Reports")}</span></button>`:""}
    ${S.isOwner?`<button type="button" class="tbtn" data-settings>${ICON.gear}<span>${L("الإعدادات","Settings")}</span></button>`:""}
    ${ROLE?`<span class="role">${esc(accLabel(ROLE))}${c?" – "+esc(c.name):""} · <button type="button" class="linkbtn" data-logout>${L("خروج","Sign out")}</button></span>`:""}`;
}
function setLang(l){
  LANG=l; try{ localStorage.setItem("awana-lang",l); }catch{}
  applyLang(); renderTools();
  if($("#modalRoot").firstChild) closeModal();
  if(ROLE) render(); else if(fs) loginView(pendingMsg);
}

// ================= routing & render =================
function go(r){ S.route=r; window.scrollTo(0,0); render(); }
$("#goHome").onclick=()=>{ if(ROLE) go({v:"home"}); };
function render(){
  if(!ROLE) return;
  const app=$("#app"); const r=S.route;
  const ae=document.activeElement; const focusId = ae && ae.id;
  let caret=null; try{ caret=ae.selectionStart; }catch{}
  if(S.isClub && (r.v==="home"||(r.v==="club"&&r.id!==CLUB_ID))) S.route={v:"club",id:CLUB_ID,tab:r.v==="club"?r.tab:"info"};
  if(S.route.v==="club" && !club(S.route.id) && S.loaded.clubs && !S.isClub) S.route={v:"home"};
  if(S.route.v==="week" && !S.weeks.find(w=>w.id===S.route.id) && S.loaded.weeks) S.route={v:"club",id:S.route.clubId,tab:"weeks"};
  if(S.route.v==="settings" && !S.isOwner) S.route={v:"home"};
  const v=S.route.v;
  app.innerHTML = v==="home"?homeView(): v==="club"?clubView(): v==="settings"?settingsView(): v==="reports"?reportsView(): weekView();
  if(focusId){ const el=document.getElementById(focusId); if(el && el!==document.activeElement){ el.focus(); try{ if(caret!=null) el.setSelectionRange(caret,caret);}catch{} } }
}
const heroTitle = () => LANG==="en" ? `<span class="w1">Awana</span> <span class="w2">Clubs</span> <span class="w3">Jordan</span>` : `<span class="w1">أندية</span> <span class="w2">أوانا</span> في <span class="w3">الأردن</span>`;
const crumbRoot = () => S.isClub ? "" : `<button type="button" data-home>${L("كل الأندية","All clubs")}</button><span>${SEP()}</span>`;

// #6 backup reminder
function backupBanner(){
  if(!(S.isOwner||ROLE==="jordan")||!S.loaded.clubs||!S.clubs.length) return "";
  const last=S.meta.backup&&S.meta.backup.lastAt; const days=last?Math.floor((Date.now()-new Date(last))/864e5):null;
  if(days!=null&&days<30) return "";
  return `<div class="banner warnb">${ICON.dl} <span>${days==null?L("لم يتم تحميل أي نسخة احتياطية بعد.","No backup has been downloaded yet."):L(`آخر نسخة احتياطية من ${days} يوم.`,`Last backup was ${days} days ago.`)}</span> <button type="button" class="btn sm" data-act="backup">${L("حمّل نسخة الآن","Download one now")}</button></div>`;
}
function backupPanel(){
  const last=S.meta.backup&&S.meta.backup.lastAt;
  return `<section class="panel backup">
    <h2>${L("النسخ الاحتياطي","Backup")}</h2>
    <p class="muted small">${L("ملف فيه كل بيانات الأندية والمسؤولين والأطفال والأسابيع والحضور. احفظه كل شهر في مكان آمن.","A file with every club, leader, child, meeting and attendance record. Save one every month somewhere safe.")}${last?` ${L("آخر نسخة:","Last backup:")} ${esc(fmtStamp(last))}.`:""}</p>
    <div class="actions"><button class="btn" type="button" data-act="backup">${ICON.dl} ${L("تحميل نسخة احتياطية (البيانات)","Download backup (data)")}</button>
    ${S.isOwner?`<button class="btn" type="button" data-act="backupFull">${ICON.dl} ${L("نسخة كاملة بالصور (ZIP)","Full backup with photos (ZIP)")}</button><label class="btn">${ICON.up} ${L("استرجاع من نسخة احتياطية","Restore from backup")}<input id="restoreInput" type="file" accept=".json,.zip,application/json,application/zip" hidden></label>`:""}</div>
  </section>`;
}

function homeView(){
  const kidsActive = S.kids.filter(isActive).length;
  const sw = S.weeks.filter(inSeason);
  const photos = sw.reduce((s,w)=>s+(w.photos||[]).length,0);
  const q=S.q.trim();
  let list = S.clubs.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  if(S.typeF) list=list.filter(c=>c.type===S.typeF);
  if(q) list=list.filter(c=>has([c.name,c.host,c.city,tr(CITY_EN,c.city),c.area,c.dirName],q));
  const kq=S.kidQ.trim();
  const kidHits = kq ? S.kids.filter(k=>has([k.name,k.parentName,k.parentPhone,k.parent2],kq)).slice(0,30) : [];
  return `${backupBanner()}
  <div class="hero">
    <div><h1>${heroTitle()}</h1><p>${L("كل الأندية، مديروها، مسؤولوها وأطفالها، وألبوم كل أسبوع في مكان واحد.","Every club, its director, leaders and children, plus each week's album, in one place.")}</p></div>
    <div class="actions">${seasonSelect()}${S.canWrite?`<button class="btn pri" data-act="newClub" type="button">${ICON.plus} ${L("إضافة نادٍ","Add club")}</button>`:""}</div>
  </div>
  <div class="stats">
    <div class="stat"><b>${S.clubs.length}</b><span>${L("نادٍ","Clubs")}</span></div>
    <div class="stat"><b>${kidsActive}</b><span>${L("طفل نشط","Active children")}</span></div>
    <div class="stat"><b>${S.leaders.length+S.clubs.filter(c=>c.dirName).length}</b><span>${L("مدير ومسؤول","Directors & leaders")}</span></div>
    <div class="stat"><b>${sw.length}</b><span>${L("أسبوع","Meetings")} · ${photos} ${L("صورة","photos")} · ${esc(seasonLabel(S.season))}</span></div>
  </div>
  <div class="bar">
    <div class="search">${ICON.search}<input id="qClubs" type="search" placeholder="${L("ابحث عن نادٍ، مدينة، أو مدير…","Search clubs, cities or directors…")}" value="${esc(S.q)}" aria-label="${L("بحث في الأندية","Search clubs")}"></div>
    <div class="chips" role="group">
      <button class="chip" type="button" data-type="" aria-pressed="${!S.typeF}">${L("الكل","All")}</button>
      ${TYPES.map(t=>`<button class="chip" type="button" data-type="${t}" aria-pressed="${S.typeF===t}">${tr(TYPE_EN,t)}</button>`).join("")}
    </div>
  </div>
  ${!S.loaded.clubs?`<p class="muted">${L("جارٍ تحميل الأندية…","Loading clubs…")}</p>`:
    !S.clubs.length?`<div class="empty"><h3>${L("لا توجد أندية بعد","No clubs yet")}</h3><p>${L("ابدأ بإضافة أول نادٍ: اسمه، نوع المكان (كنيسة، مدرسة، حضانة)، المدينة، وبيانات مديره. بعدها تضيف المسؤولين والأطفال وصور كل أسبوع.","Start with your first club: its name, venue type (church, school, nursery), city and director. Then add leaders, children and each week's photos.")}</p>${S.canWrite?`<button class="btn pri" data-act="newClub" type="button">${ICON.plus} ${L("إضافة أول نادٍ","Add the first club")}</button>`:""}</div>`:
    !list.length?`<p class="muted">${L("لا توجد أندية مطابقة للبحث.","No clubs match your search.")}</p>`:
    `<div class="grid">${list.map(clubCard).join("")}</div>`}
  ${S.kids.length?`
  <h2 class="sec-h">${L("البحث عن طفل في كل الأندية","Find a child in any club")}</h2>
  <div class="bar"><div class="search">${ICON.search}<input id="qKids" type="search" placeholder="${L("اسم الطفل أو ولي الأمر أو رقم الهاتف","Child, parent or phone number")}" value="${esc(S.kidQ)}" aria-label="${L("بحث عن طفل","Find a child")}"></div></div>
  ${kq?(kidHits.length?`<div class="list">${kidHits.map(k=>kidRow(k,true)).join("")}</div>`:`<p class="muted">${L("لا يوجد طفل بهذا الاسم.","No child found.")}</p>`):""}`:""}
  ${S.loaded.clubs?backupPanel():""}`;
}
function clubCard(c){
  const ks=clubKids(c.id).filter(isActive).length, ls=clubLeaders(c.id).length, ws=clubWeeks(c.id);
  return `<button class="card-btn" type="button" data-open-club="${esc(c.id)}">
    <div class="club-head">${avatar(c.photo,c.name,c.photo?"logo":"")}<div style="min-width:0"><h3>${esc(c.name)}</h3>
      <div class="meta">${c.type?`<span class="type-pill">${esc(tr(TYPE_EN,c.type))}</span>`:""}${c.city?`<span>${esc(tr(CITY_EN,c.city))}${c.area?" – "+esc(c.area):""}</span>`:""}</div></div></div>
    ${c.dirName?`<div class="meta"><span>${L("المدير:","Director:")} <b style="color:var(--ink)">${esc(c.dirName)}</b></span>${c.meetingDay?`<span>${esc(tr(DAY_EN,c.meetingDay))} ${esc(c.meetingTime||"")}</span>`:""}</div>`:""}
    ${(c.programs||[]).length?`<div class="prog-dots">${c.programs.map(pgChip).join("")}</div>`:""}
    <div class="club-nums"><span><b>${ks}</b> ${L("طفل","children")}</span><span><b>${ls}</b> ${L("مسؤول","leaders")}</span><span><b>${ws.length}</b> ${L("أسبوع","meetings")}</span>${ws[0]?`<span>${L("آخر اجتماع","Last")} ${esc(fmtDateShort(ws[0].date))}</span>`:""}</div>
  </button>`;
}
function kidRow(k,showClub){
  const st=kidStats(k,S.season), c=club(k.clubId), a=age(k.birthdate);
  return `<button class="row" type="button" data-open-kid="${esc(k.id)}">
    ${avatar(k.photo,k.name,"round")}
    <span class="grow"><span class="name">${esc(k.name)}</span>
      <span class="meta">${pgChip(k.program)}${a!==""?`<span>${a} ${L("سنة","yrs")}</span>`:""}${k.book?`<span>${esc(k.book)}</span>`:""}${showClub&&c?`<span>${esc(c.name)}</span>`:""}${!isActive(k)?`<span class="type-pill">${esc(tr(STATUS_EN,k.status))}</span>`:""}${noPhoto(k)?`<span class="warn">${ICON.nocam} ${L("ممنوع التصوير","No photos")}</span>`:""}</span></span>
    <span class="end"><span class="pts">${st.pts}</span><span>${L("نقطة","pts")}</span>${st.p!=null?`<span class="meter"><i style="width:${st.p}%"></i></span><span>${L("حضور","Att.")} ${st.p}%</span>`:""}</span>
  </button>`;
}

function clubView(){
  const c=club(S.route.id); if(!c) return `<p class="muted">${L("جارٍ التحميل…","Loading…")}</p>`;
  const tab=S.route.tab||"info";
  const kids=clubKids(c.id), leaders=clubLeaders(c.id), weeks=clubWeeks(c.id);
  const tabs=[["info",L("نظرة عامة","Overview")],["leaders",L("المدير والمسؤولين","Director & leaders"),leaders.length+(c.dirName?1:0)],["kids",L("الأطفال","Children"),kids.length],["weeks",L("الأسابيع والصور","Meetings & photos"),weeks.length]];
  const body = tab==="info"?clubInfo(c,kids,weeks): tab==="leaders"?leadersTab(c,leaders): tab==="kids"?kidsTab(c,kids): weeksTab(c,weeks);
  return `<nav class="crumbs">${crumbRoot()}<span>${esc(c.name)}</span></nav>
  <div class="profile">${avatar(c.photo,c.name,"lg"+(c.photo?" logo":""))}
    <div class="txt"><h1>${esc(c.name)}</h1><div class="meta">${c.type?`<span class="type-pill">${esc(tr(TYPE_EN,c.type))}</span>`:""}${c.host?`<span>${esc(c.host)}</span>`:""}${c.city?`<span>${esc(tr(CITY_EN,c.city))}${c.area?" – "+esc(c.area):""}</span>`:""}${c.meetingDay?`<span>${L("كل","Every")} ${esc(tr(DAY_EN,c.meetingDay))} ${esc(c.meetingTime||"")}</span>`:""}</div></div>
    <div class="actions">${seasonSelect()}${S.canWrite?`<button class="btn" type="button" data-act="editClub">${ICON.edit} ${L("تعديل بيانات النادي","Edit club")}</button>`:""}</div>
  </div>
  <div class="tabs" role="tablist">${tabs.map(([k,l,n])=>`<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${tab===k}">${l}${n!=null?`<span class="n">${n}</span>`:""}</button>`).join("")}</div>
  ${body}`;
}
function kv(pairs){ const rows=pairs.filter(([,v])=>v!==undefined&&v!==null&&v!==""); return rows.length?`<dl class="kv">${rows.map(([k,v,sel])=>`<dt>${k}</dt><dd${sel?' class="sel"':""}>${esc(v)}</dd>`).join("")}</dl>`:`<p class="muted small">${L("لم تُضف بيانات بعد.","Nothing added yet.")}</p>`; }
function clubInfo(c,kids,weeks){
  const active=kids.filter(isActive);
  const byProg=PROGRAMS.map(p=>[p,active.filter(k=>k.program===p.k).length]).filter(([,n])=>n);
  const last4=weeks.slice(0,4);
  const avgAtt = last4.length? Math.round(last4.reduce((s,w)=>s+presentCount(w),0)/last4.length):null;
  const vrs = weeks.reduce((s,w)=>s+Object.values(w.progress||{}).reduce((a,p)=>a+num(p.vrs),0),0);
  const noCam = active.filter(noPhoto);
  return `<div class="cols">
    <section class="panel"><h2>${L("بيانات النادي","Club details")}</h2>${kv([[L("نوع المكان","Venue"),tr(TYPE_EN,c.type)],[L("الجهة","Host"),c.host],[L("المدينة","City"),tr(CITY_EN,c.city)],[L("المنطقة","Area"),c.area],[L("العنوان","Address"),c.address],[L("يوم الاجتماع","Meeting day"),tr(DAY_EN,c.meetingDay)],[L("الوقت","Time"),c.meetingTime],[L("تأسّس في","Started"),fmtDate(c.startDate)],[L("السعة المتوقعة","Capacity"),c.capacity],[L("الهاتف","Phone"),c.phone,1],[L("البريد","Email"),c.email,1]])}
      ${(c.programs||[]).length?`<div class="prog-dots" style="margin-top:10px">${c.programs.map(pgChip).join("")}</div>`:""}
      ${c.notes?`<div class="note">${esc(c.notes)}</div>`:""}
      ${c.updatedBy?`<p class="muted small" style="margin:10px 0 0">${L("آخر تعديل:","Last edited:")} ${esc(byLabel(c.updatedBy))} · ${esc(fmtStamp(c.updatedAt))}</p>`:""}</section>
    <div style="display:grid;gap:14px;align-content:start;min-width:0">
      <section class="panel"><h2>${L("مدير النادي","Club director")}</h2>
        ${c.dirName?`<div class="club-head" style="margin-bottom:10px">${avatar(c.dirPhoto,c.dirName,"round")}<div><b>${esc(c.dirName)}</b><div class="meta">${esc(c.dirJob||"")}</div></div></div>${kv([[L("الهاتف","Phone"),c.dirPhone,1],[L("البريد","Email"),c.dirEmail,1],[L("الكنيسة","Church"),c.dirChurch],[L("مدير منذ","Since"),fmtDate(c.dirSince)],[L("التدريبات","Trainings"),c.dirTraining]])}${c.dirNotes?`<div class="note">${esc(c.dirNotes)}</div>`:""}`
        :`<p class="muted small">${L("لم تُضف بيانات المدير بعد.","No director added yet.")}</p>`}
      </section>
      <section class="panel"><h2>${L("ملخّص","Summary")} · ${esc(seasonLabel(S.season))}</h2>
        <div class="prog-stats"><div><b>${active.length}</b><span>${L("طفل نشط","active children")}</span></div><div><b>${weeks.length}</b><span>${L("أسبوع","meetings")}</span></div><div><b>${avgAtt??"—"}</b><span>${L("متوسط الحضور (آخر 4)","avg attendance (last 4)")}</span></div><div><b>${vrs}</b><span>${L("آية سُمّعت","verses recited")}</span></div></div>
        ${byProg.length?`<div class="prog-dots" style="margin-top:10px">${byProg.map(([p,n])=>`<span class="pg" style="--c:var(${p.c})">${p.n}: ${n}</span>`).join("")}</div>`:""}
        ${noCam.length?`<p class="warn-line">${ICON.nocam} ${L(`${noCam.length} طفل ممنوع تصويرهم:`,`${noCam.length} without photo consent:`)} ${noCam.map(k=>esc(k.name)).join(L("، ",", "))}</p>`:""}
      </section>
      <section class="panel"><h2>${L("تصدير إلى Excel","Export to Excel")}</h2><div class="actions">
        <button class="btn sm" type="button" data-export="kids">${ICON.dl} ${L("الأطفال","Children")}</button>
        <button class="btn sm" type="button" data-export="leaders">${ICON.dl} ${L("المسؤولين","Leaders")}</button>
        <button class="btn sm" type="button" data-export="att">${ICON.dl} ${L("سجل الحضور والنقاط","Attendance & points")}</button></div>
        <p class="muted small" style="margin:8px 0 0">${L("سجل الحضور يتصدّر لـ","Attendance is exported for ")}${esc(seasonLabel(S.season))}.</p></section>
      ${S.isClub?backupPanel():""}
    </div>
  </div>`;
}
function leadersTab(c,leaders){
  const sorted=leaders.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  const att=st=>st.p!=null?`<span class="end"><span class="meter"><i style="width:${st.p}%"></i></span><span>${L("حضور","Att.")} ${st.p}%</span></span>`:"";
  return `<div class="bar" style="justify-content:space-between"><p class="muted small" style="margin:0">${L("المدير يُعدَّل من بيانات النادي. نسبة الحضور من تحضير المسؤولين في صفحة كل أسبوع.","Edit the director from the club details. Attendance comes from the leader check-in on each meeting page.")}</p>${S.canWrite?`<button class="btn pri" type="button" data-act="newLeader">${ICON.plus} ${L("إضافة مسؤول","Add leader")}</button>`:""}</div>
  <div class="list">
    ${c.dirName?`<button class="row" type="button" ${S.canWrite?'data-act="editClub"':""}>${avatar(c.dirPhoto,c.dirName,"round")}<span class="grow"><span class="name">${esc(c.dirName)}</span><span class="meta"><span class="type-pill">${L("مدير النادي","Club director")}</span>${c.dirPhone?`<span>${esc(c.dirPhone)}</span>`:""}</span></span>${att(leaderStats("dir",c.id,S.season))}</button>`:""}
    ${sorted.map(l=>`<button class="row" type="button" data-open-leader="${esc(l.id)}">${avatar(l.photo,l.name,"round")}<span class="grow"><span class="name">${esc(l.name)}</span><span class="meta">${l.role?`<span>${esc(tr(ROLE_EN,l.role))}</span>`:""}${pgChip(l.program)}${l.phone?`<span>${esc(l.phone)}</span>`:""}</span></span>${att(leaderStats(l.id,c.id,S.season))}</button>`).join("")}
    ${!sorted.length&&!c.dirName?`<div class="empty"><h3>${L("لا يوجد مسؤولون بعد","No leaders yet")}</h3><p>${L("أضف فريق الخدمة: الاسم، الدور، المرحلة التي يخدم فيها، ووسيلة التواصل.","Add the team: name, role, program and contact details.")}</p></div>`:""}
  </div>`;
}
function kidsTab(c,kids){
  const q=S.kidQ.trim(); let list=kids.slice();
  if(S.progF) list=list.filter(k=>k.program===S.progF);
  if(q) list=list.filter(k=>has([k.name,k.parentName,k.parentPhone,k.parent2],q));
  list.sort((a,b)=>(isActive(b)-isActive(a))||String(a.name).localeCompare(String(b.name),"ar"));
  const progs=PROGRAMS.filter(p=>kids.some(k=>k.program===p.k));
  return `<div class="bar">
    <div class="search">${ICON.search}<input id="qKidsClub" type="search" placeholder="${L("ابحث باسم الطفل أو ولي الأمر","Search child or parent")}" value="${esc(S.kidQ)}" aria-label="${L("بحث عن طفل","Find a child")}"></div>
    ${S.canWrite?`<button class="btn pri" type="button" data-act="newKid">${ICON.plus} ${L("إضافة طفل","Add child")}</button>`:""}
    ${S.canWrite&&kids.some(isActive)?`<button class="btn" type="button" data-act="rollover">${ICON.star} ${L("بداية سنة جديدة","Start a new year")}</button>`:""}
  </div>
  ${progs.length>1?`<div class="chips" style="margin-bottom:10px"><button class="chip" type="button" data-prog="" aria-pressed="${!S.progF}">${L("كل المراحل","All programs")}</button>${progs.map(p=>`<button class="chip" type="button" data-prog="${p.k}" aria-pressed="${S.progF===p.k}">${p.n}</button>`).join("")}</div>`:""}
  ${kids.length?`<p class="muted small" style="margin:0 0 8px">${L("النقاط ونسبة الحضور محسوبة لـ","Points and attendance shown for ")}${esc(seasonLabel(S.season))}.</p>`:""}
  ${!kids.length?`<div class="empty"><h3>${L("لا يوجد أطفال في هذا النادي بعد","No children in this club yet")}</h3><p>${L("سجّل كل طفل ببياناته وبيانات أهله ومرحلته في أوانا، ثم تابع حضوره ونقاطه وآياته أسبوعياً.","Register each child with their details, parents and Awana program, then track attendance, points and verses every week.")}</p>${S.canWrite?`<button class="btn pri" type="button" data-act="newKid">${ICON.plus} ${L("تسجيل أول طفل","Register the first child")}</button>`:""}</div>`:
    list.length?`<div class="list">${list.map(k=>kidRow(k)).join("")}</div>`:`<p class="muted">${L("لا نتائج.","No results.")}</p>`}`;
}
function weeksTab(c,weeks){
  return `<div class="bar" style="justify-content:space-between"><p class="muted small" style="margin:0">${L("كل أسبوع له تاريخ، تحضير الأطفال والمسؤولين، النقاط، وألبوم صور. المعروض: ","Each meeting has a date, child and leader attendance, points, and a photo album. Showing: ")}${esc(seasonLabel(S.season))}.</p>${S.canWrite?`<button class="btn pri" type="button" data-act="newWeek">${ICON.plus} ${L("أسبوع جديد","New meeting")}</button>`:""}</div>
  ${!weeks.length?`<div class="empty"><h3>${L("لا توجد أسابيع في ","No meetings in ")}${esc(seasonLabel(S.season))}</h3><p>${L("بعد كل اجتماع أضف أسبوعاً جديداً: سجّل الحضور والنقاط وارفع صور اليوم.","After each club night, add a meeting: mark attendance and points and upload the day's photos.")}</p></div>`:
  `<div class="weeks">${weeks.map(w=>`<button class="card-btn" type="button" data-open-week="${esc(w.id)}">
    <div class="wk-cover">${(w.photos||[])[0]?`<img data-ph="${esc(w.photos[0])}" alt="">`:L("بدون صور","No photos")}</div>
    <div><div class="wk-date">${esc(fmtDate(w.date))}</div>${w.title?`<div style="font-weight:600">${esc(w.title)}</div>`:""}</div>
    <div class="club-nums"><span><b>${presentCount(w)}</b> ${L("حاضر","present")}</span><span><b>${leadersCountOf(w)}</b> ${L("مسؤول","leaders")}</span><span><b>${(w.photos||[]).length}</b> ${L("صورة","photos")}</span></div>
  </button>`).join("")}</div>`}`;
}

function weekView(){
  const w=S.weeks.find(x=>x.id===S.route.id); const c=w&&club(w.clubId);
  if(!w||!c) return `<p class="muted">${L("جارٍ التحميل…","Loading…")}</p>`;
  const kids=S.kids.filter(k=>(isActive(k)&&memberAt(k,w))||presentIn(w,k.id)).sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  const groups=PROGRAMS.map(p=>[p,kids.filter(k=>k.program===p.k)]).filter(([,l])=>l.length);
  const other=kids.filter(k=>!PMAP[k.program]); if(other.length) groups.push([{n:L("بدون مرحلة","No program"),c:"--muted"},other]);
  const photos=w.photos||[]; const pc=presentCount(w);
  const noCam=kids.filter(k=>noPhoto(k)&&presentIn(w,k.id));
  const prog=w.progress||{};
  const ro=S.canWrite?"":"disabled";
  const FL={pts:L("نقاط","points"),sec:L("أقسام","sections"),vrs:L("آيات","verses")};
  const cell=(k,f)=>`<input class="pin" id="pg_${esc(k.id)}_${f}" data-pg="${esc(k.id)}" data-f="${f}" type="number" min="0" inputmode="numeric" value="${prog[k.id]&&prog[k.id][f]!=null&&prog[k.id][f]!==""?esc(prog[k.id][f]):""}" aria-label="${FL[f]} ${esc(k.name)}" ${ro}>`;
  const team=[].concat(c.dirName?[{id:"dir",name:c.dirName,role:L("مدير النادي","Director")}]:[], clubLeaders(c.id).map(l=>({id:l.id,name:l.name,role:tr(ROLE_EN,l.role)})));
  return `
  <nav class="crumbs">${crumbRoot()}<button type="button" data-open-club="${esc(c.id)}" data-tab-to="weeks">${esc(c.name)}</button><span>${SEP()}</span><span>${esc(fmtDate(w.date))}</span></nav>
  <div class="profile"><div class="txt"><h1>${esc(w.title||L("اجتماع ","Meeting ")+fmtDate(w.date))}</h1><div class="meta"><span>${esc(fmtDate(w.date))}</span>${w.theme?`<span class="type-pill">${esc(w.theme)}</span>`:""}<span>${L(`${pc} حاضر من ${kids.length}`,`${pc} of ${kids.length} present`)}</span>${num(w.visitors)?`<span>${num(w.visitors)} ${L("زائر","visitors")}</span>`:""}<span>${leadersCountOf(w)} ${L("مسؤول","leaders")}</span></div></div>
    <div class="actions">${S.canWrite?`<button class="btn" type="button" data-act="editWeek">${ICON.edit} ${L("تعديل بيانات الأسبوع","Edit meeting")}</button>`:""}</div></div>
  ${w.lesson||w.notes?`<div class="panel" style="margin-top:12px">${w.lesson?`<p style="margin:0"><b>${L("الدرس / الآية:","Lesson / verse:")}</b> ${esc(w.lesson)}</p>`:""}${w.notes?`<div class="note">${esc(w.notes)}</div>`:""}</div>`:""}
  <section class="panel" style="margin-top:14px"><h2>${L("ألبوم الأسبوع","Meeting album")} <span class="actions"><span class="muted small">${photos.length} ${L("صورة","photos")}</span>${photos.length&&window.JSZip?`<button class="btn sm" type="button" data-act="zip">${ICON.dl} ${L("تحميل كل الصور","Download all")}</button>`:""}</span></h2>
    ${noCam.length?`<p class="warn-line">${ICON.nocam} ${L("لا تنشر صور هؤلاء الأطفال (الأهل غير موافقين):","Don't share photos of these children (no parent consent):")} ${noCam.map(k=>esc(k.name)).join(L("، ",", "))}</p>`:""}
    <div class="photos">
      ${photos.map((id,i)=>`<button class="ph" type="button" data-lb="${i}" aria-label="${L("عرض الصورة","Open photo")} ${i+1}"><img data-ph="${esc(id)}" alt=""></button>`).join("")}
      ${pendingUploads.map(()=>`<div class="ph up">${L("جارٍ الرفع…","Uploading…")}</div>`).join("")}
      ${S.canUpload?`<label class="drop" id="drop">${ICON.cam}<span>${L("أضف صوراً","Add photos")}<br><span class="small">${L("اسحبها هنا أو اضغط","Drop here or tap")}</span></span><input id="photoInput" type="file" accept="image/*" multiple hidden></label>`:""}
    </div>
    ${!photos.length&&!S.canUpload?`<p class="muted small">${L("لا توجد صور لهذا الأسبوع.","No photos for this meeting.")}</p>`:""}
  </section>
  <section class="panel" style="margin-top:14px"><h2>${L("حضور المسؤولين","Leader attendance")} <span class="muted small">${Object.values(w.leadersPresent||{}).filter(Boolean).length}/${team.length}${num(w.leadersCount)?L(` + ${num(w.leadersCount)} إضافي`,` + ${num(w.leadersCount)} extra`):""}</span></h2>
    ${team.length?`<div class="att-grid">${team.map(t=>`<button class="att" type="button" role="checkbox" aria-checked="${leaderIn(w,t.id)}" ${S.canWrite?"":'aria-disabled="true"'} data-latt="${esc(t.id)}"><span class="box">${leaderIn(w,t.id)?ICON.check:""}</span><span class="t">${esc(t.name)}<br><span class="muted small">${esc(t.role||"")}</span></span></button>`).join("")}</div>`:`<p class="muted small">${L("أضف المدير والمسؤولين من تبويب «المدير والمسؤولين».","Add the director and leaders first.")}</p>`}
  </section>
  <section class="panel" style="margin-top:14px"><h2>${L("حضور الأطفال والتقدّم","Children: attendance & progress")} <span class="muted small">${pc}/${kids.length}</span></h2>
    <p class="muted small" style="margin:-4px 0 10px">${S.canWrite?L("اضغط على اسم الطفل لتحضيره، واكتب ما حقّقه اليوم: النقاط، الأقسام التي أنهاها، والآيات التي سمّعها.","Tap a child's name to mark them present, then enter today's points, completed sections and recited verses."):L("عرض فقط.","View only.")}</p>
    ${!kids.length?`<p class="muted small">${L("أضف أطفال النادي أولاً من تبويب «الأطفال» لتسجيل الحضور.","Add the club's children first from the Children tab.")}</p>`:
    groups.map(([p,l])=>`<h3 class="grp" style="color:var(${p.c})">${esc(p.n)} <span class="muted small">${l.filter(k=>presentIn(w,k.id)).length}/${l.length}</span></h3>
    <div class="ptab"><div class="prow phead"><span>${L("الطفل","Child")}</span><span>${FL.pts}</span><span>${FL.sec}</span><span>${FL.vrs}</span></div>
    ${l.map(k=>`<div class="prow ${presentIn(w,k.id)?"on":""}"><button class="att" type="button" role="checkbox" aria-checked="${presentIn(w,k.id)}" ${S.canWrite?"":'aria-disabled="true"'} data-att="${esc(k.id)}"><span class="box">${presentIn(w,k.id)?ICON.check:""}</span><span class="t">${esc(k.name)}${noPhoto(k)?` <span class="warn" title="${L("ممنوع التصوير","No photos")}">${ICON.nocam}</span>`:""}</span></button>${cell(k,"pts")}${cell(k,"sec")}${cell(k,"vrs")}</div>`).join("")}</div>`).join("")}
  </section>`;
}

// ================= #10 reports =================
function reportData(){
  const clubs = S.repClub ? S.clubs.filter(c=>c.id===S.repClub) : S.clubs;
  const ids = new Set(clubs.map(c=>c.id));
  const weeks = S.weeks.filter(w=>ids.has(w.clubId) && inSeason(w) && (!S.repMonth || String(w.date).slice(0,7)===S.repMonth));
  const kids = S.kids.filter(k=>ids.has(k.clubId));
  const progSum = (ws,f) => ws.reduce((s,w)=>s+Object.values(w.progress||{}).reduce((a,p)=>a+num(p[f]),0),0);
  const perClub = clubs.map(c=>{ const ws=weeks.filter(w=>w.clubId===c.id); const act=S.kids.filter(k=>k.clubId===c.id&&isActive(k)).length; const att=ws.reduce((s,w)=>s+presentCount(w),0);
    return {c, kids:act, meetings:ws.length, avg:ws.length?Math.round(att/ws.length*10)/10:0, rate:ws.length&&act?Math.min(100,Math.round(att*100/(ws.length*act))):0,
      verses:progSum(ws,"vrs"), points:progSum(ws,"pts"), leaders:ws.length?Math.round(ws.reduce((s,w)=>s+leadersCountOf(w),0)/ws.length*10)/10:0, last:ws.map(w=>w.date).sort().pop()||""}; });
  const months={}; weeks.forEach(w=>{ const m=String(w.date).slice(0,7); (months[m]=months[m]||{m,att:0,meet:0}); months[m].att+=presentCount(w); months[m].meet++; });
  const progs = PROGRAMS.map(p=>({p,n:kids.filter(k=>isActive(k)&&k.program===p.k).length})).filter(x=>x.n);
  const top = kids.filter(isActive).map(k=>{ let p=0,v=0; weeks.forEach(w=>{ const x=(w.progress||{})[k.id]; if(x){p+=num(x.pts);v+=num(x.vrs);} }); return {k,p,v}; }).filter(x=>x.p||x.v).sort((a,b)=>b.p-a.p||b.v-a.v).slice(0,10);
  return {weeks,sumAtt:weeks.reduce((s,w)=>s+presentCount(w),0),vrs:progSum(weeks,"vrs"),pts:progSum(weeks,"pts"),visitors:weeks.reduce((s,w)=>s+num(w.visitors),0),perClub,months:Object.values(months).sort((a,b)=>a.m.localeCompare(b.m)),progs,top};
}
function barChart(rows){
  if(!rows.length) return `<p class="muted small">${L("لا توجد بيانات في هذه الفترة.","No data for this period.")}</p>`;
  const max=Math.max(1,...rows.map(r=>r.att)); const W=Math.max(320,rows.length*64), H=210, slot=W/rows.length, bw=Math.min(40,slot-18);
  const bars=rows.map((r,i)=>{ const x=i*slot+(slot-bw)/2; const h=Math.max(2,Math.round((r.att/max)*(H-64))); const y=H-30-h;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" class="bar"></rect><text x="${x+bw/2}" y="${y-6}" text-anchor="middle" class="bval">${r.att}</text><text x="${x+bw/2}" y="${H-10}" text-anchor="middle" class="blab">${esc(monthName(r.m))}</text>`; }).join("");
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${L("الحضور حسب الشهر","Attendance by month")}"><line x1="0" x2="${W}" y1="${H-30}" y2="${H-30}" class="axis"></line>${bars}</svg></div>`;
}
function reportsView(){
  const R=reportData();
  const months=[...new Set(S.weeks.filter(inSeason).map(w=>String(w.date).slice(0,7)))].sort();
  const pmax=Math.max(1,...R.progs.map(y=>y.n));
  return `<nav class="crumbs">${S.isClub?`<button type="button" data-home>${esc((club(CLUB_ID)||{}).name||"")}</button><span>${SEP()}</span>`:crumbRoot()}<span>${L("التقارير","Reports")}</span></nav>
  <div class="hero"><div><h1>${L("التقارير","Reports")}</h1><p>${L("ملخّص الحضور والتقدّم لكل الأندية أو لنادٍ واحد.","Attendance and progress for all clubs or one club.")}</p></div>
    <div class="actions">${seasonSelect()}
      ${!S.isClub?`<label class="season"><span>${L("النادي","Club")}</span><select id="repClub"><option value="">${L("كل الأندية","All clubs")}</option>${S.clubs.map(c=>`<option value="${esc(c.id)}" ${S.repClub===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>`:""}
      <label class="season"><span>${L("الشهر","Month")}</span><select id="repMonth"><option value="">${L("كل الشهور","All months")}</option>${months.map(m=>`<option value="${m}" ${S.repMonth===m?"selected":""}>${esc(monthName(m))}</option>`).join("")}</select></label>
      <button class="btn" type="button" data-act="exportReport">${ICON.dl} ${L("تصدير التقرير","Export report")}</button></div></div>
  <div class="stats">
    <div class="stat"><b>${R.weeks.length}</b><span>${L("اجتماع","meetings")}</span></div>
    <div class="stat"><b>${R.weeks.length?Math.round(R.sumAtt/R.weeks.length):0}</b><span>${L("متوسط حضور الاجتماع","avg per meeting")}</span></div>
    <div class="stat"><b>${R.vrs}</b><span>${L("آية سُمّعت","verses recited")}</span></div>
    <div class="stat"><b>${R.pts}</b><span>${L("نقطة","points")} · ${R.visitors} ${L("زائر","visitors")}</span></div>
  </div>
  <div class="cols">
    <section class="panel"><h2>${L("الحضور حسب الشهر","Attendance by month")}</h2>${barChart(R.months)}<p class="muted small" style="margin:6px 0 0">${L("مجموع حضور الأطفال في اجتماعات كل شهر.","Total child check-ins across each month's meetings.")}</p></section>
    <section class="panel"><h2>${L("الأطفال النشطون حسب المرحلة","Active children by program")}</h2>${R.progs.length?`<div class="hbars">${R.progs.map(x=>`<div class="hbar"><span>${esc(x.p.n)}</span><i style="--w:${Math.round(x.n*100/pmax)}%;--c:var(${x.p.c})"></i><b>${x.n}</b></div>`).join("")}</div>`:`<p class="muted small">${L("لا توجد بيانات.","No data.")}</p>`}</section>
  </div>
  <section class="panel" style="margin-top:14px"><h2>${L("مقارنة الأندية","Clubs compared")}</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${L("النادي","Club")}</th><th>${L("أطفال نشطون","Active")}</th><th>${L("اجتماعات","Meetings")}</th><th>${L("متوسط الحضور","Avg att.")}</th><th>${L("نسبة الحضور","Att. rate")}</th><th>${L("متوسط المسؤولين","Avg leaders")}</th><th>${L("آيات","Verses")}</th><th>${L("نقاط","Points")}</th><th>${L("آخر اجتماع","Last")}</th></tr></thead>
    <tbody>${R.perClub.map(x=>`<tr><td><button type="button" class="linkbtn2" data-open-club="${esc(x.c.id)}">${esc(x.c.name)}</button></td><td>${x.kids}</td><td>${x.meetings}</td><td>${x.avg}</td><td><span class="rate ${x.rate>=75?"good":x.rate>=50?"mid":x.meetings?"low":""}">${x.meetings?x.rate+"%":"—"}</span></td><td>${x.leaders}</td><td>${x.verses}</td><td>${x.points}</td><td>${esc(fmtDateShort(x.last))}</td></tr>`).join("")}</tbody></table></div>
  </section>
  ${R.top.length?`<section class="panel" style="margin-top:14px"><h2>${L("الأعلى نقاطاً","Top by points")}</h2><div class="list">${R.top.map((x,i)=>`<button class="row" type="button" data-open-kid="${esc(x.k.id)}"><span class="rank">${i+1}</span>${avatar(x.k.photo,x.k.name,"round")}<span class="grow"><span class="name">${esc(x.k.name)}</span><span class="meta">${pgChip(x.k.program)}<span>${esc((club(x.k.clubId)||{}).name||"")}</span></span></span><span class="end"><span class="pts">${x.p}</span><span>${x.v} ${L("آية","verses")}</span></span></button>`).join("")}</div></section>`:""}`;
}
function exportReport(){
  const R=reportData();
  const head=[L("النادي","Club"),L("المدينة","City"),L("أطفال نشطون","Active children"),L("اجتماعات","Meetings"),L("متوسط الحضور","Avg attendance"),L("نسبة الحضور","Attendance rate"),L("متوسط المسؤولين","Avg leaders"),L("آيات","Verses"),L("نقاط","Points"),L("آخر اجتماع","Last meeting")];
  const rows=R.perClub.map(x=>[x.c.name,tr(CITY_EN,x.c.city),x.kids,x.meetings,x.avg,x.meetings?x.rate+"%":"",x.leaders,x.verses,x.points,x.last]);
  save(`Awana-report-${(S.season||"all").replace("–","-")}${S.repMonth?"-"+S.repMonth:""}.csv`,csvOf(head,rows));
}

// ================= settings (admin) =================
const appLink = (role,cid) => location.origin+location.pathname+"?as="+role+(cid?"&c="+encodeURIComponent(cid):"");
function settingsView(){
  const tab=S.route.tab||"acc";
  const tabs=[["acc",L("الحسابات","Accounts")],["clubs",L("حسابات مديري الأندية","Club director accounts")],["trash",L("سلة المحذوفات","Trash")],["audit",L("سجل التعديلات","Activity log")],["test",L("فحص الحماية","Security check")]];
  const body=tab==="acc"?accountsTab(): tab==="clubs"?clubAccountsTab(): tab==="trash"?trashTab(): tab==="audit"?auditTab(): testTab();
  return `<nav class="crumbs">${crumbRoot()}<span>${L("الإعدادات","Settings")}</span></nav>
  <div class="profile"><div class="txt"><h1>${L("الإعدادات","Settings")}</h1><div class="meta"><span>${L("للمدير فقط","Admin only")}</span></div></div></div>
  <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button class="tab" role="tab" type="button" data-stab="${k}" aria-selected="${tab===k}">${l}</button>`).join("")}</div>
  ${S.keys===null?`<p class="muted">${L("جارٍ التحميل…","Loading…")}</p>`:body}`;
}
function pwCard({key,title,set,on,pw,n,link,extra}){
  return `<section class="panel acct">
    <h2>${title} <span class="${on?"ok-pill":"warn"}">${!set?L("لم تُحدَّد كلمة مرور","No password yet"):on?L("مفعّل","Active"):L("موقوف","Disabled")}</span></h2>
    <dl class="kv">
      <dt>${L("الرابط","Link")}</dt><dd class="inrow"><span class="sel mono">${esc(link)}</span><button type="button" class="btn sm" data-copy="${esc(link)}" aria-label="${L("نسخ","Copy")}">${ICON.copy}</button></dd>
      ${extra||""}
      <dt>${L("كلمة المرور الحالية","Current password")}</dt><dd class="inrow">${set?`<span class="mono" id="cur_${esc(key)}" data-pw="${esc(pw)}">••••••••</span><button type="button" class="btn sm" data-show="${esc(key)}">${L("إظهار","Show")}</button><button type="button" class="btn sm" data-copy="${esc(pw)}" aria-label="${L("نسخ","Copy")}">${ICON.copy}</button>`:`<span class="muted">—</span>`}</dd>
      <dt>${L("أجهزة داخلة الآن","Signed-in devices")}</dt><dd>${n}</dd>
    </dl>
    <div class="f" style="margin-top:12px"><label for="np_${esc(key)}">${set?L("كلمة مرور جديدة","New password"):L("حدّد كلمة مرور","Set a password")}</label>
      <div class="inrow"><input id="np_${esc(key)}" type="text" autocomplete="off" spellcheck="false" placeholder="${L("10 حروف أو أكثر","10+ characters")}"><button type="button" class="btn sm" data-gen="${esc(key)}">${L("توليد","Generate")}</button></div></div>
    <div class="actions" style="margin-top:10px">
      <button type="button" class="btn pri" data-setpw="${esc(key)}">${L("حفظ كلمة المرور","Save password")}</button>
      ${set?`<button type="button" class="btn ${on?"danger":""}" data-toggle="${esc(key)}">${on?L("إيقاف الحساب","Disable account"):L("تفعيل الحساب","Enable account")}</button>`:""}
      <button type="button" class="btn" data-kick="${esc(key)}" ${n?"":"disabled"}>${L("إخراج كل الأجهزة","Sign out all devices")}</button>
    </div>
  </section>`;
}
function accountsTab(){
  const k=S.keys||{};
  const card=r=>pwCard({key:r,title:esc(accLabel(r)),set:!!k[r],on:!!k[r]&&k[r+"On"]===true,pw:k[r]||"",n:S.sessions.filter(x=>x.role===r).length,link:appLink(r)});
  return `<p class="muted small">${L("تغيير كلمة المرور أو إيقاف الحساب يُخرج كل الأجهزة الداخلة بيه فوراً. استخدم «توليد» لكلمات قوية.","Changing a password or disabling an account signs out every device using it right away. Use Generate for strong passwords.")}</p>
  <div class="cols">${card("jordan")}${card("view")}</div>
  <section class="panel" style="margin-top:14px"><h2>${L("كلمة مرور المدير (حسابك)","Your admin password")}</h2>
    <p class="muted small" style="margin-top:0">${L("حسابك:","Your account:")} <span class="mono">${esc(ADMIN_EMAIL)}</span>. ${L("لو نسيت كلمة المرور، اضغط «نسيت كلمة المرور؟» في شاشة الدخول وهيوصلك إيميل.","If you forget it, use “Forgot password?” on the sign-in screen and you'll get an email.")}</p>
    <div class="fs">
      <div class="f"><label for="apOld">${L("كلمة المرور الحالية","Current password")}</label><input id="apOld" type="password" autocomplete="current-password"></div>
      <div class="f"><label for="apNew">${L("كلمة المرور الجديدة","New password")}</label><input id="apNew" type="password" autocomplete="new-password"></div>
    </div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn pri" data-adminpw>${L("تغيير كلمة مروري","Change my password")}</button></div>
  </section>`;
}
function clubAccountsTab(){
  const ck=(S.keys||{}).clubs||{};
  if(!S.clubs.length) return `<p class="muted">${L("أضف أندية أولاً.","Add clubs first.")}</p>`;
  return `<p class="muted small">${L("كل مدير نادي يدخل برابط ناديه وكلمة مروره، ويشوف ويعدّل ناديه هو بس. مايقدرش يمسح نهائياً.","Each club director signs in with their club's link and password and can only see and edit their own club. They can't permanently delete anything.")}</p>
  <div class="cols">${S.clubs.map(c=>{ const e=ck[c.id]||{}; return pwCard({key:"club:"+c.id,title:esc(c.name),set:!!e.pw,on:!!e.pw&&e.on===true,pw:e.pw||"",n:S.sessions.filter(x=>x.role==="club"&&x.clubId===c.id).length,link:appLink("club",c.id),
    extra:`<dt>${L("رمز النادي","Club code")}</dt><dd class="inrow"><span class="mono sel">${esc(c.id)}</span></dd>`}); }).join("")}</div>`;
}
const ACT = {create:["أضاف","added"],update:["عدّل","edited"],delete:["نقل للسلة","moved to trash"],restore:["استرجع","restored"],purge:["مسح نهائياً","deleted forever"],"photo+":["رفع صور","uploaded photos"],"photo-":["حذف صورة","removed a photo"],transfer:["نقل طفل","transferred a child"],rollover:["بدأ سنة جديدة","started a new year"],restoreBackup:["استرجع نسخة احتياطية","restored a backup"],password:["غيّر كلمة مرور","changed a password"],account:["غيّر حالة حساب","changed an account"]};
const COLN = {clubs:["نادي","club"],kids:["طفل","child"],leaders:["مسؤول","leader"],weeks:["أسبوع","meeting"],photos:["صورة","photo"],accounts:["حساب","account"]};
function auditTab(){
  let rows=S.audit; if(S.auditF) rows=rows.filter(a=>String(a.by).startsWith(S.auditF));
  return `<div class="bar"><label class="season"><span>${L("الحساب","Account")}</span><select id="auditF"><option value="">${L("الكل","All")}</option>${["admin","jordan","club"].map(r=>`<option value="${r}" ${S.auditF===r?"selected":""}>${esc(accLabel(r))}</option>`).join("")}</select></label><span class="muted small">${L("آخر 300 عملية","Latest 300 actions")}</span></div>
  ${rows.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${L("الوقت","When")}</th><th>${L("مين","Who")}</th><th>${L("عمل إيه","What")}</th><th>${L("على إيه","On")}</th><th>${L("النادي","Club")}</th></tr></thead><tbody>
  ${rows.map(a=>`<tr><td class="nowrap">${esc(fmtStamp(a.at))}</td><td>${esc(byLabel(a.by))}</td><td>${esc(ACT[a.action]?L(...ACT[a.action]):a.action)}</td><td>${COLN[a.col]?esc(L(...COLN[a.col]))+": ":""}${esc(a.name)}${a.extra?`<br><span class="muted small">${esc(a.extra)}</span>`:""}</td><td>${esc((S.raw.clubs.find(c=>c.id===a.clubId)||{}).name||"")}</td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">${L("لا توجد عمليات بعد.","No activity yet.")}</p>`}`;
}
function trashTab(){
  const dead=col=>S.raw[col].filter(x=>x.deleted&&!String(x.id).startsWith("zz-probe")).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt)));
  const cn=id=>(S.raw.clubs.find(c=>c.id===id)||{}).name||"";
  const row=(col,x,label)=>`<div class="trow"><span class="grow"><b>${esc(label)}</b><span class="meta"><span>${esc(L(...COLN[col]))}</span>${col!=="clubs"?`<span>${esc(cn(x.clubId))}</span>`:""}<span>${esc(byLabel(x.deletedBy))} · ${esc(fmtStamp(x.deletedAt))}</span></span></span><span class="actions"><button class="btn sm" type="button" data-restore-rec="${col}|${esc(x.id)}">${ICON.undo} ${L("استرجاع","Restore")}</button><button class="btn sm danger" type="button" data-purge-rec="${col}|${esc(x.id)}">${ICON.trash} ${L("مسح نهائي","Delete forever")}</button></span></div>`;
  const recs=[].concat(dead("clubs").map(x=>row("clubs",x,x.name)),dead("kids").map(x=>row("kids",x,x.name)),dead("leaders").map(x=>row("leaders",x,x.name)),dead("weeks").map(x=>row("weeks",x,(x.title||L("اجتماع","Meeting"))+" – "+fmtDate(x.date))));
  const photos=S.trash.slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return `<p class="muted small">${L("أي حاجة بتتحذف من أي حساب بتيجي هنا الأول. إنت بس اللي تقدر ترجّعها أو تمسحها نهائياً.","Anything deleted from any account lands here first. Only you can restore it or delete it forever.")}</p>
  ${recs.length||photos.length?`<div class="actions" style="margin-bottom:10px"><span id="emptyZone"><button class="btn danger" type="button" data-empty-trash>${ICON.trash} ${L("إفراغ السلة بالكامل","Empty the trash")}</button></span></div>`:""}
  <section class="panel"><h2>${L("بيانات محذوفة","Deleted records")} <span class="muted small">${recs.length}</span></h2>${recs.length?`<div class="tlist">${recs.join("")}</div>`:`<p class="muted small">${L("السلة فاضية.","Nothing here.")}</p>`}</section>
  <section class="panel" style="margin-top:14px"><h2>${L("صور محذوفة أو غير مستخدمة","Deleted or unused photos")} <span class="muted small">${photos.length}</span></h2>
  ${photos.length?`<div class="photos">${photos.map(t=>`<div class="tph"><span class="ph"><img data-ph="${esc(t.photoId)}" alt=""></span><span class="small muted">${esc(t.label||"")} · ${esc(byLabel(t.by))}</span><span class="actions">${t.weekId?`<button class="btn sm" type="button" data-restore-ph="${esc(t.id)}" aria-label="${L("استرجاع","Restore")}">${ICON.undo}</button>`:""}<button class="btn sm danger" type="button" data-purge-ph="${esc(t.id)}" aria-label="${L("مسح نهائي","Delete forever")}">${ICON.trash}</button></span></div>`).join("")}</div>`:`<p class="muted small">${L("لا توجد صور.","No photos.")}</p>`}</section>`;
}
// #7 live security check against the real Firebase rules
let probeLog=[];
function testTab(){
  const k=S.keys||{};
  const ready=k.jordan&&k.jordanOn&&k.view&&k.viewOn;
  return `<section class="panel"><h2>${L("فحص الحماية على Firebase الحقيقي","Live security check on Firebase")}</h2>
    <p class="muted small" style="margin-top:0">${L("الفحص بيدخل كحساب العرض وحساب الأردن ومدير نادي تجريبي، ويجرّب حاجات المفروض تتمنع وحاجات المفروض تنجح، وبعدين بيمسح أي بيانات تجريبية.","The check signs in as the view account, the Jordan account and a test club director, tries actions that should be blocked and actions that should work, then removes any test data.")}</p>
    ${ready?`<button class="btn pri" type="button" data-probe>${ICON.lock} ${L("ابدأ الفحص","Run the check")}</button>`:`<p class="warn-line">${L("حدّد كلمة مرور لحساب الأردن وحساب العرض وفعّلهم الأول من تبويب «الحسابات».","Set and enable passwords for the Jordan and view accounts first (Accounts tab).")}</p>`}
    <div id="probeOut">${probeLog.length?probeResults():""}</div></section>`;
}
function probeResults(){
  const fails=probeLog.filter(r=>!r.pass).length;
  return `<p class="${fails?"warn-line":"ok-line"}">${fails?L(`فيه ${fails} مشكلة. ابعت صورة الشاشة دي.`,`${fails} problem(s) found. Send a screenshot of this.`):L("كل الاختبارات نجحت. الحماية شغالة صح.","All checks passed. Protection is working.")}</p>
  <div class="tlist">${probeLog.map(r=>`<div class="trow"><span class="${r.pass?"ok-pill":"warn"}">${r.pass?"✓":"✗"}</span><span class="grow">${esc(r.name)}${r.code?` <span class="muted small mono">${esc(r.code)}</span>`:""}</span></div>`).join("")}</div>`;
}
async function runProbe(){
  const btn=$("[data-probe]"); if(btn){ btn.disabled=true; btn.textContent=L("جارٍ الفحص…","Checking…"); }
  probeLog=[]; const k=S.keys||{};
  const papp=initializeApp(CFG,"probe-"+Date.now()); const pauth=getAuth(papp); const pfs=initializeFirestore(papp,{});
  const rnd=()=>Math.random().toString(36).slice(2,10);
  const probeClub="zz-probe-"+rnd(), probePw="probe-"+rnd()+rnd(), kid="zz-probe-"+rnd();
  const realClub=S.clubs[0]&&S.clubs[0].id;
  const out=()=>{ const o=$("#probeOut"); if(o) o.innerHTML=probeResults(); };
  const t=async(name, expectOk, fn)=>{ try{ await fn(); probeLog.push({name,pass:expectOk,code:expectOk?"":"ALLOWED"}); }catch(e){ probeLog.push({name,pass:!expectOk,code:expectOk?(e&&e.code||String(e)):""}); } out(); };
  try{
    await setDoc(doc(fs,"clubs",probeClub),{name:"__probe__",deleted:true,createdAt:nowIso()});
    await setDoc(doc(fs,"secrets","keys"),{clubs:{[probeClub]:{pw:probePw,on:true}}},{merge:true});
    await signInAnonymously(pauth); const sref=doc(pfs,"sessions",pauth.currentUser.uid);
    await t(L("بدون كلمة مرور: قراءة الأندية ممنوعة","No password: reading clubs is blocked"), false, ()=>getDocs(query(collection(pfs,"clubs"),limit(1))));
    await t(L("كلمة مرور غلط مرفوضة","A wrong password is rejected"), false, ()=>setDoc(sref,{role:"view",key:"wrong-"+rnd(),at:nowIso()}));
    await t(L("حساب العرض يدخل بكلمته","View account signs in"), true, ()=>setDoc(sref,{role:"view",key:k.view,at:nowIso(),device:"probe"}));
    await t(L("العرض يقرأ الأندية","View can read clubs"), true, ()=>getDocs(query(collection(pfs,"clubs"),limit(1))));
    await t(L("العرض لا يضيف بيانات","View can't add data"), false, ()=>setDoc(doc(pfs,"kids",kid),{clubId:probeClub,name:"__probe__"}));
    await t(L("العرض لا يقرأ كلمات المرور","View can't read passwords"), false, ()=>getDoc(doc(pfs,"secrets","keys")));
    await t(L("العرض لا يقرأ الملاحظات الصحية","View can't read health notes"), false, ()=>getDocs(query(collection(pfs,"private"),limit(1))));
    await t(L("العرض لا يقرأ سجل التعديلات","View can't read the activity log"), false, ()=>getDocs(query(collection(pfs,"audit"),limit(1))));
    await t(L("حساب الأردن يدخل بكلمته","Jordan account signs in"), true, ()=>setDoc(sref,{role:"jordan",key:k.jordan,at:nowIso(),device:"probe"}));
    await t(L("الأردن يضيف طفل","Jordan can add a child"), true, ()=>setDoc(doc(pfs,"kids",kid),{clubId:probeClub,name:"__probe__",deleted:true}));
    await t(L("الأردن لا يمسح نهائياً","Jordan can't delete permanently"), false, ()=>deleteDoc(doc(pfs,"kids",kid)));
    await t(L("الأردن لا يمسح نادي","Jordan can't delete a club"), false, ()=>deleteDoc(doc(pfs,"clubs",probeClub)));
    await t(L("الأردن لا يخفي نادي","Jordan can't hide (soft-delete) a club"), false, ()=>setDoc(doc(pfs,"clubs",probeClub),{name:"__probe__",deleted:true}));
    await t(L("الأردن لا يقرأ كلمات المرور","Jordan can't read passwords"), false, ()=>getDoc(doc(pfs,"secrets","keys")));
    await t(L("الأردن لا يكتب في السجل باسم المدير","Jordan can't write the log as the admin"), false, ()=>setDoc(doc(collection(pfs,"audit")),{by:"admin",action:"probe",at:nowIso()}));
    await t(L("مدير النادي يدخل بكلمة ناديه","Club director signs in"), true, ()=>setDoc(sref,{role:"club",clubId:probeClub,key:probePw,at:nowIso(),device:"probe"}));
    await t(L("مدير النادي يقرأ ناديه","Club director reads their club"), true, ()=>getDoc(doc(pfs,"clubs",probeClub)));
    if(realClub) await t(L("مدير النادي لا يقرأ نادٍ آخر","Club director can't read another club"), false, ()=>getDoc(doc(pfs,"clubs",realClub)));
    await t(L("مدير النادي لا يقرأ أطفال كل الأندية","Club director can't list all children"), false, ()=>getDocs(query(collection(pfs,"kids"),limit(1))));
    await t(L("مدير النادي يقرأ أطفال ناديه","Club director lists their own children"), true, ()=>getDocs(query(collection(pfs,"kids"),where("clubId","==",probeClub))));
    if(realClub) await t(L("مدير النادي لا يضيف طفل لنادٍ آخر","Club director can't add a child to another club"), false, ()=>setDoc(doc(pfs,"kids","zz-probe-x"+rnd()),{clubId:realClub,name:"__probe__"}));
    await setDoc(doc(fs,"secrets","keys"),{clubs:{[probeClub]:{on:false}}},{merge:true});
    await t(L("بعد إيقاف الحساب، الجهاز يفقد الصلاحية","After disabling, the device loses access"), false, ()=>getDoc(doc(pfs,"clubs",probeClub)));
  }catch(e){ probeLog.push({name:L("تعذّر إكمال الفحص","The check couldn't finish"),pass:false,code:e&&e.code||String(e)}); }
  try{ const u=pauth.currentUser; if(u) await deleteDoc(doc(fs,"sessions",u.uid)); }catch{}
  await deleteDoc(doc(fs,"kids",kid)).catch(()=>{});
  await deleteDoc(doc(fs,"clubs",probeClub)).catch(()=>{});
  await updateDoc(doc(fs,"secrets","keys"),{["clubs."+probeClub]:deleteField()}).catch(()=>{});
  try{ await signOut(pauth); await deleteApp(papp); }catch{}
  out();
  if(btn){ btn.disabled=false; btn.textContent=L("أعد الفحص","Run again"); }
}
function genPw(){ const a="abcdefghjkmnpqrstuvwxyz23456789"; let s=""; const r=crypto.getRandomValues(new Uint32Array(12)); for(const x of r) s+=a[x%a.length]; return s.slice(0,4)+"-"+s.slice(4,8)+"-"+s.slice(8); }
async function setPw(key){
  const v=(document.getElementById("np_"+key)||{}).value?.trim()||"";
  if(v.length<10) return toast(L("كلمة المرور لازم تكون 10 حروف أو أكثر. اضغط «توليد».","Password must be 10+ characters. Use Generate."));
  const k=S.keys||{};
  try{
    if(key.startsWith("club:")){ const cid=key.slice(5); const cur=(k.clubs||{})[cid]||{}; await setDoc(doc(fs,"secrets","keys"),{clubs:{[cid]:{pw:v,on:cur.on===undefined?true:cur.on,at:nowIso()}}},{merge:true}); await kick(key,true); audit("password","accounts",cid,(club(cid)||{}).name,cid); }
    else { const data={[key]:v,[key+"At"]:nowIso()}; if(k[key+"On"]===undefined) data[key+"On"]=true; await setDoc(doc(fs,"secrets","keys"),data,{merge:true}); await kick(key,true); audit("password","accounts",key,accLabel(key)); }
    toast(L("تم حفظ كلمة المرور. ابعتها مع الرابط.","Password saved. Send it along with the link."));
  }catch(e){ toast(dbErr(e)); }
}
async function toggleAcc(key){
  const k=S.keys||{};
  try{
    let on;
    if(key.startsWith("club:")){ const cid=key.slice(5); on=((k.clubs||{})[cid]||{}).on===true; await setDoc(doc(fs,"secrets","keys"),{clubs:{[cid]:{on:!on}}},{merge:true}); audit("account","accounts",cid,(club(cid)||{}).name,cid,on?"disabled":"enabled"); }
    else { on=k[key+"On"]===true; await setDoc(doc(fs,"secrets","keys"),{[key+"On"]:!on},{merge:true}); audit("account","accounts",key,accLabel(key),"",on?"disabled":"enabled"); }
    if(on) await kick(key,true);
    toast(on?L("تم إيقاف الحساب","Account disabled"):L("تم تفعيل الحساب","Account enabled"));
  }catch(e){ toast(dbErr(e)); }
}
async function kick(key,quiet){
  const ids=S.sessions.filter(x=>key.startsWith("club:")?(x.role==="club"&&x.clubId===key.slice(5)):x.role===key).map(x=>x.id);
  try{ for(let i=0;i<ids.length;i+=400){ const b=writeBatch(fs); ids.slice(i,i+400).forEach(id=>b.delete(doc(fs,"sessions",id))); await b.commit(); } if(!quiet) toast(L("تم إخراج كل الأجهزة","All devices signed out")); }catch(e){ if(!quiet) toast(dbErr(e)); }
}
async function adminPw(){
  const o=$("#apOld").value, n=$("#apNew").value;
  if(n.length<8) return toast(L("كلمة المرور الجديدة لازم تكون 8 حروف أو أكثر.","New password must be at least 8 characters."));
  try{ await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email,o)); await updatePassword(auth.currentUser,n); $("#apOld").value=$("#apNew").value=""; toast(L("تم تغيير كلمة مرورك","Your password was changed")); }
  catch(e){ const c=String(e&&e.code); toast(c.includes("wrong-password")||c.includes("invalid-credential")?L("كلمة المرور الحالية غير صحيحة.","Current password is wrong."):L("تعذّر التغيير. حاول مجدداً.","Couldn't change it. Try again.")); }
}
// trash actions (admin)
async function restoreRec(col,id){ const x=S.raw[col].find(r=>r.id===id); try{ await updDoc(col,id,{deleted:false,deletedAt:deleteField(),deletedBy:deleteField(),updatedAt:nowIso(),updatedBy:BY()}); audit("restore",col,id,x&&(x.name||x.title||x.date),x&&(col==="clubs"?id:x.clubId)); toast(L("تم الاسترجاع","Restored")); }catch(e){ toast(dbErr(e)); } }
async function purgeRec(col,id,quiet){
  const x=S.raw[col].find(r=>r.id===id); if(!x) return;
  try{
    if(col==="clubs"){
      const ks=S.raw.kids.filter(r=>r.clubId===id), ls=S.raw.leaders.filter(r=>r.clubId===id), ws=S.raw.weeks.filter(r=>r.clubId===id);
      const refs=[].concat(ks.map(r=>doc(fs,"kids",r.id)),ks.filter(r=>S.priv[r.id]).map(r=>doc(fs,"private",r.id)),ls.map(r=>doc(fs,"leaders",r.id)),ws.map(r=>doc(fs,"weeks",r.id)));
      for(let i=0;i<refs.length;i+=400){ const b=writeBatch(fs); refs.slice(i,i+400).forEach(r=>b.delete(r)); await b.commit(); }
      await deleteDoc(doc(fs,"clubs",id));
      purgePhotos([x.photo,x.dirPhoto].concat(ks.map(r=>r.photo),ls.map(r=>r.photo),ws.flatMap(r=>r.photos||[])));
      updateDoc(doc(fs,"secrets","keys"),{["clubs."+id]:deleteField()}).catch(()=>{});
    } else {
      await deleteDoc(doc(fs,col,id));
      if(col==="kids"&&S.priv[id]) deleteDoc(doc(fs,"private",id)).catch(()=>{});
      purgePhotos(col==="weeks"?(x.photos||[]):[x.photo]);
    }
    audit("purge",col,id,x.name||x.title||x.date,col==="clubs"?id:x.clubId); if(!quiet) toast(L("تم المسح النهائي","Deleted forever"));
  }catch(e){ toast(dbErr(e)); }
}
async function restorePh(tid){ const t=S.trash.find(x=>x.id===tid); if(!t) return; try{ if(t.weekId) await updDoc("weeks",t.weekId,{photos:arrayUnion(t.photoId)}); await deleteDoc(doc(fs,"trash",tid)); audit("restore","photos",t.photoId,t.label,t.clubId); toast(L("تم الاسترجاع","Restored")); }catch(e){ toast(dbErr(e)); } }
async function purgePh(tid){ const t=S.trash.find(x=>x.id===tid); if(!t) return; try{ purgePhotos([t.photoId]); await deleteDoc(doc(fs,"trash",tid)); }catch(e){ toast(dbErr(e)); } }
async function emptyTrash(){
  for(const col of ["kids","leaders","weeks","clubs"]) for(const x of S.raw[col].filter(r=>r.deleted)) await purgeRec(col,x.id,true);
  for(const t of S.trash.slice()) await purgePh(t.id);
  toast(L("تم إفراغ السلة","Trash emptied"));
}

// ================= forms =================
let pendingUploads=[], modalCancel=null;
// #9 save only the fields this person changed, and stop if someone else changed those same fields meanwhile
async function saveRecord(col,id,orig,data,isNew,force){
  const clean={}; for(const [k,v] of Object.entries(data)) if(!["id","health"].includes(k) && v!==undefined) clean[k]=v;
  if(isNew){ Object.assign(clean,{createdAt:nowIso(),createdBy:BY(),updatedAt:nowIso(),updatedBy:BY()}); await saveDoc(col,id,clean); return true; }
  const changed=Object.keys(clean).filter(k=>!sameJSON(clean[k],orig[k]));
  if(!changed.length) return false;
  if(!force){ const latest=S.raw[col].find(x=>x.id===id)||orig; const conf=changed.filter(k=>!sameJSON(latest[k],orig[k])); if(conf.length) throw {code:"conflict",keys:conf}; }
  const upd={updatedAt:nowIso(),updatedBy:BY()}; changed.forEach(k=>upd[k]=clean[k]);
  await updDoc(col,id,upd); return true;
}
function openForm({title, form, data, onSave, onDelete, deleteLabel, deleteNote, ctxClub, warn}){
  const orig=data||{}; const d=Object.assign({},orig);
  const fresh=new Set(); let saved=false, force=false, warnOk=false;
  const fields=form.flatMap(g=>g.fields);
  const photoKeys=fields.filter(f=>f.t==="photo").map(f=>f.k);
  const fid=f=>"f_"+f.k;
  const field=f=>{
    const v=d[f.k]??""; const lab=L(...f.l); const ph=f.ph?L(...f.ph):"";
    let inp;
    if(f.t==="select"){ const opts=(v&&!f.o.includes(v)?[v]:[]).concat(f.o); inp=`<select id="${fid(f)}">${opts.map(o=>`<option value="${esc(o)}" ${o===v?"selected":""}>${esc(f.ol?f.ol(o):(o||"—"))}</option>`).join("")}${!v&&!f.o.includes("")?`<option value="" selected>—</option>`:""}</select>`; }
    else if(f.t==="textarea") inp=`<textarea id="${fid(f)}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;
    else if(f.t==="programs") inp=`<div class="checks">${PROGRAMS.map(p=>`<label><input type="checkbox" data-prog-cb="${p.k}" ${(d.programs||[]).includes(p.k)?"checked":""}> ${L(p.ar,p.en)}</label>`).join("")}</div>`;
    else if(f.t==="photo") inp=`<div class="photo-in" data-photo-field="${f.k}">${avatar(v,d.name||"?","round"+(f.k==="photo"&&form===CLUB_FORM&&v?" logo":""))}${S.canUpload?`<label class="btn sm">${ICON.cam} ${v?L("تغيير","Change"):L("اختيار صورة","Choose photo")}<input type="file" accept="image/*" hidden data-photo-input="${f.k}"></label>${v?`<button type="button" class="btn sm ghost" data-photo-clear="${f.k}">${L("إزالة","Remove")}</button>`:""}`:""}</div>`;
    else inp=`<input id="${fid(f)}" type="${f.t||"text"}" value="${esc(v)}" placeholder="${esc(ph)}" ${f.req?"required":""} ${f.t==="number"?'min="0" inputmode="numeric"':""}>`;
    return `<div class="f ${f.wide?"wide":""}">${f.t==="programs"||f.t==="photo"?`<span class="lbl">${lab}</span>`:`<label for="${fid(f)}">${lab}${f.req?" *":""}</label>`}${inp}</div>`;
  };
  const delBtn=()=>onDelete?`<button type="button" class="btn danger" data-del>${ICON.trash} ${deleteLabel||L("حذف","Delete")}</button>`:(deleteNote?`<span class="muted small lock-note">${ICON.lock} ${deleteNote}</span>`:"");
  const meta=orig.updatedBy?`<p class="muted small" style="margin:0">${L("آخر تعديل:","Last edited:")} ${esc(byLabel(orig.updatedBy))} · ${esc(fmtStamp(orig.updatedAt))}</p>`:"";
  const draw=()=>{
    $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><form class="modal" id="mform" novalidate>
      <div class="modal-h"><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
      <div class="modal-b">${meta}${form.map(g=>`<fieldset class="fs"><legend>${L(...g.legend)}</legend>${g.hint?`<p class="muted small hint">${L(...g.hint)}</p>`:""}${g.fields.map(field).join("")}</fieldset>`).join("")}<div id="formErr" role="alert"></div></div>
      <div class="modal-f"><div id="delZone">${delBtn()}</div>
        <div class="actions"><button type="button" class="btn ghost" data-close>${L("إلغاء","Cancel")}</button><button type="submit" class="btn pri" id="saveBtn">${L("حفظ","Save")}</button></div></div>
    </form></div>`;
  };
  const collect=()=>{ fields.forEach(f=>{ if(f.t==="photo") return; if(f.t==="programs"){ d.programs=[...document.querySelectorAll("[data-prog-cb]:checked")].map(x=>x.dataset.progCb); return;} const el=document.getElementById(fid(f)); if(el) d[f.k]= f.t==="number"? (el.value===""?"":num(el.value)) : el.value.trim(); }); };
  const showErr=html=>{ const el=$("#formErr"); el.innerHTML=html; el.scrollIntoView({block:"nearest"}); };
  draw();
  modalCancel=()=>{ if(!saved) dropAssets([...fresh],{label:title,clubId:ctxClub}); };
  const root=$("#modalRoot");
  setTimeout(()=>{ const first=root.querySelector("input:not([type=checkbox]):not([type=file]),select,textarea"); first&&first.focus(); },30);
  root.onclick=async e=>{
    const t=e.target;
    if(t.id==="scrim"||t.closest("[data-close]")) return closeModal();
    if(t.closest("[data-force]")){ force=true; return $("#mform").requestSubmit(); }
    if(t.closest("[data-warnok]")){ warnOk=true; return $("#mform").requestSubmit(); }
    if(t.closest("[data-reload]")) return closeModal();
    if(t.closest("[data-del]")){ $("#delZone").innerHTML=`<div class="confirm-box">${S.isOwner?L("هيتنقل لسلة المحذوفات.","It'll go to the trash."):L("هيتنقل لسلة المحذوفات، ومسؤول الشرق الأوسط يقدر يرجّعه.","It'll go to the trash; the Middle East coordinator can restore it.")} <button type="button" class="btn sm danger" data-del-yes>${L("نعم، احذف","Yes, delete")}</button><button type="button" class="btn sm" data-del-no>${L("تراجع","Keep")}</button></div>`; return; }
    if(t.closest("[data-del-no]")){ $("#delZone").innerHTML=delBtn(); return; }
    if(t.closest("[data-del-yes]")){ $("#delZone").innerHTML=`<span class="muted small">${L("جارٍ الحذف…","Deleting…")}</span>`; try{ await onDelete(); saved=true; dropAssets([...fresh],{label:title,clubId:ctxClub}); closeModal(); toast(L("اتنقل لسلة المحذوفات","Moved to trash")); }catch(err){ showErr(`<p class="err">${esc(dbErr(err))}</p>`); $("#delZone").innerHTML=delBtn(); } return; }
    const pc=t.closest("[data-photo-clear]"); if(pc){ collect(); const k=pc.dataset.photoClear; if(fresh.has(d[k])){ dropAssets([d[k]],{label:title,clubId:ctxClub}); fresh.delete(d[k]); } d[k]=""; draw(); }
  };
  root.onchange=async e=>{
    const inp=e.target.closest("[data-photo-input]"); if(!inp||!inp.files[0]) return;
    const k=inp.dataset.photoInput; collect();
    const box=root.querySelector(`[data-photo-field="${k}"]`); box.innerHTML=`<span class="muted small">${L("جارٍ رفع الصورة…","Uploading photo…")}</span>`;
    $("#saveBtn").disabled=true;
    try{ const id=await uploadImage(inp.files[0], ctxClub||d.clubId); if(fresh.has(d[k])){ dropAssets([d[k]],{label:title,clubId:ctxClub}); fresh.delete(d[k]); } fresh.add(id); d[k]=id; }catch(err){ toast(upErr(err)); }
    draw(); $("#saveBtn").disabled=false;
  };
  root.onsubmit=async e=>{
    e.preventDefault(); collect();
    const miss=fields.find(f=>f.req&&!d[f.k]);
    if(miss){ showErr(`<p class="err">${L(`الحقل «${miss.l[0]}» مطلوب.`,`“${miss.l[1]}” is required.`)}</p>`); document.getElementById(fid(miss))?.focus(); return; }
    if(warn&&!warnOk){ const w=warn(d); if(w){ showErr(`<div class="warn-box">${w}<div class="actions"><button type="button" class="btn sm" data-warnok>${L("حفظ على أي حال","Save anyway")}</button></div></div>`); return; } }
    $("#saveBtn").disabled=true; $("#saveBtn").textContent=L("جارٍ الحفظ…","Saving…");
    try{
      await onSave(d,force); saved=true;
      dropAssets(photoKeys.filter(k=>orig[k]&&orig[k]!==d[k]).map(k=>orig[k]).concat([...fresh].filter(id=>!photoKeys.some(k=>d[k]===id))),{label:title,clubId:ctxClub});
      closeModal(); toast(L("تم الحفظ","Saved"));
    }catch(err){
      $("#saveBtn").disabled=false; $("#saveBtn").textContent=L("حفظ","Save");
      if(err&&err.code==="conflict"){ const names=err.keys.map(k=>{ const f=fields.find(x=>x.k===k); return f?L(...f.l):k; }); showErr(`<div class="warn-box">${L("شخص تاني عدّل نفس الخانات دي وانت بتعدّل:","Someone else changed these same fields while you were editing:")} <b>${esc(names.join(L("، ",", ")))}</b><div class="actions"><button type="button" class="btn sm" data-force>${L("احفظ تعديلاتي على أي حال","Save my changes anyway")}</button><button type="button" class="btn sm ghost" data-reload>${L("إلغاء وشوف التعديل الجديد","Cancel and see their version")}</button></div></div>`); }
      else showErr(`<p class="err">${esc(dbErr(err))}</p>`);
    }
  };
}
function closeModal(){ if(modalCancel){ const f=modalCancel; modalCancel=null; f(); } $("#modalRoot").innerHTML=""; $("#modalRoot").onclick=$("#modalRoot").onchange=$("#modalRoot").onsubmit=null; }
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){ if($("#lb")) closeLb(); else if($("#modalRoot").firstChild) closeModal(); }
  if($("#lb")&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){ const fwd=(e.key==="ArrowLeft")===(LANG!=="en"); lbStep(fwd?1:-1); }
});
// #2 deleting = moving to the trash; only the admin deletes forever
async function softDelete(col,x){ await updDoc(col,x.id,{deleted:true,deletedAt:nowIso(),deletedBy:BY()}); audit("delete",col,x.id,x.name||x.title||x.date,col==="clubs"?x.id:x.clubId); }

function clubForm(c){
  const id=c?c.id:newId("clubs");
  openForm({title:c?L("تعديل بيانات النادي","Edit club"):L("نادٍ جديد","New club"), form:CLUB_FORM, data:c, ctxClub:id,
    onSave:async (d,force)=>{ const ch=await saveRecord("clubs",id,c||{},d,!c,force); if(ch) audit(c?"update":"create","clubs",id,d.name,id); if(!c) go({v:"club",id,tab:"info"}); },
    onDelete: c&&S.isOwner ? async()=>{ await softDelete("clubs",c); go({v:"home"}); } : null,
    deleteLabel:L("حذف النادي","Delete club"),
    deleteNote: c&&!S.isOwner ? L("حذف النادي متاح لمسؤول الشرق الأوسط فقط.","Only the Middle East coordinator can delete a club.") : ""});
}
function leaderForm(clubId,l){
  openForm({title:l?L("بيانات المسؤول","Leader"):L("مسؤول جديد","New leader"), form:LEADER_FORM, data:l, ctxClub:clubId,
    onSave:async (d,force)=>{ d.clubId=clubId; const id=l?l.id:newId("leaders"); const ch=await saveRecord("leaders",id,l||{},d,!l,force); if(ch) audit(l?"update":"create","leaders",id,d.name,clubId); },
    onDelete:l?()=>softDelete("leaders",l):null});
}
// #12 possible duplicates: same name, or same parent phone with the same first name
function dupWarn(d,selfId){
  const n=norm(d.name), first=n.split(" ")[0], ph=digits(d.parentPhone);
  const hits=S.kids.filter(k=>k.id!==selfId && (norm(k.name)===n || (ph.length>=7 && digits(k.parentPhone)===ph && norm(k.name).split(" ")[0]===first)));
  if(!hits.length) return "";
  return `<b>${L("ممكن الطفل ده متسجّل قبل كده:","This child may already be registered:")}</b><ul>${hits.slice(0,5).map(k=>`<li>${esc(k.name)} – ${esc((club(k.clubId)||{}).name||"")}${k.parentPhone?` · ${esc(k.parentPhone)}`:""}</li>`).join("")}</ul>`;
}
function kidForm(clubId,k){
  const data = k ? Object.assign({},k,{awards:(k.awards||[]).join(L("، ",", ")),health:(S.priv[k.id]||{}).health||""}) : {status:"نشط",joined:today(),clubId};
  openForm({title:k?L("تعديل بيانات الطفل","Edit child"):L("طفل جديد","New child"), form:kidFormDef(!!k), data, ctxClub:clubId,
    warn:d=>dupWarn(d,k&&k.id),
    onSave:async (d,force)=>{
      const id=k?k.id:newId("kids");
      d.clubId=d.clubId||clubId;
      d.awards=String(d.awards||"").split(/[,،]/).map(s=>s.trim()).filter(Boolean);
      if(!k||d.program!==k.program){ const hist=((k&&k.programHistory)||[]).filter(h=>h.season!==curSeason()); if(d.program) hist.push({season:curSeason(),program:d.program,book:d.book||""}); d.programHistory=hist.sort((a,b)=>String(a.season).localeCompare(String(b.season))); }
      // #13 transferring keeps the record of where the child was before
      const moved=!!k&&d.clubId!==k.clubId;
      if(!k) d.clubHistory=[{clubId:d.clubId,from:d.joined||today()}];
      if(moved){ const h=(k.clubHistory&&k.clubHistory.length?k.clubHistory:[{clubId:k.clubId,from:k.joined||""}]).map(e=>Object.assign({},e)); const open=h.find(e=>!e.to&&e.clubId===k.clubId); if(open) open.to=today(); h.push({clubId:d.clubId,from:today()}); d.clubHistory=h; }
      const health=d.health||"", oldHealth=((k&&S.priv[k.id])||{}).health||"";
      const ch=await saveRecord("kids",id,k||{},d,!k,force);
      // #4 health notes live in a separate place the view-only account can't read
      if(health!==oldHealth||(moved&&oldHealth)) await saveDoc("private",id,{health,clubId:d.clubId,updatedAt:nowIso()});
      if(ch) audit(k?"update":"create","kids",id,d.name,d.clubId);
      if(moved) audit("transfer","kids",id,d.name,d.clubId,((club(k.clubId)||{}).name||"")+" → "+((club(d.clubId)||{}).name||""));
    },
    onDelete:k?()=>softDelete("kids",k):null});
}
function weekForm(clubId,w){
  openForm({title:w?L("تعديل بيانات الأسبوع","Edit meeting"):L("أسبوع جديد","New meeting"), form:WEEK_FORM, data:w||{date:today()}, ctxClub:clubId,
    warn:d=>{ const dup=S.weeks.find(x=>x.clubId===clubId&&x.date===d.date&&(!w||x.id!==w.id)); return dup?`<b>${L("فيه اجتماع مسجّل بنفس التاريخ في النادي ده.","There's already a meeting on this date for this club.")}</b>`:""; },
    onSave:async (d,force)=>{
      d.clubId=clubId;
      if(w){ const x=Object.assign({},d); for(const f of ["present","progress","photos","leadersPresent"]) delete x[f]; const ch=await saveRecord("weeks",w.id,w,x,false,force); if(ch) audit("update","weeks",w.id,(d.title||"")+" "+d.date,clubId); }
      else { const id=newId("weeks"); Object.assign(d,{present:{},progress:{},photos:[],leadersPresent:{}}); await saveRecord("weeks",id,{},d,true); audit("create","weeks",id,(d.title||"")+" "+d.date,clubId); go({v:"week",clubId,id}); }
    },
    onDelete:w?async()=>{ await softDelete("weeks",w); go({v:"club",id:clubId,tab:"weeks"}); }:null, deleteLabel:L("حذف الأسبوع","Delete meeting")});
}

function kidProfile(k){
  const c=club(k.clubId), a=age(k.birthdate);
  const st=kidStats(k,S.season), tot=kidTotal(k);
  const ws=kidWeeks(k,S.season).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  const hist=(k.programHistory||[]).slice().reverse();
  const ch=(k.clubHistory||[]).length>1?k.clubHistory:null;
  const health=(S.priv[k.id]||{}).health;
  simpleModal(`<span class="muted small">${esc(c?c.name:"")}</span>`, `
      <div class="kid-top">${avatar(k.photo,k.name,"lg round")}<div style="min-width:0"><h2>${esc(k.name)}</h2><div class="meta">${pgChip(k.program)}${a!==""?`<span>${a} ${L("سنة","yrs")}</span>`:""}${k.gender?`<span>${esc(tr(GENDER_EN,k.gender))}</span>`:""}${k.grade?`<span>${esc(k.grade)}</span>`:""}<span class="type-pill">${esc(tr(STATUS_EN,k.status||"نشط"))}</span>${noPhoto(k)?`<span class="warn">${ICON.nocam} ${L("ممنوع التصوير","No photos")}</span>`:k.photoOk==="yes"?`<span class="ok-pill">${L("موافقة على التصوير","Photo consent")}</span>`:""}</div></div></div>
      <div><div class="muted small" style="margin-bottom:6px">${esc(seasonLabel(S.season))}</div>
      <div class="prog-stats"><div><b>${st.pts}</b><span>${L("نقطة","points")}</span></div><div><b>${st.vrs}</b><span>${L("آية سمّعها","verses")}</span></div><div><b>${st.sec}</b><span>${L("قسم أنهاه","sections")}</span></div><div><b>${st.p!=null?st.p+"%":"—"}</b><span>${st.of?L(`حضور ${st.n} من ${st.of}`,`attended ${st.n} of ${st.of}`):L("الحضور","attendance")}</span></div></div>
      <p class="muted small" style="margin:6px 0 0">${L(`المجموع منذ انضمامه: ${tot.pts} نقطة · ${tot.vrs} آية · ${tot.sec} قسم`,`All-time: ${tot.pts} points · ${tot.vrs} verses · ${tot.sec} sections`)}</p></div>
      ${ws.length?`<div><div class="muted small" style="margin-bottom:6px">${L("سجل الأسابيع","Meeting log")}</div><div class="wlog">${ws.slice(0,40).map(w=>{ const p=(w.progress||{})[k.id]||{}; const on=presentIn(w,k.id); return `<div class="wl ${on?"on":""}"><span>${esc(fmtDateShort(w.date))}</span><span>${on?L("حاضر","present"):L("غائب","absent")}</span><span>${[num(p.pts)?num(p.pts)+L(" ن"," pts"):"",num(p.vrs)?num(p.vrs)+L(" آية"," verses"):"",num(p.sec)?num(p.sec)+L(" قسم"," sections"):"",w.clubId!==k.clubId?((club(w.clubId)||{}).name||""):""].filter(Boolean).join(" · ")}</span></div>`; }).join("")}</div></div>`:""}
      ${hist.length?`<div><div class="muted small" style="margin-bottom:6px">${L("المراحل عبر السنين","Programs by year")}</div><div class="awards">${hist.map(h=>`<span class="pg" style="--c:var(${(PMAP[h.program]||{c:"--muted"}).c})">${esc(h.season)}: ${esc((PMAP[h.program]||{}).n||h.program)}${h.book?" – "+esc(h.book):""}</span>`).join("")}</div></div>`:""}
      ${ch?`<div><div class="muted small" style="margin-bottom:6px">${L("الأندية اللي كان فيها","Club history")}</div><div class="awards">${ch.map(e=>`<span class="award">${esc((S.raw.clubs.find(x=>x.id===e.clubId)||{}).name||e.clubId)}: ${esc(fmtDateShort(e.from))} – ${e.to?esc(fmtDateShort(e.to)):L("الآن","now")}</span>`).join("")}</div></div>`:""}
      ${k.book?`<p style="margin:0"><b>${L("الكتيّب الحالي:","Current handbook:")}</b> ${esc(k.book)}</p>`:""}
      ${(k.awards||[]).length?`<div><div class="muted small" style="margin-bottom:6px">${L("الجوائز والشارات","Awards & badges")}</div><div class="awards">${k.awards.map(x=>`<span class="award">${esc(x)}</span>`).join("")}</div></div>`:""}
      <div class="cols" style="gap:16px"><div>${kv([[L("تاريخ الميلاد","Born"),fmtDate(k.birthdate)],[L("المدرسة","School"),k.school],[L("الكنيسة","Church"),k.church],[L("انضم في","Joined"),fmtDate(k.joined)]])}</div>
      <div>${kv([[L("ولي الأمر","Parent"),k.parentName],[L("الهاتف","Phone"),k.parentPhone,1],[L("بديل","Alt."),k.parent2,1],[L("العنوان","Address"),k.address]])}</div></div>
      ${health?`<div class="note"><b>${L("ملاحظات صحية:","Health notes:")}</b> ${esc(health)}</div>`:""}
      ${k.notes?`<div class="note">${esc(k.notes)}</div>`:""}
      ${k.updatedBy?`<p class="muted small" style="margin:0">${L("آخر تعديل:","Last edited:")} ${esc(byLabel(k.updatedBy))} · ${esc(fmtStamp(k.updatedAt))}</p>`:""}`,
    S.canWrite?`<span></span><button type="button" class="btn pri" data-edit-kid>${ICON.edit} ${L("تعديل بيانات الطفل","Edit child")}</button>`:"");
  $("#modalRoot").onclick=e=>{ if(e.target.id==="scrim"||e.target.closest("[data-close]")) closeModal(); else if(e.target.closest("[data-edit-kid]")) kidForm(k.clubId,k); };
}
function leaderProfile(l){
  if(S.canWrite) return leaderForm(l.clubId,l);
  const st=leaderStats(l.id,l.clubId,S.season);
  simpleModal(esc(l.name), `<div class="kid-top">${avatar(l.photo,l.name,"lg round")}<div class="meta">${esc(tr(ROLE_EN,l.role||""))} ${pgChip(l.program)}${st.p!=null?`<span>${L("حضور","Attendance")} ${st.p}%</span>`:""}</div></div>
    ${kv([[L("الهاتف","Phone"),l.phone,1],[L("البريد","Email"),l.email,1],[L("تاريخ الميلاد","Born"),fmtDate(l.birthdate)],[L("بدأ الخدمة","Serving since"),fmtDate(l.joined)],[L("المهنة","Occupation"),l.job],[L("الكنيسة","Church"),l.church],[L("التدريبات","Trainings"),l.training]])}${l.notes?`<div class="note">${esc(l.notes)}</div>`:""}`);
  $("#modalRoot").onclick=e=>{ if(e.target.id==="scrim"||e.target.closest("[data-close]")) closeModal(); };
}

// ================= #15 new Awana year =================
const ORDER=["puggles","cubbies","sparks","tt","trek","journey"];
function suggestProgram(k, startYear){
  const a=age(k.birthdate, startYear+"-09-01");
  if(a!==""){ if(a<3) return "puggles"; if(a<=4) return "cubbies"; if(a<=7) return "sparks"; if(a<=11) return "tt"; if(a<=14) return "trek"; if(a<=18) return "journey"; return "grad"; }
  return k.program||"";
}
function rolloverDialog(c){
  const d=new Date(); const sy=d.getMonth()+1>=6?d.getFullYear():d.getFullYear()-1; const target=sy+"–"+(sy+1);
  const kids=clubKids(c.id).filter(isActive).sort((a,b)=>(ORDER.indexOf(a.program)-ORDER.indexOf(b.program))||String(a.name).localeCompare(String(b.name),"ar"));
  const opt=(k,sel)=>`<select id="ro_${esc(k.id)}" aria-label="${esc(k.name)}">${PROGRAMS.map(p=>`<option value="${p.k}" ${sel===p.k?"selected":""}>${p.n}</option>`).join("")}<option value="grad" ${sel==="grad"?"selected":""}>${L("تخرّج","Graduated")}</option></select>`;
  simpleModal(L(`بداية سنة جديدة ${target}`,`Start year ${target}`), `
    <p class="muted small" style="margin:0">${L("البرنامج اقترح المرحلة الجديدة لكل طفل حسب عمره في أول سبتمبر. راجعها وغيّر اللي محتاج، وشيل العلامة من أي طفل مش عايز تغيّره.","The app suggested each child's new program from their age on 1 September. Check them, change any, and untick children you want to leave as they are.")}</p>
    <label class="radio"><input type="checkbox" id="roBook" checked> ${L("امسح «الكتيّب الحالي» للأطفال اللي اتنقلوا لمرحلة جديدة","Clear “current handbook” for children moving to a new program")}</label>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>${L("الطفل","Child")}</th><th>${L("العمر","Age")}</th><th>${L("الحالية","Now")}</th><th>${L("الجديدة","New")}</th></tr></thead><tbody>
    ${kids.map(k=>{ const s=suggestProgram(k,sy); const chg=s!==k.program; return `<tr class="${chg?"chg":""}"><td><input type="checkbox" data-ro="${esc(k.id)}" ${chg?"checked":""} aria-label="${esc(k.name)}"></td><td>${esc(k.name)}</td><td>${age(k.birthdate,sy+"-09-01")}</td><td>${pgChip(k.program)||"—"}</td><td>${opt(k,s)}</td></tr>`; }).join("")}</tbody></table></div>`,
    `<span id="roMsg" class="muted small"></span><div class="actions"><button type="button" class="btn ghost" data-close>${L("إلغاء","Cancel")}</button><button type="button" class="btn pri" data-roapply>${L("تطبيق","Apply")}</button></div>`);
  $("#modalRoot").onclick=async e=>{
    if(e.target.id==="scrim"||e.target.closest("[data-close]")) return closeModal();
    const ap=e.target.closest("[data-roapply]"); if(!ap) return;
    ap.disabled=true;
    const clearBook=$("#roBook").checked; let n=0; const b=writeBatch(fs);
    for(const k of kids){
      const cb=document.querySelector(`[data-ro="${CSS.escape(k.id)}"]`); if(!cb||!cb.checked) continue;
      const v=document.getElementById("ro_"+k.id).value; const upd={updatedAt:nowIso(),updatedBy:BY()};
      if(v==="grad") upd.status="تخرّج";
      else { upd.program=v; const h=(k.programHistory||[]).filter(x=>x.season!==target); h.push({season:target,program:v,book:""}); upd.programHistory=h.sort((a,b)=>String(a.season).localeCompare(String(b.season))); if(clearBook&&v!==k.program) upd.book=""; }
      b.update(doc(fs,"kids",k.id),upd); n++;
    }
    try{ if(n) await b.commit(); audit("rollover","kids","",`${n}`,c.id,target); closeModal(); toast(L(`تم تحديث ${n} طفل`,`${n} children updated`)); }catch(err){ ap.disabled=false; $("#roMsg").textContent=dbErr(err); }
  };
}

// ================= lightbox =================
let lbI=0;
function openLb(i){ lbI=i; drawLb(); }
function drawLb(){
  const w=curWeek(); const ph=(w&&w.photos)||[]; if(!ph.length) return closeLb();
  lbI=(lbI+ph.length)%ph.length;
  let el=$("#lb"); if(!el){ el=document.createElement("div"); el.id="lb"; el.className="lb"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); document.body.appendChild(el); }
  el.innerHTML=`<div class="lb-top"><span>${lbI+1} / ${ph.length}</span><span class="actions">${S.canUpload?`<span id="lbDel"><button class="btn sm" type="button" data-lb-del style="background:rgba(255,255,255,.12);color:#fff;border-color:transparent">${ICON.trash} ${L("حذف الصورة","Delete photo")}</button></span>`:""}<button class="x" type="button" data-lb-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></span></div>
    <div class="lb-img"><img data-full="${esc(ph[lbI])}" alt=""></div>
    <div class="lb-nav"><button class="btn" type="button" data-lb-step="-1">${L("‹ السابقة","‹ Previous")}</button><button class="btn" type="button" data-lb-step="1">${L("التالية ›","Next ›")}</button></div>`;
  hydrate(el);
  el.onclick=async e=>{
    const t=e.target;
    if(t.closest("[data-lb-close]")||t.classList.contains("lb-img")) return closeLb();
    const s=t.closest("[data-lb-step]"); if(s) return lbStep(+s.dataset.lbStep);
    if(t.closest("[data-lb-del]")){ $("#lbDel").innerHTML=`<button class="btn sm danger" type="button" data-lb-del-yes>${L("تأكيد الحذف","Confirm delete")}</button>`; return; }
    if(t.closest("[data-lb-del-yes]")){ const id=ph[lbI]; const c=club(w.clubId); const label=(c?c.name+" – ":"")+w.date;
      try{ await updDoc("weeks",w.id,{photos:arrayRemove(id)}); await setDoc(doc(collection(fs,"trash")),{type:"photo",photoId:id,weekId:w.id,clubId:w.clubId,label,at:nowIso(),by:BY()}); audit("photo-","photos",id,label,w.clubId); toast(L("الصورة اتنقلت لسلة المحذوفات","Photo moved to trash")); }catch(err){ toast(dbErr(err)); } }
  };
}
function lbStep(d){ lbI+=d; drawLb(); }
function closeLb(){ $("#lb")?.remove(); }

// ================= week photos, attendance, progress =================
async function addPhotos(files){
  const w=curWeek(); if(!w) return;
  files=[...files].filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)); if(!files.length) return;
  pendingUploads=files.map(()=>1); render();
  const ids=[];
  for(const f of files){ try{ ids.push(await uploadImage(f,w.clubId)); }catch(err){ toast(upErr(err)); } pendingUploads.pop(); }
  if(ids.length){ try{ await updDoc("weeks",w.id,{photos:arrayUnion(...ids)}); audit("photo+","weeks",w.id,`${ids.length} – ${w.date}`,w.clubId); toast(L(`تم رفع ${ids.length} صورة`,`${ids.length} photo(s) uploaded`)); }catch(err){ dropAssets(ids,{clubId:w.clubId}); toast(dbErr(err)); } }
  render();
}
const pend={present:{},progress:{},leaders:{}};
let flushT;
function applyPending(w){
  const pp=pend.present[w.id], pg=pend.progress[w.id], pl=pend.leaders[w.id];
  if(pp) w.present=Object.assign({},w.present||{},pp);
  if(pl) w.leadersPresent=Object.assign({},w.leadersPresent||{},pl);
  if(pg){ const pr=Object.assign({},w.progress||{}); for(const [kid,v] of Object.entries(pg)) pr[kid]=Object.assign({},pr[kid]||{},v); w.progress=pr; }
}
function scheduleFlush(){ clearTimeout(flushT); flushT=setTimeout(flush,700); }
function flush(){
  const ids=new Set([...Object.keys(pend.present),...Object.keys(pend.progress),...Object.keys(pend.leaders)]);
  for(const wid of ids){
    const pp=pend.present[wid], pg=pend.progress[wid], pl=pend.leaders[wid], data={};
    // field paths touch only the people that changed, so two people checking in different kids never overwrite each other
    if(pp) for(const [k,v] of Object.entries(pp)) data["present."+k]=v;
    if(pl) for(const [k,v] of Object.entries(pl)) data["leadersPresent."+k]=v;
    if(pg) for(const [k,o] of Object.entries(pg)) for(const [f,v] of Object.entries(o)) data["progress."+k+"."+f]=v;
    data.updatedAt=nowIso(); data.updatedBy=BY();
    updDoc("weeks",wid,data).then(()=>{ if(pend.present[wid]===pp) delete pend.present[wid]; if(pend.progress[wid]===pg) delete pend.progress[wid]; if(pend.leaders[wid]===pl) delete pend.leaders[wid]; }).catch(err=>toast(dbErr(err)));
  }
}
function curWeek(){ return S.weeks.find(x=>x.id===S.route.id); }
function toggleAtt(kidId){ const w=curWeek(); if(!w||!S.canWrite) return; pend.present[w.id]=Object.assign({},pend.present[w.id],{[kidId]:!presentIn(w,kidId)}); applyPending(w); render(); scheduleFlush(); }
function toggleLeader(id){ const w=curWeek(); if(!w||!S.canWrite) return; pend.leaders[w.id]=Object.assign({},pend.leaders[w.id],{[id]:!leaderIn(w,id)}); applyPending(w); render(); scheduleFlush(); }
function setProgress(kidId,f,val){
  const w=curWeek(); if(!w||!S.canWrite) return;
  const n=val===""?0:Math.max(0,num(val));
  const cur=Object.assign({},(pend.progress[w.id]||{})[kidId]||{},{[f]:n});
  pend.progress[w.id]=Object.assign({},pend.progress[w.id],{[kidId]:cur});
  if(n>0 && !presentIn(w,kidId)) pend.present[w.id]=Object.assign({},pend.present[w.id],{[kidId]:true});
  applyPending(w); scheduleFlush();
  if(n>0){ const row=document.querySelector(`[data-att="${CSS.escape(kidId)}"]`); if(row&&row.getAttribute("aria-checked")!=="true"){ row.setAttribute("aria-checked","true"); row.querySelector(".box").innerHTML=ICON.check; row.closest(".prow").classList.add("on"); } }
}

// ================= export / backup / restore =================
const cell = v => `"${String(v??"").replace(/"/g,'""')}"`;
const csvOf = (head, rows) => "﻿"+[head.map(cell).join(",")].concat(rows.map(r=>r.map(cell).join(","))).join("\r\n");
// file names stay ASCII: some browsers drop non-Latin download names
const slug = c => { const t=String(c.name||"").normalize("NFKD").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,""); return t||("club-"+String(c.id).slice(0,6)); };
function save(filename,data){
  const blob=data instanceof Blob?data:new Blob([data],{type:filename.endsWith(".json")?"application/json":"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function exportClub(c,what){
  const kids=clubKids(c.id).sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  const tag=S.season||L("كل السنوات","all years"), ftag=(S.season||"all").replace("–","-");
  if(what==="kids"){
    const head=[L("الاسم","Name"),L("الجنس","Gender"),L("تاريخ الميلاد","Born"),L("المرحلة","Program"),L("الصف","Grade"),L("المدرسة","School"),L("الكنيسة","Church"),L("الحالة","Status"),L("ولي الأمر","Parent"),L("هاتف ولي الأمر","Parent phone"),L("هاتف بديل","Alt. phone"),L("العنوان","Address"),L("موافقة التصوير","Photo consent"),L("الكتيّب","Handbook"),`${L("نقاط","Points")} (${tag})`,`${L("آيات","Verses")} (${tag})`,`${L("أقسام","Sections")} (${tag})`,`${L("نسبة الحضور","Attendance")} (${tag})`,L("مجموع النقاط","All-time points"),L("الجوائز","Awards")].concat(S.canWrite?[L("ملاحظات صحية","Health notes")]:[],[L("ملاحظات","Notes")]);
    const rows=kids.map(k=>{ const s=kidStats(k,S.season), t=kidTotal(k); return [k.name,tr(GENDER_EN,k.gender),k.birthdate,(PMAP[k.program]||{}).n||"",k.grade,k.school,k.church,tr(STATUS_EN,k.status||"نشط"),k.parentName,k.parentPhone,k.parent2,k.address,L(...CONSENT[k.photoOk||""]),k.book,s.pts,s.vrs,s.sec,s.p!=null?s.p+"%":"",t.pts,(k.awards||[]).join(L("، ",", "))].concat(S.canWrite?[(S.priv[k.id]||{}).health||""]:[],[k.notes]); });
    return save(`Awana-kids-${slug(c)}.csv`,csvOf(head,rows));
  }
  if(what==="leaders"){
    const head=[L("الاسم","Name"),L("الدور","Role"),L("المرحلة","Program"),L("الهاتف","Phone"),L("البريد","Email"),L("تاريخ الميلاد","Born"),L("بدأ الخدمة","Serving since"),L("المهنة","Occupation"),L("الكنيسة","Church"),L("التدريبات","Trainings"),`${L("نسبة الحضور","Attendance")} (${tag})`,L("ملاحظات","Notes")];
    const rows=[]; if(c.dirName){ const s=leaderStats("dir",c.id,S.season); rows.push([c.dirName,L("مدير النادي","Club director"),"",c.dirPhone,c.dirEmail,"",c.dirSince,c.dirJob,c.dirChurch,c.dirTraining,s.p!=null?s.p+"%":"",c.dirNotes]); }
    clubLeaders(c.id).forEach(l=>{ const s=leaderStats(l.id,c.id,S.season); rows.push([l.name,tr(ROLE_EN,l.role),(PMAP[l.program]||{}).n||"",l.phone,l.email,l.birthdate,l.joined,l.job,l.church,l.training,s.p!=null?s.p+"%":"",l.notes]); });
    return save(`Awana-leaders-${slug(c)}.csv`,csvOf(head,rows));
  }
  const ws=clubWeeks(c.id).slice().reverse();
  const head=[L("الطفل","Child"),L("المرحلة","Program")].concat(ws.map(w=>w.date),[L("أسابيع الحضور","Meetings attended"),L("النقاط","Points"),L("الآيات","Verses"),L("الأقسام","Sections")]);
  const rows=kids.map(k=>{ const s=kidStats(k,S.season); return [k.name,(PMAP[k.program]||{}).n||""].concat(ws.map(w=>{ const p=(w.progress||{})[k.id]||{}; return presentIn(w,k.id)?("✓"+(num(p.pts)?" "+num(p.pts):"")):""; }),[s.n+"/"+s.of,s.pts,s.vrs,s.sec]); });
  return save(`Awana-attendance-${slug(c)}-${ftag}.csv`,csvOf(head,rows));
}
function backupData(){
  const cp=a=>a.filter(x=>!String(x.id).startsWith("zz-probe")).map(x=>Object.assign({},x));
  return {app:"awana-jordan",version:4,exportedAt:nowIso(),by:BY(),clubs:cp(S.raw.clubs),leaders:cp(S.raw.leaders),kids:cp(S.raw.kids),weeks:cp(S.raw.weeks),
    private:Object.entries(S.priv).map(([id,v])=>Object.assign({id},v))};
}
function markBackup(){ if(S.isOwner||ROLE==="jordan") setDoc(doc(fs,"meta","backup"),{lastAt:nowIso(),by:BY()}).catch(()=>{}); }
function backup(){ save(`Awana-Jordan-backup-${today()}.json`,JSON.stringify(backupData(),null,1)); markBackup(); }
async function backupFull(){
  if(!window.JSZip) return toast(L("مكتبة الضغط لم تُحمّل بعد. حاول بعد لحظات.","The zip library isn't loaded yet. Try again in a moment."));
  const data=backupData();
  const ids=[...new Set([].concat(data.clubs.flatMap(c=>[c.photo,c.dirPhoto]),data.kids.map(k=>k.photo),data.leaders.map(l=>l.photo),data.weeks.flatMap(w=>w.photos||[])).filter(Boolean))];
  const zip=new JSZip(); zip.file("data.json",JSON.stringify(data,null,1));
  let i=0; for(const id of ids){ i++; if(i%5===0) toast(L(`جارٍ تجهيز الصور ${i} من ${ids.length}…`,`Preparing photos ${i} of ${ids.length}…`)); const src=await loadPhoto(id,true); if(src) zip.file(`photos/${id}.jpg`,src.split(",")[1],{base64:true}); }
  save(`Awana-Jordan-full-backup-${today()}.zip`,await zip.generateAsync({type:"blob"})); markBackup();
}
async function zipWeek(){
  const w=curWeek(); const c=w&&club(w.clubId); if(!w||!window.JSZip) return;
  toast(L("جارٍ تجهيز الصور…","Preparing photos…"));
  const zip=new JSZip(); let i=0;
  for(const id of w.photos||[]){ i++; try{ const src=await loadPhoto(id,true); if(!src) continue; zip.file(`${w.date}-${String(i).padStart(2,"0")}.jpg`,src.split(",")[1],{base64:true}); }catch{} }
  save(`Awana-photos-${c?slug(c):""}-${w.date}.zip`,await zip.generateAsync({type:"blob"}));
}
async function restorePrompt(file){
  let data, photos=null;
  try{
    if(/\.zip$/i.test(file.name)){ const z=await JSZip.loadAsync(file); data=JSON.parse(await z.file("data.json").async("string")); photos={}; z.folder("photos").forEach((p,f)=>{ photos[p.replace(/\.jpg$/,"")]=f; }); }
    else data=JSON.parse(await file.text());
  }catch{ return toast(L("الملف غير صالح. اختر ملف النسخة الاحتياطية (.json أو .zip).","Invalid file. Choose the backup (.json or .zip).")); }
  if(!data||data.app!=="awana-jordan") return toast(L("هذا الملف ليس نسخة احتياطية من هذا البرنامج.","This isn't a backup from this app."));
  const cols=["clubs","leaders","kids","weeks","private"]; const cur=c=>c==="private"?Object.keys(S.priv).map(id=>({id})):S.raw[c];
  const total=cols.reduce((s,k)=>s+(data[k]||[]).length,0);
  const missing=cols.reduce((s,k)=>s+(data[k]||[]).filter(x=>!cur(k).some(y=>y.id===x.id)).length,0);
  simpleModal(L("استرجاع من نسخة احتياطية","Restore from backup"), `<p style="margin:0">${L("نسخة بتاريخ","Backup from")} <b>${esc(fmtStamp(data.exportedAt))}</b>: ${(data.clubs||[]).length} ${L("نادٍ","clubs")} · ${(data.leaders||[]).length} ${L("مسؤول","leaders")} · ${(data.kids||[]).length} ${L("طفل","children")} · ${(data.weeks||[]).length} ${L("أسبوع","meetings")}${photos?` · ${Object.keys(photos).length} ${L("صورة","photos")}`:""}</p>
      <div class="list"><label class="radio"><input type="radio" name="rmode" value="missing" checked> ${L(`استرجاع الممسوح فقط (${missing} سجل) — لا يغيّر البيانات الحالية`,`Restore deleted records only (${missing}) — current data stays as is`)}</label>
      <label class="radio"><input type="radio" name="rmode" value="all"> ${L(`استرجاع كل شيء كما في النسخة (${total} سجل) — يرجّع أي تعديل حصل بعدها`,`Restore everything (${total}) — undoes later edits`)}</label></div>
      <p class="muted small" id="rProg" style="margin:0">${photos?L("الصور الناقصة هترجع من الملف.","Missing photos will be restored from the file."):L("ملف البيانات مافيهوش صور؛ الصور الموجودة هترجع مرتبطة بأسابيعها.","This data file has no photos; existing photos reconnect to their meetings.")}</p>`,
    `<span></span><div class="actions"><button type="button" class="btn ghost" data-close>${L("إلغاء","Cancel")}</button><button type="button" class="btn pri" data-restore>${L("استرجاع","Restore")}</button></div>`);
  $("#modalRoot").onclick=async e=>{
    if(e.target.id==="scrim"||e.target.closest("[data-close]")) return closeModal();
    const rb=e.target.closest("[data-restore]"); if(!rb) return;
    const mode=(document.querySelector("[name=rmode]:checked")||{}).value;
    rb.disabled=true;
    let done=0, fail=0; const jobs=[];
    for(const col of cols) for(const x of data[col]||[]){ if(!x||!x.id) continue; if(mode==="missing"&&cur(col).some(y=>y.id===x.id)) continue; jobs.push([col,x]); }
    const prog=()=>{ $("#rProg").textContent=L(`تم ${done} من ${jobs.length}`,`${done} of ${jobs.length} done`)+(fail?L(` · فشل ${fail}`,` · ${fail} failed`):""); };
    for(const [col,x] of jobs){
      let ok=false; const body={}; for(const [k,v] of Object.entries(x)) if(k!=="id") body[k]=v;
      for(let t=0;t<3&&!ok;t++){ try{ await setDoc(doc(fs,col,String(x.id)),body); ok=true; }catch(err){ const c=err&&err.code; if(c==="resource-exhausted"||c==="unavailable") await sleep(1500*(t+1)); else break; } }
      ok?done++:fail++; prog(); await sleep(30);
    }
    if(photos){ for(const [id,f] of Object.entries(photos)){ try{ const ex=await getDoc(doc(fs,"photos",id)); if(ex.exists()) continue; const blob=await f.async("blob"); const {full,thumb}=await makeJpegs(blob); const cid=((data.weeks||[]).find(w=>(w.photos||[]).includes(id))||(data.kids||[]).find(k=>k.photo===id)||{}).clubId||""; await setDoc(doc(fs,"thumbs",id),{data:thumb,clubId:cid,createdAt:nowIso(),by:BY()}); await setDoc(doc(fs,"photos",id),{data:full,clubId:cid,createdAt:nowIso(),by:BY()}); }catch{} } }
    audit("restoreBackup","","",`${done}`,"",fmtStamp(data.exportedAt));
    closeModal(); toast(fail?L(`تم استرجاع ${done} سجل، وفشل ${fail}. أعد المحاولة للباقي.`,`Restored ${done}; ${fail} failed. Try again for the rest.`):L(`تم استرجاع ${done} سجل.`,`Restored ${done} records.`));
  };
}

// ================= events =================
document.addEventListener("click",e=>{
  const t=e.target;
  if(t.closest("[data-lang]")) return setLang(LANG==="en"?"ar":"en");
  if(t.closest("[data-install]")) return doInstall();
  if(t.closest("[data-logout]")) return logout();
  if(t.closest("[data-settings]")) return go({v:"settings",tab:"acc"});
  if(t.closest("[data-reports]")) return go({v:"reports"});
  if(t.closest("#modalRoot")||t.closest("#lb")) return;
  const cp=t.closest("[data-copy]"); if(cp) return copyText(cp.dataset.copy);
  const sh=t.closest("[data-show]"); if(sh){ const el=document.getElementById("cur_"+sh.dataset.show); if(el) el.textContent = el.textContent.startsWith("•") ? el.dataset.pw : "••••••••"; return; }
  const gn=t.closest("[data-gen]"); if(gn){ const i=document.getElementById("np_"+gn.dataset.gen); if(i){ i.value=genPw(); i.focus(); } return; }
  const sp=t.closest("[data-setpw]"); if(sp) return setPw(sp.dataset.setpw);
  const tg=t.closest("[data-toggle]"); if(tg) return toggleAcc(tg.dataset.toggle);
  const kk=t.closest("[data-kick]"); if(kk) return kick(kk.dataset.kick);
  if(t.closest("[data-adminpw]")) return adminPw();
  if(t.closest("[data-probe]")) return runProbe();
  const st=t.closest("[data-stab]"); if(st){ S.route.tab=st.dataset.stab; return render(); }
  const rr=t.closest("[data-restore-rec]"); if(rr){ const [c,id]=rr.dataset.restoreRec.split("|"); return restoreRec(c,id); }
  const pr=t.closest("[data-purge-rec]"); if(pr){ if(pr.dataset.sure){ const [c,id]=pr.dataset.purgeRec.split("|"); return purgeRec(c,id); } pr.dataset.sure="1"; pr.textContent=L("تأكيد المسح؟","Confirm?"); return; }
  const rp=t.closest("[data-restore-ph]"); if(rp) return restorePh(rp.dataset.restorePh);
  const pp=t.closest("[data-purge-ph]"); if(pp) return purgePh(pp.dataset.purgePh);
  if(t.closest("[data-empty-trash]")){ $("#emptyZone").innerHTML=`<span class="confirm-box">${L("كل اللي في السلة هيتمسح نهائياً.","Everything in the trash will be deleted forever.")} <button type="button" class="btn sm danger" data-empty-yes>${L("امسح","Delete")}</button></span>`; return; }
  if(t.closest("[data-empty-yes]")) return emptyTrash();
  const a=t.closest("[data-act]");
  const r=S.route, c=r.v==="club"?club(r.id):r.v==="week"?club(r.clubId):null;
  if(a){ const act=a.dataset.act;
    if(act==="newClub") return clubForm(null);
    if(act==="editClub") return clubForm(c);
    if(act==="newLeader") return leaderForm(c.id,null);
    if(act==="newKid") return kidForm(c.id,null);
    if(act==="newWeek") return weekForm(c.id,null);
    if(act==="editWeek") return weekForm(r.clubId,curWeek());
    if(act==="backup") return backup();
    if(act==="backupFull") return backupFull();
    if(act==="zip") return zipWeek();
    if(act==="rollover") return rolloverDialog(c);
    if(act==="exportReport") return exportReport();
  }
  const ex=t.closest("[data-export]"); if(ex&&c) return exportClub(c,ex.dataset.export);
  if(t.closest("[data-home]")) return go({v:"home"});
  const oc=t.closest("[data-open-club]"); if(oc){ S.kidQ=""; S.progF=""; return go({v:"club",id:oc.dataset.openClub,tab:oc.dataset.tabTo||"info"}); }
  const tb=t.closest("[data-tab]"); if(tb){ S.route.tab=tb.dataset.tab; return render(); }
  const ty=t.closest("[data-type]"); if(ty){ S.typeF=ty.dataset.type; return render(); }
  const pg=t.closest("[data-prog]"); if(pg){ S.progF=pg.dataset.prog; return render(); }
  const ok=t.closest("[data-open-kid]"); if(ok){ const k=S.kids.find(x=>x.id===ok.dataset.openKid); return k&&kidProfile(k); }
  const ol=t.closest("[data-open-leader]"); if(ol){ const l=S.leaders.find(x=>x.id===ol.dataset.openLeader); return l&&leaderProfile(l); }
  const ow=t.closest("[data-open-week]"); if(ow) return go({v:"week",clubId:r.id,id:ow.dataset.openWeek});
  const at=t.closest("[data-att]"); if(at) return toggleAtt(at.dataset.att);
  const la=t.closest("[data-latt]"); if(la) return toggleLeader(la.dataset.latt);
  const lb=t.closest("[data-lb]"); if(lb) return openLb(+lb.dataset.lb);
});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.id==="qClubs"){ S.q=t.value; render(); }
  else if(t.id==="qKids"||t.id==="qKidsClub"){ S.kidQ=t.value; render(); }
  else if(t.dataset&&t.dataset.pg){ setProgress(t.dataset.pg,t.dataset.f,t.value); }
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.id==="photoInput") addPhotos(t.files);
  else if(t.id==="seasonSel"){ S.season=t.value; S.repMonth=""; render(); }
  else if(t.id==="repClub"){ S.repClub=t.value; render(); }
  else if(t.id==="repMonth"){ S.repMonth=t.value; render(); }
  else if(t.id==="auditF"){ S.auditF=t.value; render(); }
  else if(t.id==="restoreInput"&&t.files[0]){ restorePrompt(t.files[0]); t.value=""; }
});
document.addEventListener("dragover",e=>{ const d=e.target.closest&&e.target.closest("#drop"); if(d){ e.preventDefault(); d.classList.add("over"); } });
document.addEventListener("dragleave",e=>{ const d=e.target.closest&&e.target.closest("#drop"); if(d) d.classList.remove("over"); });
document.addEventListener("drop",e=>{ const d=e.target.closest&&e.target.closest("#drop"); if(d){ e.preventDefault(); addPhotos(e.dataTransfer.files); } });
window.addEventListener("pagehide",()=>{ clearTimeout(flushT); flush(); });

// ================= sign-in =================
// admin: Firebase email account. jordan / view / club: anonymous device + a session doc holding the
// password the admin set; Firestore rules compare it to secrets/keys on every request.
const params=new URLSearchParams(location.search);
const wanted=["admin","jordan","view","club"].includes(params.get("as"))?params.get("as"):"";
const wantedClub=params.get("c")||"";
// #3 slow down password guessing on this device
const THR="awana-fails";
function failsGet(){ try{ return JSON.parse(localStorage.getItem(THR)||"[]").filter(t=>Date.now()-t<60*60e3); }catch{ return []; } }
function failsAdd(){ try{ const f=failsGet(); f.push(Date.now()); localStorage.setItem(THR,JSON.stringify(f)); }catch{} }
function failsClear(){ try{ localStorage.removeItem(THR); }catch{} }
function lockedFor(){ const f=failsGet(); if(f.length<5) return 0; const wait=Math.min(30, 2**(f.length-5))*60e3; return Math.max(0, f[f.length-1]+wait-Date.now()); }
function loginView(msg){
  pendingMsg=msg||"";
  ROLE=""; S.isOwner=false; S.isClub=false; renderTools();
  const roleSel=wanted?"":`<div class="f"><label for="lgRole">${L("الحساب","Account")}</label><select id="lgRole">${["admin","jordan","view","club"].map(k=>`<option value="${k}">${esc(accLabel(k))}</option>`).join("")}</select></div>`;
  const showCode = wanted==="club" && !wantedClub;
  $("#app").innerHTML=`<div class="login"><div class="panel">
    <img class="login-logo" src="icons/icon-192.png" alt="Awana Jordan" width="96" height="96">
    <h1 class="login-h">${heroTitle()}</h1>
    <form id="loginForm" class="login-f" novalidate>
      ${wanted?`<p class="login-who">${esc(accLabel(wanted))}</p>`:roleSel}
      <div class="f" id="codeRow" ${showCode?"":"hidden"}><label for="lgCode">${L("رمز النادي","Club code")}</label><input id="lgCode" type="text" autocomplete="off" spellcheck="false" value="${esc(wantedClub)}"></div>
      <div class="f"><label for="lgPass">${L("كلمة المرور","Password")}</label><input id="lgPass" type="password" autocomplete="current-password" required></div>
      <p class="small" id="lgErr" role="alert" style="color:var(--danger);margin:0">${esc(pendingMsg)}</p>
      <button class="btn pri" type="submit" id="lgBtn">${L("دخول","Sign in")}</button>
      <button class="linkbtn2 small" type="button" id="lgForgot" ${wanted&&wanted!=="admin"?"hidden":""}>${L("نسيت كلمة المرور؟ (للمدير)","Forgot password? (admin)")}</button>
    </form>
    ${canInstall()?`<button type="button" class="btn ghost install-cta" data-install>${ICON.phone} ${L("ثبّت التطبيق على موبايلك","Install the app on your phone")}</button>`:""}
  </div></div>`;
  const rs=$("#lgRole"); if(rs){ const sync=()=>{ $("#codeRow").hidden=rs.value!=="club"; $("#lgForgot").hidden=rs.value!=="admin"; }; rs.onchange=sync; sync(); }
  setTimeout(()=>$("#lgPass")?.focus(),30);
  $("#lgForgot").onclick=async()=>{
    try{ await sendPasswordResetEmail(auth,ADMIN_EMAIL); $("#lgErr").style.color="var(--ok)"; $("#lgErr").textContent=L(`بعتنا رابط تغيير كلمة المرور على ${ADMIN_EMAIL}. افتح الإيميل (وشوف Spam كمان).`,`We sent a reset link to ${ADMIN_EMAIL}. Check your inbox (and spam).`); }
    catch{ $("#lgErr").style.color="var(--danger)"; $("#lgErr").textContent=L("تعذّر إرسال الإيميل. تأكد إن حساب المدير معمول بإيميل حقيقي.","Couldn't send the email. Make sure the admin account uses a real email."); }
  };
  $("#loginForm").onsubmit=async e=>{
    e.preventDefault();
    const role=wanted||$("#lgRole").value, pass=$("#lgPass").value, code=(($("#lgCode")||{}).value||"").trim()||wantedClub;
    const fail=m=>{ $("#lgErr").style.color="var(--danger)"; $("#lgErr").textContent=m; $("#lgBtn").disabled=false; $("#lgBtn").textContent=L("دخول","Sign in"); };
    const wait=lockedFor(); if(wait) return fail(L(`محاولات خاطئة كثيرة. حاول بعد ${Math.ceil(wait/60000)} دقيقة.`,`Too many wrong attempts. Try again in ${Math.ceil(wait/60000)} min.`));
    if(!pass) return fail(L("اكتب كلمة المرور.","Enter the password."));
    if(role==="club"&&!code) return fail(L("اكتب رمز النادي.","Enter the club code."));
    $("#lgBtn").disabled=true; $("#lgBtn").textContent=L("جارٍ الدخول…","Signing in…");
    if(role==="admin"){
      try{ await signInWithEmailAndPassword(auth,ADMIN_EMAIL,pass); failsClear(); }
      catch(err){ const c=err&&err.code; if(c!=="auth/network-request-failed") failsAdd(); fail(c==="auth/too-many-requests"?L("محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.","Too many attempts. Wait a bit and try again."):c==="auth/network-request-failed"?L("لا يوجد اتصال بالإنترنت.","No internet connection."):L("كلمة المرور غير صحيحة.","Wrong password.")); }
      return;
    }
    loggingIn=true;
    try{
      if(auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
      if(!auth.currentUser) await signInAnonymously(auth);
      const s={role,key:pass,at:nowIso(),device:navigator.userAgent.slice(0,140)}; if(role==="club") s.clubId=code;
      await setDoc(doc(fs,"sessions",auth.currentUser.uid),s);
      failsClear(); loggingIn=false; start(role, role==="club"?code:"");
    }catch(err){
      const c=err&&err.code;
      if(c==="permission-denied") failsAdd();
      const m=c==="permission-denied"?(role==="club"?L("رمز النادي أو كلمة المرور غير صحيحة، أو الحساب موقوف.","Wrong club code or password, or the account is disabled."):L("كلمة المرور غير صحيحة أو الحساب موقوف.","Wrong password, or this account is disabled.")):
        c==="auth/operation-not-allowed"||c==="auth/admin-restricted-operation"?L("الدخول المجهول غير مفعّل في Firebase (Authentication > Anonymous).","Anonymous sign-in isn't enabled in Firebase (Authentication > Anonymous)."):
        c==="auth/network-request-failed"||c==="unavailable"?L("لا يوجد اتصال بالإنترنت.","No internet connection."):L("تعذّر الدخول. حاول مجدداً.","Couldn't sign in. Try again.");
      pendingMsg=m; fail(m);
      try{ if(auth.currentUser&&auth.currentUser.isAnonymous) await signOut(auth); }catch{}
      loggingIn=false;
    }
  };
}
function resetState(){ unsubs.forEach(u=>{ try{u();}catch{} }); unsubs=[]; Object.assign(S,{raw:{clubs:[],kids:[],leaders:[],weeks:[]},clubs:[],kids:[],leaders:[],weeks:[],priv:{},sessions:[],keys:null,trash:[],audit:[],meta:{},loaded:{clubs:0,kids:0,leaders:0,weeks:0},route:{v:"home"},canWrite:false,canUpload:false,canTransfer:false,isOwner:false,isClub:false,repClub:""}); assets=null; phCache.clear(); ROLE=""; CLUB_ID=""; probeLog=[]; }
async function logout(msg){
  const u=auth&&auth.currentUser;
  resetState(); pendingMsg=msg||"";
  if(u&&u.isAnonymous){ try{ await deleteDoc(doc(fs,"sessions",u.uid)); }catch{} }
  try{ await signOut(auth); }catch{}
  loginView(pendingMsg);
}
function start(role, clubId){
  if(ROLE===role && CLUB_ID===(clubId||"")) return;
  resetState(); ROLE=role; CLUB_ID=clubId||""; pendingMsg="";
  S.canWrite = role==="admin"||role==="jordan"||role==="club"; S.canUpload=S.canWrite; assets=S.canWrite?{}:null;
  S.isOwner = role==="admin"; S.isClub = role==="club"; S.canTransfer = role==="admin"||role==="jordan";
  S.season=curSeason(); renderTools();
  if(S.isClub) S.route={v:"club",id:CLUB_ID,tab:"info"};
  const onErr=err=>{
    if(err&&err.code==="permission-denied"&&role!=="admin") return logout(L("تم تغيير كلمة المرور أو إيقاف الحساب. ادخل من جديد.","The password was changed or the account was disabled. Please sign in again."));
    S.err=dbErr(err); toast(S.err);
  };
  const editing=()=>S.route.v==="settings"&&/^(np_|ap)/.test(document.activeElement?.id||"");
  const apply=(col,docs)=>{ S.raw[col]=docs; S.loaded[col]=1; recompute(); if(col==="weeks") S.weeks.forEach(applyPending);
    const typing=document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.pg;
    if(!(typing&&col==="weeks")&&!editing()) render(); if(col==="clubs") renderTools(); if($("#lb")) drawLb(); };
  const listen=(ref,cb)=>unsubs.push(onSnapshot(ref,cb,onErr));
  const docs=snap=>snap.docs.map(d=>Object.assign({id:d.id},d.data()));
  if(S.isClub){
    listen(doc(fs,"clubs",CLUB_ID), d=>apply("clubs", d.exists()?[Object.assign({id:d.id},d.data())]:[]));
    for(const col of ["kids","leaders","weeks"]) listen(query(collection(fs,col),where("clubId","==",CLUB_ID)), snap=>apply(col,docs(snap)));
    listen(query(collection(fs,"private"),where("clubId","==",CLUB_ID)), snap=>{ S.priv=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()])); });
  } else {
    for(const col of ["clubs","kids","leaders","weeks"]) listen(collection(fs,col), snap=>apply(col,docs(snap)));
    if(S.canWrite) listen(collection(fs,"private"), snap=>{ S.priv=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()])); });
  }
  listen(doc(fs,"meta","backup"), d=>{ S.meta.backup=d.exists()?d.data():null; if(!editing()) render(); });
  if(S.isOwner){
    const rs=()=>{ if(S.route.v==="settings"&&!editing()) render(); };
    listen(doc(fs,"secrets","keys"), d=>{ S.keys=d.exists()?d.data():{}; rs(); });
    listen(collection(fs,"sessions"), snap=>{ S.sessions=docs(snap); rs(); });
    listen(collection(fs,"trash"), snap=>{ S.trash=docs(snap); rs(); });
    listen(query(collection(fs,"audit"),orderBy("at","desc"),limit(300)), snap=>{ S.audit=docs(snap); rs(); });
  }
  render();
}

// ================= boot =================
renderTools();
if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
CFG=window.FIREBASE_CONFIG||{};
if(!CFG.projectId||/ضع/.test(CFG.projectId)){
  $("#app").innerHTML=`<div class="login"><div class="panel"><h2>${L("الإعداد غير مكتمل","Setup isn't finished")}</h2><p>${L("افتح ملف config.js والصق بيانات مشروع Firebase مكان «ضع-هنا».","Open config.js and paste your Firebase project settings.")}</p></div></div>`;
} else {
  APP=initializeApp(CFG);
  // #3 optional App Check (reCAPTCHA v3): blocks scripted password guessing from outside this site
  if(window.RECAPTCHA_V3_SITE_KEY){ import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js").then(m=>m.initializeAppCheck(APP,{provider:new m.ReCaptchaV3Provider(window.RECAPTCHA_V3_SITE_KEY),isTokenAutoRefreshEnabled:true})).catch(()=>{}); }
  auth=getAuth(APP);
  try{ fs=initializeFirestore(APP,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}); }
  catch{ fs=initializeFirestore(APP,{}); }
  onAuthStateChanged(auth, async u=>{
    if(loggingIn) return;
    if(!u){ if(ROLE) resetState(); return loginView(pendingMsg); }
    if(!u.isAnonymous){
      if(String(u.email||"").toLowerCase()!==ADMIN_EMAIL){ await signOut(auth); return loginView(L("هذا الحساب غير مسموح له بالدخول.","This account isn't allowed.")); }
      if(wanted && wanted!=="admin") return logout();
      return start("admin");
    }
    let s={};
    try{ const d=await getDoc(doc(fs,"sessions",u.uid)); s=d.exists()?d.data():{}; }catch{}
    if(!["jordan","view","club"].includes(s.role)) return logout(pendingMsg);
    // opening another account's link on a device that's signed in switches accounts
    if(wanted && (wanted!==s.role || (wanted==="club"&&wantedClub&&wantedClub!==s.clubId))) return logout();
    start(s.role, s.clubId||"");
  });
}
})();
