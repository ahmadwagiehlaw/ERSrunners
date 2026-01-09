/* ERS Coach */

// ==================== 4. Badges & Coach ====================
// ==================== 🎖️ نظام الأوسمة والإنجازات (BADGES SYSTEM V2.0) ====================

const BADGES_CONFIG = [
    // --- الصف الأول: المسافات (Distances) ---
    { id: 'dist_50k', name: 'بداية الطريق', icon: '🥉', desc: 'أتممت 50 كم إجمالي' },
    { id: 'dist_100k', name: 'المئوية الأولى', icon: '🥈', desc: 'أتممت 100 كم إجمالي' },
    { id: 'dist_500k', name: 'نصف مليون', icon: '🥇', desc: 'أتممت 500 كم إجمالي' },
    { id: 'dist_1000k', name: 'الأسطورة', icon: '👑', desc: 'كسرت حاجز 1000 كم!' },

    // --- الصف الثاني: تحديات خاصة (Special) ---
    { id: 'dist_half_marathon', name: 'نصف ماراثون', icon: '🏃', desc: 'جريت 21 كم في مرة واحدة' },
    { id: 'dist_marathon', name: 'ماراثون كامل', icon: '🦁', desc: 'جريت 42 كم في مرة واحدة' },
    { id: 'speed_flash', name: 'البرق', icon: '⚡', desc: 'بيس أقل من 4:00 د/كم' },
    { id: 'speed_rocket', name: 'الصاروخ', icon: '🚀', desc: 'بيس أقل من 5:00 د/كم' },

    // --- الصف الثالث: الاستمرارية (Consistency) ---
    { id: 'streak_3', name: 'بداية ساخنة', icon: '🔥', desc: 'تمرين لمدة 3 أيام متتالية' },
    { id: 'streak_7', name: 'أسبوع ناري', icon: '📆', desc: 'تمرين لمدة 7 أيام متتالية' },
    { id: 'streak_30', name: 'وحش الالتزام', icon: '🛡️', desc: 'تمرين لمدة 30 يوم متتالية' },
    { id: 'weekend_warrior', name: 'بطل العطلة', icon: '🌴', desc: 'تمرين قوي يوم الجمعة' },

    // --- الصف الرابع: المجتمع والوقت (Social & Time) ---
    { id: 'early_bird', name: 'طائر الصباح', icon: '🌅', desc: 'تمرين قبل 7 صباحاً' },
    { id: 'night_owl', name: 'ساهر الليل', icon: '🦉', desc: 'تمرين بعد 10 مساءً' },
    { id: 'social_star', name: 'نجم الفريق', icon: '🌟', desc: 'عضو نشط في التحديات' },
    { id: 'elite_club', name: 'نادي النخبة', icon: '💎', desc: 'أداء استثنائي مستمر' }
];async function checkNewBadges(dist, time, dateObj) {
    const myBadges = userData.badges || []; 
    let newBadgesEarned = [];
    const runDate = dateObj || new Date();
    const h = runDate.getHours();
    const d = runDate.getDay(); 

    if (!myBadges.includes('first_step')) newBadgesEarned.push('first_step');
    if (!myBadges.includes('early_bird') && h >= 5 && h <= 8) newBadgesEarned.push('early_bird');
    if (!myBadges.includes('night_owl') && (h >= 22 || h <= 3)) newBadgesEarned.push('night_owl');
    if (!myBadges.includes('weekend_warrior') && d === 5) newBadgesEarned.push('weekend_warrior');
    if (!myBadges.includes('half_marathon') && dist >= 20) newBadgesEarned.push('half_marathon');
    if (!myBadges.includes('club_100') && userData.totalDist >= 100) newBadgesEarned.push('club_100');
    if (!myBadges.includes('club_500') && userData.totalDist >= 500) newBadgesEarned.push('club_500');

    if (newBadgesEarned.length > 0) {
        await db.collection('users').doc(currentUser.uid).update({ badges: firebase.firestore.FieldValue.arrayUnion(...newBadgesEarned) });
        if(!userData.badges) userData.badges = [];
        userData.badges.push(...newBadgesEarned);
        const badgeNames = newBadgesEarned.map(b => BADGES_CONFIG.find(x => x.id === b).name).join(" و ");
        alert(`🎉 إنجاز جديد: ${badgeNames}`);
    }
}

function renderBadges() {
    const grid = document.getElementById('badges-grid');
    if(!grid) return;
    
    const myBadges = userData.badges || [];
    let html = '';
    
    BADGES_CONFIG.forEach(badge => {
        const isUnlocked = myBadges.includes(badge.id);
        const stateClass = isUnlocked ? 'unlocked' : 'locked';
        
        html += `
            <div class="badge-item ${stateClass}" onclick="showToast('${isUnlocked ? badge.desc : '🔒 ' + badge.desc}', 'info')">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-name">${badge.name}</span>
            </div>`;
    });
    grid.innerHTML = html;
}

// ==================== V4.0 Helpers (Coach Tabs + Cross Training) ====================
const ERS_CORE_TYPES = ['Run','Walk','Race'];
const ERS_XT_TYPES = ['Bike','Cardio','Strength','Yoga'];

window.openExternal = function(url){
  try { window.open(url, '_blank', 'noopener'); } catch(e){ location.href = url; }
};

window.setCoachHomeTab = function(tab){
  const tabs = ['today','plan','community'];
  tabs.forEach(t=>{
    const pane = document.getElementById('coach-home-tab-'+t);
    if(pane) pane.classList.toggle('active', t===tab);
  });
  document.querySelectorAll('.coach-tab-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.getAttribute('data-tab')===tab);
  });

  if (tab === 'today') {
    // ✅ الأهم: حمّل تمرين اليوم (ده اللي بيملا _coachDailyWorkout)
    if (typeof setupCoachFeedOnce === 'function') {
      setupCoachFeedOnce();
    } else {
      // fallback لو مشروعك لسه فيه renderTeamWorkout فقط
      if (typeof renderTeamWorkout === 'function') renderTeamWorkout();
    }

    // ✅ التحدي الأسبوعي
    if (typeof loadCoachWeeklyChallenge === 'function') {
      loadCoachWeeklyChallenge();
    } else if (typeof loadWeeklyChallenge === 'function') {
      loadWeeklyChallenge();
    }
  }

  try{ localStorage.setItem('ers_coach_home_tab', tab); }catch(e){}
};
// ========================
function setupLogTypeUI(){
  const typeSel = document.getElementById('log-type');
  const distWrap = document.getElementById('log-dist')?.closest('.input-wrap');
  const distInput = document.getElementById('log-dist');
  const timeInput = document.getElementById('log-time');

  function apply(){
    const t = typeSel ? typeSel.value : 'Run';
    const isCore = _ersIsCoreType(t);

    if(distWrap){
      distWrap.style.display = isCore ? '' : 'none';
    }
    if(distInput){
      distInput.required = isCore;
      if(!isCore && !distInput.value) distInput.value = '';
    }
    if(timeInput){
      timeInput.required = true;
    }

    const modalTitle = document.querySelector('#modal-log h3');
    if(modalTitle){
      modalTitle.textContent = isCore ? 'تسجيل نشاط 🏃‍♂️' : 'تسجيل نشاط (Cross Training) 🧩';
    }
  }

  if(typeSel){
    typeSel.addEventListener('change', apply);
    apply();
  }
}

// ==================== V8.0 Pro Coach Engine (Training Planner) 🧠 ====================
// ==================== V9.0 Mastermind Coach Engine 🧠 ====================

