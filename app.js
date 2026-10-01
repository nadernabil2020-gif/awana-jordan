import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, writeBatch, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(() => {
"use strict";

// ---------- language ----------
let LANG = "ar";
try{ LANG = localStorage.getItem("awana-lang")==="en" ? "en" : "ar"; }catch{}
const L = (ar,en) => LANG==="en" ? en : ar;
function applyLang(){ document.documentElement.lang=LANG; document.documentElement.dir=LANG==="en"?"ltr":"rtl"; document.title=L("أندية أوانا الأردن","Awana Jordan"); const j=document.getElementById("logoJo"); if(j) j.textContent=L("الأردن","JORDAN"); }
applyLang();

// ---------- constants ----------
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
// stored values stay Arabic; English is a display label
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
const KID_FORM = [
  {legend:["بيانات الطفل","Child details"], fields:[
    {k:"name",l:["اسم الطفل الكامل","Child's full name"],req:1,wide:1},
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
    {k:"health",l:["ملاحظات صحية / حساسية","Health notes / allergies"],t:"textarea",wide:1},
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
  ]},
];
const WEEK_FORM = [{legend:["بيانات الأسبوع","Meeting details"], fields:[
  {k:"date",l:["تاريخ الاجتماع","Meeting date"],t:"date",req:1},
  {k:"title",l:["عنوان / موضوع الأسبوع","Title / theme"]},
  {k:"theme",l:["ليلة مميزة (اختياري)","Special night (optional)"],ph:["مثال: ليلة الألوان، ليلة الأبطال","e.g. Crazy Hair Night"]},
  {k:"visitors",l:["عدد الزوار","Visitors"],t:"number"},
  {k:"leadersCount",l:["عدد المسؤولين الحاضرين","Leaders present"],t:"number"},
  {k:"lesson",l:["الدرس / الآية الأساسية","Lesson / key verse"],wide:1},
  {k:"notes",l:["ملاحظات عن الاجتماع","Meeting notes"],t:"textarea",wide:1},
]}];

// ---------- state ----------
const S = {clubs:[],kids:[],leaders:[],weeks:[],sessions:[],keys:null,loaded:{clubs:0,kids:0,leaders:0,weeks:0},
  route:{v:"home"}, q:"", typeF:"", kidQ:"", progF:"", season:"", canWrite:false, canUpload:false, isOwner:false, err:""};
let fs=null, auth=null, ROLE="", unsubs=[], loggingIn=false, pendingMsg="";
let assets=null; const downloads=true;

// ---------- helpers ----------
const $ = (s,el=document)=>el.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = Number(v); return isFinite(n)?n:0; };
const loc = () => LANG==="en"?"en-GB":"ar-JO";
const fmtDate = d => { if(!d) return ""; try{ return new Date(d+"T00:00:00").toLocaleDateString(loc(),{day:"numeric",month:"long",year:"numeric"}); }catch{ return d; } };
const fmtDateShort = d => { if(!d) return ""; try{ return new Date(d+"T00:00:00").toLocaleDateString(loc(),{day:"numeric",month:"short"}); }catch{ return d; } };
const age = b => { if(!b) return ""; const d=new Date(b+"T00:00:00"), n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n.getMonth()<d.getMonth()||(n.getMonth()==d.getMonth()&&n.getDate()<d.getDate())) a--; return a>=0&&a<100?a:""; };
const initial = s => (String(s||"?").replace(/^\s*(نادي|نادٍ|أندية|awana)\s+(أوانا\s*[–-]?\s*)?/i,"").trim()[0]||"?");
const pgChip = k => PMAP[k] ? `<span class="pg" style="--c:var(${PMAP[k].c})">${esc(PMAP[k].n)}</span>` : "";
const hue = s => { let h=0; for(const ch of String(s||"")) h=(h*31+ch.charCodeAt(0))>>>0; return "c"+(h%4); };
const avatar = (photo,name,cls="") => `<span class="avatar ${hue(name)} ${cls}">${photo?`<img data-ph="${esc(photo)}" alt="">`:esc(initial(name))}</span>`;
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const SEP = () => L("‹","›");
const norm = s => String(s??"").toLowerCase().replace(/[ً-ٰٟـ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s+/g," ").trim();
const has = (parts,q) => norm(parts.join(" ")).includes(norm(q));
const seasonOf = d => { if(!d) return ""; const [y,m]=String(d).split("-").map(Number); if(!y) return ""; const s=m>=8?y:y-1; return s+"–"+(s+1); };
const curSeason = () => seasonOf(today());
const isActive = k => (k.status||"نشط")==="نشط";
const noPhoto = k => k.photoOk==="no";
const presentIn = (w,id) => !!(w.present||{})[id];
const presentCount = w => Object.values(w.present||{}).filter(Boolean).length;
const nKids = n => L(`${n} طفل`,`${n} ${n===1?"child":"children"}`);

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
};
let toastT;
function toast(msg){ let t=$("#toast"); if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");document.body.appendChild(t);} t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3400); }
function dbErr(e){ const c=e&&e.code; if(c==="permission-denied") return L("هذا الحساب لا يملك صلاحية هذا الإجراء.","This account isn't allowed to do that."); if(c==="resource-exhausted") return L("تم تجاوز الحد المجاني اليومي أو امتلأت المساحة. حاول غداً أو راجع Firebase.","The free daily limit or storage is used up. Try tomorrow or check Firebase."); if(c==="unavailable") return L("لا يوجد اتصال. سيتم الحفظ تلقائياً عند عودة الإنترنت.","No connection. Changes will sync when you're back online."); return L("تعذّر الحفظ. تحقّق من الاتصال ثم حاول مجدداً.","Couldn't save. Check your connection and try again."); }
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast(L("تم النسخ","Copied")); }catch{ toast(t); } }

// serialized writes per doc
const chains = {};
function write(path, fn){
  const p=(chains[path]||Promise.resolve()).catch(()=>{}).then(fn); chains[path]=p;
  // offline: Firestore keeps the change on this device and sends it when the connection returns
  if(!navigator.onLine){ p.catch(e=>toast(dbErr(e))); toast(L("لا يوجد إنترنت: تم الحفظ على الجهاز وسيُرسل تلقائياً عند عودة الاتصال.","Offline: saved on this device and will sync when you're back online.")); return Promise.resolve(); }
  return p;
}
async function saveDoc(col,id,data){ return write(col+"/"+id, ()=>setDoc(doc(fs,col,id),data)); }
async function updDoc(col,id,data){ return write(col+"/"+id, ()=>updateDoc(doc(fs,col,id),data)); }
async function delDoc(col,id){ return write(col+"/"+id, ()=>deleteDoc(doc(fs,col,id))); }

// ---------- photos (compressed JPEG inside Firestore: thumbs/{id} for grids, photos/{id} full size) ----------
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
async function uploadImage(file){
  if(!assets) throw {code:"not_granted"};
  if(!navigator.onLine) throw {code:"offline"};
  let bmp; try{ bmp=await createImageBitmap(file); }catch{ throw {code:"unsupported_type"}; }
  // full copy stays under Firestore's 1 MB document limit; the thumb keeps grids fast
  let full=""; for(const [m,q] of [[1280,.78],[1280,.65],[1024,.62],[900,.55],[720,.5]]){ full=toJpeg(bmp,m,q); if(full.length<900000) break; }
  if(full.length>=900000) throw {code:"too_large"};
  const thumb=toJpeg(bmp,360,.7);
  const id=doc(collection(fs,"photos")).id, meta={createdAt:new Date().toISOString(), by:ROLE};
  await setDoc(doc(fs,"thumbs",id),{data:thumb,...meta});
  await setDoc(doc(fs,"photos",id),{data:full,...meta});
  phCache.set("t:"+id,Promise.resolve(thumb)); phCache.set("f:"+id,Promise.resolve(full));
  return id;
}
function dropAssets(ids){ if(!assets) return; for(const id of new Set(ids.filter(Boolean))){ deleteDoc(doc(fs,"photos",id)).catch(()=>{}); deleteDoc(doc(fs,"thumbs",id)).catch(()=>{}); phCache.delete("t:"+id); phCache.delete("f:"+id); } }
function upErr(e){ const c=e&&e.code; return c==="too_large"?L("تعذّر ضغط الصورة بما يكفي. جرّب صورة أخرى.","Couldn't shrink this photo enough. Try another one."):c==="unsupported_type"?L("نوع الصورة غير مدعوم. استخدم JPG أو PNG.","Unsupported image type. Use JPG or PNG."):c==="resource-exhausted"?L("امتلأت المساحة المجانية أو تجاوزت حد اليوم.","Free storage or today's limit is used up."):c==="permission-denied"||c==="not_granted"?L("رفع الصور غير مسموح لهذا الحساب.","This account can't upload photos."):c==="offline"?L("رفع الصور يحتاج اتصال بالإنترنت.","Uploading photos needs an internet connection."):L("تعذّر رفع الصورة. تحقّق من الاتصال وحاول مجدداً.","Upload failed. Check your connection and try again."); }

