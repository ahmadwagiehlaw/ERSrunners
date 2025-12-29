/* ERS Runners - V23 (Smart Log & Live Avatar) */

const firebaseConfig = {
  apiKey: "AIzaSyCHod8qSDNzKDKxRHj1yQlWgNAPXFNdAyg",
  authDomain: "ers-runners-app.firebaseapp.com",
  projectId: "ers-runners-app",
  storageBucket: "ers-runners-app.firebasestorage.app",
  messagingSenderId: "493110452684",
  appId: "1:493110452684:web:db892ab6e6c88b3e6dbd69"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userData = {};
let isSignupMode = false;

// متغيرات التعديل الجديدة
let editingRunId = null;
let editingOldDist = 0;

// ==================== 1. Auth & Init ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                if (!userData.badges) userData.badges = [];
                initApp();
            } else {
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
                initApp();
            }
        } catch (e) { 
            console.error("Auth Error:", e);
            userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
            initApp();
        }
    } else {
        currentUser = null;
        showAuthScreen();
    }
});

function initApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    
    // ضبط الوقت الافتراضي
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = now.toISOString().slice(0,16);

    updateUI();
    loadActivityLog(); // السجل المطور
    loadActiveChallenges(); 
    loadGlobalFeed();
    listenForNotifications();
}

// ==================== 2. UI Updates & Avatar ====================
function updateUI() {
    try {
        const headerName = document.getElementById('headerName');
        const helloText = document.querySelector('.hello-text');
        
        if(helloText) helloText.innerText = "أهلاً يا كابتن 👋"; 
        if (headerName) headerName.innerText = userData.name || "Runner";

        // Dashboard Stats
        const monthDistEl = document.getElementById('monthDist');
        const totalRunsEl = document.getElementById('totalRuns');
        if (monthDistEl) monthDistEl.innerText = (userData.monthDist || 0).toFixed(1);
        if (totalRunsEl) totalRunsEl.innerText = userData.totalRuns || 0;

        // Rank & Avatar Calculation
        const totalDist = userData.totalDist || 0;
        const rankData = calculateRank(totalDist);

        // Profile (Bib Card Update)
        const profileName = document.getElementById('profileName');
        const profileRegion = document.getElementById('profileRegion');
        const profileAvatar = document.querySelector('.bib-avatar') || document.getElementById('profileAvatar');
        const pTotalDist = document.getElementById('profileTotalDist');
        const pTotalRuns = document.getElementById('profileTotalRuns');
        const pRankText = document.getElementById('profileRankText');
        const pPace = document.getElementById('profilePace');

        if (profileName) profileName.innerText = userData.name;
        if (profileRegion) profileRegion.innerText = userData.region;
        
        // 🔥 تحديث الأفاتار بالإيموجي
        if (profileAvatar) {
            profileAvatar.innerText = rankData.avatar; 
            // إزالة الخلفية السوداء لكي يظهر الإيموجي بوضوح إذا كان في البيب
            if(profileAvatar.classList.contains('bib-avatar')) {
                profileAvatar.style.background = "rgba(0,0,0,0.1)"; 
                profileAvatar.style.border = "2px solid rgba(255,255,255,0.2)";
            }
        }

        if (pTotalDist) pTotalDist.innerText = (userData.totalDist || 0).toFixed(1);
        if (pTotalRuns) pTotalRuns.innerText = userData.totalRuns || 0;
        
        // Pace calculation
        if (pPace) pPace.innerText = userData.totalRuns > 0 ? ((userData.totalDist/userData.totalRuns)*5).toFixed(1) : "-"; 
        if (pRankText) pRankText.innerText = rankData.name;

        // Rank Badge in Home
        const rankBadge = document.getElementById('userRankBadge');
        if(rankBadge) {
            rankBadge.innerText = rankData.name;
            rankBadge.className = `rank-badge ${rankData.class}`;
        }
        
        // XP Bar
        const nextLevelDist = document.getElementById('nextLevelDist');
        if(nextLevelDist) nextLevelDist.innerText = rankData.remaining.toFixed(1);
        
        const xpBar = document.getElementById('xpBar');
        if(xpBar) {
            xpBar.style.width = `${rankData.percentage}%`;
            xpBar.style.backgroundColor = `var(--rank-color)`;
            xpBar.parentElement.className = `xp-track ${rankData.class}`;
        }
        const xpText = document.getElementById('xpText');
        const xpPerc = document.getElementById('xpPerc');
        const xpMessage = document.getElementById('xpMessage');

        if(xpText) xpText.innerText = `${rankData.distInLevel.toFixed(1)} / ${rankData.distRequired} كم`;
        if(xpPerc) xpPerc.innerText = `${Math.floor(rankData.percentage)}%`;
        if(xpMessage) xpMessage.innerText = rankData.name === "أسطورة" ? "أنت الملك! 👑" : `باقي ${rankData.remaining.toFixed(1)} كم للوصول لمستوى ${getNextRankName(rankData.name)}`;

        // Charts & Badges
        updateGoalRing();
        renderBadges();
        if(typeof loadWeeklyChart === "function") loadWeeklyChart();

    } catch (error) { console.error("UI Update Error:", error); }
}

