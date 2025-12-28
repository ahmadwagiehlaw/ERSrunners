/* ERS Runners - Core Logic V1
   Powered by Firebase (Compat Mode)
*/

// 1. إعدادات فايربيس (باستخدام بياناتك)
const firebaseConfig = {
  apiKey: "AIzaSyCHod8qSDNzKDKxRHj1yQlWgNAPXFNdAyg",
  authDomain: "ers-runners-app.firebaseapp.com",
  projectId: "ers-runners-app",
  storageBucket: "ers-runners-app.firebasestorage.app",
  messagingSenderId: "493110452684",
  appId: "1:493110452684:web:db892ab6e6c88b3e6dbd69"
};

// تهيئة التطبيق
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// متغيرات عامة
let currentUser = null;
let userData = {};
let isSignupMode = false;

// ---------------------------------------------------------
// 2. إدارة المصادقة (Auth & Users)
// ---------------------------------------------------------

// مراقب حالة الدخول (يعمل عند فتح التطبيق)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // جلب بيانات المستخدم
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            userData = doc.data();
            initApp(); // تشغيل التطبيق
        }
    } else {
        currentUser = null;
        showAuthScreen();
    }
});

// التبديل بين الدخول وإنشاء حساب
function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const fields = document.getElementById('signup-fields');
    const btn = document.getElementById('toggleAuthBtn');
    const mainBtn = document.querySelector('.btn-primary'); // زر الدخول

    if (isSignupMode) {
        fields.style.display = 'block';
        btn.innerText = "لديك حساب بالفعل؟ تسجيل الدخول";
        mainBtn.innerText = "إنشاء حساب جديد";
    } else {
        fields.style.display = 'none';
        btn.innerText = "ليس لديك حساب؟ سجل الآن";
        mainBtn.innerText = "دخول";
    }
}

// تنفيذ عملية الدخول/التسجيل
async function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');
    
    msg.innerText = ""; // مسح الأخطاء السابقة

    try {
        if (!email || !pass) throw new Error("يرجى ملء البيانات");

        if (isSignupMode) {
            // --- تسجيل جديد ---
            const name = document.getElementById('username').value;
            const region = document.getElementById('region').value;

            if (!name) throw new Error("الاسم مطلوب");
            if (!region) throw new Error("يرجى اختيار المنطقة");

            // 1. إنشاء الحساب
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            
            // 2. حفظ بيانات اللاعب في قاعدة البيانات
            await db.collection('users').doc(cred.user.uid).set({
                name: name,
                region: region,
                email: email,
                totalDist: 0,
                totalRuns: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                level: "Mubtadi" // المستوى الافتراضي
            });

        } else {
            // --- تسجيل دخول ---
            await auth.signInWithEmailAndPassword(email, pass);
        }

    } catch (err) {
        console.error(err);
        let errorText = "حدث خطأ";
        if (err.code === 'auth/email-already-in-use') errorText = "البريد مسجل مسبقاً";
        else if (err.code === 'auth/wrong-password') errorText = "كلمة المرور غير صحيحة";
        else if (err.code === 'auth/user-not-found') errorText = "المستخدم غير موجود";
        else errorText = err.message;
        
        msg.innerText = errorText;
    }
}

function logout() {
    if(confirm("هل تريد الخروج؟")) {
        auth.signOut();
        window.location.reload();
    }
}

// ---------------------------------------------------------
// 3. واجهة المستخدم (UI Logic)
// ---------------------------------------------------------

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
}

function initApp() {
    // إخفاء شاشة الدخول وإظهار التطبيق
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';

    // تحديث البيانات في الواجهة
    updateUI();
    
    // تحميل السجل
    loadActivityLog();
}

function updateUI() {
    // الهيدر
    document.getElementById('headerName').innerText = userData.name || "Runner";
    document.getElementById('headerAvatar').innerText = (userData.name || "U").charAt(0);
    
    // كارت الإحصائيات (الداشبورد)
    document.getElementById('monthDist').innerText = (userData.totalDist || 0).toFixed(1);
    document.getElementById('totalRuns').innerText = userData.totalRuns || 0;
    
    // البروفايل
    document.getElementById('profileName').innerText = userData.name;
    document.getElementById('profileRegion').innerHTML = `<i class="ri-map-pin-line"></i> ${userData.region}`;
    document.getElementById('profileAvatar').innerText = (userData.name || "U").charAt(0); // تحديث افتار البروفايل
    
    // حساب الرتبة (Rank Logic)
    let rank = "مبتدئ";
    const d = userData.totalDist || 0;
    if (d > 50) rank = "هاوي";
    if (d > 100) rank = "محترف";
    if (d > 500) rank = "نخبة";
    document.getElementById('userRankBadge').innerText = rank;
}