// ---------- derived ----------
const club = id => S.clubs.find(c=>c.id===id);
const clubKids = id => S.kids.filter(k=>k.clubId===id);
const clubLeaders = id => S.leaders.filter(k=>k.clubId===id);
const clubWeeksAll = id => S.weeks.filter(k=>k.clubId===id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
const clubWeeks = id => clubWeeksAll(id).filter(w=>!S.season||seasonOf(w.date)===S.season);
function kidStats(k, season){
  let pts=0,sec=0,vrs=0,n=0,of=0;
  for(const w of S.weeks){
    if(w.clubId!==k.clubId) continue;
    if(season && seasonOf(w.date)!==season) continue;
    if(k.joined && String(w.date)<k.joined) continue;
    of++; if(presentIn(w,k.id)) n++;
    const p=(w.progress||{})[k.id]; if(p){ pts+=num(p.pts); sec+=num(p.sec); vrs+=num(p.vrs); }
  }
  return {pts,sec,vrs,n,of,p:of?Math.round(n*100/of):null};
}
function kidTotal(k){ const a=kidStats(k,""); return {pts:a.pts+num(k.points), sec:a.sec+num(k.sections), vrs:a.vrs+num(k.verses)}; }
function seasons(){ const s=new Set([curSeason()]); S.weeks.forEach(w=>{ const x=seasonOf(w.date); if(x) s.add(x); }); return [...s].sort().reverse(); }
const seasonLabel = s => s ? L("سنة ","Year ")+s : L("كل السنوات","All years");
function seasonSelect(){ return `<label class="season"><span>${L("السنة","Year")}</span><select id="seasonSel">${seasons().map(s=>`<option value="${s}" ${s===S.season?"selected":""}>${s}${s===curSeason()?L(" (الحالية)"," (current)"):""}</option>`).join("")}<option value="" ${!S.season?"selected":""}>${L("كل السنوات","All years")}</option></select></label>`; }

// ---------- header tools: install, language, settings, account ----------
let installEvt=null;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const canInstall = () => !isStandalone() && (!!installEvt || isIOS());
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); installEvt=e; renderTools(); if(!ROLE) loginView(pendingMsg); });
window.addEventListener("appinstalled",()=>{ installEvt=null; renderTools(); toast(L("تم تثبيت التطبيق","App installed")); });
async function doInstall(){
  if(installEvt){ installEvt.prompt(); try{ await installEvt.userChoice; }catch{} installEvt=null; renderTools(); return; }
  $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><div class="modal" role="dialog" aria-modal="true">
    <div class="modal-h"><h2>${L("تثبيت التطبيق على الآيفون","Install on iPhone / iPad")}</h2><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
    <div class="modal-b"><div class="install-steps">
      <div class="istep"><b>1</b><span>${L("افتح الرابط من متصفح Safari.","Open this link in Safari.")}</span></div>
      <div class="istep"><b>2</b><span>${L("اضغط زر المشاركة (المربع والسهم لأعلى) أسفل الشاشة.","Tap the Share button (square with an up arrow).")}</span></div>
      <div class="istep"><b>3</b><span>${L("اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».","Choose “Add to Home Screen”, then “Add”.")}</span></div>
    </div><p class="muted small" style="margin:0">${L("هتلاقي أيقونة Awana Jordan على الشاشة، وتفتح التطبيق مباشرة.","The Awana Jordan icon will appear on your home screen.")}</p></div></div></div>`;
  $("#modalRoot").onclick=e=>{ if(e.target.id==="scrim"||e.target.closest("[data-close]")) closeModal(); };
}
function renderTools(){
  const el=$("#tools"); if(!el) return;
  el.innerHTML=`${canInstall()?`<button type="button" class="tbtn" data-install>${ICON.phone}<span>${L("تثبيت التطبيق","Install app")}</span></button>`:""}
    <button type="button" class="tbtn" data-lang aria-label="${L("Switch to English","التحويل إلى العربية")}">${ICON.globe}<span>${L("English","عربي")}</span></button>
    ${S.isOwner?`<button type="button" class="tbtn" data-settings>${ICON.gear}<span>${L("الإعدادات","Settings")}</span></button>`:""}
    ${ROLE?`<span class="role">${esc(accLabel(ROLE))} · <button type="button" class="linkbtn" data-logout>${L("خروج","Sign out")}</button></span>`:""}`;
}
function setLang(l){
  LANG=l; try{ localStorage.setItem("awana-lang",l); }catch{}
  applyLang(); renderTools();
  if($("#modalRoot").firstChild) closeModal();
  if(ROLE) render(); else if(fs) loginView(pendingMsg); else render();
}

// ---------- routing ----------
function go(r){ S.route=r; window.scrollTo(0,0); render(); }
$("#goHome").onclick=()=>{ if(ROLE) go({v:"home"}); };

// ---------- render ----------
function render(){
  if(!ROLE){ if(S.err) $("#app").innerHTML=`<div class="login"><div class="panel"><p>${esc(S.err)}</p></div></div>`; return; }
  const app=$("#app"); const r=S.route;
  const ae=document.activeElement; const focusId = ae && ae.id;
  let caret=null; try{ caret=ae.selectionStart; }catch{}
  if(r.v==="club" && !club(r.id) && S.loaded.clubs) S.route={v:"home"};
  if(r.v==="week" && !S.weeks.find(w=>w.id===r.id) && S.loaded.weeks) S.route={v:"club",id:r.clubId,tab:"weeks"};
  if(r.v==="settings" && !S.isOwner) S.route={v:"home"};
  const v=S.route.v;
  app.innerHTML = v==="home"?homeView(): v==="club"?clubView(): v==="settings"?settingsView(): weekView();
  if(focusId){ const el=document.getElementById(focusId); if(el && el!==document.activeElement){ el.focus(); try{ if(caret!=null) el.setSelectionRange(caret,caret);}catch{} } }
}
const heroTitle = () => LANG==="en" ? `<span class="w1">Awana</span> <span class="w2">Clubs</span> <span class="w3">Jordan</span>` : `<span class="w1">أندية</span> <span class="w2">أوانا</span> في <span class="w3">الأردن</span>`;

function homeView(){
  const kidsActive = S.kids.filter(isActive).length;
  const sw = S.weeks.filter(w=>!S.season||seasonOf(w.date)===S.season);
  const photos = sw.reduce((s,w)=>s+(w.photos||[]).length,0);
  const q=S.q.trim();
  let list = S.clubs.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  if(S.typeF) list=list.filter(c=>c.type===S.typeF);
  if(q) list=list.filter(c=>has([c.name,c.host,c.city,tr(CITY_EN,c.city),c.area,c.dirName],q));
  const kq=S.kidQ.trim();
  const kidHits = kq ? S.kids.filter(k=>has([k.name,k.parentName,k.parentPhone,k.parent2],kq)).slice(0,30) : [];
  return `
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
  ${S.loaded.clubs?`
  <section class="panel backup">
    <h2>${L("النسخ الاحتياطي","Backup")}</h2>
    <p class="muted small">${L("ملف واحد فيه كل بيانات الأندية والمسؤولين والأطفال والأسابيع والحضور. احفظه كل فترة في مكان آمن.","One file with every club, leader, child, meeting and attendance record. Save it somewhere safe from time to time.")}${S.isOwner?L(" ويمكنك استرجاع البيانات منه لو اتمسح شيء بالغلط."," You can restore from it if something is deleted by mistake."):""}</p>
    <div class="actions"><button class="btn" type="button" data-act="backup">${ICON.dl} ${L("تحميل نسخة احتياطية كاملة","Download full backup")}</button>${S.isOwner?`<label class="btn">${ICON.up} ${L("استرجاع من نسخة احتياطية","Restore from backup")}<input id="restoreInput" type="file" accept=".json,application/json" hidden></label>`:""}</div>
  </section>`:""}`;
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
  return `
  <nav class="crumbs"><button type="button" data-home>${L("كل الأندية","All clubs")}</button><span>${SEP()}</span><span>${esc(c.name)}</span></nav>
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
      ${c.notes?`<div class="note">${esc(c.notes)}</div>`:""}</section>
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
    </div>
  </div>`;
}
function leadersTab(c,leaders){
  const sorted=leaders.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  return `<div class="bar" style="justify-content:space-between"><p class="muted small" style="margin:0">${L("المدير يُعدَّل من بيانات النادي. هنا باقي فريق الخدمة.","Edit the director from the club details. The rest of the team is listed here.")}</p>${S.canWrite?`<button class="btn pri" type="button" data-act="newLeader">${ICON.plus} ${L("إضافة مسؤول","Add leader")}</button>`:""}</div>
  <div class="list">
    ${c.dirName?`<button class="row" type="button" ${S.canWrite?'data-act="editClub"':""}>${avatar(c.dirPhoto,c.dirName,"round")}<span class="grow"><span class="name">${esc(c.dirName)}</span><span class="meta"><span class="type-pill">${L("مدير النادي","Club director")}</span>${c.dirPhone?`<span>${esc(c.dirPhone)}</span>`:""}</span></span></button>`:""}
    ${sorted.map(l=>`<button class="row" type="button" data-open-leader="${esc(l.id)}">${avatar(l.photo,l.name,"round")}<span class="grow"><span class="name">${esc(l.name)}</span><span class="meta">${l.role?`<span>${esc(tr(ROLE_EN,l.role))}</span>`:""}${pgChip(l.program)}${l.phone?`<span>${esc(l.phone)}</span>`:""}</span></span></button>`).join("")}
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
  </div>
  ${progs.length>1?`<div class="chips" style="margin-bottom:10px"><button class="chip" type="button" data-prog="" aria-pressed="${!S.progF}">${L("كل المراحل","All programs")}</button>${progs.map(p=>`<button class="chip" type="button" data-prog="${p.k}" aria-pressed="${S.progF===p.k}">${p.n}</button>`).join("")}</div>`:""}
  ${kids.length?`<p class="muted small" style="margin:0 0 8px">${L("النقاط ونسبة الحضور محسوبة لـ","Points and attendance shown for ")}${esc(seasonLabel(S.season))}.</p>`:""}
  ${!kids.length?`<div class="empty"><h3>${L("لا يوجد أطفال في هذا النادي بعد","No children in this club yet")}</h3><p>${L("سجّل كل طفل ببياناته وبيانات أهله ومرحلته في أوانا، ثم تابع حضوره ونقاطه وآياته أسبوعياً.","Register each child with their details, parents and Awana program, then track attendance, points and verses every week.")}</p>${S.canWrite?`<button class="btn pri" type="button" data-act="newKid">${ICON.plus} ${L("تسجيل أول طفل","Register the first child")}</button>`:""}</div>`:
    list.length?`<div class="list">${list.map(k=>kidRow(k)).join("")}</div>`:`<p class="muted">${L("لا نتائج.","No results.")}</p>`}`;
}
function weeksTab(c,weeks){
  return `<div class="bar" style="justify-content:space-between"><p class="muted small" style="margin:0">${L("كل أسبوع له تاريخ، تحضير الأطفال ونقاطهم، وألبوم صور. المعروض: ","Each meeting has a date, attendance and points, and a photo album. Showing: ")}${esc(seasonLabel(S.season))}.</p>${S.canWrite?`<button class="btn pri" type="button" data-act="newWeek">${ICON.plus} ${L("أسبوع جديد","New meeting")}</button>`:""}</div>
  ${!weeks.length?`<div class="empty"><h3>${L("لا توجد أسابيع في ","No meetings in ")}${esc(seasonLabel(S.season))}</h3><p>${L("بعد كل اجتماع أضف أسبوعاً جديداً: سجّل الحضور والنقاط وارفع صور اليوم.","After each club night, add a meeting: mark attendance and points and upload the day's photos.")}</p></div>`:
  `<div class="weeks">${weeks.map(w=>`<button class="card-btn" type="button" data-open-week="${esc(w.id)}">
    <div class="wk-cover">${(w.photos||[])[0]?`<img data-ph="${esc(w.photos[0])}" alt="">`:L("بدون صور","No photos")}</div>
    <div><div class="wk-date">${esc(fmtDate(w.date))}</div>${w.title?`<div style="font-weight:600">${esc(w.title)}</div>`:""}</div>
    <div class="club-nums"><span><b>${presentCount(w)}</b> ${L("حاضر","present")}</span>${num(w.visitors)?`<span><b>${num(w.visitors)}</b> ${L("زائر","visitors")}</span>`:""}<span><b>${(w.photos||[]).length}</b> ${L("صورة","photos")}</span></div>
  </button>`).join("")}</div>`}`;
}

function weekView(){
  const w=S.weeks.find(x=>x.id===S.route.id); const c=w&&club(w.clubId);
  if(!w||!c) return `<p class="muted">${L("جارٍ التحميل…","Loading…")}</p>`;
  const kids=clubKids(c.id).filter(k=>isActive(k)||presentIn(w,k.id)).sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  const groups=PROGRAMS.map(p=>[p,kids.filter(k=>k.program===p.k)]).filter(([,l])=>l.length);
  const other=kids.filter(k=>!PMAP[k.program]); if(other.length) groups.push([{n:L("بدون مرحلة","No program"),c:"--muted"},other]);
  const photos=w.photos||[]; const pc=presentCount(w);
  const noCam=kids.filter(k=>noPhoto(k)&&presentIn(w,k.id));
  const prog=w.progress||{};
  const ro=S.canWrite?"":"disabled";
  const FL={pts:L("نقاط","points"),sec:L("أقسام","sections"),vrs:L("آيات","verses")};
  const cell=(k,f)=>`<input class="pin" id="pg_${esc(k.id)}_${f}" data-pg="${esc(k.id)}" data-f="${f}" type="number" min="0" inputmode="numeric" value="${prog[k.id]&&prog[k.id][f]!=null&&prog[k.id][f]!==""?esc(prog[k.id][f]):""}" aria-label="${FL[f]} ${esc(k.name)}" ${ro}>`;
  return `
  <nav class="crumbs"><button type="button" data-home>${L("كل الأندية","All clubs")}</button><span>${SEP()}</span><button type="button" data-open-club="${esc(c.id)}" data-tab-to="weeks">${esc(c.name)}</button><span>${SEP()}</span><span>${esc(fmtDate(w.date))}</span></nav>
  <div class="profile"><div class="txt"><h1>${esc(w.title||L("اجتماع ","Meeting ")+fmtDate(w.date))}</h1><div class="meta"><span>${esc(fmtDate(w.date))}</span>${w.theme?`<span class="type-pill">${esc(w.theme)}</span>`:""}<span>${L(`${pc} حاضر من ${kids.length}`,`${pc} of ${kids.length} present`)}</span>${num(w.visitors)?`<span>${num(w.visitors)} ${L("زائر","visitors")}</span>`:""}${num(w.leadersCount)?`<span>${num(w.leadersCount)} ${L("مسؤول","leaders")}</span>`:""}</div></div>
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
  <section class="panel" style="margin-top:14px"><h2>${L("الحضور والتقدّم","Attendance & progress")} <span class="muted small">${pc}/${kids.length}</span></h2>
    <p class="muted small" style="margin:-4px 0 10px">${S.canWrite?L("اضغط على اسم الطفل لتحضيره، واكتب ما حقّقه اليوم: النقاط، الأقسام التي أنهاها، والآيات التي سمّعها.","Tap a child's name to mark them present, then enter today's points, completed sections and recited verses."):L("عرض فقط.","View only.")}</p>
    ${!kids.length?`<p class="muted small">${L("أضف أطفال النادي أولاً من تبويب «الأطفال» لتسجيل الحضور.","Add the club's children first from the Children tab.")}</p>`:
    groups.map(([p,l])=>`<h3 class="grp" style="color:var(${p.c})">${esc(p.n)} <span class="muted small">${l.filter(k=>presentIn(w,k.id)).length}/${l.length}</span></h3>
    <div class="ptab"><div class="prow phead"><span>${L("الطفل","Child")}</span><span>${FL.pts}</span><span>${FL.sec}</span><span>${FL.vrs}</span></div>
    ${l.map(k=>`<div class="prow ${presentIn(w,k.id)?"on":""}"><button class="att" type="button" role="checkbox" aria-checked="${presentIn(w,k.id)}" ${S.canWrite?"":'aria-disabled="true"'} data-att="${esc(k.id)}"><span class="box">${presentIn(w,k.id)?ICON.check:""}</span><span class="t">${esc(k.name)}${noPhoto(k)?` <span class="warn" title="${L("ممنوع التصوير","No photos")}">${ICON.nocam}</span>`:""}</span></button>${cell(k,"pts")}${cell(k,"sec")}${cell(k,"vrs")}</div>`).join("")}</div>`).join("")}
  </section>`;
}

// ---------- settings (admin only) ----------
const appLink = role => location.origin+location.pathname+"?as="+role;
function settingsView(){
  const k=S.keys||{};
  const card=role=>{
    const set=!!k[role], on=set&&k[role+"On"]===true, n=S.sessions.filter(x=>x.role===role).length;
    return `<section class="panel acct">
      <h2>${esc(accLabel(role))} <span class="${on?"ok-pill":"warn"}">${!set?L("لم تُحدَّد كلمة مرور","No password yet"):on?L("مفعّل","Active"):L("موقوف","Disabled")}</span></h2>
      <dl class="kv">
        <dt>${L("الرابط","Link")}</dt><dd class="inrow"><span class="sel mono">${esc(appLink(role))}</span><button type="button" class="btn sm" data-copy="${esc(appLink(role))}">${ICON.copy}</button></dd>
        <dt>${L("كلمة المرور الحالية","Current password")}</dt><dd class="inrow">${set?`<span class="mono" id="cur_${role}" data-pw="${esc(k[role])}">••••••••</span><button type="button" class="btn sm" data-show="${role}">${L("إظهار","Show")}</button><button type="button" class="btn sm" data-copy="${esc(k[role])}">${ICON.copy}</button>`:`<span class="muted">—</span>`}</dd>
        <dt>${L("أجهزة داخلة الآن","Signed-in devices")}</dt><dd>${n}</dd>
      </dl>
      <div class="f" style="margin-top:12px"><label for="np_${role}">${set?L("كلمة مرور جديدة","New password"):L("حدّد كلمة مرور","Set a password")}</label>
        <div class="inrow"><input id="np_${role}" type="text" autocomplete="off" spellcheck="false" placeholder="${L("6 حروف أو أكثر","6+ characters")}"><button type="button" class="btn sm" data-gen="${role}">${L("توليد","Generate")}</button></div></div>
      <div class="actions" style="margin-top:10px">
        <button type="button" class="btn pri" data-setpw="${role}">${L("حفظ كلمة المرور","Save password")}</button>
        ${set?`<button type="button" class="btn ${on?"danger":""}" data-toggle="${role}">${on?L("إيقاف الحساب","Disable account"):L("تفعيل الحساب","Enable account")}</button>`:""}
        <button type="button" class="btn" data-kick="${role}" ${n?"":"disabled"}>${L("إخراج كل الأجهزة","Sign out all devices")}</button>
      </div>
      <p class="muted small" style="margin:8px 0 0">${L("تغيير كلمة المرور أو إيقاف الحساب يُخرج كل الأجهزة الداخلة بيه فوراً.","Changing the password or disabling the account signs out every device using it right away.")}</p>
    </section>`;
  };
  return `<nav class="crumbs"><button type="button" data-home>${L("كل الأندية","All clubs")}</button><span>${SEP()}</span><span>${L("الإعدادات","Settings")}</span></nav>
  <div class="profile"><div class="txt"><h1>${L("الإعدادات والحسابات","Settings & accounts")}</h1><div class="meta"><span>${L("للمدير فقط","Admin only")}</span></div></div></div>
  ${S.keys===null?`<p class="muted">${L("جارٍ التحميل…","Loading…")}</p>`:`<div class="cols">${card("jordan")}${card("view")}</div>`}
  <section class="panel" style="margin-top:14px"><h2>${L("كلمة مرور المدير (حسابك)","Your admin password")}</h2>
    <div class="fs">
      <div class="f"><label for="apOld">${L("كلمة المرور الحالية","Current password")}</label><input id="apOld" type="password" autocomplete="current-password"></div>
      <div class="f"><label for="apNew">${L("كلمة المرور الجديدة","New password")}</label><input id="apNew" type="password" autocomplete="new-password"></div>
    </div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn pri" data-adminpw>${L("تغيير كلمة مروري","Change my password")}</button></div>
  </section>`;
}
function genPw(){ const a="abcdefghjkmnpqrstuvwxyz23456789"; let s=""; const r=crypto.getRandomValues(new Uint32Array(10)); for(const x of r) s+=a[x%a.length]; return s.slice(0,5)+"-"+s.slice(5); }
async function setPw(role){
  const v=($("#np_"+role)||{}).value?.trim()||"";
  if(v.length<6) return toast(L("كلمة المرور لازم تكون 6 حروف أو أكثر.","Password must be at least 6 characters."));
  const k=S.keys||{}; const data={[role]:v, [role+"At"]:new Date().toISOString()};
  if(k[role+"On"]===undefined) data[role+"On"]=true;
  try{ await setDoc(doc(fs,"secrets","keys"),data,{merge:true}); await kick(role,true); toast(L("تم حفظ كلمة المرور. ابعتها مع الرابط.","Password saved. Send it along with the link.")); }catch(e){ toast(dbErr(e)); }
}
async function toggleAcc(role){
  const on=(S.keys||{})[role+"On"]===true;
  try{ await setDoc(doc(fs,"secrets","keys"),{[role+"On"]:!on},{merge:true}); if(on) await kick(role,true); toast(on?L("تم إيقاف الحساب","Account disabled"):L("تم تفعيل الحساب","Account enabled")); }catch(e){ toast(dbErr(e)); }
}
async function kick(role,quiet){
  const ids=S.sessions.filter(x=>x.role===role).map(x=>x.id);
  try{ for(let i=0;i<ids.length;i+=400){ const b=writeBatch(fs); ids.slice(i,i+400).forEach(id=>b.delete(doc(fs,"sessions",id))); await b.commit(); } if(!quiet) toast(L("تم إخراج كل الأجهزة","All devices signed out")); }catch(e){ if(!quiet) toast(dbErr(e)); }
}
async function adminPw(){
  const o=$("#apOld").value, n=$("#apNew").value;
  if(n.length<8) return toast(L("كلمة المرور الجديدة لازم تكون 8 حروف أو أكثر.","New password must be at least 8 characters."));
  try{ await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email,o)); await updatePassword(auth.currentUser,n); $("#apOld").value=$("#apNew").value=""; toast(L("تم تغيير كلمة مرورك","Your password was changed")); }
  catch(e){ toast(e&&String(e.code).includes("wrong-password")||String(e&&e.code).includes("invalid-credential")?L("كلمة المرور الحالية غير صحيحة.","Current password is wrong."):L("تعذّر التغيير. حاول مجدداً.","Couldn't change it. Try again.")); }
}

// ---------- forms ----------
let pendingUploads=[], modalCancel=null;
function openForm({title, form, data, onSave, onDelete, deleteLabel, deleteNote}){
  const orig=data||{}; const d=Object.assign({},orig);
  const fresh=new Set(); let saved=false;
  const photoKeys=form.flatMap(g=>g.fields).filter(f=>f.t==="photo").map(f=>f.k);
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
  const draw=()=>{
    $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><form class="modal" id="mform" novalidate>
      <div class="modal-h"><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
      <div class="modal-b">${form.map(g=>`<fieldset class="fs"><legend>${L(...g.legend)}</legend>${g.hint?`<p class="muted small hint">${L(...g.hint)}</p>`:""}${g.fields.map(field).join("")}</fieldset>`).join("")}<p class="muted small" id="formErr" role="alert" style="margin:0"></p></div>
      <div class="modal-f"><div id="delZone">${delBtn()}</div>
        <div class="actions"><button type="button" class="btn ghost" data-close>${L("إلغاء","Cancel")}</button><button type="submit" class="btn pri" id="saveBtn">${L("حفظ","Save")}</button></div></div>
    </form></div>`;
  };
  const collect=()=>{ form.forEach(g=>g.fields.forEach(f=>{ if(f.t==="photo") return; if(f.t==="programs"){ d.programs=[...document.querySelectorAll("[data-prog-cb]:checked")].map(x=>x.dataset.progCb); return;} const el=document.getElementById(fid(f)); if(el) d[f.k]= f.t==="number"? (el.value===""?"":num(el.value)) : el.value.trim(); })); };
  draw();
  modalCancel=()=>{ if(!saved) dropAssets([...fresh]); };
  const root=$("#modalRoot");
  setTimeout(()=>{ const first=root.querySelector("input:not([type=checkbox]):not([type=file]),select,textarea"); first&&first.focus(); },30);
  root.onclick=async e=>{
    const t=e.target;
    if(t.id==="scrim"||t.closest("[data-close]")) return closeModal();
    if(t.closest("[data-del]")){ $("#delZone").innerHTML=`<div class="confirm-box">${L("متأكد؟ لا يمكن التراجع.","Are you sure? This can't be undone.")} <button type="button" class="btn sm danger" data-del-yes>${L("نعم، احذف","Yes, delete")}</button><button type="button" class="btn sm" data-del-no>${L("تراجع","Keep")}</button></div>`; return; }
    if(t.closest("[data-del-no]")){ $("#delZone").innerHTML=delBtn(); return; }
    if(t.closest("[data-del-yes]")){ $("#delZone").innerHTML=`<span class="muted small">${L("جارٍ الحذف…","Deleting…")}</span>`; try{ await onDelete(); saved=true; dropAssets([...fresh]); closeModal(); toast(L("تم الحذف","Deleted")); }catch(err){ $("#formErr").textContent=dbErr(err); $("#delZone").innerHTML=delBtn(); } return; }
    const pc=t.closest("[data-photo-clear]"); if(pc){ collect(); const k=pc.dataset.photoClear; if(fresh.has(d[k])){ dropAssets([d[k]]); fresh.delete(d[k]); } d[k]=""; draw(); }
  };
  root.onchange=async e=>{
    const inp=e.target.closest("[data-photo-input]"); if(!inp||!inp.files[0]) return;
    const k=inp.dataset.photoInput; collect();
    const box=root.querySelector(`[data-photo-field="${k}"]`); box.innerHTML=`<span class="muted small">${L("جارٍ رفع الصورة…","Uploading photo…")}</span>`;
    $("#saveBtn").disabled=true;
    try{ const id=await uploadImage(inp.files[0]); if(fresh.has(d[k])){ dropAssets([d[k]]); fresh.delete(d[k]); } fresh.add(id); d[k]=id; }catch(err){ toast(upErr(err)); }
    draw(); $("#saveBtn").disabled=false;
  };
  root.onsubmit=async e=>{
    e.preventDefault(); collect();
    const miss=form.flatMap(g=>g.fields).find(f=>f.req&&!d[f.k]);
    if(miss){ $("#formErr").textContent=L(`الحقل «${miss.l[0]}» مطلوب.`,`“${miss.l[1]}” is required.`); document.getElementById(fid(miss))?.focus(); return; }
    $("#saveBtn").disabled=true; $("#saveBtn").textContent=L("جارٍ الحفظ…","Saving…");
    try{
      await onSave(d); saved=true;
      dropAssets(photoKeys.filter(k=>orig[k]&&orig[k]!==d[k]).map(k=>orig[k]).concat([...fresh].filter(id=>!photoKeys.some(k=>d[k]===id))));
      closeModal(); toast(L("تم الحفظ","Saved"));
    }catch(err){ $("#formErr").textContent=dbErr(err); $("#saveBtn").disabled=false; $("#saveBtn").textContent=L("حفظ","Save"); }
  };
}
function closeModal(){ if(modalCancel){ const f=modalCancel; modalCancel=null; f(); } $("#modalRoot").innerHTML=""; $("#modalRoot").onclick=$("#modalRoot").onchange=$("#modalRoot").onsubmit=null; }
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){ if($("#lb")) closeLb(); else if($("#modalRoot").firstChild) closeModal(); }
  if($("#lb")&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){ const fwd=(e.key==="ArrowLeft")===(LANG!=="en"); lbStep(fwd?1:-1); }
});