function updateGoalRing() {
    const goalRing = document.getElementById('goalRing');
    const goalText = document.getElementById('goalText');
    const goalSub = document.getElementById('goalSub');
    
    if(goalRing && goalText) {
        const myGoal = userData.monthlyGoal || 0;
        const currentMonthDist = userData.monthDist || 0;
        
        if(myGoal === 0) {
            goalText.innerText = "اضغط لتحديد هدف";
            goalSub.innerText = "تحدى نفسك هذا الشهر";
            goalRing.style.background = `conic-gradient(#374151 0deg, rgba(255,255,255,0.05) 0deg)`;
        } else {
            const perc = Math.min((currentMonthDist / myGoal) * 100, 100);
            const deg = (perc / 100) * 360;
            const remaining = Math.max(myGoal - currentMonthDist, 0).toFixed(1);
            
            goalText.innerText = `${currentMonthDist.toFixed(1)} / ${myGoal} كم`;
            goalSub.innerText = remaining == 0 ? "أنت أسطورة! 🎉" : `باقي ${remaining} كم`;
            goalSub.style.color = remaining == 0 ? "#10b981" : "#a78bfa";
            goalRing.style.background = `conic-gradient(#8b5cf6 ${deg}deg, rgba(255,255,255,0.1) 0deg)`;
        }
    }
}

// === نظام الرتب المطور (مع الإيموجي) ===
function calculateRank(totalDist) {
    const levels = [
        { name: "مبتدئ", min: 0, class: "rank-mubtadi", next: 50, avatar: "🥚" },
        { name: "هاوي", min: 50, class: "rank-hawy", next: 150, avatar: "🐣" },
        { name: "عداء", min: 150, class: "rank-runner", next: 500, avatar: "🏃" },
        { name: "محترف", min: 500, class: "rank-pro", next: 1000, avatar: "🦅" },
        { name: "أسطورة", min: 1000, class: "rank-legend", next: 10000, avatar: "👑" }
    ];
    let currentLevel = levels[0];
    for (let i = levels.length - 1; i >= 0; i--) {
        if (totalDist >= levels[i].min) { currentLevel = levels[i]; break; }
    }
    const distRequired = currentLevel.next - currentLevel.min;
    const distInLevel = totalDist - currentLevel.min;
    let percentage = (distInLevel / distRequired) * 100;
    if (percentage > 100) percentage = 100;
    
    return { 
        name: currentLevel.name, 
        class: currentLevel.class, 
        avatar: currentLevel.avatar,
        nextTarget: currentLevel.next, 
        remaining: currentLevel.next - totalDist, 
        percentage: percentage, 
        distInLevel: distInLevel, 
        distRequired: distRequired 
    };
}