const COACH_DB = {
    // 1. جداول التدريب (مخصصة حسب الهدف)
    workouts: {
        weight_loss: {
            long: "🏃‍♂️ مشي سريع أو هرولة 45 دقيقة (Zone 2) لحرق الدهون.",
            intervals: "🔥 تمرين حرق: دقيقة جري سريع / دقيقتين مشي (كرر 8 مرات).",
            tempo: "⏱️ 20 دقيقة هرولة متواصلة بدون توقف (ارفع النبض).",
            rest: "🍏 اليوم راحة. ركز على أكلك، المطبخ أهم من الجري لخسارة الوزن!"
        },
        speed: {
            long: "🐢 8 كم جري سهل جداً (Recovery Run) لتجهيز الرجل للسرعة.",
            intervals: "⚡ تراك: 400م في 90 ثانية / راحة دقيقة (كرر 10 مرات).",
            tempo: "🚀 30 دقيقة (Threshold Pace) - رتم سباق الـ 10 كم.",
            rest: "🛌 راحة تامة. عضلات السرعة تحتاج استشفاء كامل."
        },
        endurance: {
            long: "🛣️ Long Run: الموعد المقدس! 15-20 كم برتم محادثة.",
            intervals: "⛰️ فارتليك (Fartlek): دقيقتين سريع / دقيقتين بطيء لمدة ساعة.",
            tempo: "⏱️ 10 كم (Marathon Pace). عود جسمك على رتم السباق.",
            rest: "🧘 إطالات (Stretching) أو يوجا خفيفة."
        },
        general: { // الافتراضي
            long: "👟 جرية طويلة ممتعة (5-8 كم) في مكان جديد.",
            intervals: "💨 5 سرعات (Sprints) لمدة 30 ثانية في نهاية الجرية.",
            tempo: "⏱️ 3 كم رتم متوسط + 2 كم رتم سريع.",
            rest: "🚶 مشي خفيف أو يوم راحة."
        }
    },

    // 2. النصائح الفنية (مخصصة حسب الهدف)
    tips: {
        form: [
            "⚠️ ظهرك مفرود! الجري بظهر محني بيقفل الرئة ويقلل الأكسجين.",
            "🦶 انزل على وسط رجلك مش الكعب، ده بيقلل الصدمات على الركبة.",
            "👀 عينك لقدام 10 متر، متبصش تحت رجلك عشان تفتح صدرك.",
            "🛑 كتافك مشدودة؟ نزلهم وارخِ ايدك، الشد في الكتف بيضيع طاقة."
        ],
        weight_loss: [
            "💧 اشرب مية قبل الجري بـ 10 دقايق، ده بيزود الحرق 30%.",
            "🥗 الأكل بعد التمرين أهم من قبله. بروتين وسلطة عشان العضل يبني.",
            "🏃‍♂️ الجري الصبح ع الريق بيحرق من مخزون الدهون المباشر."
        ],
        speed: [
            "🚀 حرك دراعك أسرع، رجلك هتتحرك أسرع أوتوماتيك!",
            "💡 زود الـ Cadence (عدد الخطوات). خطوات قصيرة وسريعة أفضل من خطوات واسعة."
        ]
    }
};

// إلغاء الخطة الحالية والبدء من جديد
async function resetActivePlan(btnElement) {
    if(!confirm("⚠️ هل أنت متأكد من حذف الخطة الحالية؟\nسيتم فقدان تقدمك في الجدول وتعود لنقطة الصفر.")) return;

    // ضمان التقاط الزر الصحيح حتى لو لم يتم تمريره (Fallout)
    const btn = btnElement || event.target.closest('button');
    const originalContent = btn.innerHTML; // حفظ المحتوى الأصلي (أيقونة + نص)
    
    btn.innerHTML = "جاري الحذف...";
    btn.style.opacity = "0.5";
    btn.disabled = true; // تعطيل الزر لمنع التكرار

    try {
        // 1. حذف حقل activePlan من قاعدة البيانات
        await db.collection('users').doc(currentUser.uid).update({
            activePlan: firebase.firestore.FieldValue.delete()
        });

        // 2. تحديث المتغير المحلي فوراً
        delete userData.activePlan;

        // 3. تحديث واجهة الكوتش ليعود الزر القديم
        updateCoachAdvice();

        showToast("تم إلغاء الخطة بنجاح 🗑️", "success");

    } catch(e) {
        console.error(e);
        showToast("حدث خطأ أثناء الحذف", "error");
        
        // استعادة الزر في حالة الخطأ
        btn.innerHTML = originalContent;
        btn.style.opacity = "1";
        btn.disabled = false;
    }
}
// ==================== V11.0 Coach & Action Plan Logic ====================

function updateCoachAdvice() {
    const msgEl = document.getElementById('coach-message');
    const labelEl = document.querySelector('.coach-label');
    if(!msgEl) return;

    const name = (userData.name || "يا بطل").split(' ')[0];
    const hasPlan = userData?.activePlan && userData.activePlan.status === 'active';

    // العنوان ثابت لتقليل اللخبطة
    if(labelEl) labelEl.innerText = "قرار الكوتش اليوم";

    // ملاحظة قصيرة "تلمس" المستخدم — بدون أزرار هنا لتقليل الزحمة
    let note = '';
    try{
        if(hasPlan){
            const s = getPlanTodaySession(userData.activePlan);
            note = s?.isRunDay
                ? `يا ${name}… النهارده من خطتك. خلّيك ثابت واشتغل على السرعة بهدوء.`
                : `يا ${name}… يوم خفيف من الخطة. الاستشفاء جزء من التدريب مش راحة وخلاص.`;
        }else{
            const runs = window._ersRunsCache || [];
            const d = computeDecisionFromRuns(runs);
            note = `يا ${name}… ${d.why}`;
        }
    }catch(e){
        note = `يا ${name}… الاستمرارية هي سر النجاح.`;
    }

    msgEl.innerHTML = `<div class="coach-note">🧠 ${note}</div>`;

    // تحديث قرار الكوتش اليوم (Coach V2)
    if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI();

    // تحديث كارت الخطة/البدء (Plan Hero)
    if (typeof renderPlanHero === 'function') renderPlanHero();
}


function openBasicLibrary(){
    // المكتبة الأساسية مرجع — نفتحها في مودال واحد
    try{ openRunCatalog('all'); }catch(e){}
}

function _formatPlanTarget(target){
    if(!target) return '';
    const t = String(target).toLowerCase();
    if(t.includes('21') || t.includes('half')) return '21K';
    if(t.includes('10')) return '10K';
    if(t.includes('5')) return '5K';
    // fallback numeric
    return String(target).toUpperCase();
}