const strip = d => { const o={}; for(const [k,v] of Object.entries(d)) if(k!=="id") o[k]=v; o.updatedAt=new Date().toISOString(); return o; };
function newId(col){ return doc(collection(fs,col)).id; }

function clubForm(c){
  openForm({title:c?L("تعديل بيانات النادي","Edit club"):L("نادٍ جديد","New club"), form:CLUB_FORM, data:c,
    onSave:async d=>{ const id=c?c.id:newId("clubs"); if(!c) d.createdAt=new Date().toISOString(); await saveDoc("clubs",id,strip(d)); if(!c) go({v:"club",id,tab:"info"}); },
    onDelete: c&&S.isOwner ? async()=>{
      const ks=clubKids(c.id), ls=clubLeaders(c.id), ws=clubWeeksAll(c.id);
      const refs=[].concat(ks.map(x=>doc(fs,"kids",x.id)),ls.map(x=>doc(fs,"leaders",x.id)),ws.map(x=>doc(fs,"weeks",x.id)));
      for(let i=0;i<refs.length;i+=400){ const b=writeBatch(fs); refs.slice(i,i+400).forEach(r=>b.delete(r)); await b.commit(); }
      await delDoc("clubs",c.id);
      dropAssets([c.photo,c.dirPhoto].concat(ks.map(x=>x.photo),ls.map(x=>x.photo),ws.flatMap(x=>x.photos||[])));
      go({v:"home"});
    }:null, deleteLabel:L("حذف النادي وكل بياناته","Delete club and all its data"),
    deleteNote: c&&!S.isOwner ? L("حذف النادي متاح لمسؤول الشرق الأوسط فقط.","Only the Middle East coordinator can delete a club.") : ""});
}
function leaderForm(clubId,l){
  openForm({title:l?L("بيانات المسؤول","Leader"):L("مسؤول جديد","New leader"), form:LEADER_FORM, data:l,
    onSave:async d=>{ d.clubId=clubId; await saveDoc("leaders",l?l.id:newId("leaders"),strip(d)); },
    onDelete:l?async()=>{ await delDoc("leaders",l.id); dropAssets([l.photo]); }:null});
}
function kidForm(clubId,k){
  const data = k ? Object.assign({},k,{awards:(k.awards||[]).join(L("، ",", "))}) : {status:"نشط",joined:today()};
  openForm({title:k?L("تعديل بيانات الطفل","Edit child"):L("طفل جديد","New child"), form:KID_FORM, data,
    onSave:async d=>{
      d.clubId=clubId;
      d.awards=String(d.awards||"").split(/[,،]/).map(s=>s.trim()).filter(Boolean);
      const hist=((k&&k.programHistory)||[]).filter(h=>h.season!==curSeason());
      if(d.program) hist.push({season:curSeason(),program:d.program,book:d.book||""});
      d.programHistory=hist.sort((a,b)=>String(a.season).localeCompare(String(b.season)));
      await saveDoc("kids",k?k.id:newId("kids"),strip(d));
    },
    onDelete:k?async()=>{ await delDoc("kids",k.id); dropAssets([k.photo]); }:null});
}
function weekForm(clubId,w){
  openForm({title:w?L("تعديل بيانات الأسبوع","Edit meeting"):L("أسبوع جديد","New meeting"), form:WEEK_FORM, data:w||{date:today()},
    onSave:async d=>{
      d.clubId=clubId;
      if(w){ const x=strip(d); delete x.present; delete x.progress; delete x.photos; await updDoc("weeks",w.id,x); }
      else { const id=newId("weeks"); Object.assign(d,{present:{},progress:{},photos:[]}); await saveDoc("weeks",id,strip(d)); go({v:"week",clubId,id}); }
    },
    onDelete:w?async()=>{ await delDoc("weeks",w.id); dropAssets(w.photos||[]); go({v:"club",id:clubId,tab:"weeks"}); }:null, deleteLabel:L("حذف الأسبوع وصوره","Delete meeting and photos")});
}

