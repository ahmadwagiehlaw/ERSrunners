/* ERS UI */
// ==================== 3. UI Updates & Profile ====================
function updateUI() {
    try {
        // --- تعديل الاسم (الأول + الثاني) ---
        const fullName = userData.name || "Runner";
        const nameParts = fullName.split(' '); // تقسيم الاسم لمصفوفة كلمات
        let displayName = nameParts[0]; // الاسم الأول

        // لو فيه اسم تاني، نضيفه
        if (nameParts.length > 1) {
            displayName += " " + nameParts[1];
        }

        const headerName = document.getElementById('headerName');
        if (headerName) headerName.innerText = displayName;
        // ------------------------------------

        // Dashboard Animations (V2.0)
        const mDistEl = document.getElementById('monthDist');
        const tRunsEl = document.getElementById('totalRuns');
        if (mDistEl) animateValue(mDistEl, 0, userData.monthDist || 0, 1500);
        if (tRunsEl) animateValue(tRunsEl, 0, userData.totalRuns || 0, 1500);

        // Profile Data
        const rankData = calculateRank(userData.totalDist || 0);
        document.getElementById('profileName').innerText = userData.name;
        document.getElementById('profileRegion').innerText = userData.region;
        const nextRankNameEl = document.getElementById('nextRankName');
        // دالة بسيطة لمعرفة الاسم القادم
        const ranksList = ["مبتدئ", "هاوي", "عداء", "محترف", "أسطورة"];
        const currentIdx = ranksList.indexOf(rankData.name);
        const nextName = ranksList[currentIdx + 1] || "القمة";
        if (nextRankNameEl) nextRankNameEl.innerText = nextName;


        // داخل دالة updateUI في ui.js
        const statusText = document.getElementById('strava-status-text');
        const statusSub = document.getElementById('strava-status-sub');
        if (userData && userData.stravaConnected) {
            if (statusText) statusText.innerText = "حساب Strava مرتبط ✅";
            if (statusSub) statusSub.innerText = "يمكنك المزامنة الآن من مودال التسجيل";
        }


        // 2. تحديث الكالوري (تقديري: المسافة * 60)
        const calEl = document.getElementById('caloriesEst');
        if (calEl) {
            const cal = (userData.monthDist || 0) * 60; // متوسط تقريبي
            // عرض الرقم بتنسيق مختصر (مثلاً 1.2k)
            calEl.innerText = cal > 999 ? (cal / 1000).toFixed(1) + 'k' : cal.toFixed(0);
        }

        // تحديث الشعلة 🔥
        const streakEl = document.getElementById('streak-count');
        const myStreak = userData.currentStreak || 0;
        if (streakEl) {
            streakEl.innerText = myStreak > 0 ? myStreak : '0';
            streakEl.style.display = 'inline';
        }
        // تحديث كروت الإحصائيات (أسبوع/شهر/ستريك)
        try { renderCoachHeroStats(); } catch (e) { }
        // ... باقي الكود كما هو ...

        // ... داخل updateUI ...
        const profileAvatar = document.getElementById('userMainAvatar'); // التصحيح

        if (profileAvatar) {
            // التحقق: هل توجد صورة مخصصة؟
            if (userData.photoUrl) {
                profileAvatar.innerText = "";
                profileAvatar.style.backgroundImage = `url('${userData.photoUrl}')`;
                profileAvatar.style.border = "2px solid #fff";
            } else {
                // العودة للأيقونات
                profileAvatar.style.backgroundImage = "none";
                let avatarIcon = userData.avatarIcon || getUserAvatar(userData);
                // منطق الرتب الخاصة
                if (rankData.name === 'أسطورة' && !userData.avatarIcon) avatarIcon = '👑';
                profileAvatar.innerText = avatarIcon;
                profileAvatar.style.border = "2px solid var(--primary)";
            }
        }

        const pTotal = document.getElementById('profileTotalDist');
        if (pTotal) pTotal.innerText = (userData.totalDist || 0).toFixed(1);
        const pRuns = document.getElementById('profileTotalRuns');
        if (pRuns) pRuns.innerText = userData.totalRuns || 0;
        const pRank = document.getElementById('profileRankText');
        if (pRank) pRank.innerText = rankData.name;

        // XP Bar (Profile)
        const nextEl = document.getElementById('nextLevelDist');
        if (nextEl) nextEl.innerText = rankData.remaining.toFixed(1);
        const xpBar = document.getElementById('xpBar');
        if (xpBar) {
            xpBar.style.width = `${rankData.percentage}%`;
            xpBar.style.backgroundColor = `var(--rank-color)`;
        }

        // (Optional legacy fields – قد لا تكون موجودة في DOM)
        const xpText = document.getElementById('xpText');
        if (xpText) xpText.innerText = `${rankData.distInLevel.toFixed(1)} / ${rankData.distRequired} كم`;
        const xpPerc = document.getElementById('xpPerc');
        if (xpPerc) xpPerc.innerText = `${Math.floor(rankData.percentage)}%`;

        updateGoalRing();
        if (typeof renderPlanCard === 'function') renderPlanCard();
        renderBadges();
        calculatePersonalBests(); // (V2.2)
        if (typeof updateCoachAdvice === 'function') updateCoachAdvice();
        if (typeof setupCoachFeedOnce === 'function') setupCoachFeedOnce();




        // 🔥 التعديل الصحيح للأهداف السنوية
        const yearlyGoal = userData.yearlyGoal || 1000;
        const totalDist = userData.totalDist || 0;
        const remaining = Math.max(yearlyGoal - totalDist, 0);

        // 1. تحديث الرقم في الصفحة الرئيسية (الذي كان ثابتاً 120)
        const heroYearTotal = document.getElementById('hero-year-total');
        if (heroYearTotal) heroYearTotal.innerText = yearlyGoal;

        // 2. تحديث نص الهدف في الكارت الكبير
        const annualGoalText = document.getElementById('annualGoalText');
        if (annualGoalText) annualGoalText.innerText = `${yearlyGoal} كم`;

        // 3. تحديث المتبقي
        const annualGoalSub = document.getElementById('annualGoalSub');
        if (annualGoalSub) annualGoalSub.innerText = `${remaining.toFixed(1)} كم متبقي`;


        // إخفاء/إظهار زر لوحة الإدارة بناءً على الصلاحية
        // 🔥 القفل الأمني: إظهار الزر للأدمن فقط وإخفاؤه عن البقية
        const adminBtn = document.getElementById('btn-admin-entry');
        if (adminBtn) {
            if (userData && userData.isAdmin === true) {
                adminBtn.style.display = 'flex'; // إظهار للمشرفين فقط
            } else {
                adminBtn.style.display = 'none'; // إخفاء تام عن بقية المستخدمين
            }
        }

    } catch (error) { console.error("UI Error:", error); }
}

function calculateRank(totalDist) {
    const levels = [
        { name: "مبتدئ", min: 0, class: "rank-mubtadi", next: 50 },
        { name: "هاوي", min: 50, class: "rank-hawy", next: 150 },
        { name: "عداء", min: 150, class: "rank-runner", next: 500 },
        { name: "محترف", min: 500, class: "rank-pro", next: 1000 },
        { name: "أسطورة", min: 1000, class: "rank-legend", next: 10000 }
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
        nextTarget: currentLevel.next,
        remaining: currentLevel.next - totalDist,
        percentage: percentage,
        distInLevel: distInLevel,
        distRequired: distRequired
    };
}