/* ==================== إصلاح كارت الخطة (V5.1 Safe Mode) ==================== */
function renderPlanHero(planData) {
    const container = document.getElementById('plan-hero');
    if (!container) return;

    // محاولة الوصول للبيانات من عدة مصادر
    // window.userData هو المتغير العام الذي يحتوي بيانات المستخدم
    const user = window.userData || userData || {}; 
    const plan = planData || user.activePlan;

    // هام: إذا لم تكن البيانات قد حملت بعد (user فارغ)، لا تعرض شاشة الإنشاء فوراً
    // بل اعرض "جاري التحميل" أو انتظر قليلاً
    if (Object.keys(user).length === 0 && !plan) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#9ca3af;">جاري تحميل الخطة... ⏳</div>`;
        return;
    }

    // حالة فعلاً لا توجد خطة (البيانات حملت ولكن لا يوجد activePlan)
   if (!plan || (!plan.target && !plan.name)) {
    container.innerHTML = `
        <div class="plan-create-card ers-blue-glass">
            <h3 class="plan-create-title">🎯 هدفك القادم؟</h3>
            <p class="plan-create-sub">ابدأ رحلة تدريبية احترافية الآن.</p>
            <button class="btn btn-glossy.record" onclick="openModal('modal-plan-wizard')">
                إنشاء خطة جديدة
            </button>
        </div>
    `;
    return;
}

    // --- باقي كود الرسم كما هو (التصميم الجديد) ---
    const targetTitle = plan.target || plan.name || "خطة تدريبية"; 
    const currentWeek = plan.currentWeek || 1;
    const totalWeeks = plan.totalWeeks || 8;
    
    let progress = plan.progress || 0;
    if (!progress && totalWeeks > 0) {
        progress = Math.round(((currentWeek - 1) / totalWeeks) * 100);
    }

    container.innerHTML = `
        <div class="plan-header-row" style="z-index: 10; position: relative;">
            <div class="plan-title-group">
                <div class="plan-hero-big" style="font-size:40px;">${targetTitle}</div>
                <div class="plan-hero-sub">الأسبوع ${currentWeek} من ${totalWeeks}</div>
            </div>
            <div class="plan-top-actions">
                <button class="btn-glass-rect" onclick="openPlanScheduleModal()">
                    <i class="ri-calendar-todo-fill"></i>
                    <span>خطة التدريب</span>
                </button>

<button class="btn-glass-rect danger" onclick="resetActivePlan(this)">
    <i class="ri-close-circle-line"></i>
    <span>إلـغـاء الخطة</span>
</button>          

</div>
        </div>
        <div style="position:relative; z-index:10; margin-top:10px;">
             <div style="display:flex; justify-content:space-between; font-size:10px; color:#9ca3af; margin-bottom:5px;">
                <span>مستوى الإنجاز</span>
                <span>${progress}%</span>
            </div>
            <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
                <div style="height:100%; width:${progress}%; background:var(--primary); box-shadow: 0 0 10px var(--primary); transition:width 1s;"></div>
            </div>
        </div>
        <button class="btn-glass-record" onclick="openNewRun()">
            <i class="ri-add-line"></i>
            <span>جرية اليوم</span>
        </button>
    `;
}
// ==================== Coach V2: Decision Engine (Safe / Non-breaking) ====================
window._ersRunsCache = window._ersRunsCache || [];

// === Coach Brain v1 helpers (pace / classification / prefs) ===
const ERS_PACE_RUN_MAX = 10.5;   // min/km and faster => Run
const ERS_PACE_WALK_MIN = 10.75; // above this is usually Walk
const ERS_MIN_DIST_FOR_SPEED = 5; // km

function _ersPace(distKm, timeMin){
    const d = parseFloat(distKm||0);
    const t = parseFloat(timeMin||0);
    if(!d || !t) return null;
    return t / d; // min per km
}
function _ersFormatPace(p){
    if(p === null || p === undefined || !isFinite(p)) return '—';
    const mm = Math.floor(p);
    const ss = Math.round((p - mm)*60);
    return `${mm}:${String(ss).padStart(2,'0')} د/كم`;
}
function _ersAutoKind(selectedType, pace){
    // Race always treated as Run
    const t = String(selectedType||'').toLowerCase();
    if(t === 'race') return 'Run';
    if(pace === null || pace === undefined || !isFinite(pace)) return (t === 'walk' ? 'Walk' : 'Run');
    return (pace <= ERS_PACE_RUN_MAX ? 'Run' : 'Walk');
}
function _ersInferChallengeActivityKind(ch){
    // explicit
    const explicit = ch?.rules?.activityKind;
    if(explicit === 'Run' || explicit === 'Walk' || explicit === 'Any') return explicit;
    const title = String(ch?.title || ch?.name || '').toLowerCase();
    if(title.includes('مشي') || title.includes('walk') || title.includes('steps')) return 'Walk';
    if(ch?.type === 'speed') return 'Run';
    if(title.includes('جري') || title.includes('run') || title.includes('race') || title.includes('ماراثون') || title.includes('half')) return 'Run';
    return 'Any';
}
function _ersEligibleForChallenge(ch, effectiveKind){
    const kind = _ersInferChallengeActivityKind(ch);
    if(kind === 'Any') return true;
    return String(effectiveKind||'') === kind;
}
function _ersLoadPrefs(){
    try{
        const raw = localStorage.getItem('ers_prefs');
        return raw ? JSON.parse(raw) : {};
    }catch(e){ return {}; }
}
function _ersSavePrefs(prefs){
    try{ localStorage.setItem('ers_prefs', JSON.stringify(prefs||{})); }catch(e){}
}
function getUserPref(key, fallback){
    const prefs = (userData && userData.prefs) ? userData.prefs : _ersLoadPrefs();
    if(prefs && Object.prototype.hasOwnProperty.call(prefs, key)) return prefs[key];
    return fallback;
}
async function setUserPref(key, value){
    const prefs = Object.assign({}, _ersLoadPrefs(), (userData?.prefs||{}), { [key]: value });
    _ersSavePrefs(prefs);
    if(userData) userData.prefs = prefs;
    try{
        if(db && auth?.currentUser){
            await db.collection('users').doc(auth.currentUser.uid).set({ prefs }, { merge:true });
        }
    }catch(e){}
    try{ applyUserPrefsToUI(); }catch(e){}
}
function applyUserPrefsToUI(){
    const hideTeam = !!getUserPref('hideTeamWorkout', false);
    const hideWeekly = !!getUserPref('hideWeeklyChallenge', false);
    const hideLib = !!getUserPref('hideBasicLibrary', false);
    const hideSpeed = !!getUserPref('hideSpeedRadar', false);

    const teamEl = document.getElementById('team-workout-section');
    const weeklyEl = document.getElementById('weekly-challenge-section');
    const libEl = document.getElementById('basic-library-section');
    const speedBtn = document.getElementById('coach-speed-btn');

    if(teamEl) teamEl.style.display = hideTeam ? 'none' : '';
    if(weeklyEl) weeklyEl.style.display = hideWeekly ? 'none' : '';
    if(libEl) libEl.style.display = hideLib ? 'none' : '';

    if(speedBtn && hideSpeed) speedBtn.style.display = 'none';
}

function openCoachPreferences(){
    const modal = document.getElementById('modal-coach-prefs');
    if(!modal) return;

    // Fill UI from prefs
    const setChk = (id, val) => { const el=document.getElementById(id); if(el) el.checked = !!val; };
    setChk('pref-hide-team', getUserPref('hideTeamWorkout', false));
    setChk('pref-hide-weekly', getUserPref('hideWeeklyChallenge', false));
    setChk('pref-hide-lib', getUserPref('hideBasicLibrary', false));
    setChk('pref-hide-speed', getUserPref('hideSpeedRadar', false));
    setChk('pref-disable-comments', getUserPref('disableComments', false));

    const focusSel = document.getElementById('pref-goal-focus');
    if(focusSel) focusSel.value = getUserPref('goalFocus', 'general');

    modal.style.display = 'flex';
}

async function saveCoachPreferences(){
    try{
        const getChk = (id) => { const el=document.getElementById(id); return !!(el && el.checked); };

        setUserPref('hideTeamWorkout', getChk('pref-hide-team'));
        setUserPref('hideWeeklyChallenge', getChk('pref-hide-weekly'));
        setUserPref('hideBasicLibrary', getChk('pref-hide-lib'));
        setUserPref('hideSpeedRadar', getChk('pref-hide-speed'));
        setUserPref('disableComments', getChk('pref-disable-comments'));

        const focusSel = document.getElementById('pref-goal-focus');
        const focus = focusSel ? (focusSel.value || 'general') : 'general';
        setUserPref('goalFocus', focus);

        // Persist to Firestore (merge)
        if(currentUser && db){
            await db.collection('users').doc(currentUser.uid).set({
                uiPrefs: userData.uiPrefs || {}
            }, {merge:true});
        }

        applyUserPrefsToUI();
        showToast("تم حفظ تفضيلاتك ✅", "success");
        closeModal('modal-coach-prefs');
        updateUI();
    }catch(e){
        console.error(e);
        showToast("تعذر حفظ التفضيلات", "error");
    }
}



function openExternal(url){
    if(!url) return;
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch(e) { location.href = url; }
}