function getNextRankName(current) {
    if(current === "مبتدئ") return "هاوي"; if(current === "هاوي") return "عداء";
    if(current === "عداء") return "محترف"; if(current === "محترف") return "أسطورة"; return "";
}

// ==================== 3. Core Features (Edit & Add) ====================

// دالة فتح نافذة الإضافة الجديدة (تصفير البيانات)
function openNewRun() {
    editingRunId = null;
    editingOldDist = 0;
    
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    document.getElementById('log-type').value = 'Run';
    document.getElementById('log-link').value = '';
    document.getElementById('save-run-btn').innerText = "حفظ النشاط";
    
    // إعادة تعيين الوقت للآن
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateInput = document.getElementById('log-date');
    if(dateInput) dateInput.value = now.toISOString().slice(0,16);

    openLogModal();
}

// دالة فتح نافذة التعديل (ملء البيانات)
window.editRun = function(id, dist, time, type, link) {
    editingRunId = id;
    editingOldDist = dist;
    
    document.getElementById('log-dist').value = dist;
    document.getElementById('log-time').value = time;
    document.getElementById('log-type').value = type;
    document.getElementById('log-link').value = link || '';
    
    document.getElementById('save-run-btn').innerText = "تعديل النشاط";
    openLogModal();
}

async function submitRun() {
    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const link = document.getElementById('log-link').value;
    const dateInput = document.getElementById('log-date').value;

    if (!dist || !time) return alert("البيانات ناقصة");
    if(btn) { btn.innerText = "جاري المعالجة..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;

        // === حالة التعديل (Edit Mode) ===
        if (editingRunId) {
            const distDiff = dist - editingOldDist; // فرق المسافة
            
            // 1. تحديث الوثيقة
            await db.collection('users').doc(uid).collection('runs').doc(editingRunId).update({
                dist, time, type, link
                // لا نعدل التاريخ للحفاظ على الترتيب
            });

            // 2. تعديل الإحصائيات بالفرق
            await db.collection('users').doc(uid).set({
                totalDist: firebase.firestore.FieldValue.increment(distDiff),
                monthDist: firebase.firestore.FieldValue.increment(distDiff)
            }, { merge: true });

            alert("تم تعديل الجرية بنجاح ✅");
            editingRunId = null;

        } else {
            // === حالة الإضافة الجديدة (New Mode) ===
            const selectedDate = new Date(dateInput);
            const timestamp = firebase.firestore.Timestamp.fromDate(selectedDate);
            const currentMonthKey = selectedDate.toISOString().slice(0, 7); 
            let newMonthDist = (userData.monthDist || 0) + dist;
            if(userData.lastMonthKey !== currentMonthKey) { newMonthDist = dist; }

            const runData = { dist, time, type, link, date: selectedDate.toISOString(), timestamp };

            await db.collection('users').doc(uid).collection('runs').add(runData);
            await db.collection('activity_feed').add({
                uid: uid, userName: userData.name, userRegion: userData.region,
                ...runData, likes: []
            });
            await db.collection('users').doc(uid).set({
                totalDist: firebase.firestore.FieldValue.increment(dist),
                totalRuns: firebase.firestore.FieldValue.increment(1),
                monthDist: newMonthDist, lastMonthKey: currentMonthKey
            }, { merge: true });

            // Challenges
            const activeCh = await db.collection('challenges').where('active', '==', true).get();
            const batch = db.batch();
            activeCh.forEach(doc => {
                batch.set(doc.ref.collection('participants').doc(uid), {
                    progress: firebase.firestore.FieldValue.increment(dist),
                    lastUpdate: timestamp, name: userData.name, region: userData.region
                }, { merge: true });
            });
            await batch.commit();

            userData.totalDist += dist; userData.totalRuns += 1;
            userData.monthDist = newMonthDist; userData.lastMonthKey = currentMonthKey;
            
            // فحص البادجات
            await checkNewBadges(dist, time, selectedDate);
            alert("تم الحفظ!");
        }
        
        closeModal('modal-log');
        updateUI(); loadGlobalFeed(); loadActivityLog();

    } catch (error) { alert("خطأ: " + error.message); } 
    finally { 
        if(btn) { 
            btn.innerText = "حفظ النشاط"; 
            btn.disabled = false; 
        } 
    }
}