function updateGoalRing() {
    const goalRing = document.getElementById('goalRing');
    const goalText = document.getElementById('goalText');
    const goalSub = document.getElementById('goalSub');
    if (goalRing && goalText) {
        const myGoal = userData.monthlyGoal || 0;
        const currentMonthDist = userData.monthDist || 0;
        if (myGoal === 0) {
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

// أرقامي القياسية (V2.2 Fix)
async function calculatePersonalBests() {
    if (!currentUser) return;

    // 1. أطول جرية
    db.collection('users').doc(currentUser.uid).collection('runs')
        .orderBy('dist', 'desc').limit(1).get()
        .then(snap => {
            if (!snap.empty) {
                const run = snap.docs[0].data();
                const el = document.getElementById('best-dist');
                if (el) el.innerText = run.dist.toFixed(1);

                const paceEl = document.getElementById('best-pace');
                if (paceEl && run.dist > 0) {
                    const pace = (run.time / run.dist).toFixed(1);
                    paceEl.innerText = pace;
                }
            }
        });

    // 2. الساعات (تجميع)
    try {
        const snap = await db.collection('users').doc(currentUser.uid).collection('runs').get();
        let totalMinutes = 0;
        snap.forEach(doc => { totalMinutes += (doc.data().time || 0); });
        const hours = Math.floor(totalMinutes / 60);
        const elHours = document.getElementById('total-time-hours');
        if (elHours) animateValue(elHours, 0, hours, 2000);
    } catch (e) { }
}



// ==================== Coach Brain v1: Speed Radar ======================================
function _ersGetRecentRunsForSpeed() {
    const runs = (window._ersRunsCache || []).slice().filter(r => {
        const kind = r.autoKind || _ersAutoKind(r.type, _ersPace(r.dist, r.time));
        return kind === 'Run' && (parseFloat(r.dist) || 0) > 0 && (parseFloat(r.time) || 0) > 0;
    });
    return runs;
}
function _ersComputeSpeedStats(runs) {
    const now = new Date();
    const msDay = 1000 * 60 * 60 * 24;
    const inDays = (r, days) => {
        const d = r.timestamp ? (r.timestamp.toDate ? r.timestamp.toDate() : new Date(r.timestamp)) : null;
        return d && (now - d) <= days * msDay;
    };
    const agg = (arr) => {
        let dist = 0, time = 0, count = 0, bestPace = null;
        arr.forEach(r => {
            const d = parseFloat(r.dist) || 0, t = parseFloat(r.time) || 0;
            const p = _ersPace(d, t);
            if (d > 0 && t > 0 && p) {
                dist += d; time += t; count++;
                if (bestPace === null || p < bestPace) bestPace = p;
            }
        });
        const avgPace = dist > 0 ? (time / dist) : null;
        return { dist, time, count, avgPace, bestPace };
    };
    return {
        last7: agg(runs.filter(r => inDays(r, 7))),
        last14: agg(runs.filter(r => inDays(r, 14)))
    };
}
function _ersSpeedWorkoutSuggestion(stats) {
    const focus = String(getUserPref('focusGoal', 'fitness')).toLowerCase();
    const note = (focus === 'weightloss' || focus === 'fitness')
        ? 'تنويه: لو هدفك لياقة/خسارة وزن… السرعة مش أولوية. الأهم الاستمرارية والمسافة.'
        : 'هدفك أداء/سرعة… هنشتغل بذكاء بدون ضغط مبالغ فيه.';
    const basePace = stats?.last14?.avgPace || stats?.last7?.avgPace;
    const p = (basePace && isFinite(basePace)) ? basePace : null;

    let suggestion = { title: '⚡ تمرين سرعة خفيف', details: 'إحماء 10د + 6×(1د سريع / 1د سهل) + تهدئة 8د.', tip: 'السريع "قابل للتحكم"… مش سباق.', safety: 'لو في ألم/إرهاق عالي: حوله لجري سهل 20–30د.' };
    if (p && p < 6.5) {
        suggestion = { title: '⚡ Speed Builder', details: 'إحماء 12د + 8×(400م سريع / 200م سهل) + تهدئة 10د.', tip: 'ركز على تكنيك وخفة…', safety: 'يوم استشفاء بعدها.' };
    } else if (p && p < 8.5) {
        suggestion = { title: '⚡ Intervals ذكية', details: 'إحماء 10د + 5×(2د سريع / 2د سهل) + تهدئة 8د.', tip: 'السريع حوالي 15–25ث أسرع من بيسك السهل.', safety: 'لو بعد لونج رن… خليه فارتلك خفيف.' };
    }
    return { note, suggestion };
}
function openSpeedRadar() {
    const body = document.getElementById('speed-radar-body');
    if (!body) return;
    const runs = _ersGetRecentRunsForSpeed();
    const btn = document.getElementById('coach-speed-btn');
    if (btn) btn.style.display = (!getUserPref('hideSpeedRadar', false) && runs.length >= 2) ? 'flex' : 'none';
    const stats = _ersComputeSpeedStats(runs);
    const last7 = stats.last7, last14 = stats.last14;
    const pack = _ersSpeedWorkoutSuggestion(stats);
    body.innerHTML = `
    <div class="speed-stat"><b>متوسط بيس 7 أيام</b><span>${_ersFormatPace(last7.avgPace)} • ${last7.dist.toFixed(1)} كم • ${last7.count} نشاط</span></div>
    <div class="speed-stat"><b>أفضل بيس (14 يوم)</b><span>${_ersFormatPace(last14.bestPace)} • ${last14.dist.toFixed(1)} كم</span></div>
    <div class="speed-card">
      <h4>${pack.suggestion.title}</h4>
      <p><b>الخطة:</b> ${pack.suggestion.details}</p>
      <p style="margin-top:8px;"><b>Tip:</b> ${pack.suggestion.tip}</p>
      <p style="margin-top:8px; color:#9ca3af;">${pack.note}</p>
      <p style="margin-top:8px; color:#9ca3af;">${pack.suggestion.safety}</p>
    </div>
  `;
    openModal('modal-speed-radar');
}

// ==================== Weekly Awards (Top 3) ====================
function _ersWeekRangeSat(d = new Date()) {
    const z = new Date(d); z.setHours(0, 0, 0, 0);
    const day = z.getDay(); // 0 Sun..6 Sat
    const offset = (day + 1) % 7;
    const start = new Date(z); start.setDate(z.getDate() - offset);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return { start, end };
}
function _ersFormatDateShort(d) { return `${d.getDate()}/${d.getMonth() + 1}`; }
async function _ersFetchFeedSince(dateObj, limit = 1500) {
    if (!db) return [];
    const items = [];
    const snap = await db.collection('activity_feed').where('timestamp', '>=', dateObj).orderBy('timestamp', 'desc').limit(limit).get();
    snap.forEach(doc => items.push(Object.assign({ id: doc.id }, doc.data() || {})));
    return items;
}
async function openWeeklyAwards(category) {
    const titleEl = document.getElementById('weekly-awards-title');
    const rangeEl = document.getElementById('weekly-awards-range');
    const bodyEl = document.getElementById('weekly-awards-body');
    if (!titleEl || !rangeEl || !bodyEl) return;
    const mapTitle = { distance: 'تكريم: الأطول نفسًا 🫁', speed: 'تكريم: الأسرع عدوًا ⚡', consistency: 'تكريم: الأكثر تحمّلًا 🛡️' };
    titleEl.textContent = mapTitle[category] || 'لوحة تكريم الأسبوع';
    const { start, end } = _ersWeekRangeSat(new Date());
    rangeEl.textContent = `الأسبوع: ${_ersFormatDateShort(start)} → ${_ersFormatDateShort(new Date(end - 1))}`;
    bodyEl.innerHTML = '<div style="text-align:center; padding:10px; color:#9ca3af;">جاري التحميل…</div>';
    openModal('modal-weekly-awards');
    try {
        const feed = await _ersFetchFeedSince(start, 1500);
        const week = feed.filter(it => {
            const d = it.timestamp ? it.timestamp.toDate() : null;
            return d && d >= start && d < end;
        });
        const per = {};
        week.forEach(it => {
            const uid = it.uid || it.userId;
            if (!uid) return;
            const dist = parseFloat(it.dist) || 0, time = parseFloat(it.time) || 0;
            const pace = it.pace || _ersPace(dist, time);
            const autoKind = it.autoKind || _ersAutoKind(it.type, pace);
            if (autoKind !== 'Run') return;
            if (!per[uid]) per[uid] = { uid, name: it.userName || 'عضو', dist: 0, time: 0, count: 0, days: {} };
            per[uid].dist += dist; per[uid].time += time; per[uid].count += 1;
            try { const dd = it.timestamp ? it.timestamp.toDate() : null; if (dd) { const k = _ersDateKey(dd); per[uid].days[k] = true; } } catch (e) { }
        });
        let arr = Object.values(per);
        if (category === 'distance') { arr.sort((a, b) => b.dist - a.dist); arr = arr.slice(0, 3); }
        else if (category === 'speed') {
            arr = arr.filter(u => u.dist >= ERS_MIN_DIST_FOR_SPEED);
            arr.forEach(u => u.avgPace = u.dist > 0 ? (u.time / u.dist) : null);
            arr.sort((a, b) => (a.avgPace || 999) - (b.avgPace || 999));
            arr = arr.slice(0, 3);
        } else if (category === 'consistency') {
            arr.forEach(u => u.daysActive = u.days ? Object.keys(u.days).length : 0);
            const eligible = arr.filter(u => u.daysActive >= 5);
            const pool = eligible.length ? eligible : arr;
            pool.sort((a, b) => (b.daysActive || 0) - (a.daysActive || 0));
            arr = pool.slice(0, 3);
        }
        else { arr.sort((a, b) => b.dist - a.dist); arr = arr.slice(0, 3); }
        if (!arr.length) { bodyEl.innerHTML = '<div style="text-align:center; padding:10px; color:#9ca3af;">لا توجد بيانات كافية هذا الأسبوع</div>'; return; }
        bodyEl.innerHTML = `<div class="hof-list">${arr.map((u, idx) => {
            const metric = category === 'speed' ? _ersFormatPace(u.avgPace) : (category === 'consistency' ? `${(u.daysActive ?? (u.days ? Object.keys(u.days).length : 0))} أيام` : `${u.dist.toFixed(1)} كم`); return `
      <div class="hof-row" onclick="viewUserProfile('${u.uid}')">
        <div class="hof-rank">#${idx + 1}</div>
        <div class="hof-main"><div class="hof-name">${u.name}</div><div class="hof-meta">${metric}</div></div>
        <div class="hof-action"><i class="ri-arrow-left-s-line"></i></div>
      </div>`;
        }).join('')}</div>`;
    } catch (e) {
        bodyEl.innerHTML = '<div style="text-align:center; padding:10px; color:#ef4444;">حدث خطأ في التحميل</div>';
    }
}

function openSettingsModal() { document.getElementById('modal-settings').style.display = 'flex'; }
function showNotifications() { document.getElementById('modal-notifications').style.display = 'flex'; document.getElementById('notif-dot').classList.remove('active'); loadNotifications(); }

// فتح نافذة التعديل مع ملء البيانات الحالية (V9.0)
function openEditProfile() {
    // 1. ملء البيانات الأساسية
    document.getElementById('edit-name').value = userData.name || "";
    document.getElementById('edit-region').value = userData.region || "Cairo";
    document.getElementById('edit-gender').value = userData.gender || "male";
    document.getElementById('edit-birthyear').value = userData.birthYear || "";

    // 2. 🔥 ملء بيانات الكوتش (الجديدة)
    // إذا لم يكن المستخدم قد اختار سابقاً، نضع القيم الافتراضية
    document.getElementById('edit-goal').value = userData.trainingGoal || "general";
    document.getElementById('edit-level').value = userData.manualLevel || "beginner";

    // 3. عرض النافذة
    document.getElementById('modal-edit-profile').style.display = 'flex';
}
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    const navItems = document.querySelectorAll('.nav-item');
    // ترتيب التبويبات الجديد: الكوتش / بياناتي / النادي / الأرينا
    const map = { 'home': 0, 'profile': 1, 'club': 2, 'challenges': 3 };
    if (navItems[map[viewId]]) navItems[map[viewId]].classList.add('active');

    if (viewId === 'admin' && !(userData && userData.isAdmin === true)) {
        showToast("⛔ غير مسموح لك بالدخول هنا", "error");
        return;
    }

    // Hooks بسيطة للصفحات الجديدة
    if (viewId === 'home') {
        if (typeof renderPlanCard === 'function') renderPlanCard();
        if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI();
    }
    // if (viewId === 'club' && typeof loadHallOfFame === 'function') loadHallOfFame(); // تم النقل لصفحة الكوتش
}

// Keyboard shortcut for header name (accessibility)
try {
    const _hn = document.getElementById('headerName');
    if (_hn) {
        _hn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchView('profile');
            }
        });
    }
} catch (e) { }

function setTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    if (tabName === 'leaderboard') loadLeaderboard('all');
    if (tabName === 'squads') loadRegionBattle();
}

function getSkeletonHTML(type) {
    // 1. المتصدرين
    if (type === 'leaderboard') {
        return Array(5).fill('').map(() => `
            <div class="sk-leader-row">
                <div class="skeleton sk-circle"></div>
                <div style="flex:1">
                    <div class="skeleton sk-line long"></div>
                    <div class="skeleton sk-line short"></div>
                </div>
            </div>`).join('');
    }

    // 2. المنشورات (Feed)
    if (type === 'feed') {
        return Array(3).fill('').map(() => `
            <div class="feed-card-compact" style="pointer-events:none;">
                <div class="feed-compact-content">
                    <div class="skeleton sk-circle" style="width:30px; height:30px;"></div>
                    <div style="flex:1">
                        <div class="skeleton sk-line" style="width:60%; height:10px; margin-bottom:5px;"></div>
                        <div class="skeleton sk-line" style="width:40%; height:8px;"></div>
                    </div>
                </div>
            </div>`).join('');
    }

    // 3. التحديات
    if (type === 'challenges') {
        return Array(3).fill('').map(() => `
            <div class="ch-card" style="border-color: rgba(255,255,255,0.05); pointer-events: none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div class="skeleton sk-line" style="width:40%; height:20px;"></div>
                    <div class="skeleton sk-line" style="width:20%; height:15px;"></div>
                </div>
                <div class="skeleton" style="width:100%; height:60px; border-radius:10px; margin-bottom:15px; opacity:0.5;"></div>
                <div class="skeleton" style="width:100%; height:45px; border-radius:12px;"></div>
            </div>
        `).join('');
    }

    // 4. (الجديد 🔥) المناطق (Squads)
    if (type === 'squads') {
        return Array(5).fill('').map(() => `
            <div class="squad-row" style="pointer-events: none; border-color: rgba(255,255,255,0.05);">
                <div class="squad-header" style="margin-bottom:15px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="skeleton" style="width:28px; height:28px; border-radius:6px;"></div> <div class="skeleton" style="width:100px; height:15px;"></div> </div>
                    <div class="skeleton" style="width:60px; height:20px; border-radius:6px;"></div> </div>
                <div class="squad-stats-row" style="border:none; padding-top:0;">
                    <div class="skeleton" style="width:100%; height:8px; opacity:0.3;"></div>
                </div>
            </div>
        `).join('');
    }

    return '...';
}
// Notifications
function loadNotifications() {
    const list = document.getElementById('notifications-list');
    db.collection('users').doc(currentUser.uid).collection('notifications')
        .orderBy('timestamp', 'desc').limit(10).get().then(snap => {
            let html = '';
            snap.forEach(d => {
                const msg = d.data().msg;
                // التحقق هل الإشعار إداري؟
                const isAdmin = msg.includes("إداري") || msg.includes("Admin") || msg.includes("تنبيه");
                const specialClass = isAdmin ? 'admin-alert' : '';
                const icon = isAdmin ? '📢' : (msg.includes('❤️') ? '❤️' : '🔔');

                html += `
            <div class="notif-item ${specialClass}">
                <div class="notif-icon" style="${isAdmin ? 'background:rgba(239,68,68,0.2); color:#ef4444;' : ''}">${icon}</div>
                <div class="notif-content">${msg}</div>
            </div>`;

                if (!d.data().read) d.ref.update({ read: true });
            });
            list.innerHTML = html || '<div style="padding:20px;text-align:center;">لا جديد</div>';
        });
}
function listenForNotifications() {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notifications').where('read', '==', false).onSnapshot(s => {
        if (!s.empty) document.getElementById('notif-dot').classList.add('active');
    });
}

