/* ERS Main */

/* ERS Main */

/* ==================== Modal Helpers (Required for inline onclick) ==================== */
function openModal(modalId){
    const modal = document.getElementById(modalId);
    if(!modal) {
        console.warn('[openModal] Modal not found:', modalId);
        return;
    }
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeModal(modalId){
    const modal = document.getElementById(modalId);
    if(!modal) {
        console.warn('[closeModal] Modal not found:', modalId);
        return;
    }
    modal.style.display = 'none';

    // لو مفيش أي مودال مفتوح، شيل الـ class
    const anyOpen = Array.from(document.querySelectorAll('.modal-overlay'))
        .some(el => (getComputedStyle(el).display !== 'none'));
    if(!anyOpen) document.body.classList.remove('modal-open');
}

// إغلاق المودال عند الضغط على الخلفية (overlay)
function initModalSystem(){
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        // منع تكرار ربط الليسنر
        if(overlay.dataset._modalBound === '1') return;
        overlay.dataset._modalBound = '1';

        overlay.addEventListener('click', (e) => {
            // اقفل فقط لو الضغط على الخلفية نفسها مش على محتوى المودال
            if(e.target === overlay){
                overlay.style.display = 'none';
                const anyOpen = Array.from(document.querySelectorAll('.modal-overlay'))
                    .some(el => (getComputedStyle(el).display !== 'none'));
                if(!anyOpen) document.body.classList.remove('modal-open');
            }
        });
    });

    // ESC لإغلاق آخر مودال مفتوح
    document.addEventListener('keydown', (e) => {
        if(e.key !== 'Escape') return;
        const openOverlays = Array.from(document.querySelectorAll('.modal-overlay'))
            .filter(el => (getComputedStyle(el).display !== 'none'));
        const last = openOverlays[openOverlays.length - 1];
        if(last){
            last.style.display = 'none';
            const anyOpen = Array.from(document.querySelectorAll('.modal-overlay'))
                .some(el => (getComputedStyle(el).display !== 'none'));
            if(!anyOpen) document.body.classList.remove('modal-open');
        }
    });
}

// expose globally for inline handlers
window.openModal = openModal;
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', initModalSystem);

/* ==================== End Modal Helpers ==================== */

// ==================== 2. Initialization ====================}

/* ==================== Weekly Challenge Logic ==================== */

// 1. دالة رفع صورة التحدي الأسبوعي
async function uploadWeeklyProofToImgBB() {
    const fileInput = document.getElementById('weekly-img-file');
    const statusDiv = document.getElementById('weekly-upload-status');
    const urlInput = document.getElementById('weekly-uploaded-img-url');
    const previewImg = document.getElementById('weekly-img-preview');

    if (!fileInput || !statusDiv || !urlInput || !previewImg) return;

    if (!fileInput.files || fileInput.files.length === 0) return;

    // ✅ نفس المفتاح المستخدم في activities.js (اللي شغال عندك)
    // ممكن بعدين تنقله لمكان مركزي، لكن ده إصلاح مباشر وفعال
    const API_KEY = "0d0b1fefa53eb2fc054b27c6395af35c";

    if (!API_KEY) {
        statusDiv.innerHTML = '<span style="color:#ef4444;">مفتاح رفع الصور غير موجود ❌</span>';
        return;
    }

    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append("image", file);

    statusDiv.innerHTML = '<span style="color:#f59e0b;">جاري الرفع... ⏳</span>';

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data && data.success && data.data && data.data.url) {
            const imageUrl = data.data.url;

            urlInput.value = imageUrl;
            previewImg.src = imageUrl;
            previewImg.style.display = 'block';

            statusDiv.innerHTML = '<span style="color:#10b981;">تم الرفع بنجاح ✅</span>';
        } else {
            throw new Error('ImgBB upload failed: ' + JSON.stringify(data));
        }
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = '<span style="color:#ef4444;">فشل الرفع! تأكد من النت ❌</span>';
    }
}