function getPlanTodaySession(plan){
    if(!plan) return null;

    const startDate = new Date(plan.startDate);
    const today = new Date();
    startDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - startDate) / (1000*60*60*24));
    const dayNum = diffDays + 1;
    const dayInWeek = ((dayNum - 1) % 7) + 1; // 1..7

    const daysCount = parseInt(plan.daysPerWeek) || 3;
    let runDays = [];
    if(daysCount === 3) runDays = [1, 3, 5];
    else if(daysCount === 4) runDays = [1, 2, 4, 6];
    else if(daysCount === 5) runDays = [1, 2, 3, 5, 6];
    else runDays = [1, 2, 3, 4, 5, 6];

    const isRunDay = runDays.includes(dayInWeek);
    let title = 'راحة واستشفاء 🧘‍♂️';
    let sub = 'مشي خفيف + إطالة 8–10 دقايق.';
    let mode = 'recovery';

    if (isRunDay) {
        const targetNum = parseFloat(plan.target);
        const baseDist = (Number.isFinite(targetNum) ? (targetNum / daysCount) : 4);

        if (dayInWeek === runDays[0]) {
            title = `جري مريح (Easy)`;
            sub = `${(baseDist).toFixed(1)} كم • تنفّس مريح (RPE 3–4).`;
            mode = 'build';
        } else if (dayInWeek === runDays[runDays.length-1]) {
            title = `لونج رن (Long)`;
            sub = `${(baseDist * 1.2).toFixed(1)} كم • ثابت وبهدوء + جرعة ماء.`;
            mode = 'push';
        } else {
            title = `تمرين سرعات (Speed/Tempo)`;
            sub = `${(baseDist * 0.8).toFixed(1)} كم • ركّز على الإيقاع بدون تهور.`;
            mode = 'push';
        }
    }

    return { title, sub, mode, isRunDay };
}

function computeDecisionFromRuns(runs){
    const now = new Date();
    const msDay = 24*3600*1000;

    // Robust date parsing for legacy runs (older versions stored date/timestamp in different shapes)
    function _ersToDate(val) {
        if (!val) return null;
        try {
            if (typeof val.toDate === 'function') {
                const d = val.toDate();
                return (d instanceof Date && !isNaN(d)) ? d : null;
            }
        } catch (e) {}

        // Firestore Timestamp-like object {seconds, nanoseconds}
        try {
            if (typeof val === 'object' && typeof val.seconds === 'number') {
                const d = new Date(val.seconds * 1000);
                return !isNaN(d) ? d : null;
            }
        } catch (e) {}

        if (typeof val === 'number' || typeof val === 'string') {
            const d = new Date(val);
            return !isNaN(d) ? d : null;
        }

        if (val instanceof Date) return !isNaN(val) ? val : null;
        return null;
    }

    function _ersGetRunDate(r) {
        if (!r) return null;
        return (
            _ersToDate(r.timestamp) ||
            _ersToDate(r.date) ||
            _ersToDate(r.runDate) ||
            _ersToDate(r.createdAt) ||
            _ersToDate(r.timeStamp) ||
            _ersToDate(r.ts) ||
            _ersToDate(r.dateISO)
        );
    }

    const sorted = (runs||[]).slice().sort((a,b)=>{
        const ta = (_ersGetRunDate(a) || new Date(0)).getTime();
        const tb = (_ersGetRunDate(b) || new Date(0)).getTime();
        return tb - ta;
    });

    const last = sorted[0] || null;
    const lastDate = last ? (_ersGetRunDate(last) || now) : null;
    const daysSince = lastDate ? Math.floor((now - lastDate)/msDay) : 999;

    const lastDist = last ? (parseFloat(last.dist)||0) : 0;
    const lastTime = last ? (parseFloat(last.time)||0) : 0;
    const lastPace = last ? (last.pace || _ersPace(lastDist, lastTime) || 0) : 0;
    const lastKind = last ? (last.autoKind || _ersAutoKind(last.type||'Run', lastPace)) : 'Run';

    // آخر 7 أيام
    const since7 = new Date(now.getTime() - 7 * msDay);
    const weekRuns = sorted.filter(r=>{
        const d = _ersGetRunDate(r);
        return d ? (d >= since7) : false;
    });

    const weekDist = weekRuns.reduce((s,r)=>s+(parseFloat(r.dist)||0),0);

    // Month dist + streak computed from runs as a safe fallback (in case userData fields are missing/outdated)
    let monthDistFromRuns = 0;
    const activeDayKeys = new Set();
    sorted.forEach(r=>{
        const d = _ersGetRunDate(r);
        if(!d) return;
        const dist = parseFloat(r.dist) || 0;
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            monthDistFromRuns += dist;
        }
        // streak considers core activities only (dist > 0)
        if (dist > 0) activeDayKeys.add(d.toISOString().slice(0,10));
    });

    function computeStreakFromKeys(keysSet){
        if(!keysSet || keysSet.size === 0) return 0;
        const cursor = new Date();
        cursor.setHours(0,0,0,0);
        let k = cursor.toISOString().slice(0,10);
        // لو مفيش نشاط النهارده، نبدأ من امبارح (تعريف عملي للستريك)
        if(!keysSet.has(k)){
            cursor.setDate(cursor.getDate()-1);
            k = cursor.toISOString().slice(0,10);
        }
        let streak = 0;
        while(keysSet.has(k)){
            streak++;
            cursor.setDate(cursor.getDate()-1);
            k = cursor.toISOString().slice(0,10);
        }
        return streak;
    }

    const streakFromRuns = computeStreakFromKeys(activeDayKeys);
    const userMonth = Number(userData?.monthDist);
    const userStreak = Number(userData?.currentStreak);
    const safeMonth = (Number.isFinite(userMonth) && userMonth > 0) ? userMonth : monthDistFromRuns;
    const safeStreak = (Number.isFinite(userStreak) && userStreak > 0) ? userStreak : streakFromRuns;

    // V4 Hero quick stats
    try{
      const wEl = document.getElementById('hero-week-dist');
      if(wEl) wEl.textContent = (weekDist||0).toFixed(1);
      const mEl = document.getElementById('hero-month-dist');
      if(mEl) mEl.textContent = (safeMonth||0).toFixed(1);
      const sEl = document.getElementById('hero-streak');
      if(sEl) sEl.textContent = String(safeStreak || 0);
      const gEl = document.getElementById('coach-greeting');
      if(gEl){
        const h = (new Date()).getHours();
        const name = (userData?.name || 'يا كابتن').split(' ')[0];
        const greet = (h < 12) ? 'صباح الخير' : (h < 17 ? 'مساء الخير' : 'مساء النور');
        gEl.textContent = `${greet} يا ${name} 👋`;
      }
    }catch(e){}

    const weekHard = weekRuns.filter(r=>{
        const d = parseFloat(r.dist)||0;
        const t = parseFloat(r.time)||0;
        const p = r.pace || _ersPace(d,t) || 0;
        return (d >= 10) || (p>0 && p <= 5.3);
    }).length;

    // قرار الكوتش اليوم (Coach Brain v1)
    let title = "قرار الكوتش اليوم 🧠";
    let summary = "";
    let tone = "neutral";
    let actionKey = "easy"; // for UI hints

    if (!last) {
        title = "نبدأ صح 👟";
        summary = "مفيش نشاط مسجل لسه… النهارده نعمل 20–30 دقيقة جري/مشي خفيف + 5 دقايق إطالة. أهم حاجة نفتح الباب.";
        tone = "good";
        actionKey = "start";
    } else if (daysSince >= 4) {
        title = "رجعنا للمسار 💚";
        summary = `آخر نشاط من ${daysSince} أيام… هنرجّع الإيقاع بهدوء: 25–35 دقيقة سهل (RPE 2–3) + مشي دقيقتين في النص لو احتجت.`;
        tone = "warn";
        actionKey = "return";
    } else if (lastKind === 'Run' && (lastDist >= 10 || (lastPace>0 && lastPace<=5.3))) {
        title = "استشفاء ذكي 🫶";
        summary = "أمس/آخر مرة كان فيها شغل تقيل… النهارده جسمك محتاج يوم سهل: 20–40 دقيقة Recovery أو راحة نشطة + Mobility.";
        tone = "good";
        actionKey = "recovery";
    } else if (weekHard >= 2) {
        title = "توازن الأسبوع ⚖️";
        summary = "الأسبوع فيه مجهود عالي كفاية… خلينا النهارده سهل عشان نطلع أقوى في الجلسة الجاية.";
        tone = "neutral";
        actionKey = "easy";
    } else if (weekDist < 8) {
        title = "نزوّد الاستمرارية 🔥";
        summary = "إجمالي الأسبوع قليل… النهارده 30–45 دقيقة سهل + 4×20 ثانية سترایدز خفيفة (اختياري).";
        tone = "good";
        actionKey = "build";
    } else {
        title = "يوم شغل مُتحكَّم فيه 💪";
        summary = "لو حاسس نفسك كويس: 10 دقايق إحماء → 6×(1 دقيقة أسرع + 1 دقيقة سهل) → تهدئة. لو مش جاهز… خليه Easy.";
        tone = "neutral";
        actionKey = "quality";
    }

    return { title, summary, tone, actionKey, weekDist: weekDist.toFixed(1), weekHard };
}