// Social Comments
function openComments(postId, postOwnerId) {
    currentPostId = postId; currentPostOwner = postOwnerId;
    document.getElementById('modal-comments').style.display = 'flex';
    document.getElementById('comment-text').value = '';
    loadComments(postId);
}
function loadComments(postId) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '...';
    db.collection('activity_feed').doc(postId).collection('comments').orderBy('timestamp', 'asc').onSnapshot(snap => {
        let html = '';
        if (snap.empty) { list.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.7;">كن أول من يعلق!</div>'; return; }
        snap.forEach(doc => {
            const c = doc.data();
            html += `<div class="comment-item"><div class="comment-avatar">${c.userName.charAt(0)}</div><div class="comment-bubble"><span class="comment-user">${c.userName}</span><span class="comment-msg">${c.text}</span></div></div>`;
        });
        list.innerHTML = html;
        list.scrollTop = list.scrollHeight;
    });
}
async function sendComment() {
    const input = document.getElementById('comment-text');
    const text = input.value.trim();
    if (!text || !currentPostId) return;
    input.value = '';
    await db.collection('activity_feed').doc(currentPostId).collection('comments').add({
        text: text, userId: currentUser.uid, userName: userData.name, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('activity_feed').doc(currentPostId).update({ commentsCount: firebase.firestore.FieldValue.increment(1) });

    // Update UI comment counter immediately
    const commentCountElements = document.querySelectorAll(`[data-post-id="${currentPostId}"] .comment-count`);
    commentCountElements.forEach(el => {
        const currentCount = parseInt(el.textContent) || 0;
        el.textContent = currentCount + 1;
    });

    if (currentPostOwner !== currentUser.uid) sendNotification(currentPostOwner, `علق ${userData.name}: "${text.substring(0, 20)}..."`);
}


// فتح مودال الهدف
function setPersonalGoal() {
    const currentGoal = userData.monthlyGoal || 0;
    document.getElementById('input-monthly-goal').value = currentGoal > 0 ? currentGoal : '';
    document.getElementById('modal-set-goal').style.display = 'flex';
}

// حفظ الهدف في قاعدة البيانات
async function savePersonalGoal() {
    const val = parseFloat(document.getElementById('input-monthly-goal').value);
    if (!val || val <= 0) return showToast("أدخل رقماً صحيحاً", "error");

    const btn = event.target;
    btn.innerText = "...";

    try {
        await db.collection('users').doc(currentUser.uid).update({
            monthlyGoal: val
        });

        userData.monthlyGoal = val;
        updateUI(); // لتحديث الدائرة فوراً
        updateGoalRing(); // تحديث الدائرة تحديداً

        closeModal('modal-set-goal');
        showToast("تم تحديد الهدف! بالتوفيق 🔥", "success");
    } catch (e) {
        console.error(e);
        showToast("حدث خطأ", "error");
    } finally {
        btn.innerText = "حفظ الهدف 🎯";
    }
}
// Profile Editing
// حفظ بيانات البروفايل والكوتش (V9.0)
async function saveProfileChanges() {
    // 1. جلب القيم من العناصر
    const name = document.getElementById('edit-name').value.trim();
    const region = document.getElementById('edit-region').value;
    const gender = document.getElementById('edit-gender').value;
    const birthYear = document.getElementById('edit-birthyear').value;
    // جلب الهدف السنوي من الحقل الجديد (تأكد أن id الحقل في الـ HTML هو edit-yearly-goal)
    const yearlyGoal = parseFloat(document.getElementById('edit-yearly-goal')?.value) || 1000;

    if (!name) {
        showToast("يرجى إدخال الاسم", "error");
        return;
    }

    const btn = document.querySelector('[onclick="saveProfileChanges()"]');
    if (btn) btn.innerText = "جاري الحفظ...";

    try {
        const updateData = {
            name: name,
            region: region,
            gender: gender,
            birthYear: birthYear,
            yearlyGoal: yearlyGoal // حفظ الهدف في قاعدة البيانات
        };

        await db.collection('users').doc(currentUser.uid).update(updateData);

        // تحديث البيانات محلياً فوراً
        userData = { ...userData, ...updateData };

        showToast("تم تحديث البروفايل بنجاح ✅", "success");
        closeModal('modal-edit-profile');
        updateUI(); // تحديث الواجهة لعكس الأرقام الجديدة
    } catch (e) {
        console.error(e);
        showToast("حدث خطأ أثناء الحفظ", "error");
    } finally {
        if (btn) btn.innerText = "حفظ التغييرات";
    }
}

// Force Update
// Force Update
async function forceUpdateApp() {
    showConfirm("تحديث التطبيق الآن؟", async () => {
        const btn = (typeof event !== 'undefined' && event.target) ? event.target.closest('button') : null;
        if (btn) btn.innerText = "جاري التحديث...";
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }
        } catch (e) { }
        window.location.reload(true);
    });
}