// ==================== 4. Smart Log (Grouping) ====================
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;
    
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(snap => {
          if(snap.empty) {
              list.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">ابدأ الجري وسجل تاريخك!</div>';
              return;
          }

          const runs = [];
          let maxDist = 0;

          snap.forEach(doc => {
              const r = doc.data();
              r.id = doc.id;
              if(r.dist > maxDist) maxDist = r.dist;
              runs.push(r);
          });

          // تجميع حسب الشهر
          const groups = {};
          runs.forEach(r => {
              const date = r.timestamp ? r.timestamp.toDate() : new Date();
              const monthKey = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if(!groups[monthKey]) groups[monthKey] = [];
              groups[monthKey].push(r);
          });

          let html = '';
          for (const [month, monthRuns] of Object.entries(groups)) {
              html += `<div class="log-group"><div class="log-month-header">${month}</div>`;
              
              monthRuns.forEach(r => {
                  const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                  const dayStr = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', weekday: 'short' });
                  
                  // شارة أطول جرية
                  const badge = (r.dist === maxDist && maxDist > 5) ? `<span class="badge-record">🏆 الأطول</span>` : '';
                  const pace = r.time > 0 ? (r.time / r.dist).toFixed(1) : '-';

                  html += `
                  <div class="log-row-compact">
                      ${badge}
                      <div class="log-col-main">
                          <div class="log-type-icon">
                              <i class="${r.type === 'Walk' ? 'ri-walk-line' : 'ri-run-line'}"></i>
                          </div>
                          <div>
                              <span class="log-dist-val">${r.dist}</span>
                              <span class="log-dist-unit">كم</span>
                          </div>
                      </div>
                      <div class="log-col-meta">
                          <span class="log-date-text">${dayStr}</span>
                          <span class="log-pace-text">${r.time}دقيقة • ${pace} د/كم</span>
                      </div>
                      <div class="log-col-actions">
                          <button class="btn-mini-action btn-edit" onclick="editRun('${r.id}', ${r.dist}, ${r.time}, '${r.type}', '${r.link || ''}')">
                              <i class="ri-pencil-line"></i>
                          </button>
                          <button class="btn-mini-action btn-del" onclick="deleteRun('${r.id}', ${r.dist})">
                              <i class="ri-delete-bin-line"></i>
                          </button>
                      </div>
                  </div>`;
              });
              html += `</div>`;
          }
          list.innerHTML = html;
      });
}

async function deleteRun(id, dist) {
    if(confirm("حذف؟")) {
        await db.collection('users').doc(currentUser.uid).collection('runs').doc(id).delete();
        await db.collection('users').doc(currentUser.uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-1),
            monthDist: firebase.firestore.FieldValue.increment(-dist)
        });
        userData.totalDist -= dist; userData.totalRuns -= 1; userData.monthDist -= dist;
        updateUI();
    }
}

// ==================== 5. Other Features (Feed, Admin, Badges) ====================
// ... (باقي الدوال كما هي في V22، تم نقلها هنا لضمان عمل كل شيء) ...