// 2. دالة حفظ إنجاز التحدي (مهمة جداً للأدمن)
async function saveWeeklyProof() {
    if (!currentUser) {
        showToast("يجب تسجيل الدخول أولاً", "error");
        return;
    }

    const btn = document.getElementById('weekly-save-proof-btn');
    const note = document.getElementById('weekly-proof-note').value;
    const imgUrl = document.getElementById('weekly-uploaded-img-url').value;

    // التحقق من الصورة لو التحدي إجباري
    // (يمكنك تخفيف الشرط لو عايز تسمح بدون صورة)
    if (!imgUrl) {
        showToast("لازم ترفع صورة إثبات يا بطل 📸", "error");
        return;
    }

    btn.innerText = "جاري الحفظ...";
    btn.disabled = true;

    try {
        // تجهيز بيانات النشاط
        const activityData = {
            uid: currentUser.uid,
            userName: userData.name || "مجهول",
            userAvatar: userData.avatar || "🏃",
            type: "Challenge", // نوع مميز
            title: "تحدي الأسبوع 🏆",
            dist: 0, // التحدي غالباً لا يحسب مسافة مباشرة هنا إلا لو عدلتها
            time: 0,
            pace: 0,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            img: imgUrl,
            note: note,
            
            // 🔥 أهم حقل للأدمن 🔥
            isWeeklyChallenge: true 
        };

        // 1. الحفظ في الـ Feed العام
        await db.collection('activity_feed').add(activityData);

        // 2. الحفظ في بروفايل المستخدم (اختياري بس مفيد)
        await db.collection('users').doc(currentUser.uid).collection('runs').add(activityData);

        // 3. إعطاء مكافأة XP (اختياري)
        await db.collection('users').doc(currentUser.uid).update({
            xp: firebase.firestore.FieldValue.increment(50) // 50 نقطة هدية
        });

        showToast("عاش يا وحش! تم تسجيل التحدي 💪", "success");
        closeModal('modal-weekly-proof');
        closeModal('modal-weekly-challenge');

        // إعادة تعيين الزر
        btn.innerText = "تأكيد الإنجاز ✅";
        btn.disabled = false;
        
        // تنظيف الحقول
        document.getElementById('weekly-proof-note').value = "";
        document.getElementById('weekly-uploaded-img-url').value = "";
        document.getElementById('weekly-img-preview').style.display = "none";
        document.getElementById('weekly-upload-status').innerHTML = "";

    } catch (error) {
        console.error(error);
        showToast("حصل خطأ في الحفظ", "error");
        btn.innerText = "تأكيد الإنجاز ✅";
        btn.disabled = false;
    }
}