// Delete Account
// Delete Account
async function deleteFullAccount() {
    showConfirm("⚠️ حذف الحساب نهائياً؟", async () => {
        const checkWord = prompt("للتأكيد اكتب (حذف):");
        if (checkWord !== "حذف") return;

        try {
            const uid = currentUser.uid;
            // حذف الجريات
            const runs = await db.collection('users').doc(uid).collection('runs').get();
            await Promise.all(runs.docs.map(d => d.ref.delete()));
            // حذف البروفايل
            await db.collection('users').doc(uid).delete();
            await currentUser.delete();
            showToast("تم الحذف 👋", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) { showToast("خطأ: " + e.message, "error"); }
    });
}

// Share Logic
function generatePreviewCard() {
    const dist = parseFloat(document.getElementById('log-dist').value) || 0;
    const time = parseFloat(document.getElementById('log-time').value) || 0;

    if (dist === 0 || time === 0) {
        showToast("يرجى إدخال المسافة والوقت أولاً", "error");
        return;
    }

    generateShareCard(dist.toFixed(2), time, new Date().toLocaleDateString());
}

// Share Logic (Core)
function generateShareCard(dist, time, dateStr) {
    document.getElementById('share-name').innerText = userData.name;
    const rank = calculateRank(userData.totalDist || 0);
    document.getElementById('share-rank').innerText = rank.name;
    document.getElementById('share-dist').innerText = dist;
    document.getElementById('share-time').innerText = time + "m";
    document.getElementById('share-pace').innerText = (time / dist).toFixed(1);
    document.getElementById('modal-share').style.display = 'flex';
    document.getElementById('final-share-img').style.display = 'none';
    setTimeout(() => {
        html2canvas(document.getElementById('capture-area'), { backgroundColor: null, scale: 2 }).then(canvas => {
            document.getElementById('final-share-img').src = canvas.toDataURL("image/png");
            document.getElementById('final-share-img').style.display = 'block';
        });
    }, 100);
}


// عرض التحديات بذكاء (V4.1 Smart Display)
// ==================== V5.0 Challenge Engine & Admin Tools ====================

// IMPORTANT: challenges cache must be global/shared across files.
// Using `var` here avoids "Identifier has already been declared" when other scripts
// (e.g., challenges.js) also reference the same global.
var allChallengesCache = window.allChallengesCache || (window.allChallengesCache = []);

// ==================== تحميل الخلاصة العالمية (مع Pagination) ====================
let _lastFeedDoc = null;     // Cursor for pagination
let _feedSeenKeys = new Set(); // Dedup across pages

async function loadGlobalFeed(appendMode = false) {
    const list = document.getElementById('global-feed-list');
    if (!list) return;

    const PAGE_SIZE = 20;

    if (!appendMode) {
        // Fresh load — reset everything
        _lastFeedDoc = null;
        _feedSeenKeys = new Set();
        list.innerHTML = `
        <div style="text-align:center; padding:30px; color:var(--text-muted);">
            <i class="ri-loader-4-line ri-spin" style="font-size:24px;"></i>
            <div style="font-size:12px; margin-top:10px;">جاري تحديث الأخبار...</div>
        </div>`;
    } else {
        // Remove old "Load More" button before appending
        const oldBtn = document.getElementById('feed-load-more-btn');
        if (oldBtn) oldBtn.outerHTML = `
        <div id="feed-loading-indicator" style="text-align:center; padding:15px; color:var(--text-muted);">
            <i class="ri-loader-4-line ri-spin" style="font-size:18px;"></i>
        </div>`;
    }

    try {
        let query = db.collection('activity_feed')
            .orderBy('timestamp', 'desc')
            .limit(PAGE_SIZE);

        if (appendMode && _lastFeedDoc) {
            query = query.startAfter(_lastFeedDoc);
        }

        const snap = await query.get();

        // Remove loading indicator
        const loadingEl = document.getElementById('feed-loading-indicator');
        if (loadingEl) loadingEl.remove();

        if (snap.empty && !appendMode) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد أنشطة حالياً.</div>';
            return;
        }

        if (snap.empty && appendMode) {
            list.insertAdjacentHTML('beforeend',
                '<div style="text-align:center; padding:15px; color:#64748b; font-size:12px;">🏁 وصلت لآخر الأنشطة</div>');
            return;
        }

        // Save cursor for next page
        _lastFeedDoc = snap.docs[snap.docs.length - 1];

        // 🔥 فلترة المكررات: نحتفظ بأول ظهور فقط لكل uid+dist+timestamp
        const uniqueDocs = [];
        snap.forEach(doc => {
            const p = doc.data();
            const ts = p.timestamp?.seconds || 0;
            const dedupeKey = `${p.uid || ''}_${p.dist || 0}_${ts}`;
            if (!_feedSeenKeys.has(dedupeKey)) {
                _feedSeenKeys.add(dedupeKey);
                uniqueDocs.push({ id: doc.id, data: p });
            }
        });

        if (uniqueDocs.length === 0 && !appendMode) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد أنشطة حالياً.</div>';
            return;
        }

        let html = '';
        uniqueDocs.forEach(({ id: docId, data: p }) => {

            // --- 1. منطق الألوان والتمييز (إصلاح جذري) ---
            const rawType = String(p.type || '').trim().toLowerCase();
            const isWalk = rawType.includes('walk') || rawType.includes('hike');

            // ألوان صريحة لضمان الظهور
            // أزرق سماوي للمشي | أخضر زمردي للجري
            const themeColor = isWalk ? '#0ea5e9' : '#10b981';
            const typeIcon = isWalk ? 'ri-walk-line' : 'ri-run-line';
            const typeLabel = isWalk ? 'تمشية' : 'جري';

            // --- 2. تجهيز البيانات ---
            const userName = p.userName || 'عداء';
            const userRegion = p.userRegion || 'مصر';
            const dist = parseFloat(p.dist || 0).toFixed(2);
            const pace = (p.dist > 0 && p.time > 0) ? (p.time / p.dist).toFixed(2) : '--';

            let timeAgo = 'الآن';
            try {
                if (p.timestamp && typeof getArabicTimeAgo === 'function') {
                    timeAgo = getArabicTimeAgo(p.timestamp);
                }
            } catch (e) { }

            const isLiked = p.likes && currentUser && p.likes.includes(currentUser.uid);
            const likesCount = (p.likes || []).length;
            const commentsCount = p.commentsCount || 0;

            const safeDataJson = JSON.stringify({
                ...p,
                id: docId,
                timestamp: null
            }).replace(/"/g, '&quot;');

            // --- 3. بناء الكارت ---
            html += `
            <div class="feed-card-premium" data-post-id="${docId}" onclick="openRunDetailFromFeed('${docId}', ${safeDataJson})" 
                 style="background:rgba(30, 41, 59, 0.6); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:15px; margin-bottom:12px; cursor:pointer; position:relative; overflow:hidden;">
                
                <div style="position:absolute; right:0; top:0; bottom:0; width:4px; background:${themeColor};"></div>

                <div style="display:flex; gap:12px; align-items:flex-start;">
                    
                    <div style="flex:1;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <div style="width:36px; height:36px; border-radius:10px; background:${themeColor}20; color:${themeColor}; display:flex; align-items:center; justify-content:center; border:1px solid ${themeColor}40;">
                                <i class="${typeIcon}" style="font-size:18px;"></i>
                            </div>
                            <div>
                                <div style="font-size:14px; font-weight:bold; color:#f1f5f9; line-height:1.2;">${userName}</div>
                                <div style="font-size:11px; color:#94a3b8;">${timeAgo} • ${userRegion}</div>
                            </div>
                        </div>

                        <div style="display:flex; gap:15px; margin-bottom:12px; padding-right:5px;">
                            <div>
                                <span style="font-size:10px; color:#64748b; display:block;">المسافة</span>
                                <span style="font-size:18px; font-weight:800; color:${themeColor}; letter-spacing:-0.5px;">${dist}</span>
                                <span style="font-size:10px; color:${themeColor};">كم</span>
                            </div>
                            <div style="border-right:1px solid rgba(255,255,255,0.1); padding-right:15px;">
                                <span style="font-size:10px; color:#64748b; display:block;">السرعة</span>
                                <span style="font-size:16px; font-weight:700; color:#cbd5e1;">${pace}</span>
                            </div>
                        </div>

                        <div style="display:flex; gap:18px; align-items:center;" onclick="event.stopPropagation()">
                             <div id="like-wrap-${docId}" onclick="handleLikeClick('${docId}')" style="display:flex; align-items:center; gap:6px; cursor:pointer; transition:transform 0.1s;">
                                <i class="${isLiked ? 'ri-heart-fill' : 'ri-heart-line'}" style="font-size:18px; color:${isLiked ? '#ef4444' : '#94a3b8'};"></i> 
                                <span style="font-size:13px; font-weight:600; color:${isLiked ? '#ef4444' : '#94a3b8'};">${likesCount}</span>
                             </div>
                             <div onclick="openComments('${docId}', '${p.uid}')" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <i class="ri-chat-3-line" style="font-size:18px; color:#94a3b8;"></i> 
                                <span class="comment-count" style="font-size:13px; font-weight:600; color:#94a3b8;">${commentsCount}</span>
                             </div>
                        </div>
                    </div>

                    <div style="width:85px; height:85px; border-radius:12px; background:#0f172a; overflow:hidden; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
                        <img src="${p.polyline ? 'https://www.strava.com/assets/images/google_static_map_placeholder.png' : (p.img || 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=200&auto=format&fit=crop')}" 
                             style="width:100%; height:100%; object-fit:cover; opacity:0.8;">
                    </div>
                </div>
            </div>`;
        });

        // Add "Load More" button if we got a full page
        if (snap.size >= PAGE_SIZE) {
            html += `
            <div id="feed-load-more-btn" onclick="loadGlobalFeed(true)" 
                 style="text-align:center; padding:12px; margin:8px 0; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); border-radius:12px; cursor:pointer; color:#10b981; font-size:13px; font-weight:600; transition:all 0.2s;">
                <i class="ri-arrow-down-line"></i> عرض المزيد
            </div>`;
        } else {
            html += '<div style="text-align:center; padding:15px; color:#64748b; font-size:12px;">🏁 نهاية الأنشطة</div>';
        }

        if (appendMode) {
            list.insertAdjacentHTML('beforeend', html);
        } else {
            list.innerHTML = html;
        }

    } catch (e) {
        console.error("Feed Error:", e);
        if (!appendMode) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#ef4444">فشل تحميل الأخبار</div>';
        }
    }
}
// ==================== Community Reporting System (V5.0) ====================