function loadGlobalFeed() {
    const list = document.getElementById('global-feed-list');
    if(!list) return;
    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        let html = '';
        if(snap.empty) { list.innerHTML = '<div style="text-align:center; font-size:12px; color:#6b7280;">لا توجد أنشطة</div>'; return; }
        snap.forEach(doc => {
            const p = doc.data();
            const isLiked = p.likes && p.likes.includes(currentUser.uid);
            const commentsCount = p.commentsCount || 0;
            let timeAgo = "الآن";
            if(p.timestamp) {
                const diff = (new Date() - p.timestamp.toDate()) / 60000;
                if(diff < 60) timeAgo = `${Math.floor(diff)} د`;
                else if(diff < 1440) timeAgo = `${Math.floor(diff/60)} س`;
                else timeAgo = `${Math.floor(diff/1440)} يوم`;
            }
            html += `
            <div class="feed-card-compact">
                <div class="feed-compact-content">
                    <div class="feed-compact-avatar">${(p.userName||"?").charAt(0)}</div>
                    <div>
                        <div class="feed-compact-text"><strong>${p.userName}</strong> <span style="opacity:0.7">(${p.userRegion})</span></div>
                        <div class="feed-compact-text" style="margin-top:2px;">${p.type === 'Run' ? 'جري' : p.type} <span style="color:#10b981; font-weight:bold;">${p.dist} كم</span></div>
                    </div>
                </div>
                <div class="feed-compact-action">
                    ${p.link ? `<a href="${p.link}" target="_blank" style="text-decoration:none; color:#3b82f6; font-size:14px;"><i class="ri-link"></i></a>` : ''}
                    <button class="feed-compact-btn ${isLiked?'liked':''}" onclick="toggleLike('${doc.id}', '${p.uid}')"><i class="${isLiked?'ri-heart-fill':'ri-heart-line'}"></i> <span class="feed-compact-count">${(p.likes||[]).length||''}</span></button>
                    <button class="feed-compact-btn" onclick="openComments('${doc.id}', '${p.uid}')" style="margin-right:8px;"><i class="ri-chat-3-line"></i> <span class="feed-compact-count">${commentsCount>0?commentsCount:''}</span></button>
                    <span class="feed-compact-meta" style="margin-right:5px;">${timeAgo}</span>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    });
}

// Badges
const BADGES_CONFIG = [
    { id: 'first_step', name: 'الانطلاقة', icon: '🚀', desc: 'أول نشاط لك في التطبيق' },
    { id: 'early_bird', name: 'طائر الصباح', icon: '🌅', desc: 'نشاط بين 5 و 8 صباحاً' },
    { id: 'night_owl', name: 'ساهر الليل', icon: '🌙', desc: 'نشاط بعد 10 مساءً' },
    { id: 'weekend_warrior', name: 'بطل العطلة', icon: '🎉', desc: 'نشاط يوم الجمعة' },
    { id: 'half_marathon', name: 'نصف ماراثون', icon: '🔥', desc: 'جرية واحدة +20 كم' },
    { id: 'club_100', name: 'نادي المئة', icon: '💎', desc: 'إجمالي مسافة 100 كم' },
    { id: 'club_500', name: 'المحترف', icon: '👑', desc: 'إجمالي مسافة 500 كم' },
];

async function checkNewBadges(currentRunDist, currentRunTime, runDateObj) {
    const myBadges = userData.badges || []; 
    let newBadgesEarned = [];
    const runDate = runDateObj || new Date();
    const currentHour = runDate.getHours();
    const currentDay = runDate.getDay(); 

    if (!myBadges.includes('first_step')) newBadgesEarned.push('first_step');
    if (!myBadges.includes('early_bird') && currentHour >= 5 && currentHour <= 8) newBadgesEarned.push('early_bird');
    if (!myBadges.includes('night_owl') && (currentHour >= 22 || currentHour <= 3)) newBadgesEarned.push('night_owl');
    if (!myBadges.includes('weekend_warrior') && currentDay === 5) newBadgesEarned.push('weekend_warrior');
    if (!myBadges.includes('half_marathon') && currentRunDist >= 20) newBadgesEarned.push('half_marathon');
    if (!myBadges.includes('club_100') && userData.totalDist >= 100) newBadgesEarned.push('club_100');
    if (!myBadges.includes('club_500') && userData.totalDist >= 500) newBadgesEarned.push('club_500');

    if (newBadgesEarned.length > 0) {
        await db.collection('users').doc(currentUser.uid).update({ badges: firebase.firestore.FieldValue.arrayUnion(...newBadgesEarned) });
        if(!userData.badges) userData.badges = [];
        userData.badges.push(...newBadgesEarned);
        const badgeNames = newBadgesEarned.map(b => BADGES_CONFIG.find(x => x.id === b).name).join(" و ");
        alert(`🎉 مبروووك! إنجاز جديد:\n\n✨ ${badgeNames} ✨`);
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
        const clickAction = isUnlocked ? `alert('${badge.desc}')` : `alert('🔒 لفتح هذا الوسام: ${badge.desc}')`;
        html += `<div class="badge-item ${stateClass}" onclick="${clickAction}"><span class="badge-icon">${badge.icon}</span><span class="badge-name">${badge.name}</span></div>`;
    });
    grid.innerHTML = html;
}

// Charts
function loadWeeklyChart() {
    const chartDiv = document.getElementById('weekly-chart');
    if(!chartDiv) return;
    const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    let last7Days = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last7Days.push({ dayName: days[d.getDay()], dateKey: d.toISOString().slice(0, 10), dist: 0 });
    }
    db.collection('users').doc(currentUser.uid).collection('runs')
      .where('timestamp', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .get().then(snap => {
          snap.forEach(doc => {
              const run = doc.data();
              if(run.timestamp) {
                  const runDate = run.timestamp.toDate().toISOString().slice(0, 10);
                  const targetDay = last7Days.find(d => d.dateKey === runDate);
                  if(targetDay) targetDay.dist += (run.dist || 0);
              }
          });
          let html = '';
          const maxDist = Math.max(...last7Days.map(d => d.dist), 5);
          last7Days.forEach(day => {
              const heightPerc = (day.dist / maxDist) * 100;
              let barClass = day.dist > 10 ? 'high' : (day.dist > 5 ? 'med' : 'low');
              if(day.dist === 0) barClass = 'low';
              html += `<div class="chart-column"><span class="bar-tooltip">${day.dist > 0 ? day.dist.toFixed(1) : ''}</span><div class="bar-bg"><div class="bar-fill ${barClass}" style="height: ${heightPerc}%"></div></div><span class="bar-label">${day.dayName}</span></div>`;
          });
          chartDiv.innerHTML = html;
      });
}

// Admin & Helpers
function openAdminAuth() {
    const pin = prompt("أدخل كود المشرف:");
    if(pin === "1234") { 
        closeModal('modal-settings'); 
        setTimeout(() => { switchView('admin'); loadAdminStats(); loadAdminFeed(); }, 100);
    } else { alert("كود خاطئ"); }
}
async function forceUpdateApp() {
    if(confirm("تحديث؟")) {
        if('serviceWorker' in navigator) { (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister()); }
        window.location.reload(true);
    }
}
async function deleteFullAccount() {
    if(!confirm("⚠️ تحذير خطير!\nسيتم حذف حسابك وجميع بياناتك.\nهل أنت متأكد؟")) return;
    if (prompt("اكتب (حذف) للتأكيد:") !== "حذف") return alert("لم يتم الحذف");
    try {
        const uid = currentUser.uid;
        const runs = await db.collection('users').doc(uid).collection('runs').get();
        const batch = db.batch(); runs.forEach(doc => batch.delete(doc.ref)); await batch.commit();
        const posts = await db.collection('activity_feed').where('uid', '==', uid).get();
        const batch2 = db.batch(); posts.forEach(doc => batch2.delete(doc.ref)); await batch2.commit();
        await db.collection('users').doc(uid).delete(); await currentUser.delete();
        alert("تم الحذف"); window.location.reload();
    } catch (e) { alert("خطأ: " + e.message); }
}
async function createChallengeUI() {
    const t = document.getElementById('admin-ch-title').value;
    const target = document.getElementById('admin-ch-target').value;
    await db.collection('challenges').add({title:t, target:parseFloat(target), active:true, startDate: new Date().toISOString()});
    alert("تم");
}
function loadAdminFeed() {
    const list = document.getElementById('admin-feed-list');
    db.collection('activity_feed').orderBy('timestamp','desc').limit(10).get().then(s => {
        let h = ''; s.forEach(d => h += `<div>${d.data().userName} <button onclick="adminDelete('${d.id}')">حذف</button></div>`);
        list.innerHTML = h;
    });
}
async function adminDelete(id) { await db.collection('activity_feed').doc(id).delete(); alert("حذف"); loadAdminFeed(); loadGlobalFeed(); }
function loadAdminStats() {
    const statsDiv = document.getElementById('admin-stats');
    if(!statsDiv) return;
    db.collection('users').get().then(snap => { statsDiv.innerHTML = `عدد الأعضاء: <strong style="color:#fff">${snap.size}</strong>`; });
}
async function saveProfileChanges() {
    const name = document.getElementById('edit-name').value;
    const region = document.getElementById('edit-region').value;
    if(name) {
        await db.collection('users').doc(currentUser.uid).update({ name, region });
        userData.name = name; userData.region = region;
        updateUI(); closeModal('modal-edit-profile'); alert("تم الحفظ");
    }
}
function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    document.getElementById('signup-fields').style.display = isSignupMode ? 'block' : 'none';
    document.getElementById('toggleAuthBtn').innerText = isSignupMode ? "لديك حساب؟" : "سجل الآن";
}
async function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    if(isSignupMode) {
        const name = document.getElementById('username').value;
        const region = document.getElementById('region').value;
        const c = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection('users').doc(c.user.uid).set({name, region, email, totalDist:0, totalRuns:0, badges:[]});
    } else {
        await auth.signInWithEmailAndPassword(email, pass);
    }
}
function openLogModal() { document.getElementById('modal-log').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showAuthScreen() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('app-content').style.display='none';}
function openSettingsModal() { document.getElementById('modal-settings').style.display='flex'; }
function showNotifications() { document.getElementById('modal-notifications').style.display='flex'; document.getElementById('notif-dot').classList.remove('active'); loadNotifications(); }
function openEditProfile() { document.getElementById('modal-edit-profile').style.display='flex'; }
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    const map = {'home':0, 'challenges':1, 'profile':2};
    if(navItems[map[viewId]]) navItems[map[viewId]].classList.add('active');
}
function setTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    if (tabName === 'leaderboard') loadLeaderboard('all');
    if (tabName === 'squads') loadRegionBattle();
    if (tabName === 'active-challenges') loadActiveChallenges();
}
async function toggleLike(pid, uid) {
    if(!currentUser) return;
    const ref = db.collection('activity_feed').doc(pid);
    const doc = await ref.get();
    if(doc.exists) {
        const likes = doc.data().likes || [];
        if(likes.includes(currentUser.uid)) {
            await ref.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        } else {
            await ref.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            if(uid !== currentUser.uid) sendNotification(uid, `${userData.name} شجعك ❤️`);
        }
    }
}
async function sendNotification(receiverId, message) {
    try {
        await db.collection('users').doc(receiverId).collection('notifications').add({
            msg: message, read: false, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(e) {}
}
let currentPostId = null; let currentPostOwner = null;
function openComments(postId, postOwnerId) {
    currentPostId = postId; currentPostOwner = postOwnerId;
    document.getElementById('modal-comments').style.display = 'flex';
    document.getElementById('comment-text').value = ''; 
    loadComments(postId);
}
function loadComments(postId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div style="text-align:center; color:#6b7280; font-size:12px; margin-top:20px;">جاري تحميل المحادثة...</div>';
    db.collection('activity_feed').doc(postId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snap => {
          let html = '';
          if(snap.empty) { list.innerHTML = '<div style="text-align:center; color:#6b7280; font-size:12px; margin-top:50px; opacity:0.7;"><i class="ri-chat-1-line" style="font-size:30px;"></i><br>كن أول من يشجع الكابتن!</div>'; return; }
          snap.forEach(doc => {
              const c = doc.data();
              const time = c.timestamp ? new Date(c.timestamp.toDate()).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '';
              html += `<div class="comment-item"><div class="comment-avatar">${c.userName.charAt(0)}</div><div class="comment-bubble"><span class="comment-user">${c.userName}</span><span class="comment-msg">${c.text}</span><span class="comment-time">${time}</span></div></div>`;
          });
          list.innerHTML = html;
          list.scrollTop = list.scrollHeight;
      });
}
async function sendComment() {
    const input = document.getElementById('comment-text');
    const text = input.value.trim();
    if(!text || !currentPostId) return;
    input.value = ''; 
    try {
        await db.collection('activity_feed').doc(currentPostId).collection('comments').add({
            text: text, userId: currentUser.uid, userName: userData.name, timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('activity_feed').doc(currentPostId).update({ commentsCount: firebase.firestore.FieldValue.increment(1) });
        if(currentPostOwner !== currentUser.uid) { sendNotification(currentPostOwner, `علق ${userData.name} على نشاطك: "${text.substring(0, 20)}..."`); }
    } catch(e) { console.error("Comment Error:", e); }
}
async function loadLeaderboard(filter) {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    list.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(50).get();
    let users = []; snap.forEach(doc => users.push(doc.data()));
    if(filter === 'region') users = users.filter(u => u.region === userData.region);
    let html = '';
    users.forEach((u, i) => {
        let badge = i+1; if(i===0) badge='🥇'; if(i===1) badge='🥈'; if(i===2) badge='🥉';
        html += `<div class="leader-row"><div class="rank-col">${badge}</div><div class="info-col">${u.name} <small>(${u.region})</small></div><div class="dist-col">${u.totalDist.toFixed(1)}</div></div>`;
    });
    list.innerHTML = html || 'لا يوجد';
}
function filterLeaderboard(type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    loadLeaderboard(type);
}
async function loadRegionBattle() {
    const list = document.getElementById('region-battle-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;">جاري الحساب...</div>';
    const snap = await db.collection('users').get();
    let regionMap = {};
    snap.forEach(doc => {
        const u = doc.data();
        if(u.region) { if (!regionMap[u.region]) regionMap[u.region] = 0; regionMap[u.region] += (u.totalDist || 0); }
    });
    const sortedRegions = Object.keys(regionMap).map(key => ({ name: key, total: regionMap[key] })).sort((a, b) => b.total - a.total);
    list.innerHTML = '';
    const maxVal = sortedRegions[0]?.total || 1; 
    sortedRegions.forEach((r, idx) => {
        const percent = (r.total / maxVal) * 100;
        list.innerHTML += `<div class="squad-card"><div class="squad-header"><span class="squad-rank">#${idx + 1}</span><span class="squad-name">${r.name}</span><span class="squad-total">${r.total.toFixed(0)} كم</span></div><div class="squad-bar-bg"><div class="squad-bar-fill" style="width:${percent}%"></div></div></div>`;
    });
}
async function setPersonalGoal() {
    const newGoal = prompt("حددي هدفك لهذا الشهر (كم):", userData.monthlyGoal || 0);
    if(newGoal && newGoal > 0) {
        await db.collection('users').doc(currentUser.uid).update({ monthlyGoal: parseFloat(newGoal) });
        userData.monthlyGoal = parseFloat(newGoal);
        updateUI();
    }
}
function loadNotifications() {
    const list = document.getElementById('notifications-list');
    db.collection('users').doc(currentUser.uid).collection('notifications').orderBy('timestamp','desc').limit(10).get().then(snap => {
        let html = '';
        snap.forEach(d => { html += `<div class="notif-item"><div class="notif-content">${d.data().msg}</div></div>`; d.ref.update({read:true}); });
        list.innerHTML = html || 'لا يوجد إشعارات';
    });
}
function listenForNotifications() {
    if(!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notifications').where('read','==',false).onSnapshot(s => {
        if(!s.empty) document.getElementById('notif-dot').classList.add('active');
    });
}