/* دالة عرض محتوى نافذة الجدول */
function openPlanScheduleModal() {
  const contentDiv = document.getElementById('plan-details-content');

  // فتح النافذة
  openModal('modal-my-plan');

  const user = window.userData || (typeof userData !== 'undefined' ? userData : null);
  const plan = user?.activePlan;

  if (!plan) {
    if (contentDiv) contentDiv.innerHTML = '<p class="text-center">لا توجد خطة نشطة حالياً.</p>';
    return;
  }

  // ---- Fix undefined weeks (fallback زي plan-hero) ----
  const totalWeeks = Number.isFinite(+plan.totalWeeks) ? +plan.totalWeeks : 8;

  // ---- نحسب الأسبوع الحالي من startDate (بنفس روح الكود الموجود عندك في app.js) ----
  let currentWeek = 1;
  try {
    const start = new Date(plan.startDate);
    const today = new Date();
    start.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - start) / (1000*60*60*24));
    currentWeek = Math.max(1, Math.floor(diffDays / 7) + 1);
  } catch(e) {}

  // ---- Helper: session لكل يوم (نفس منطق getPlanTodaySession لكن parametrized) ----
  function getPlanSessionForDay(planObj, dayInWeek){
    const daysCount = parseInt(planObj.daysPerWeek) || 3;

    let runDays = [];
    if(daysCount === 3) runDays = [1, 3, 5];
    else if(daysCount === 4) runDays = [1, 2, 4, 6];
    else if(daysCount === 5) runDays = [1, 2, 3, 5, 6];
    else runDays = [1, 2, 3, 4, 5, 6];

    const isRunDay = runDays.includes(dayInWeek);

    let title = 'راحة واستشفاء 🧘‍♂️';
    let sub   = 'مشي خفيف + إطالة 8–10 دقايق.';
    let mode  = 'recovery';

    if (isRunDay) {
      const targetNum = parseFloat(planObj.target);
      const baseDist = (Number.isFinite(targetNum) ? (targetNum / daysCount) : 4);

      if (dayInWeek === runDays[0]) {
        title = `جري مريح (Easy)`;
        sub   = `${(baseDist).toFixed(1)} كم • تنفّس مريح (RPE 3–4).`;
        mode  = 'build';
      } else if (dayInWeek === runDays[runDays.length-1]) {
        title = `لونج رن (Long)`;
        sub   = `${(baseDist * 1.2).toFixed(1)} كم • ثابت وبهدوء + جرعة ماء.`;
        mode  = 'push';
      } else {
        title = `تمرين جودة (Speed/Tempo)`;
        sub   = `${(baseDist * 0.8).toFixed(1)} كم • ركّز على الإيقاع بدون تهور.`;
        mode  = 'push';
      }
    }

    return { title, sub, mode, isRunDay };
  }

  // ترتيب الأيام زي العرض الحالي عندك (السبت..الجمعة)
  const weekDays = [
    { ar:'السبت',    n:1 },
    { ar:'الأحد',    n:2 },
    { ar:'الإثنين',  n:3 },
    { ar:'الثلاثاء', n:4 },
    { ar:'الأربعاء', n:5 },
    { ar:'الخميس',   n:6 },
    { ar:'الجمعة',   n:7 },
  ];

  // نعرف “اليوم” علشان نميّزه
  let todayN = null;
  try{
    const start = new Date(plan.startDate);
    const today = new Date();
    start.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - start) / (1000*60*60*24));
    const dayNum = diffDays + 1;
    todayN = ((dayNum - 1) % 7) + 1;
  }catch(e){}

  let html = `
    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:15px;">
      <h4 style="color:var(--primary); margin:0 0 5px 0;">${plan.target || plan.name || 'خطة تدريبية'}</h4>
      <div style="font-size:12px; color:#fff;">
        المدة: <span style="color:#9ca3af">${totalWeeks} أسابيع</span><br>
        المستوى: <span style="color:#9ca3af">${plan.level || 'متوسط'}</span>
      </div>
    </div>

    <h5 style="margin:10px 0; color:#fff;">جدول الأسبوع الحالي (${currentWeek}):</h5>
    <div style="display:flex; flex-direction:column; gap:10px;">
  `;

  weekDays.forEach(d => {
    const s = getPlanSessionForDay(plan, d.n);
    const isToday = (todayN === d.n);
    const accent = (s.mode === 'recovery') ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.18)';
    const border = (s.mode === 'recovery') ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)';

    html += `
      <div style="
        background:rgba(0,0,0,0.18);
        padding:12px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.06);
        ${isToday ? `box-shadow: 0 0 0 1px ${border}; background:${accent};` : ''}
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="font-size:13px; color:#fff; font-weight:800;">${d.ar}${isToday ? ' • اليوم' : ''}</div>
          <div style="font-size:11px; color:#9ca3af;">${s.mode === 'recovery' ? 'Recovery' : (s.mode === 'push' ? 'Push' : 'Build')}</div>
        </div>
        <div style="margin-top:6px; font-size:13px; color:#fff;">${s.title}</div>
        <div style="margin-top:4px; font-size:11px; color:#d1d5db;">${s.sub}</div>
      </div>
    `;
  });

  html += `</div>`;

  if (contentDiv) contentDiv.innerHTML = html;
}

// لو بتستخدم inline onclick
window.openPlanScheduleModal = openPlanScheduleModal;

// ✅ لازم برا الدالة (يتنفّذ عند تحميل الملف)
window.openPlanScheduleModal = openPlanScheduleModal;



function openImageViewer(url){
  const img = document.getElementById('image-viewer-img');
  if(img) img.src = url;
  openModal('modal-image-viewer');
}
window.openImageViewer = openImageViewer;


/* ==================== Glass Onboarding Logic V4.0 (Install Support) ==================== */
/* ==================== Glass Onboarding Logic V6 (External Link) ==================== */

let glassStepIndex = 0;
const glassTotalSteps = 7; 
let dontShowAgain = false;

document.addEventListener('DOMContentLoaded', () => {
    const permanentlyHidden = localStorage.getItem('ers_hide_onboarding_forever');
    if (!permanentlyHidden) {
        setTimeout(() => {
            const modal = document.getElementById('modal-onboarding');
            if(modal) {
                modal.style.display = 'flex';
                updateGlassUI(0);
            }
        }, 800);
    }
});

function nextGlassStep() {
    if (glassStepIndex < glassTotalSteps - 1) {
        glassStepIndex++;
        updateGlassUI(glassStepIndex);
    } else {
        closeOnboarding(true); 
    }
}