function openReportModal(feedId) {
    currentReportFeedId = feedId;
    document.getElementById('modal-report').style.display = 'flex';
}

async function submitReport() {
    const reason = document.getElementById('report-reason').value;
    if (!currentReportFeedId) return;

    const btn = event.target;
    btn.innerText = "جاري الإرسال...";

    try {
        // إضافة البلاغ في كولكشن منفصل
        await db.collection('reports').add({
            feedId: currentReportFeedId,
            reporterId: currentUser.uid,
            reporterName: userData.name,
            reason: reason,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending' // pending, resolved
        });

        // يمكننا أيضاً إضافة علامة على البوست نفسه
        /* await db.collection('activity_feed').doc(currentReportFeedId).update({
            flags: firebase.firestore.FieldValue.increment(1)
        }); */

        showToast("تم استلام البلاغ، شكراً لحرصك 👮‍♂️", "success");
        closeModal('modal-report');
    } catch (e) {
        showToast("حدث خطأ", "error");
    } finally {
        btn.innerText = "إرسال البلاغ";
    }
}




/* Avatar System */
// ==================== V3.2 Avatar System ====================

let selectedAvatarIcon = "🏃"; // الافتراضي

function openAvatarSelector() {
    const grid = document.getElementById('avatar-grid');
    const icons = ["🏃", "🏃‍♀️", "⚡", "🔥", "🦁", "🦅", "🚀", "👑", "💀", "🤖"];

    let html = '';
    icons.forEach(icon => {
        html += `<div class="avatar-option" onclick="selectAvatarIcon(this, '${icon}')">${icon}</div>`;
    });
    grid.innerHTML = html;

    // إعادة تعيين الحقول
    document.getElementById('custom-avatar-url').value = userData.photoUrl || '';
    if (userData.photoUrl) {
        previewCustomAvatar(userData.photoUrl);
    } else {
        selectedAvatarIcon = userData.avatarIcon || "🏃";
        updatePreview(selectedAvatarIcon);
    }

    document.getElementById('modal-avatar').style.display = 'flex';
}

function selectAvatarIcon(el, icon) {
    // إزالة التحديد من الكل
    document.querySelectorAll('.avatar-option').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');

    selectedAvatarIcon = icon;
    // مسح الرابط المخصص إذا اختار أيقونة
    document.getElementById('custom-avatar-url').value = '';
    updatePreview(icon);
}

function previewCustomAvatar(url) {
    const preview = document.getElementById('avatar-preview');
    if (url.length > 5) {
        preview.innerText = '';
        preview.style.backgroundImage = `url('${url}')`;
    } else {
        preview.style.backgroundImage = 'none';
        preview.innerText = selectedAvatarIcon;
    }
}

function updatePreview(icon) {
    const preview = document.getElementById('avatar-preview');
    preview.style.backgroundImage = 'none';
    preview.innerText = icon;
}

async function saveAvatarSelection() {
    const customUrl = document.getElementById('custom-avatar-url').value.trim();
    const btn = event.target;
    btn.innerText = "جاري الحفظ...";

    const updateData = {};

    if (customUrl) {
        updateData.photoUrl = customUrl;
        updateData.avatarIcon = null; // نلغي الأيقونة لو فيه صورة
        userData.photoUrl = customUrl;
    } else {
        updateData.avatarIcon = selectedAvatarIcon;
        updateData.photoUrl = null;
        userData.avatarIcon = selectedAvatarIcon;
    }

    try {
        await db.collection('users').doc(currentUser.uid).update(updateData);
        allUsersCache = []; // تحديث الكاش ليظهر الجديد في القوائم
        updateUI();
        closeModal('modal-avatar');
        showToast("تم تحديث الصورة الشخصية 📸", "success");
    } catch (e) {
        showToast("فشل الحفظ", "error");
    } finally {
        btn.innerText = "حفظ الصورة";
    }
}

// ==================== ✅ PROFILE COMPLETE LOGIC (FINAL) ====================

// 1. دالة التبديل بين التبويبات (مع الإنعاش)
function switchProfileTab(tabName) {
    // UI Updates
    document.querySelectorAll('.p-tab').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`ptab-${tabName}`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.p-tab-content').forEach(el => el.classList.remove('active'));
    const content = document.getElementById(`p-content-${tabName}`);
    if (content) content.classList.add('active');

    // Data Refresh Logic
    if (tabName === 'activity') {
        if (typeof loadChart === 'function') loadChart('week');
        if (typeof loadActivityLog === 'function') loadActivityLog();
        loadRecentInteractions(); // تحميل التفاعلات
    }
    else if (tabName === 'goals') {
        // تحديث حلقة الهدف
        if (typeof updateGoalRing === 'function') updateGoalRing();
        // تحميل التحديات
        loadProfileChallenges();
    }
    else if (tabName === 'stats') {
        renderProfileBadges(); // رسم البادجات
    }
}