function kidProfile(k){
  const c=club(k.clubId), a=age(k.birthdate);
  const st=kidStats(k,S.season), tot=kidTotal(k);
  const ws=clubWeeksAll(k.clubId).filter(w=>(!S.season||seasonOf(w.date)===S.season)&&(!k.joined||String(w.date)>=k.joined));
  const hist=(k.programHistory||[]).slice().reverse();
  $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(k.name)}">
    <div class="modal-h"><span class="muted small">${esc(c?c.name:"")}</span><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
    <div class="modal-b">
      <div class="kid-top">${avatar(k.photo,k.name,"lg round")}<div style="min-width:0"><h2>${esc(k.name)}</h2><div class="meta">${pgChip(k.program)}${a!==""?`<span>${a} ${L("سنة","yrs")}</span>`:""}${k.gender?`<span>${esc(tr(GENDER_EN,k.gender))}</span>`:""}${k.grade?`<span>${esc(k.grade)}</span>`:""}<span class="type-pill">${esc(tr(STATUS_EN,k.status||"نشط"))}</span>${noPhoto(k)?`<span class="warn">${ICON.nocam} ${L("ممنوع التصوير","No photos")}</span>`:k.photoOk==="yes"?`<span class="ok-pill">${L("موافقة على التصوير","Photo consent")}</span>`:""}</div></div></div>
      <div><div class="muted small" style="margin-bottom:6px">${esc(seasonLabel(S.season))}</div>
      <div class="prog-stats"><div><b>${st.pts}</b><span>${L("نقطة","points")}</span></div><div><b>${st.vrs}</b><span>${L("آية سمّعها","verses")}</span></div><div><b>${st.sec}</b><span>${L("قسم أنهاه","sections")}</span></div><div><b>${st.p!=null?st.p+"%":"—"}</b><span>${st.of?L(`حضور ${st.n} من ${st.of}`,`attended ${st.n} of ${st.of}`):L("الحضور","attendance")}</span></div></div>
      <p class="muted small" style="margin:6px 0 0">${L(`المجموع منذ انضمامه: ${tot.pts} نقطة · ${tot.vrs} آية · ${tot.sec} قسم`,`All-time: ${tot.pts} points · ${tot.vrs} verses · ${tot.sec} sections`)}</p></div>
      ${ws.length?`<div><div class="muted small" style="margin-bottom:6px">${L("سجل الأسابيع","Meeting log")}</div><div class="wlog">${ws.slice(0,40).map(w=>{ const p=(w.progress||{})[k.id]||{}; const on=presentIn(w,k.id); return `<div class="wl ${on?"on":""}"><span>${esc(fmtDateShort(w.date))}</span><span>${on?L("حاضر","present"):L("غائب","absent")}</span><span>${[num(p.pts)?num(p.pts)+L(" ن"," pts"):"",num(p.vrs)?num(p.vrs)+L(" آية"," verses"):"",num(p.sec)?num(p.sec)+L(" قسم"," sections"):""].filter(Boolean).join(" · ")}</span></div>`; }).join("")}</div></div>`:""}
      ${hist.length?`<div><div class="muted small" style="margin-bottom:6px">${L("المراحل عبر السنين","Programs by year")}</div><div class="awards">${hist.map(h=>`<span class="pg" style="--c:var(${(PMAP[h.program]||{c:"--muted"}).c})">${esc(h.season)}: ${esc((PMAP[h.program]||{}).n||h.program)}${h.book?" – "+esc(h.book):""}</span>`).join("")}</div></div>`:""}
      ${k.book?`<p style="margin:0"><b>${L("الكتيّب الحالي:","Current handbook:")}</b> ${esc(k.book)}</p>`:""}
      ${(k.awards||[]).length?`<div><div class="muted small" style="margin-bottom:6px">${L("الجوائز والشارات","Awards & badges")}</div><div class="awards">${k.awards.map(x=>`<span class="award">${esc(x)}</span>`).join("")}</div></div>`:""}
      <div class="cols" style="gap:16px"><div>${kv([[L("تاريخ الميلاد","Born"),fmtDate(k.birthdate)],[L("المدرسة","School"),k.school],[L("الكنيسة","Church"),k.church],[L("انضم في","Joined"),fmtDate(k.joined)]])}</div>
      <div>${kv([[L("ولي الأمر","Parent"),k.parentName],[L("الهاتف","Phone"),k.parentPhone,1],[L("بديل","Alt."),k.parent2,1],[L("العنوان","Address"),k.address]])}</div></div>
      ${k.health?`<div class="note"><b>${L("ملاحظات صحية:","Health notes:")}</b> ${esc(k.health)}</div>`:""}
      ${k.notes?`<div class="note">${esc(k.notes)}</div>`:""}
    </div>
    ${S.canWrite?`<div class="modal-f"><span></span><button type="button" class="btn pri" data-edit-kid>${ICON.edit} ${L("تعديل بيانات الطفل","Edit child")}</button></div>`:""}
  </div></div>`;
  $("#modalRoot").onclick=e=>{ if(e.target.id==="scrim"||e.target.closest("[data-close]")) closeModal(); else if(e.target.closest("[data-edit-kid]")) kidForm(k.clubId,k); };
}
function leaderProfile(l){
  if(S.canWrite) return leaderForm(l.clubId,l);
  $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><div class="modal" role="dialog" aria-modal="true">
    <div class="modal-h"><h2>${esc(l.name)}</h2><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
    <div class="modal-b"><div class="kid-top">${avatar(l.photo,l.name,"lg round")}<div class="meta">${esc(tr(ROLE_EN,l.role||""))} ${pgChip(l.program)}</div></div>
    ${kv([[L("الهاتف","Phone"),l.phone,1],[L("البريد","Email"),l.email,1],[L("تاريخ الميلاد","Born"),fmtDate(l.birthdate)],[L("بدأ الخدمة","Serving since"),fmtDate(l.joined)],[L("المهنة","Occupation"),l.job],[L("الكنيسة","Church"),l.church],[L("التدريبات","Trainings"),l.training]])}${l.notes?`<div class="note">${esc(l.notes)}</div>`:""}</div></div></div>`;
  $("#modalRoot").onclick=e=>{ if(e.target.id==="scrim"||e.target.closest("[data-close]")) closeModal(); };
}