// التنقل بين الصفحات
function switchView(viewId) {
    // إخفاء كل الصفحات
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // إظهار الصفحة المطلوبة
    document.getElementById('view-' + viewId).classList.add('active');
    
    // تلوين الأيقونة في النافبار
    // (حيلة بسيطة لتحديد الزر بناء على الترتيب)
    const navMap = {'home': 0, 'challenges': 1, 'profile': 2};
    document.querySelectorAll('.nav-item')[navMap[viewId]].classList.add('active');
}

// التبويبات (Tabs) في صفحة التحديات
function setTab(tabName) {
    // تحديث أزرار التبويبات
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText.includes(getTabTitle(tabName))) btn.classList.add('active'); // مطابقة تقريبية
    });
    
    // إخفاء المحتويات وإظهار المطلوب
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
}
// مساعد بسيط لمعرفة اسم التبويب بالعربي
function getTabTitle(id) {
    if(id === 'active-challenges') return 'التحديات';
    if(id === 'leaderboard') return 'المتصدرون';
    return 'المناطق';
}

// النوافذ المنبثقة (Modals)
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }


// ---------------------------------------------------------
// 4. منطق البيانات (Data Logic)
// ---------------------------------------------------------

// تسجيل جرية جديدة
async function submitRun() {
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;

    if (!dist || !time) return alert("يرجى إدخال المسافة والزمن");

    const uid = currentUser.uid;
    const runRef = db.collection('users').doc(uid).collection('runs').doc();
    
    const newRun = {
        dist: dist,
        time: time,
        type: type,
        date: new Date().toISOString(), // للتخزين
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // 1. حفظ الجرية في Sub-collection
        await runRef.set(newRun);

        // 2. تحديث إجمالي مسافة اللاعب (Transaction لضمان الدقة)
        const userRef = db.collection('users').doc(uid);
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw "User not found";
            
            const currentDist = userDoc.data().totalDist || 0;
            const currentRuns = userDoc.data().totalRuns || 0;
            
            transaction.update(userRef, {
                totalDist: currentDist + dist,
                totalRuns: currentRuns + 1
            });
        });
        
        // تحديث البيانات المحلية
        userData.totalDist += dist;
        userData.totalRuns += 1;
        updateUI();

        alert("عاش يا بطل! 🔥 تم التسجيل");
        closeModal('modal-log');
        
        // مسح الحقول
        document.getElementById('log-dist').value = '';
        document.getElementById('log-time').value = '';
        
        loadActivityLog(); // تحديث السجل

    } catch (e) {
        console.error(e);
        alert("حدث خطأ في التسجيل");
    }
}

// تحميل سجل النشاط
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    
    db.collection('users').doc(currentUser.uid).collection('runs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get()
        .then((snap) => {
            let html = '';
            if (snap.empty) {
                html = '<div style="text-align:center; padding:20px; color:#6b7280;">لا توجد أنشطة بعد</div>';
            } else {
                snap.forEach(doc => {
                    const r = doc.data();
                    const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                    const dateStr = dateObj.toLocaleDateString('ar-EG');
                    
                    html += `
                    <div style="background:rgba(255,255,255,0.05); padding:12px; margin-bottom:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; color:#fff;">${r.dist} كم <span style="font-size:11px; color:var(--primary)">${r.type}</span></div>
                            <div style="font-size:11px; color:#9ca3af;">${dateStr}</div>
                        </div>
                        <div style="font-weight:bold; color:#6b7280;">${r.time} د</div>
                    </div>
                    `;
                });
            }
            list.innerHTML = html;
        });
}

// ---------------------------------------------------------
// تهيئة الأزرار والأحداث عند التحميل
// ---------------------------------------------------------
// (إغلاق المودال عند الضغط في الخارج)
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = "none";
    }
}