// 2. دالة التفاعلات (النسخة الذكية - سطر واحد)
function loadRecentInteractions() {
    const container = document.getElementById('interactions-list-mini');
    const box = document.getElementById('latest-interactions-box');
    if (!container) return;

    if (!currentUser) {
        if (box) box.style.display = 'none';
        return;
    }

    // إظهار البوكس مبدئياً
    if (box) box.style.display = 'block';

    db.collection('users').doc(currentUser.uid).collection('notifications')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get()
        .then(snap => {
            if (snap.empty) {
                container.innerHTML = `<div style="text-align:center; padding:5px; font-size:11px; opacity:0.6;">لا توجد تفاعلات جديدة</div>`;
                return;
            }

            let html = '';
            snap.forEach(doc => {
                const n = doc.data();

                // تحديد الاسم
                let rawName = n.senderName || n.userName || n.name;
                let displayName = rawName;
                let avatarChar = rawName ? rawName.charAt(0) : '';

                // تحديد النص والأيقونة
                let actionText = '';
                let iconOverlay = '';
                let iconColor = '#9ca3af';

                switch (n.type) {
                    case 'like':
                        if (!displayName) { displayName = "إعجاب"; avatarChar = "❤️"; }
                        actionText = "أعجب بنشاطك";
                        iconOverlay = '<i class="ri-heart-fill"></i>';
                        iconColor = '#ef4444';
                        break;
                    case 'comment':
                        if (!displayName) { displayName = "تعليق"; avatarChar = "💬"; }
                        let shortMsg = (n.msg || '').substring(0, 20) + ((n.msg && n.msg.length > 20) ? '...' : '');
                        actionText = `علق: <span style="color:#cbd5e1">"${shortMsg}"</span>`;
                        iconOverlay = '<i class="ri-chat-3-fill"></i>';
                        iconColor = '#3b82f6';
                        break;
                    case 'badge':
                        displayName = "إنجاز جديد";
                        avatarChar = "🏆";
                        actionText = "حصلت على وسام!";
                        iconOverlay = '<i class="ri-medal-fill"></i>';
                        iconColor = '#f59e0b';
                        break;
                    case 'admin':
                    case 'system':
                        displayName = "إدارة الفريق";
                        avatarChar = "📢";
                        actionText = n.msg || "تنبيه هام";
                        iconOverlay = '<i class="ri-megaphone-fill"></i>';
                        iconColor = '#10b981';
                        break;
                    default:
                        if (!displayName) { displayName = "إشعار"; avatarChar = "🔔"; }
                        actionText = n.msg || "تفاعل جديد";
                        iconOverlay = '<i class="ri-notification-3-fill"></i>';
                }

                const timeAgo = (typeof getTimeAgo === 'function') ? getTimeAgo(n.timestamp ? n.timestamp.toDate() : new Date()) : '';

                html += `
                    <div class="inter-item compact" style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:6px;">
                        <div style="position:relative; flex-shrink:0;">
                            <div style="width:32px; height:32px; background:#1f2937; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border:1px solid rgba(255,255,255,0.1);">
                                ${avatarChar}
                            </div>
                            <div style="position:absolute; bottom:-3px; left:-3px; width:14px; height:14px; background:${iconColor}; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8px; border:2px solid #111827;">
                                ${iconOverlay}
                            </div>
                        </div>
                        <div style="flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:11px; color:#9ca3af;">
                            <strong style="color:#fff; margin-left:3px;">${displayName}</strong> ${actionText}
                        </div>
                        <span style="font-size:9px; color:#64748b; flex-shrink:0;">${timeAgo}</span>
                    </div>
                `;
            });
            container.innerHTML = html;
        })
        .catch(err => {
            console.error(err);
            if (box) box.style.display = 'none';
        });
}