function updateCoachDecisionUI(runsOverride){
    const pill = document.getElementById('coach-mode-pill');
    const tEl = document.getElementById('coach-command-title');
    const sEl = document.getElementById('coach-command-sub');
    if(!pill || !tEl || !sEl) return;

    // 1) لو فيه خطة نشطة: القرار يطلع منها
    const hasPlan = userData?.activePlan && userData.activePlan.status === 'active';
    if (hasPlan) {
        const s = getPlanTodaySession(userData.activePlan);
        if (s) {
            pill.className = `coach-mode-pill ${s.mode}`;
            pill.textContent = s.mode === 'recovery' ? 'Recovery' : (s.mode === 'push' ? 'Push' : 'Build');
            tEl.textContent = s.title;
            sEl.textContent = s.sub;
            return;
        }
    }

    // 2) من واقع آخر النشاطات
    const runs = runsOverride || window._ersRunsCache || [];
    const d = computeDecisionFromRuns(runs);
    const tone = d.tone || 'neutral';
    pill.className = `coach-mode-pill ${tone}`;
    pill.textContent = (tone==='good') ? 'Stable' : (tone==='warn' ? 'Reset' : 'Focus');
    tEl.textContent = d.title;
    const w = (d.weekDist != null) ? ` • أسبوعك: ${d.weekDist} كم` : '';
    sEl.textContent = `${d.summary}${w}`;
}
//========================================================
// دوال مساعدة للعرض
// ==================== Coach Center: Daily Workout + Weekly Challenge (V3.5) ====================

let _coachFeedReady = false;
let _coachDailyWorkout = null;
let _coachWeeklyChallenge = null;
let _coachUnsubs = { override:null, schedule:null, workout:null, challenge:null, myChallenge:null };