/* ==================== JS Logic V7 (Red/Blue Theme) ==================== */

// ... (نفس متغيرات التهيئة ودالة الـ DOMContentLoaded السابقة) ...

// ... (دالة nextGlassStep السابقة) ...

function updateGlassUI(index) {
    const slides = document.querySelectorAll('.glass-slide');
    const dots = document.querySelectorAll('.glass-dot');
    const btn = document.getElementById('glass-next-btn');

    slides.forEach((s, i) => {
        s.classList.remove('active');
        if(i === index) s.classList.add('active');
    });

    dots.forEach((d, i) => {
        d.classList.remove('active');
        if(i === index) d.classList.add('active');
    });

    // تحديث زر "التالي" / "إنهاء"
    if (index === glassTotalSteps - 1) {
        btn.innerHTML = 'إنهاء الجولة ✅';
        btn.style.background = 'rgba(255,255,255,0.1)'; // شفاف في النهاية
        btn.style.border = '1px solid rgba(255,255,255,0.2)';
        btn.style.boxShadow = 'none';
    } else {
        btn.innerHTML = 'التالي <i class="ri-arrow-left-line"></i>';
        // التعديل هنا: استخدام التدرج الأزرق بدلاً من الأخضر
        btn.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)';
        btn.style.border = 'none';
        btn.style.boxShadow = '0 10px 20px -5px rgba(37, 99, 235, 0.4)';
    }
}

// ... (دالة openExternalDownload السابقة برابط الـ OneDrive) ...

function toggleDontShow() {
    dontShowAgain = !dontShowAgain;
    const checkIcon = document.getElementById('dont-show-check');
    const box = document.querySelector('.custom-checkbox');
    const container = document.querySelector('.dont-show-box'); // إضافة كلاس للكونتينر
    
    if(dontShowAgain) {
        checkIcon.style.display = 'block';
        // استخدام اللون الأحمر
        box.style.background = '#ef4444';
        box.style.borderColor = '#ef4444';
        container.classList.add('active');
    } else {
        checkIcon.style.display = 'none';
        box.style.background = 'rgba(0,0,0,0.2)';
        box.style.borderColor = 'rgba(255,255,255,0.5)';
        container.classList.remove('active');
    }
}

// ... (دالة closeOnboarding السابقة) ...
// 🔥 دالة فتح رابط التحميل الخارجي 🔥
function openExternalDownload() {
    // ضع رابط الـ OneDrive الخاص بك هنا بين علامات التنصيص 👇
    const oneDriveLink = "https://1drv.ms/u/c/68bc25c4969fc669/IQATqO26UJujSYvsuOwhdbN6AWt7LVpGdo6MtlwAWjXldPA?e=jpGScw"; 
    
    if(oneDriveLink && oneDriveLink.includes("http")) {
        // فتح الرابط في نافذة جديدة
        window.open(oneDriveLink, '_blank');
        showToast("جاري فتح صفحة التحميل... 🚀", "success");
    } else {
        showToast("عفواً، الرابط غير متوفر حالياً", "error");
    }
}

function toggleDontShow() {
    dontShowAgain = !dontShowAgain;
    const checkIcon = document.getElementById('dont-show-check');
    const box = document.querySelector('.custom-checkbox');
    
    if(dontShowAgain) {
        checkIcon.style.display = 'block';
        box.style.background = '#10b981';
        box.style.borderColor = '#10b981';
    } else {
        checkIcon.style.display = 'none';
        box.style.background = 'rgba(0,0,0,0.2)';
        box.style.borderColor = 'rgba(255,255,255,0.5)';
    }
}

function closeOnboarding(fromFinishBtn) {
    const modal = document.getElementById('modal-onboarding');
    
    if (dontShowAgain) {
        localStorage.setItem('ers_hide_onboarding_forever', 'true');
        if(fromFinishBtn) showToast("تم الحفظ. لن تظهر الجولة مرة أخرى 👍", "success");
    }

    modal.querySelector('.glass-card').style.transform = 'scale(0.9) translateY(20px)';
    modal.querySelector('.glass-card').style.opacity = '0';
    
    setTimeout(() => {
        modal.style.display = 'none';
        modal.querySelector('.glass-card').style.transform = 'none';
        modal.querySelector('.glass-card').style.opacity = '1';
        glassStepIndex = 0;
        updateGlassUI(0);
    }, 300);
}