// ---------- lightbox ----------
let lbI=0;
function openLb(i){ lbI=i; drawLb(); }
function drawLb(){
  const w=S.weeks.find(x=>x.id===S.route.id); const ph=(w&&w.photos)||[]; if(!ph.length) return closeLb();
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
    if(t.closest("[data-lb-del-yes]")){ const id=ph[lbI]; try{ await updDoc("weeks",w.id,{photos:arrayRemove(id)}); dropAssets([id]); toast(L("تم حذف الصورة","Photo deleted")); }catch(err){ toast(dbErr(err)); } }
  };
}
function lbStep(d){ lbI+=d; drawLb(); }
function closeLb(){ $("#lb")?.remove(); }

// ---------- week photos, attendance, progress ----------
async function addPhotos(files){
  const w=S.weeks.find(x=>x.id===S.route.id); if(!w) return;
  files=[...files].filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)); if(!files.length) return;
  pendingUploads=files.map(()=>1); render();
  const ids=[];
  for(const f of files){ try{ ids.push(await uploadImage(f)); }catch(err){ toast(upErr(err)); } pendingUploads.pop(); }
  if(ids.length){ try{ await updDoc("weeks",w.id,{photos:arrayUnion(...ids)}); toast(L(`تم رفع ${ids.length} صورة`,`${ids.length} photo(s) uploaded`)); }catch(err){ dropAssets(ids); toast(dbErr(err)); } }
  render();
}
const pend={present:{},progress:{}};
let flushT;
function applyPending(w){
  const pp=pend.present[w.id], pg=pend.progress[w.id];
  if(pp) w.present=Object.assign({},w.present||{},pp);
  if(pg){ const pr=Object.assign({},w.progress||{}); for(const [kid,v] of Object.entries(pg)) pr[kid]=Object.assign({},pr[kid]||{},v); w.progress=pr; }
}
function scheduleFlush(){ clearTimeout(flushT); flushT=setTimeout(flush,700); }
function flush(){
  const ids=new Set([...Object.keys(pend.present),...Object.keys(pend.progress)]);
  for(const wid of ids){
    const pp=pend.present[wid], pg=pend.progress[wid], data={};
    // field paths touch only the kids that changed, so two people marking different kids never overwrite each other
    if(pp) for(const [k,v] of Object.entries(pp)) data["present."+k]=v;
    if(pg) for(const [k,o] of Object.entries(pg)) for(const [f,v] of Object.entries(o)) data["progress."+k+"."+f]=v;
    updDoc("weeks",wid,data).then(()=>{ if(pend.present[wid]===pp) delete pend.present[wid]; if(pend.progress[wid]===pg) delete pend.progress[wid]; }).catch(err=>toast(dbErr(err)));
  }
}
function toggleAtt(kidId){
  const w=S.weeks.find(x=>x.id===S.route.id); if(!w||!S.canWrite) return;
  const v=!presentIn(w,kidId);
  pend.present[w.id]=Object.assign({},pend.present[w.id],{[kidId]:v});
  applyPending(w); render(); scheduleFlush();
}
function setProgress(kidId,f,val){
  const w=S.weeks.find(x=>x.id===S.route.id); if(!w||!S.canWrite) return;
  const n=val===""?0:Math.max(0,num(val));
  const cur=Object.assign({},(pend.progress[w.id]||{})[kidId]||{},{[f]:n});
  pend.progress[w.id]=Object.assign({},pend.progress[w.id],{[kidId]:cur});
  if(n>0 && !presentIn(w,kidId)) pend.present[w.id]=Object.assign({},pend.present[w.id],{[kidId]:true});
  applyPending(w); scheduleFlush();
  if(n>0){ const row=document.querySelector(`[data-att="${CSS.escape(kidId)}"]`); if(row&&row.getAttribute("aria-checked")!=="true"){ row.setAttribute("aria-checked","true"); row.querySelector(".box").innerHTML=ICON.check; row.closest(".prow").classList.add("on"); } }
}