function _ersDateKey(d=new Date()){
    const z = new Date(d);
    const y = z.getFullYear();
    const m = String(z.getMonth()+1).padStart(2,'0');
    const day = String(z.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
}
function _ersDayKey(d=new Date()){
    const map = ['sun','mon','tue','wed','thu','fri','sat'];
    return map[d.getDay()];
}

function setupCoachFeedOnce(){
    if(_coachFeedReady) return;
    if(!db || !currentUser) return;
    _coachFeedReady = true;
    setupCoachFeed();
}

function setupCoachFeed(){
    try{
        const dateKey = _ersDateKey(new Date());

        // override for "today" (coach can publish a special workout)
        if(_coachUnsubs.override) _coachUnsubs.override();
        _coachUnsubs.override = db.collection('coachOverrides').doc(dateKey)
            .onSnapshot(() => loadCoachDailyWorkout());

        // weekly schedule (fallback if no override)
        if(!_coachUnsubs.schedule){
            _coachUnsubs.schedule = db.collection('coachConfig').doc('weeklySchedule')
                .onSnapshot(() => loadCoachDailyWorkout());
        }

        // weekly challenge (global)
        if(!_coachUnsubs.challenge){
            _coachUnsubs.challenge = db.collection('coachConfig').doc('weeklyChallenge')
                .onSnapshot(() => loadCoachWeeklyChallenge());
        }

        // my completion status (per user)
        if(!_coachUnsubs.myChallenge){
            _coachUnsubs.myChallenge = db.collection('users').doc(currentUser.uid)
                .collection('coachWeekly').doc('current')
                .onSnapshot(() => loadCoachWeeklyChallenge());
        }

        loadCoachDailyWorkout();
        loadCoachWeeklyChallenge();
    }catch(e){
        console.error(e);
    }
}

function _resetCoachFeed(){
    _coachFeedReady = false;
    Object.keys(_coachUnsubs).forEach(k=>{
        if(typeof _coachUnsubs[k] === 'function') _coachUnsubs[k]();
        _coachUnsubs[k] = null;
    });
    _coachDailyWorkout = null;
    _coachWeeklyChallenge = null;
}

/* -------------------- Daily Workout -------------------- */

async function loadCoachDailyWorkout(){
    const card = document.getElementById('coach-daily-card') || document.getElementById('team-workout-container');
    if(!card) return;
    if(!db) return;

    const dateKey = _ersDateKey(new Date());
    const dayKey = _ersDayKey(new Date());

    let workoutId = null;
    let source = 'weekly';

    try{
        const ov = await db.collection('coachOverrides').doc(dateKey).get();
        if(ov.exists && ov.data()?.workoutId){
            workoutId = ov.data().workoutId;
            source = 'override';
        }else{
            const sched = await db.collection('coachConfig').doc('weeklySchedule').get();
            if(sched.exists){
                workoutId = sched.data()?.[dayKey] || null;
                source = 'weekly';
            }
        }

        if(workoutId){
            // subscribe to workout live updates (edit from admin)
            if(_coachUnsubs.workout) _coachUnsubs.workout();
            _coachUnsubs.workout = db.collection('coachWorkouts').doc(workoutId)
                .onSnapshot(snap=>{
                    if(!snap.exists) return;
                    _coachDailyWorkout = { id:snap.id, ...snap.data(), _source: source };
                    renderCoachDailyCard();
                });
        }else{
            _coachDailyWorkout = _getFallbackWorkout(dayKey);
            _coachDailyWorkout._source = 'fallback';
            renderCoachDailyCard();
        }

        const pill = document.getElementById('coach-daily-pill');
        if(pill){
            pill.style.display = 'inline-flex';
            pill.innerText = (source === 'override') ? 'مُحدث اليوم ✨' : 'من جدول الأسبوع ♻️';
        }
    }catch(e){
        console.error(e);
        card.innerHTML = `
        <div class="team-goal-card" onclick="openDailyWorkoutModal();">
            <div class="team-goal-icon">${emoji}</div>
            <div class="team-goal-content">
                <div class="team-goal-title">تمرينة جديدة من الكابتن</div>
                <div class="team-goal-sub">${title} • ${load}${(load && rpe) ? ' • ' : ''}${rpe}${hasYT ? ' • 🎥' : ''}</div>
            </div>
            <div class="team-goal-actions" style="margin-left:auto; display:flex; gap:8px;">
                ${(w.startUrl || w.link) ? `<button class="btn btn-primary" style="padding:8px 10px; font-size:11px;" onclick="event.stopPropagation(); window.open('${(w.startUrl||w.link).replace(/'/g,"&#39;")}', '_blank');">ابدأ التدريب</button>` : ''}
                <button class="btn btn-ghost" style="padding:8px 10px; font-size:11px;" onclick="event.stopPropagation(); openDailyWorkoutModal();">التفاصيل</button>
            </div>
        </div>
    `;    }
}

function _getFallbackWorkout(dayKey){
    const defaults = {
        sat: { emoji:'🫁', title:'استشفائي أو راحة', type:'recovery', load:'20–35 دقيقة', rpe:'2–3', structure:'Warmup: 5 دقائق مشي/جري خفيف\nMain: جري سهل جدًا\nCooldown: إطالة 8 دقائق', notes:'خفّفها… الهدف إنك تقوم تاني بكرة.' },
        sun: { emoji:'🏔️', title:'تمرين هيلز', type:'hills', load:'30–45 دقيقة', rpe:'6–7', structure:'Warmup: 10 دقائق\nMain: 6×(40ث صعود + 70ث نزول)\nCooldown: 8 دقائق', notes:'الصعود قوي بس قصير… والنزول مرن.' },
        mon: { emoji:'🧘‍♂️', title:'موبيلتي / يوجا', type:'mobility', load:'20–30 دقيقة', rpe:'1–2', structure:'Mobility: كاحل + فخذ + حوض\nYoga: تنفّس + إطالات', notes:'ده مش رفاهية… ده صيانة.' },
        tue: { emoji:'⚡', title:'انترفال', type:'intervals', load:'35–55 دقيقة', rpe:'7–8', structure:'Warmup: 10 دقائق\nMain: 8×(1د سريع + 1د سهل)\nCooldown: 8 دقائق', notes:'سرعاتك "متحكم فيها" مش سباق.' },
        wed: { emoji:'🎲', title:'فارتلك أو استشفائي', type:'fartlek', load:'25–45 دقيقة', rpe:'4–6', structure:'Warmup: 10 دقائق\nMain: 10×(1د أسرع + 1د سهل)\nCooldown: 6 دقائق', notes:'إلعبها… وانهى وأنت قادر تزود.' },
        thu: { emoji:'🏋️', title:'كروس تريننج', type:'strength', load:'25–40 دقيقة', rpe:'4–6', structure:'Strength: سكوات خفيف + كور\nأو: عجلة/سباحة/إليبتكال', notes:'قوة = حماية للركبة + سرعة أسرع.' },
        fri: { emoji:'🐢', title:'لونج رن', type:'long', load:'60–90 دقيقة', rpe:'3–5', structure:'Warmup: 8 دقائق\nMain: جري ثابت\nCooldown: 6 دقائق + سوائل', notes:'خليها "مريحة"… اللونج يبنيك.' }
    };
    return defaults[dayKey] || defaults.sun;
}


function renderCoachDailyCard(){
    // Extra workout card مستقل (بدون خلطه بقرار الكوتش اليوم)
    const container = document.getElementById('team-workout-container') || document.getElementById('coach-daily-card');
    if(!container) return;

    const w = _coachDailyWorkout;
    if(!w){
        container.innerHTML = `
            <div class="team-goal-card" style="opacity:0.85;">
                <div class="team-goal-icon">⏳</div>
                <div class="team-goal-content">
                    <div class="team-goal-title">تمرينة جديدة من الكابتن</div>
                    <div class="team-goal-sub">جاري التحميل…</div>
                </div>
            </div>`;
        return;
    }

    const emoji = w.emoji || '🔥';
    const title = w.title || w.name || 'التمرين';
    const load = w.load || w.distance || '';
    const rpe = w.rpe ? `RPE ${w.rpe}` : '';
    const hasYT = !!_toYouTubeEmbed(w.youtubeUrl || w.youtube);
    const startUrlRaw = (w.startUrl || w.link || '').trim();
    const startUrl = startUrlRaw.replace(/'/g,"&#39;");

    const left = (w.imageUrl && String(w.imageUrl).trim())
        ? `<img src="${String(w.imageUrl).trim().replace(/"/g,'&quot;')}" alt="workout" style="width:44px;height:44px;border-radius:14px;object-fit:cover;border:1px solid rgba(255,255,255,0.10);" />`
        : `<div class="team-goal-icon">${emoji}</div>`;

    const meta = `${load}${(load && rpe) ? ' • ' : ''}${rpe}${hasYT ? ' • 🎥' : ''}`.trim();

const imgRaw = (w.imageUrl && String(w.imageUrl).trim()) ? String(w.imageUrl).trim() : '';
const imgSafe = imgRaw.replace(/"/g,'&quot;').replace(/'/g,'&#39;');

container.innerHTML = `

  <div class="coach-workout-card" onclick="openDailyWorkoutModal();">
    <div class="cw-media ${imgRaw ? 'has-img' : ''}" ${imgRaw ? `style="--cw-img:url('${imgSafe}')"` : ''}>
      ${imgRaw ? `<button class="cw-zoom" title="تكبير الصورة" onclick="event.stopPropagation(); openImageViewer('${imgSafe}');"><i class="ri-zoom-in-line"></i></button>` : ''}
    </div>

    <div class="cw-body">
      <div class="cw-top">
        <span class="cw-chip">${_escapeHtml(w.emoji || '🔥')} تمرينة جديدة من الكابتن</span>
        <span class="cw-chip" style="margin-inline-start:auto; opacity:.9;">${_escapeHtml(meta || '')}</span>
      </div>

      <div class="cw-title">${_escapeHtml(title)}</div>
      <div class="cw-sub">${_escapeHtml((w.notes || '').trim() || 'اضغط التفاصيل وشوف خطة التمرين خطوة بخطوة.')}</div>

<div class="cw-actions">
  <button class="btn btn-primary" onclick="event.stopPropagation(); openCoachWorkoutLog();">
    <i class="ri-whistle-line"></i> نفّذ التمرين
  </button>
  <button class="btn btn-ghost" onclick="event.stopPropagation(); openDailyWorkoutModal();">التفاصيل</button>
</div>
`;
}


function openDailyWorkoutModal(){
  const w = _coachDailyWorkout;
  if(!w) return;

  const titleEl = document.getElementById('daily-modal-title');
  const bodyEl  = document.getElementById('daily-modal-body');
  if(titleEl) titleEl.innerText = `${w.emoji || '🔥'} ${w.title || w.name || 'جرية اليوم'}`;

  const embed     = _toYouTubeEmbed(w.youtubeUrl || w.youtube);
  const structure = (w.structure || '').trim();
  const notes     = (w.notes || '').trim();
  const load      = w.load || '';
  const rpe       = w.rpe ? `RPE ${w.rpe}` : '';

  const imgRaw  = (w.imageUrl && String(w.imageUrl).trim()) ? String(w.imageUrl).trim() : '';
  const imgSafe = imgRaw.replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let html = '';

  // ✅ صورة التمرين + فتحها
  if(imgRaw){
    html += `
      <div style="margin-bottom:12px;">
        <div
          style="
            position:relative;
            border-radius:16px;
            overflow:hidden;
            border:1px solid rgba(255,255,255,0.10);
            background:rgba(0,0,0,0.18);
            cursor:pointer;
          "
          onclick="openImageViewer('${imgSafe}')"
          title="اضغط لتكبير الصورة"
        >
          <img src="${imgSafe}" alt="workout" style="width:100%; height:180px; object-fit:cover; display:block;">
          <div style="position:absolute; inset:auto 12px 12px 12px; font-size:11px; color:#e5e7eb; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.10); padding:6px 10px; border-radius:999px; width:max-content;">
            <i class="ri-zoom-in-line"></i> اضغط لتكبير الصورة
          </div>
        </div>
      </div>
    `;
  }

  html += `<div style="margin-bottom:10px; color:#9ca3af; font-size:12px;">${load}${(load && rpe) ? ' • ' : ''}${rpe}</div>`;

  if(structure){
    html += `<div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; white-space:pre-wrap; line-height:1.7; color:#e5e7eb; font-size:12px;">${_escapeHtml(structure)}</div>`;
  }else{
    html += `<div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; color:#e5e7eb; font-size:12px;">ابدأ بإحماء 8–10 دقائق… ثم نفّذ الجزء الرئيسي… وأنهِ بتهدئة وإطالة.</div>`;
  }

  if(notes){
    html += `<div style="margin-top:10px; font-size:12px; color:#dbeafe; line-height:1.7;"><b>كلمة الكوتش:</b> ${_escapeHtml(notes)}</div>`;
  }

  if(embed){
    html += `<div style="margin-top:12px; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.10);">
      <iframe src="${embed}" style="width:100%; aspect-ratio:16/9; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>`;
    html += `<div style="margin-top:6px; font-size:11px; color:#9ca3af;">لو الفيديو مفيد… احفظه وكرره. ✅</div>`;
  }

  if(bodyEl) bodyEl.innerHTML = html;

  // استخدم نظام المودالات الموحد لو موجود
  if(typeof openModal === 'function') openModal('modal-daily-workout');
  else document.getElementById('modal-daily-workout').style.display = 'flex';
}


function openLogFromCoach(suggestedType){
    // يفتح Modal تسجيل نشاط (بدون لمس الداتا القديمة)
    try{
        openNewRun(); // <--- تم التعديل من openLog() إلى openNewRun()
        const t = document.getElementById('log-type');
        if(t && suggestedType){
            // هنا يمكن إضافة منطق لاحقاً لتحديد النوع تلقائياً
        }
    }catch(e){
        console.error(e);
    }
}
/* -------------------- Weekly Challenge -------------------- */

async function loadCoachWeeklyChallenge(){
    const card = document.getElementById('coach-weekly-card') || document.getElementById('weekly-challenge-section');
    if(!card || !db || !currentUser) return;

    try{
        const snap = await db.collection('coachConfig').doc('weeklyChallenge').get();
        if(!snap.exists){
            _coachWeeklyChallenge = null;
            card.innerHTML = `<div style="text-align:center; color:#9ca3af;">لا يوجد تحدي أسبوعي منشور حالياً.</div>`;
            return;
        }
        _coachWeeklyChallenge = { id:snap.id, ...snap.data() };

        const mine = await db.collection('users').doc(currentUser.uid).collection('coachWeekly').doc('current').get();
        const completed = mine.exists && !!mine.data()?.completed;
        renderCoachWeeklyCard(completed, mine.exists ? mine.data() : null);
    }catch(e){
        console.error(e);
        card.innerHTML = `<div style="text-align:center; color:#ef4444;">تعذر تحميل تحدي الأسبوع.</div>`;
    }
}

function renderCoachWeeklyCard(completed, mineData){
    const card = document.getElementById('coach-weekly-card') || document.getElementById('weekly-challenge-section');
    if(!card) return;

    const ch = _coachWeeklyChallenge;
    if(!ch){
        card.innerHTML = `<div style="text-align:center; color:#9ca3af;">لا يوجد تحدي أسبوعي منشور حالياً.</div>`;
        return;
    }

    const emoji = ch.emoji || '🏁';
    const title = ch.title || 'تحدي الأسبوع';
    const desc = (ch.desc || ch.description || '').trim() || 'ابدأ… وخد صورة إثبات.';
    const requireImg = (ch.requireImage !== false);
    const status = completed ? 'مكتمل ✅' : (requireImg ? 'محتاج إثبات 📸' : 'جاهز للتنفيذ 🚀');

    const meta = document.getElementById('coach-weekly-meta');
    if(meta){
        meta.style.display = 'inline';
        meta.innerText = status;
    }

    card.innerHTML = `
        <div class="wc-head">
        <div class="ch-badge-fixed">🏆 تحدي الأسبوع</div>
        </div>
            <div class="wc-badge">
                <div class="wc-emoji">${emoji}</div>
                <div>
                    <div class="wc-title">${title}</div>
                    <div class="wc-meta">${status}</div>
                </div>
            </div>
         </div>
          
        <p class="wc-notes">${_escapeHtml(desc).replace(/\n/g,'<br>')}</p>
        <div class="wc-actions">
            <button class="btn btn-primary" onclick="openWeeklyChallengeModal(); event.stopPropagation();" ${completed ? 'disabled style="opacity:.6;"' : ''}>
                ${completed ? 'تم ✅' : 'تفاصيل التحدي'}
            </button>
        </div>
    `;
}

function openWeeklyChallengeModal(){
    const ch = _coachWeeklyChallenge;
    if(!ch) return;

    const titleEl = document.getElementById('weekly-modal-title');
    const bodyEl = document.getElementById('weekly-modal-body');
    if(titleEl) titleEl.innerText = `${ch.emoji || '🏁'} ${ch.title || 'تحدي الأسبوع'}`;

    const requireImg = (ch.requireImage !== false);
    const desc = (ch.desc || ch.description || '').trim();

    let html = '';
    html += `<div style="color:#9ca3af; font-size:12px; margin-bottom:10px;">${requireImg ? '📸 يتطلب صورة إثبات' : '✅ بدون صورة إثبات'}</div>`;
    html += `<div style="background:rgba(0,0,0,0.18); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px; white-space:pre-wrap; line-height:1.7; color:#e5e7eb; font-size:12px;">${_escapeHtml(desc || 'اكتب تفاصيل التحدي من لوحة الكوتش.')}</div>`;

    bodyEl.innerHTML = html;

    // update button availability
    db.collection('users').doc(currentUser.uid).collection('coachWeekly').doc('current').get().then(mine=>{
        const completed = mine.exists && !!mine.data()?.completed;
        const btn = document.getElementById('weekly-complete-btn');
        if(btn){
            btn.disabled = completed;
            btn.style.opacity = completed ? 0.6 : 1;
            btn.innerText = completed ? 'مكتمل ✅' : 'أكملت التحدي ✅';
        }
    });

    document.getElementById('modal-weekly-challenge').style.display = 'flex';
}

function openWeeklyProof(){
    const ch = _coachWeeklyChallenge;
    if(!ch) return;

    // reset proof UI
    const status = document.getElementById('weekly-upload-status');
    const prev = document.getElementById('weekly-img-preview');
    const hid = document.getElementById('weekly-uploaded-img-url');
    const note = document.getElementById('weekly-proof-note');
    if(status) status.innerText = '';
    if(prev){ prev.style.display = 'none'; prev.src = ''; }
    if(hid) hid.value = '';
    if(note) note.value = '';

    document.getElementById('modal-weekly-proof').style.display = 'flex';
}

async function saveWeeklyProof(){
    const ch = _coachWeeklyChallenge;
    if(!ch || !db || !currentUser) return;

    const requireImg = (ch.requireImage !== false);
    const imgUrl = document.getElementById('weekly-uploaded-img-url')?.value || '';
    const note = document.getElementById('weekly-proof-note')?.value || '';

    if(requireImg && !imgUrl){
        showToast('لازم ترفع صورة إثبات 📸');
        return;
    }

    try{
        await db.collection('users').doc(currentUser.uid).collection('coachWeekly').doc('current').set({
            completed: true,
            photoUrl: imgUrl || null,
            note: note || null,
            challengeTitle: ch.title || null,
            challengeEmoji: ch.emoji || null,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        closeModal('modal-weekly-proof');
        showToast('مبروك! التحدي اتسجل ✅');
        loadCoachWeeklyChallenge();
    }catch(e){
        console.error(e);
        showToast('حصل خطأ… حاول تاني');
    }
}

function shareWeeklyText(){
    const ch = _coachWeeklyChallenge;
    if(!ch) return;

    const title = ch.title || 'تحدي الأسبوع';
    const desc = (ch.desc || ch.description || '').trim();
    const msg = `🏁 ${title}\n\n${desc}\n\n#ERS #EgyRunnerSquad`;

    if(navigator.share){
        navigator.share({ title: title, text: msg }).catch(()=>{});
    }else{
        try{
            navigator.clipboard.writeText(msg);
            showToast('تم نسخ نص التحدي ✅');
        }catch(e){
            alert(msg);
        }
    }
}

/* Weekly proof upload (ImgBB) */
async function uploadWeeklyProofToImgBB(){
    const fileInput = document.getElementById('weekly-img-file');
    const status = document.getElementById('weekly-upload-status');
    const preview = document.getElementById('weekly-img-preview');
    const hidden = document.getElementById('weekly-uploaded-img-url');
    const saveBtn = document.getElementById('weekly-save-proof-btn');

    if(!fileInput || !fileInput.files || !fileInput.files[0]) return;

    const file = fileInput.files[0];
    if(saveBtn) saveBtn.disabled = true;
    if(status) status.innerText = 'جاري رفع الصورة...';

    try{
        const apiKey = IMG_BB_KEY;
        if(!apiKey) throw new Error('IMG_BB_KEY missing');

        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method:'POST', body: formData });
        const json = await res.json();
        if(!json || !json.success) throw new Error('upload failed');

        const url = json.data.url;
        if(hidden) hidden.value = url;

        if(preview){
            preview.src = url;
            preview.style.display = 'block';
        }
        if(status) status.innerText = 'تم رفع الصورة ✅';
    }catch(e){
        console.error(e);
        if(status) status.innerText = 'فشل رفع الصورة ❌';
    }finally{
        if(saveBtn) saveBtn.disabled = false;
    }
}




function openCoachWorkoutLog(){
  const w = _coachDailyWorkout;

  // ✅ لو تمرين اليوم لسه ماتحمّلاش، حاول تهيئة الفيد وقل للمستخدم يجرب تاني
  if(!w){
    try{
      if (typeof setupCoachFeedOnce === 'function') setupCoachFeedOnce();
    }catch(e){
      console.warn('[openCoachWorkoutLog] setupCoachFeedOnce failed:', e);
    }
    showToast('تمرين الكوتش لسه بيتحمّل… جرّب تاني بعد ثانية ⏳', 'error');
    return;
  }

  // context for submitRun()
  window._ersCoachLogCtx = {
    kind: 'coachDaily',
    workoutId: w.id || null,
    title: (w.title || w.name || 'تمرينة الكوتش'),
    emoji: (w.emoji || '📣'),
    dateKey: (typeof _ersDateKey === 'function') ? _ersDateKey(new Date()) : null,
    requireImage: true,
    startUrl: (w.startUrl || w.link || '').trim() || null
  };

  try{
    openNewRun();

    // tweak modal header
    const h = document.querySelector('#modal-log h3');
    if(h) h.innerText = `${window._ersCoachLogCtx.emoji} سجل تمرينة الكوتش`;

    // optional: put startUrl into link field
    const linkEl = document.getElementById('log-link');
    if(linkEl && window._ersCoachLogCtx.startUrl) linkEl.value = window._ersCoachLogCtx.startUrl;

   }catch(e){
    console.error(e);
  }
}




// ==================== Smart Elite Library Logic ====================

// 1. قاعدة بيانات التمارين الذكية (محتوى عبقري واحترافي)
const ELITE_WORKOUTS_DATA = {
    intervals: [
        { name: "سلم السرعة (Ladder)", desc: "100m, 200m, 400m, 800m ثم العكس. الراحة هي نفس زمن الجري.", goal: "زيادة السرعة القصوى (V02 Max)" },
        { name: "انترفل الأهرامات", desc: "5 جولات × (1د سريع جداً / 1د مشي) ثم 5 جولات × (30ث انفجار سرعة / 30ث راحة).", goal: "تحسين التحمل اللاهوائي" }
    ],
    tempo: [
        { name: "الإيقاع المتصاعد", desc: "جري 10 كم: أول 4 كم سهل، ثم زيادة السرعة تدريجياً كل 2 كم لتنتهي بأقصى سرعة.", goal: "تعويد الجسم على دفع التعب" },
        { name: "تمبو الثبات", desc: "جري مسافة 6-8 كم بسرعة ثابتة (أبطأ 15 ثانية من رقمك الشخصي في الـ 5 كم).", goal: "رفع عتبة اللاكتيك" }
    ],
    long_run: [
        { name: "ماراثون سيميوليشن", desc: "جري 15-18 كم مع إضافة 3 كم في المنتصف بسرعة الماراثون المستهدفة.", goal: "بناء التحمل العضلي الطويل" },
        { name: "جري الاستكشاف السلبي", desc: "جري مسافة طويلة بحيث يكون النصف الثاني أسرع من النصف الأول بـ 5-10 دقائق.", goal: "الانضباط وتوزيع المجهود" }
    ],
    recovery: [
        { name: "مساج الجري (Shakeout)", desc: "15-20 دقيقة هرولة خفيفة جداً (Pace > 8:00) مع تحريك الذراعين بحرية.", goal: "تنشيط الدورة الدموية للاستشفاء" },
        { name: "التعافي النشط 3-2-1", desc: "3 كم مشي سريع، 2 كم هرولة، 1 كم مشي بطيء.", goal: "إزالة حمض اللاكتيك بعد السباقات" }
    ],
    strength: [
        { name: "قوة الكور الفولاذية", desc: "Plank (1min), Russian Twists (50), Leg Raises (20) × 3 مجموعات.", goal: "ثبات الجذع أثناء الجري" },
        { name: "انفجار الساقين (Plyo)", desc: "Jump Squats, Lunges, Calf Raises. كل تمرين 45 ثانية مع 15 ثانية راحة.", goal: "زيادة قوة دفع الخطوة" }
    ]
};

// 2. تحديث دالة الرسم (التعديل لفتح المودال الجديد)
function renderCoachLibrary() {
    const container = document.getElementById('library-types-container');
    if (!container) return;

    const categories = [
        { id: 'intervals', name: 'انترفل / سرعات', icon: '⏱️', color: '#ef4444' },
        { id: 'tempo', name: 'تمبو / إيقاع', icon: '⚡', color: '#3b82f6' },
        { id: 'long_run', name: 'جري طويل', icon: '🏃‍♂️', color: '#10b981' },
        { id: 'recovery', name: 'استشفاء', icon: '🧘‍♂️', color: '#8b5cf6' },
        { id: 'strength', name: 'تمارين قوة', icon: '💪', color: '#f59e0b' }
    ];

    let html = '';
    categories.forEach(cat => {
        const count = ELITE_WORKOUTS_DATA[cat.id].length;
        html += `
            <div class="sch-card" onclick="openEliteWorkoutsModal('${cat.id}', '${cat.name}')" 
                 style="min-width: 125px; border-bottom: 3px solid ${cat.color}; cursor:pointer;">
                <div class="sch-icon" style="color:${cat.color}; font-size:24px;">${cat.icon}</div>
                <div class="sch-title" style="margin-top:5px;">${cat.name}</div>
                <div class="sch-desc">${count} تمرين ذكي</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 3. دالة فتح مودال التمارين الذكية
function openEliteWorkoutsModal(catId, catName) {
    const workouts = ELITE_WORKOUTS_DATA[catId];
    let listHtml = '';

    workouts.forEach(w => {
        listHtml += `
            <div class="elite-workout-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:15px; margin-bottom:12px; border-right:4px solid var(--primary);">
                <h4 style="margin:0 0 5px 0; color:#fff;">${w.name}</h4>
                <p style="font-size:12px; color:#cbd5e1; margin:0 0 8px 0; line-height:1.4;">${w.desc}</p>
                <div style="font-size:10px; color:var(--primary); font-weight:bold;">🎯 الهدف: ${w.goal}</div>
            </div>
        `;
    });

    // تحديث محتوى مودال الكتالوج (أو مودال مخصص)
    const titleEl = document.getElementById('catalog-title');
    const bodyEl = document.getElementById('catalog-body');
    
    if(titleEl && bodyEl) {
        titleEl.innerText = `تمارين الـ ${catName} الذكية`;
        bodyEl.innerHTML = listHtml;
        openModal('modal-catalog');
    }
}