// 3. دالة التحديات (الموثوقة)
function loadProfileChallenges() {
    const container = document.getElementById('profile-active-challenges');
    if (!container) return;

    // استخدام الكاش الموجود أو مصفوفة فارغة لتجنب الأخطاء
    const allCh = window.allChallengesCache || [];
    const myChallenges = allCh.filter(ch => ch.isJoined === true && !ch.completed);

    if (myChallenges.length === 0) {
        container.innerHTML = `<div class="empty-state-mini" style="width:100%; text-align:center; padding:15px; color:#6b7280; font-size:12px;">لا توجد تحديات نشطة حالياً</div>`;
        return;
    }

    let html = '';
    myChallenges.forEach(ch => {
        const perc = Math.min(((ch.progress || 0) / (ch.target || 1)) * 100, 100);
        html += `
            <div class="mini-challenge-card" onclick="switchView('challenges'); setTab('active-challenges');" 
                 style="cursor:pointer; border-left: 3px solid var(--primary); margin-bottom:10px; width:100%;">
                <div class="mini-ch-title">${ch.title}</div>
                <div class="mini-ch-progress">
                    <div class="mini-ch-fill" style="width:${perc}%; background:var(--primary)"></div>
                </div>
                <div style="font-size:9px; color:#9ca3af; display:flex; justify-content:space-between; margin-top:4px;">
                    <span>${Math.floor(ch.progress || 0)} / ${ch.target}</span>
                    <span>${ch.durationDays || 30} يوم</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// 4. دالة البادجات (نظام التحفيز - 4 في الصف)
function renderProfileBadges() {
    const grid = document.getElementById('badges-grid');
    if (!grid) return;

    // التأكد من تحميل الكونفيج
    const config = (typeof BADGES_CONFIG !== 'undefined') ? BADGES_CONFIG : [];

    // قائمة بادجات المستخدم الحالية
    const userBadges = userData.badges || [];

    let html = '';

    config.forEach(badge => {
        // هل يمتلك هذا البادج؟
        const isEarned = userBadges.includes(badge.id);

        // الستايل: لو مكتسب يظهر عادي، لو لأ يظهر باهت ورمادي
        const styleFilter = isEarned ? '' : 'filter: grayscale(100%); opacity: 0.35;';
        const lockIcon = isEarned ? '' : '<i class="ri-lock-2-fill" style="position:absolute; top:5px; right:5px; font-size:12px; color:#fff;"></i>';
        const bgStyle = isEarned
            ? 'background:rgba(255,255,255,0.08); border:1px solid rgba(16, 185, 129, 0.3);' // أخضر خفيف للمكتسب
            : 'background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1);'; // مقطع لغير المكتسب

        html += `
            <div class="badge-item" onclick="showBadgeDetails('${badge.name}', '${badge.desc}', '${badge.icon}', ${isEarned})"
                 style="position:relative; cursor:pointer; ${bgStyle} border-radius:12px; padding:10px 5px; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90px; transition:transform 0.2s; ${styleFilter}">
                ${lockIcon}
                <div style="font-size:28px; margin-bottom:5px;">${badge.icon}</div>
                <div style="font-size:9px; color:#fff; text-align:center; line-height:1.2; font-weight:bold;">${badge.name}</div>
            </div>
        `;
    });

    // ضبط الشبكة لتكون 4 أعمدة بالضبط
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(4, 1fr)"; // 🔥 4 في الصف
    grid.style.gap = "8px";
    grid.innerHTML = html;
}

// دالة مساعدة لإظهار التفاصيل (بتفرق في الرسالة لو البادج مقفول)
function showBadgeDetails(title, desc, icon, isEarned) {
    if (isEarned) {
        showToast(`${icon} ${title}: ${desc}`, "success");
    } else {
        // رسالة تحفيزية للمقفول
        showToast(`🔒 ${title}: ${desc} (واصل التمرين لفتحه!)`, "info");
    }
}

// ==================== Weekly Schedule Logic ====================

// 1. بيانات الجدول (ممكن تعدلها براحتك)
const WEEKLY_SCHEDULE = [
    { id: 6, day: 'السبت', title: 'جري طويل', desc: 'مسافة 10-15 كم', type: 'run', icon: '🏃‍♂️' },
    { id: 0, day: 'الأحد', title: 'استشفاء', desc: 'راحة تامة أو يوجا', type: 'rest', icon: '🧘‍♂️' },
    { id: 1, day: 'الاثنين', title: 'تمبو', desc: '5 كم رتم سريع', type: 'speed', icon: '⚡' },
    { id: 2, day: 'الثلاثاء', title: 'جري خفيف', desc: 'هرولة 30 دقيقة', type: 'run', icon: '👟' },
    { id: 3, day: 'الأربعاء', title: 'انترفل', desc: '8x400m سرعة', type: 'speed', icon: '⏱️' },
    { id: 4, day: 'الخميس', title: 'تمارين قوة', desc: 'جيم أو سويدي', type: 'gym', icon: '💪' },
    { id: 5, day: 'الجمعة', title: 'راحة', desc: 'يوم العائلة', type: 'rest', icon: '🌴' }
];

// 2. دالة رسم الجدول
function renderTeamSchedule() {
    const container = document.getElementById('schedule-scroll-container');
    if (!container) return;

    // معرفة رقم اليوم الحالي (0 = الأحد, 1 = الاثنين, ... 6 = السبت)
    const todayIndex = new Date().getDay();

    let html = '';

    // إعادة ترتيب المصفوفة لتبدأ من "اليوم" (اختياري) أو عرضها كما هي
    // سنعرضها كما هي (سبت -> جمعة) ونميز اليوم الحالي

    WEEKLY_SCHEDULE.forEach(item => {
        const isToday = (item.id === todayIndex);
        const activeClass = isToday ? 'today' : '';
        const badge = isToday ? '<div class="today-badge">اليوم</div>' : '';

        // تغيير لون الأيقونة حسب النوع
        let iconColor = '#fff';
        if (item.type === 'run') iconColor = '#10b981'; // أخضر
        if (item.type === 'speed') iconColor = '#ef4444'; // أحمر
        if (item.type === 'rest') iconColor = '#6b7280'; // رمادي
        if (item.type === 'gym') iconColor = '#f59e0b'; // برتقالي

        html += `
            <div class="sch-card ${activeClass}" onclick="showToast('${item.title}: ${item.desc}', 'info')">
                ${badge}
                <div class="sch-day">${item.day}</div>
                <div class="sch-icon" style="color:${iconColor}">${item.icon}</div>
                <div class="sch-title">${item.title}</div>
                <div class="sch-desc">${item.desc}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // سكرول تلقائي لليوم الحالي عشان المستخدم يشوفه أول ما يفتح
    setTimeout(() => {
        const todayCard = container.querySelector('.sch-card.today');
        if (todayCard) {
            todayCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 500);
}


function toggleInteractionsFold() {
    const content = document.getElementById('interactions-list-mini');
    const icon = document.getElementById('interactions-fold-icon');
    const header = document.getElementById('interactions-header');

    // تبديل الكلاسات
    content.classList.toggle('folded');
    icon.classList.toggle('rotated');

    // تعديل الهامش السفلي للعنوان عند الطي لتبدو الحاوية أصغر
    if (content.classList.contains('folded')) {
        header.style.marginBottom = "0px";
    } else {
        header.style.marginBottom = "10px";
    }
}

// ==================== Annual Goal Setting ====================
async function setAnnualGoal() {
    const currentGoal = userData.yearlyGoal || 1000;
    const newGoal = prompt("حدد هدفك السنوي لعام 2026 (بالكيلومتر):", currentGoal);

    if (newGoal === null || newGoal === "" || isNaN(newGoal)) return;

    try {
        const goalNum = parseFloat(newGoal);
        await db.collection('users').doc(currentUser.uid).update({
            yearlyGoal: goalNum
        });

        userData.yearlyGoal = goalNum;
        showToast(`تم تحديث هدفك السنوي لـ ${goalNum} كم 👑`, "success");
        updateUI(); // تحديث الواجهة فوراً
    } catch (e) {
        console.error(e);
        showToast("فشل تحديث الهدف", "error");
    }
}


function switchLogTab(tab) {
    // 1. تحديث شكل الأزرار
    document.querySelectorAll('.log-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-btn-' + tab).classList.add('active');

    // 2. إخفاء كل المحتويات
    const tabs = ['gps', 'manual', 'strava'];
    tabs.forEach(t => {
        const el = document.getElementById('log-tab-' + t);
        if (el) el.style.display = 'none';
    });

    // 3. إظهار المحتوى المطلوب
    const target = document.getElementById('log-tab-' + tab);
    if (target) target.style.display = 'block';
}


function openRunDetailFromFeed(docId, data) {
    // 1. ملء بيانات المودال الموحد (modal-run-detail)
    const typeLabel = data.type === 'Run' ? 'نشاط جري 🏃‍♂️' : (data.type === 'Walk' ? 'تمشية 🚶' : 'تمرين عداء');
    document.getElementById('detail-type').innerText = typeLabel;
    document.getElementById('detail-dist').innerText = data.dist || '0';
    document.getElementById('detail-time').innerText = data.time || '--';

    // تنسيق التاريخ من الـ Timestamp
    const timeAgo = typeof getArabicTimeAgo === 'function' ? getArabicTimeAgo(data.timestamp) : 'نشاط من الفريق';
    document.getElementById('detail-date').innerText = timeAgo;

    const pace = data.dist > 0 && data.time > 0 ? (data.time / data.dist).toFixed(2) : '--';
    document.getElementById('detail-pace').innerText = pace;

    const mapEl = document.getElementById('detail-map');
    const imgEl = document.getElementById('detail-img');

    // إخفاء العناصر القديمة
    mapEl.style.display = 'none';
    imgEl.style.display = 'none';

    // 2. التحقق من وجود خريطة أو صورة
    if (data.polyline) {
        mapEl.style.display = 'block';
        setTimeout(() => {
            if (window._feedDetailMap) window._feedDetailMap.remove();
            window._feedDetailMap = L.map('detail-map', { zoomControl: false }).setView([0, 0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window._feedDetailMap);
            const coords = L.Polyline.fromEncoded(data.polyline).getLatLngs();
            const poly = L.polyline(coords, { color: '#10b981', weight: 4 }).addTo(window._feedDetailMap);
            window._feedDetailMap.fitBounds(poly.getBounds());
        }, 300);
    } else if (data.img) {
        imgEl.src = data.img;
        imgEl.style.display = 'block';
    }

    // 3. فتح المودال
    openModal('modal-run-detail');
}


// ==================== Like Button Optimization ====================
// متغير لتخزين "آخر حالة" عشان نمنع تضارب الطلبات
window._likeDebounceTimer = null;

async function handleLikeClick(postId) {
    const wrapper = document.getElementById(`like-wrap-${postId}`);
    if (!wrapper) return;

    const icon = wrapper.querySelector('i');
    const countSpan = wrapper.querySelector('span');
    let currentCount = parseInt(countSpan.innerText || '0');

    // 1. تحديد الحالة الجديدة المتوقعة (عكس الحالة الحالية فوراً)
    const wasLiked = icon.classList.contains('ri-heart-fill');
    const newIsLiked = !wasLiked;

    // 2. تحديث الواجهة فوراً (بدون انتظار أي حاجة)
    if (newIsLiked) {
        icon.className = 'ri-heart-fill';
        icon.style.color = '#ef4444';
        countSpan.style.color = '#ef4444';
        countSpan.innerText = currentCount + 1;
        // تأثير النبضة
        wrapper.style.transform = 'scale(1.3)';
        setTimeout(() => wrapper.style.transform = 'scale(1)', 200);
    } else {
        icon.className = 'ri-heart-line';
        icon.style.color = '#94a3b8';
        countSpan.style.color = '#94a3b8';
        countSpan.innerText = Math.max(0, currentCount - 1);
    }

    // 3. (Debounce) إرسال الطلب للسيرفر بعد هدوء الضغطات
    // لو المستخدم داس 10 مرات، هننفذ آخر وضع وصله بس
    if (window._likeDebounceTimer) clearTimeout(window._likeDebounceTimer);

    window._likeDebounceTimer = setTimeout(async () => {
        try {
            // نبعت الحالة النهائية للسيرفر
            await toggleLike(postId, newIsLiked);
        } catch (e) {
            console.error("Server sync failed", e);
            // لو فشل بس، نرجع الواجهة لأصلها (Silent Fail)
            loadGlobalFeed();
        }
    }, 500); // ننتظر نص ثانية قبل الإرسال الفعلي
}


async function toggleLike(docId, shouldLike) {
    if (!currentUser) return;

    const uid = currentUser.uid;
    const feedRef = db.collection('activity_feed').doc(docId);

    // إرسال الأمر المباشر (يا ضيف يا احذف) بناء على آخر وضع الزرار وصله
    if (shouldLike) {
        return feedRef.update({
            likes: firebase.firestore.FieldValue.arrayUnion(uid)
        });
    } else {
        return feedRef.update({
            likes: firebase.firestore.FieldValue.arrayRemove(uid)
        });
    }
}