// ---------- export / backup ----------
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
    const head=[L("الاسم","Name"),L("الجنس","Gender"),L("تاريخ الميلاد","Born"),L("المرحلة","Program"),L("الصف","Grade"),L("المدرسة","School"),L("الكنيسة","Church"),L("الحالة","Status"),L("ولي الأمر","Parent"),L("هاتف ولي الأمر","Parent phone"),L("هاتف بديل","Alt. phone"),L("العنوان","Address"),L("موافقة التصوير","Photo consent"),L("الكتيّب","Handbook"),`${L("نقاط","Points")} (${tag})`,`${L("آيات","Verses")} (${tag})`,`${L("أقسام","Sections")} (${tag})`,`${L("نسبة الحضور","Attendance")} (${tag})`,L("مجموع النقاط","All-time points"),L("الجوائز","Awards"),L("ملاحظات صحية","Health notes"),L("ملاحظات","Notes")];
    const rows=kids.map(k=>{ const s=kidStats(k,S.season), t=kidTotal(k); return [k.name,tr(GENDER_EN,k.gender),k.birthdate,(PMAP[k.program]||{}).n||"",k.grade,k.school,k.church,tr(STATUS_EN,k.status||"نشط"),k.parentName,k.parentPhone,k.parent2,k.address,L(...CONSENT[k.photoOk||""]),k.book,s.pts,s.vrs,s.sec,s.p!=null?s.p+"%":"",t.pts,(k.awards||[]).join(L("، ",", ")),k.health,k.notes]; });
    return save(`Awana-kids-${slug(c)}.csv`,csvOf(head,rows));
  }
  if(what==="leaders"){
    const head=[L("الاسم","Name"),L("الدور","Role"),L("المرحلة","Program"),L("الهاتف","Phone"),L("البريد","Email"),L("تاريخ الميلاد","Born"),L("بدأ الخدمة","Serving since"),L("المهنة","Occupation"),L("الكنيسة","Church"),L("التدريبات","Trainings"),L("ملاحظات","Notes")];
    const rows=[]; if(c.dirName) rows.push([c.dirName,L("مدير النادي","Club director"),"",c.dirPhone,c.dirEmail,"",c.dirSince,c.dirJob,c.dirChurch,c.dirTraining,c.dirNotes]);
    clubLeaders(c.id).forEach(l=>rows.push([l.name,tr(ROLE_EN,l.role),(PMAP[l.program]||{}).n||"",l.phone,l.email,l.birthdate,l.joined,l.job,l.church,l.training,l.notes]));
    return save(`Awana-leaders-${slug(c)}.csv`,csvOf(head,rows));
  }
  const ws=clubWeeks(c.id).slice().reverse();
  const head=[L("الطفل","Child"),L("المرحلة","Program")].concat(ws.map(w=>w.date),[L("أسابيع الحضور","Meetings attended"),L("النقاط","Points"),L("الآيات","Verses"),L("الأقسام","Sections")]);
  const rows=kids.map(k=>{ const s=kidStats(k,S.season); return [k.name,(PMAP[k.program]||{}).n||""].concat(ws.map(w=>{ const p=(w.progress||{})[k.id]||{}; return presentIn(w,k.id)?("✓"+(num(p.pts)?" "+num(p.pts):"")):""; }),[s.n+"/"+s.of,s.pts,s.vrs,s.sec]); });
  return save(`Awana-attendance-${slug(c)}-${ftag}.csv`,csvOf(head,rows));
}
function backup(){
  const cp=a=>a.map(x=>Object.assign({},x));
  save(`Awana-Jordan-backup-${today()}.json`,JSON.stringify({app:"awana-jordan",version:3,exportedAt:new Date().toISOString(),clubs:cp(S.clubs),leaders:cp(S.leaders),kids:cp(S.kids),weeks:cp(S.weeks)},null,1));
}
async function zipWeek(){
  const w=S.weeks.find(x=>x.id===S.route.id); const c=w&&club(w.clubId); if(!w||!window.JSZip) return;
  toast(L("جارٍ تجهيز الصور…","Preparing photos…"));
  const zip=new JSZip(); let i=0;
  for(const id of w.photos||[]){ i++; try{ const src=await loadPhoto(id,true); if(!src) continue; zip.file(`${w.date}-${String(i).padStart(2,"0")}.jpg`,src.split(",")[1],{base64:true}); }catch{} }
  save(`Awana-photos-${c?slug(c):""}-${w.date}.zip`,await zip.generateAsync({type:"blob"}));
}
function restorePrompt(file){
  const rd=new FileReader();
  rd.onload=()=>{
    let data; try{ data=JSON.parse(rd.result); }catch{ return toast(L("الملف غير صالح. اختر ملف النسخة الاحتياطية (.json).","Invalid file. Choose the backup (.json) file.")); }
    if(!data||data.app!=="awana-jordan") return toast(L("هذا الملف ليس نسخة احتياطية من هذا البرنامج.","This isn't a backup from this app."));
    const cols=["clubs","leaders","kids","weeks"]; const total=cols.reduce((s,k)=>s+(data[k]||[]).length,0);
    const missing=cols.reduce((s,k)=>s+(data[k]||[]).filter(x=>!S[k].some(y=>y.id===x.id)).length,0);
    $("#modalRoot").innerHTML=`<div class="scrim" id="scrim"><div class="modal" role="dialog" aria-modal="true">
      <div class="modal-h"><h2>${L("استرجاع من نسخة احتياطية","Restore from backup")}</h2><button type="button" class="x" data-close aria-label="${L("إغلاق","Close")}">${ICON.x}</button></div>
      <div class="modal-b"><p style="margin:0">${L("نسخة بتاريخ","Backup from")} <b>${esc(fmtDate(String(data.exportedAt||"").slice(0,10)))}</b>: ${(data.clubs||[]).length} ${L("نادٍ","clubs")} · ${(data.leaders||[]).length} ${L("مسؤول","leaders")} · ${(data.kids||[]).length} ${L("طفل","children")} · ${(data.weeks||[]).length} ${L("أسبوع","meetings")}</p>
      <div class="list"><label class="radio"><input type="radio" name="rmode" value="missing" checked> ${L(`استرجاع الممسوح فقط (${missing} سجل) — لا يغيّر البيانات الحالية`,`Restore deleted records only (${missing}) — current data stays as is`)}</label>
      <label class="radio"><input type="radio" name="rmode" value="all"> ${L(`استرجاع كل شيء كما في النسخة (${total} سجل) — يرجّع أي تعديل حصل بعدها`,`Restore everything (${total}) — undoes later edits`)}</label></div>
      <p class="muted small" id="rProg" style="margin:0">${L("الصور التي حُذفت لا ترجع، لكن الصور الموجودة ترجع مرتبطة بأسابيعها.","Deleted photos can't come back, but existing photos reconnect to their meetings.")}</p></div>
      <div class="modal-f"><span></span><div class="actions"><button type="button" class="btn ghost" data-close>${L("إلغاء","Cancel")}</button><button type="button" class="btn pri" data-restore>${L("استرجاع","Restore")}</button></div></div></div></div>`;
    $("#modalRoot").onclick=async e=>{
      if(e.target.id==="scrim"||e.target.closest("[data-close]")) return closeModal();
      if(!e.target.closest("[data-restore]")) return;
      const mode=(document.querySelector("[name=rmode]:checked")||{}).value;
      e.target.closest("[data-restore]").disabled=true;
      let done=0, fail=0; const jobs=[];
      for(const col of cols) for(const x of data[col]||[]){ if(!x||!x.id) continue; if(mode==="missing"&&S[col].some(y=>y.id===x.id)) continue; jobs.push([col,x]); }
      for(const [col,x] of jobs){
        let ok=false;
        for(let t=0;t<3&&!ok;t++){ try{ await setDoc(doc(fs,col,String(x.id)),strip(x)); ok=true; }catch(err){ const c=err&&err.code; if(c==="resource-exhausted"||c==="unavailable") await sleep(1500*(t+1)); else break; } }
        ok?done++:fail++;
        $("#rProg").textContent=L(`تم ${done} من ${jobs.length}`,`${done} of ${jobs.length} done`)+(fail?L(` · فشل ${fail}`,` · ${fail} failed`):"");
        await sleep(40);
      }
      closeModal(); toast(fail?L(`تم استرجاع ${done} سجل، وفشل ${fail}. أعد المحاولة للباقي.`,`Restored ${done}; ${fail} failed. Try again for the rest.`):L(`تم استرجاع ${done} سجل.`,`Restored ${done} records.`));
    };
  };
  rd.readAsText(file);
}

// ---------- events ----------
document.addEventListener("click",e=>{
  const t=e.target;
  if(t.closest("[data-lang]")) return setLang(LANG==="en"?"ar":"en");
  if(t.closest("[data-install]")) return doInstall();
  if(t.closest("[data-logout]")) return logout();
  if(t.closest("[data-settings]")) return go({v:"settings"});
  if(t.closest("#modalRoot")||t.closest("#lb")) return;
  const cp=t.closest("[data-copy]"); if(cp) return copyText(cp.dataset.copy);
  const sh=t.closest("[data-show]"); if(sh){ const el=$("#cur_"+sh.dataset.show); if(el) el.textContent = el.textContent.startsWith("•") ? el.dataset.pw : "••••••••"; return; }
  const gn=t.closest("[data-gen]"); if(gn){ const i=$("#np_"+gn.dataset.gen); if(i){ i.value=genPw(); i.focus(); } return; }
  const sp=t.closest("[data-setpw]"); if(sp) return setPw(sp.dataset.setpw);
  const tg=t.closest("[data-toggle]"); if(tg) return toggleAcc(tg.dataset.toggle);
  const kk=t.closest("[data-kick]"); if(kk) return kick(kk.dataset.kick);
  if(t.closest("[data-adminpw]")) return adminPw();
  const a=t.closest("[data-act]");
  const r=S.route, c=r.v==="club"?club(r.id):r.v==="week"?club(r.clubId):null;
  if(a){ const act=a.dataset.act;
    if(act==="newClub") return clubForm(null);
    if(act==="editClub") return clubForm(c);
    if(act==="newLeader") return leaderForm(c.id,null);
    if(act==="newKid") return kidForm(c.id,null);
    if(act==="newWeek") return weekForm(c.id,null);
    if(act==="editWeek") return weekForm(r.clubId,S.weeks.find(w=>w.id===r.id));
    if(act==="backup") return backup();
    if(act==="zip") return zipWeek();
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
  else if(t.id==="seasonSel"){ S.season=t.value; render(); }
  else if(t.id==="restoreInput"&&t.files[0]){ restorePrompt(t.files[0]); t.value=""; }
});
document.addEventListener("dragover",e=>{ const d=e.target.closest&&e.target.closest("#drop"); if(d){ e.preventDefault(); d.classList.add("over"); } });
document.addEventListener("dragleave",e=>{ const d=e.target.closest&&e.target.closest("#drop"); if(d) d.classList.remove("over"); });
document.addEventListener("drop",e=>{ const d=e.target.closest&&e.target.closest("#drop"); if(d){ e.preventDefault(); addPhotos(e.dataTransfer.files); } });
window.addEventListener("pagehide",()=>{ clearTimeout(flushT); flush(); });

// ---------- sign-in ----------
// admin: real Firebase email account. jordan / view: anonymous device + a session doc holding the
// password the admin set; Firestore rules compare it to secrets/keys on every request.
const params=new URLSearchParams(location.search);
const wanted=["admin","jordan","view"].includes(params.get("as"))?params.get("as"):"";
function loginView(msg){
  pendingMsg=msg||"";
  ROLE=""; S.isOwner=false; renderTools();
  $("#app").innerHTML=`<div class="login"><div class="panel">
    <img class="login-logo" src="icons/icon-192.png" alt="Awana Jordan" width="96" height="96">
    <h1 class="login-h">${heroTitle()}</h1>
    <form id="loginForm" class="login-f" novalidate>
      ${wanted?`<p class="login-who">${esc(accLabel(wanted))}</p>`:
      `<div class="f"><label for="lgRole">${L("الحساب","Account")}</label><select id="lgRole">${["admin","jordan","view"].map(k=>`<option value="${k}">${esc(accLabel(k))}</option>`).join("")}</select></div>`}
      <div class="f"><label for="lgPass">${L("كلمة المرور","Password")}</label><input id="lgPass" type="password" autocomplete="current-password" required></div>
      <p class="small" id="lgErr" role="alert" style="color:var(--danger);margin:0">${esc(pendingMsg)}</p>
      <button class="btn pri" type="submit" id="lgBtn">${L("دخول","Sign in")}</button>
    </form>
    ${canInstall()?`<button type="button" class="btn ghost install-cta" data-install>${ICON.phone} ${L("ثبّت التطبيق على موبايلك","Install the app on your phone")}</button>`:""}
  </div></div>`;
  setTimeout(()=>$("#lgPass")?.focus(),30);
  $("#loginForm").onsubmit=async e=>{
    e.preventDefault();
    const role=wanted||$("#lgRole").value, pass=$("#lgPass").value;
    if(!pass){ $("#lgErr").textContent=L("اكتب كلمة المرور.","Enter the password."); return; }
    $("#lgBtn").disabled=true; $("#lgBtn").textContent=L("جارٍ الدخول…","Signing in…");
    const fail=m=>{ $("#lgErr").textContent=m; $("#lgBtn").disabled=false; $("#lgBtn").textContent=L("دخول","Sign in"); };
    if(role==="admin"){
      try{ await signInWithEmailAndPassword(auth,ADMIN_EMAIL,pass); }
      catch(err){ const c=err&&err.code; fail(c==="auth/too-many-requests"?L("محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.","Too many attempts. Wait a bit and try again."):c==="auth/network-request-failed"?L("لا يوجد اتصال بالإنترنت.","No internet connection."):L("كلمة المرور غير صحيحة.","Wrong password.")); }
      return;
    }
    loggingIn=true;
    try{
      if(auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
      if(!auth.currentUser) await signInAnonymously(auth);
      await setDoc(doc(fs,"sessions",auth.currentUser.uid),{role,key:pass,at:new Date().toISOString(),device:navigator.userAgent.slice(0,140)});
      loggingIn=false; start(role);
    }catch(err){
      const c=err&&err.code;
      const m=(c==="permission-denied"?L("كلمة المرور غير صحيحة أو الحساب موقوف.","Wrong password, or this account is disabled."):
        c==="auth/operation-not-allowed"||c==="auth/admin-restricted-operation"?L("الدخول المجهول غير مفعّل في Firebase (Authentication > Anonymous).","Anonymous sign-in isn't enabled in Firebase (Authentication > Anonymous)."):
        c==="auth/network-request-failed"||c==="unavailable"?L("لا يوجد اتصال بالإنترنت.","No internet connection."):L("تعذّر الدخول. حاول مجدداً.","Couldn't sign in. Try again."));
      // keep the message across the auth state change that follows
      pendingMsg=m; fail(m);
      try{ if(auth.currentUser&&auth.currentUser.isAnonymous) await signOut(auth); }catch{}
      loggingIn=false;
    }
  };
}
function resetState(){ unsubs.forEach(u=>{ try{u();}catch{} }); unsubs=[]; Object.assign(S,{clubs:[],kids:[],leaders:[],weeks:[],sessions:[],keys:null,loaded:{clubs:0,kids:0,leaders:0,weeks:0},route:{v:"home"},canWrite:false,canUpload:false,isOwner:false}); assets=null; phCache.clear(); ROLE=""; }
async function logout(msg){
  const u=auth&&auth.currentUser;
  resetState(); pendingMsg=msg||"";
  if(u&&u.isAnonymous){ try{ await deleteDoc(doc(fs,"sessions",u.uid)); }catch{} }
  try{ await signOut(auth); }catch{}
  loginView(pendingMsg);
}
function start(role){
  if(ROLE===role) return;
  resetState(); ROLE=role; pendingMsg="";
  S.canWrite = role==="admin"||role==="jordan"; S.canUpload=S.canWrite; assets=S.canWrite?{}:null; S.isOwner = role==="admin";
  S.season=curSeason(); renderTools();
  const onErr=err=>{
    // a changed password or disabled account shows up here as permission-denied
    if(err&&err.code==="permission-denied"&&role!=="admin") return logout(L("تم تغيير كلمة المرور أو إيقاف الحساب. ادخل من جديد.","The password was changed or the account was disabled. Please sign in again."));
    S.err=dbErr(err); toast(S.err);
  };
  for(const col of ["clubs","kids","leaders","weeks"]){
    unsubs.push(onSnapshot(collection(fs,col), snap=>{
      S[col]=snap.docs.map(d=>Object.assign({id:d.id},d.data()));
      S.loaded[col]=1;
      if(col==="weeks") S.weeks.forEach(applyPending);
      const typing=document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.pg;
      if(!(typing&&col==="weeks")) render();
      if($("#lb")) drawLb();
    }, onErr));
  }
  if(S.isOwner){
    unsubs.push(onSnapshot(doc(fs,"secrets","keys"), d=>{ S.keys=d.exists()?d.data():{}; if(S.route.v==="settings"&&!document.activeElement?.id?.startsWith("np_")&&!document.activeElement?.id?.startsWith("ap")) render(); }, onErr));
    unsubs.push(onSnapshot(collection(fs,"sessions"), snap=>{ S.sessions=snap.docs.map(d=>Object.assign({id:d.id},d.data())); if(S.route.v==="settings"&&!document.activeElement?.id?.startsWith("np_")&&!document.activeElement?.id?.startsWith("ap")) render(); }, onErr));
  }
  render();
}

// ---------- boot ----------
renderTools();
if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
const cfg=window.FIREBASE_CONFIG||{};
if(!cfg.projectId||/ضع/.test(cfg.projectId)){
  $("#app").innerHTML=`<div class="login"><div class="panel"><h2>${L("الإعداد غير مكتمل","Setup isn't finished")}</h2><p>${L("افتح ملف config.js والصق بيانات مشروع Firebase مكان «ضع-هنا».","Open config.js and paste your Firebase project settings.")}</p></div></div>`;
} else {
  const app=initializeApp(cfg);
  auth=getAuth(app);
  try{ fs=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}); }
  catch{ fs=initializeFirestore(app,{}); }
  onAuthStateChanged(auth, async u=>{
    if(loggingIn) return;
    if(!u){ if(ROLE) resetState(); return loginView(pendingMsg); }
    if(!u.isAnonymous){
      if(String(u.email||"").toLowerCase()!==ADMIN_EMAIL){ await signOut(auth); return loginView(L("هذا الحساب غير مسموح له بالدخول.","This account isn't allowed.")); }
      if(wanted && wanted!=="admin") return logout();
      return start("admin");
    }
    let role="";
    try{ const s=await getDoc(doc(fs,"sessions",u.uid)); role=s.exists()?s.data().role:""; }catch{}
    if(!["jordan","view"].includes(role)) return logout(pendingMsg);
    // opening another account's link on a device that's signed in switches accounts
    if(wanted && wanted!==role) return logout();
    start(role);
  });
}
})();
