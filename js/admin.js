/* ERS Admin */
// ==================== V1.4 Admin Logic ====================

function switchAdminTab(tabName) {
    // 1) Activate correct tab button (data-tab driven)
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
        const key = t.dataset.tab || '';
        t.classList.toggle('active', key === tabName);
    });

    // 2) Show correct content section
    document.querySelectorAll('.admin-content-section').forEach(s => s.classList.remove('active'));
    const content = document.getElementById('admin-' + tabName);
    if (content) content.classList.add('active');

    // 3) Lazy-load per tab
    if (tabName === 'overview') loadAdminStats();
    if (tabName === 'inspector') loadAdminRuns();
    if (tabName === 'studio') loadAdminChallengesList();
    if (tabName === 'coach') loadCoachAdmin();
    if (tabName === 'users') loadAllUsersTable();
}
async function loadAdminStats() {
    // 1. حساب التواريخ
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000); // 15 دقيقة للوراء

    // 2. المتواجدون الآن (Last Seen > 15 mins ago)
    // ملاحظة: تتطلب فهرس مركب في فايربيس، سنستخدم التصفية اليدوية مؤقتاً للأداء في القوائم الصغيرة
    const snapLive = await db.collection('users')
        .where('lastSeen', '>=', firebase.firestore.Timestamp.fromDate(fifteenMinsAgo))
        .orderBy('lastSeen', 'desc')
        .limit(20)
        .get();

    // 3. زوار اليوم
    const snapVisitors = await db.collection('users')
        .where('lastLoginDate', '==', todayStr).get();

    // 4. جريات اليوم
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const snapRuns = await db.collection('activity_feed')
        .where('timestamp', '>=', todayStart)
        .orderBy('timestamp', 'desc')
        .get();

    // 5. إجمالي الأعضاء (تقديري أو دقيق)
    // للجلب السريع، يفضل تخزين الرقم في وثيقة منفصلة، لكن هنا سنستخدم الحجم
    const snapTotal = await db.collection('users').get(); 

    // === تحديث العدادات ===
    if(document.getElementById('adm-live-now')) {
        document.getElementById('adm-live-now').innerText = snapLive.size;
        document.getElementById('adm-visitors-today').innerText = snapVisitors.size;
        document.getElementById('adm-runs-today').innerText = snapRuns.size;
        document.getElementById('adm-total-users').innerText = snapTotal.size;
    }

    // === ملء قائمة المتواجدين ===
    const liveList = document.getElementById('live-users-list');
    if(liveList) {
        let liveHtml = '';
        snapLive.forEach(doc => {
            const u = doc.data();
            liveHtml += `
            <div class="mini-user-row">
                <div class="mini-avatar">${(u.name||'?').charAt(0)}</div>
                <div class="mini-info">
                    <span class="mini-name">${u.name}</span>
                    <span class="mini-sub">${u.region || 'غير محدد'}</span>
                </div>
                <span class="status-pill">نشط الآن</span>
            </div>`;
        });
        liveList.innerHTML = liveHtml || '<div class="loader-placeholder">لا يوجد أعضاء أونلاين حالياً</div>';
    }

    // === ملء قائمة أحدث الأنشطة ===
    const runsList = document.getElementById('recent-runs-list');
    if(runsList) {
        let runsHtml = '';
        // نأخذ أول 10 فقط من النتائج
        const recentRuns = snapRuns.docs.slice(0, 10);
        recentRuns.forEach(doc => {
            const r = doc.data();
            const timeStr = r.timestamp ? r.timestamp.toDate().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '';
            runsHtml += `
            <div class="mini-user-row">
                <div class="mini-avatar" style="background:var(--bg-card); color:var(--primary);">${r.type === 'Run' ? '🏃' : '🚶'}</div>
                <div class="mini-info">
                    <span class="mini-name">${r.userName}</span>
                    <span class="mini-sub">${r.dist} كم • ${timeStr}</span>
                </div>
                <button onclick="viewUserProfile('${r.uid}')" style="background:none; border:none; color:#9ca3af; cursor:pointer;">👁️</button>
            </div>`;
        });
        runsList.innerHTML = runsHtml || '<div class="loader-placeholder">لا توجد جريات اليوم</div>';
    }

    // تحديث الرادار
    detectSuspiciousActivity();
}
function loadAdminRuns() {
    const list = document.getElementById('admin-runs-feed');
    if(!list) return;
    list.innerHTML = '<div style="text-align:center; padding:20px;"><span class="loader-btn"></span></div>';

    db.collection('activity_feed').orderBy('timestamp', 'desc').limit(20).get().then(snap => {
        let html = '';
        snap.forEach(doc => {
            const run = doc.data();
            const timeAgo = getArabicTimeAgo(run.timestamp);
            const pace = (run.dist > 0) ? (run.time / run.dist).toFixed(1) : '-';
            
            // روابط الصور والإثباتات
            let evidence = '';
            if(run.img) evidence += `<a href="${run.img}" target="_blank" style="color:#8b5cf6;">[صورة]</a> `;
            if(run.link) evidence += `<a href="${run.link}" target="_blank" style="color:#3b82f6;">[رابط]</a>`;
            if(!evidence) evidence = '<span style="color:#6b7280;">بلا إثبات</span>';

            html += `
            <div class="inspector-card">
                <div class="inspector-header">
                    <div class="inspector-user">
                        <div style="width:20px; height:20px; background:#374151; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px;">${run.userName.charAt(0)}</div>
                        <span>${run.userName}</span>
                    </div>
                    <span class="inspector-meta">${timeAgo}</span>
                </div>
                
                <div class="inspector-data">
                    <div>
                        <span class="insp-val">${run.dist}</span> <span style="font-size:10px;">كم</span>
                    </div>
                    <div style="width:1px; height:20px; background:rgba(255,255,255,0.1);"></div>
                    <div>
                        <span class="insp-val" style="color:#fff;">${pace}</span> <span style="font-size:10px;">د/كم</span>
                    </div>
                    <div style="flex:1; text-align:left; font-size:11px;">
                        ${evidence}
                    </div>
                </div>

                <div class="insp-actions">
                    <button class="btn-insp btn-reject" onclick="adminForceDelete('${doc.id}', '${run.uid}', ${run.dist})">حذف 🗑️</button>
                    </div>
            </div>`;
        });
        list.innerHTML = html || '<div style="text-align:center; padding:20px;">لا توجد أنشطة</div>';
    });
}




/* Admin Coach Panel */
/* -------------------- Admin Coach Panel -------------------- */
/* ==================== V1.4.1 Coach Sub-Tabs Logic ==================== */

/* ==================== V1.4.2 Coach Stats Logic ==================== */

// 1. تحديث دالة التبديل لتستدعي الإحصائيات عند الحاجة
function switchCoachSubTab(subTabName) {
    // ... (نفس كود التبديل السابق) ...
    document.querySelectorAll('.coach-sub-btn').forEach(btn => btn.classList.remove('active'));
    const clickedBtn = document.querySelector(`.coach-sub-btn[onclick="switchCoachSubTab('${subTabName}')"]`);
    if(clickedBtn) clickedBtn.classList.add('active');

    document.querySelectorAll('.coach-sub-section').forEach(sec => sec.classList.remove('active'));
    const targetSec = document.getElementById('c-sub-' + subTabName);
    if(targetSec) targetSec.classList.add('active');

    // 🔥 الجديد: تحميل البيانات إذا فتحنا تبويب التحدي
    if (subTabName === 'challenge') {
        loadWeeklyChStats();
    }
}

// 2. دالة جلب إحصائيات التحدي
async function loadWeeklyChStats() {
    const list = document.getElementById('ch-participants-list');
    const badge = document.getElementById('ch-count-badge');
    if(!list || !db) return;

    list.innerHTML = '<div style="text-align:center; padding:10px;"><span class="loader-btn"></span></div>';

    try {
        // 1. تحديد وقت بداية البحث (آخر 7 أيام)
        // قللنا التعقيد عشان نتفادى أخطاء الـ Index
        const challengeStartTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // 2. الاستعلام المبسط (بدون OrderBy في الداتابيز لتفادي الخطأ حالياً)
        const snap = await db.collection('activity_feed')
            .where('isWeeklyChallenge', '==', true)
            .where('timestamp', '>=', challengeStartTime)
            .get();

        if (snap.empty) {
            list.innerHTML = '<div class="empty-state-mini">لا يوجد أبطال حتى الآن.. شجعهم يا كوتش! 📣</div>';
            if(badge) badge.innerText = "0";
            return;
        }

        // 3. تحويل البيانات وترتيبها يدوياً (Client-side sorting)
        let docs = [];
        snap.forEach(doc => docs.push(doc.data()));
        
        // ترتيب تنازلي حسب الوقت (الأحدث أولاً)
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        // 4. عرض القائمة
        const uniqueUsers = new Set();
        let html = '';
        
        docs.forEach(data => {
            if (!uniqueUsers.has(data.uid)) {
                uniqueUsers.add(data.uid);
                
                const timeStr = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleDateString('ar-EG') : '';
                const proofIcon = data.img ? `<a href="${data.img}" target="_blank" style="color:#10b981; text-decoration:none;">📸</a>` : '';
                const noteText = data.note ? `<div style="font-size:10px; color:#9ca3af;">"${data.note}"</div>` : '';

                html += `
                <div class="mini-user-row" style="background:rgba(255,255,255,0.03); border-radius:8px; padding:8px; display:flex; align-items:flex-start; gap:10px;">
                    <div class="mini-avatar" style="margin-top:2px;">${(data.userName||'?').charAt(0)}</div>
                    <div class="mini-info" style="flex:1;">
                        <div style="display:flex; justify-content:space-between;">
                            <span class="mini-name" style="font-size:12px; color:#fff;">${data.userName}</span>
                            <span class="mini-sub" style="font-size:10px;">${timeStr}</span>
                        </div>
                        ${noteText}
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        ${proofIcon}
                    </div>
                </div>`;
            }
        });

        list.innerHTML = html;
        if(badge) badge.innerText = uniqueUsers.size;

    } catch (e) {
        console.error("Error loading ch stats:", e);
        // رسالة مفيدة للكوتش لو حصل خطأ تقني
        list.innerHTML = `<div class="error-msg" style="font-size:10px;">
            حدث خطأ. لو أنت المطور: افتح الكونسول وتأكد من الـ Indexes في فايربيس.
            <br>السبب: ${e.message}
        </div>`;
    }
}

async function loadCoachAdmin(){
    if(!(userData && userData.isAdmin===true) || !db) return;

    // set default date to today
    const dateEl = document.getElementById('coach-ov-date');
    if(dateEl && !dateEl.value) dateEl.value = _ersDateKey(new Date());

    await adminEnsureCoachSeed();
    await adminLoadCoachWorkoutsIntoSelects();
    await adminLoadScheduleAndChallenge();
    await adminRenderWorkoutsList();
}

async function adminEnsureCoachSeed(){
    try{
        const snap = await db.collection('coachWorkouts').limit(1).get();
        if(!snap.empty) return; // already has workouts

        const hint = document.getElementById('coach-week-hint');
        if(hint) hint.innerText = 'جاري إنشاء مكتبة افتراضية أول مرة…';

        const presets = [
            { emoji:'🫁', title:'Recovery Run', type:'recovery', load:'20–35 دقيقة', rpe:'2–3', structure:'Warmup: 5 دقائق\nMain: جري سهل جدًا\nCooldown: إطالة 8 دقائق', notes:'استشفاء… عايزك تخلص وأنت مبسوط.' },
            { emoji:'🏔️', title:'Hills Session', type:'hills', load:'30–45 دقيقة', rpe:'6–7', structure:'Warmup: 10 دقائق\nMain: 6×(40ث صعود + 70ث نزول)\nCooldown: 8 دقائق', notes:'الصعود قوي قصير… والنزول مرن.' },
            { emoji:'🧘‍♂️', title:'Mobility / Yoga', type:'mobility', load:'20–30 دقيقة', rpe:'1–2', structure:'Mobility: كاحل + حوض + فخذ\nYoga: 10 دقائق تنفّس + إطالات', notes:'ده يوم الصيانة.' },
            { emoji:'⚡', title:'Intervals 1:1', type:'intervals', load:'35–55 دقيقة', rpe:'7–8', structure:'Warmup: 10 دقائق\nMain: 8×(1د سريع + 1د سهل)\nCooldown: 8 دقائق', notes:'سرعاتك متحكم فيها.' },
            { emoji:'🎲', title:'Fartlek Play', type:'fartlek', load:'25–45 دقيقة', rpe:'4–6', structure:'Warmup: 10 دقائق\nMain: 10×(1د أسرع + 1د سهل)\nCooldown: 6 دقائق', notes:'إلعبها… وانهى وأنت قادر تزود.' },
            { emoji:'🏋️', title:'Cross / Strength', type:'strength', load:'25–40 دقيقة', rpe:'4–6', structure:'Strength: سكوات خفيف + كور\nأو: عجلة/سباحة', notes:'قوة = حماية للركبة.' },
            { emoji:'🐢', title:'Long Run', type:'long', load:'60–90 دقيقة', rpe:'3–5', structure:'Warmup: 8 دقائق\nMain: جري ثابت\nCooldown: 6 دقائق + سوائل', notes:'اللونج يبنيك… بهدوء.' },
        ];

        const ids = {};
        for(const p of presets){
            const docRef = await db.collection('coachWorkouts').add({
                ...p,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // map by type for schedule
            if(!ids[p.type]) ids[p.type] = docRef.id;
            // special for recovery etc
            if(p.title === 'Long Run') ids.long = docRef.id;
        }

        // default weekly schedule: sat recovery, sun hills, mon mobility, tue intervals, wed fartlek, thu strength, fri long
        await db.collection('coachConfig').doc('weeklySchedule').set({
            sat: ids.recovery || null,
            sun: ids.hills || null,
            mon: ids.mobility || null,
            tue: ids.intervals || null,
            wed: ids.fartlek || null,
            thu: ids.strength || null,
            fri: ids.long || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        await db.collection('coachConfig').doc('weeklyChallenge').set({
            emoji:'🏁',
            title:'تحدي الأسبوع: 3 أيام متتالية',
            desc:'سجّل 3 أنشطة (جري/مشي) خلال 3 أيام متتالية… وخد صورة إثبات في اليوم الأخير 💪',
            requireImage:true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        if(hint) hint.innerText = 'تم إنشاء مكتبة افتراضية ✅ (تقدر تعدّلها أو تضيف براحتك).';
    }catch(e){
        console.error(e);
    }
}

async function adminLoadCoachWorkoutsIntoSelects(){
    const selects = [
        document.getElementById('coach-ov-workout'),
        document.getElementById('wk-sat'), document.getElementById('wk-sun'), document.getElementById('wk-mon'),
        document.getElementById('wk-tue'), document.getElementById('wk-wed'), document.getElementById('wk-thu'),
        document.getElementById('wk-fri')
    ].filter(Boolean);

    if(!selects.length) return;

    const snap = await db.collection('coachWorkouts').orderBy('updatedAt','desc').get();
    const opts = [];
    snap.forEach(d=>{
        const data = d.data() || {};
        const label = `${data.emoji || '🔥'} ${data.title || data.name || 'Workout'} • ${data.type || ''}`;
        opts.push({ id:d.id, label });
    });

    const html = ['<option value="">— اختر —</option>']
        .concat(opts.map(o=>`<option value="${o.id}">${o.label}</option>`))
        .join('');

    selects.forEach(s=>{
        const val = s.value;
        s.innerHTML = html;
        if(val) s.value = val;
    });

    window._coachWorkoutsAdmin = opts;
}

async function adminLoadScheduleAndChallenge(){
    // schedule
    const sched = await db.collection('coachConfig').doc('weeklySchedule').get();
    if(sched.exists){
        const d = sched.data() || {};
        const map = { sat:'wk-sat', sun:'wk-sun', mon:'wk-mon', tue:'wk-tue', wed:'wk-wed', thu:'wk-thu', fri:'wk-fri' };
        Object.entries(map).forEach(([k,id])=>{
            const el = document.getElementById(id);
            if(el && d[k]) el.value = d[k];
        });
    }

    // weekly challenge
    const ch = await db.collection('coachConfig').doc('weeklyChallenge').get();
    if(ch.exists){
        const d = ch.data() || {};
        const e = document.getElementById('coach-ch-emoji');
        const t = document.getElementById('coach-ch-title');
        const ds = document.getElementById('coach-ch-desc');
        const r = document.getElementById('coach-ch-require-img');
        if(e) e.value = d.emoji || '🏁';
        if(t) t.value = d.title || '';
        if(ds) ds.value = d.desc || d.description || '';
        if(r) r.checked = (d.requireImage !== false);
    }

    // override hint
    const dateEl = document.getElementById('coach-ov-date');
    const hint = document.getElementById('coach-ov-hint');
    if(dateEl && hint){
        const dateKey = dateEl.value || _ersDateKey(new Date());
        const ov = await db.collection('coachOverrides').doc(dateKey).get();
        if(ov.exists){
            hint.innerText = `يوجد تعيين خاص لهذا اليوم ✅`;
        }else{
            hint.innerText = `لا يوجد تعيين خاص… سيستخدم جدول الأسبوع ♻️`;
        }
    }
}

async function adminRenderWorkoutsList(){
    const box = document.getElementById('coach-workouts-list');
    if(!box || !db) return;

    const snap = await db.collection('coachWorkouts').orderBy('updatedAt','desc').limit(50).get();
    if(snap.empty){
        box.innerHTML = `<div style="text-align:center; color:#9ca3af; padding:16px;">لا توجد تمرينات بعد.</div>`;
        return;
    }

    let html = '';
    snap.forEach(doc=>{
        const w = doc.data() || {};
        const title = (w.title || w.name || 'Workout');
        const sub = `${w.type || ''}${w.load ? ' • ' + w.load : ''}${w.rpe ? ' • RPE ' + w.rpe : ''}${(w.youtubeUrl||w.youtube)?' • 🎥':''}`;
        html += `
            <div class="workout-row">
                <div class="wr-left">
                    <div class="wr-title">${_escapeHtml((w.emoji||'🔥') + ' ' + title)}</div>
                    <div class="wr-sub">${_escapeHtml(sub)}</div>
                </div>
                <div class="wr-actions">
                    <button class="btn btn-ghost" onclick="adminEditWorkout('${doc.id}')"><i class="ri-edit-line"></i></button>
                    <button class="btn btn-ghost" onclick="adminDeleteWorkout('${doc.id}')"><i class="ri-delete-bin-6-line"></i></button>
                </div>
            </div>
        `;
    });

    box.innerHTML = html;
}

async function adminCreateWorkout(){
    try{
        const title = document.getElementById('cw-title')?.value?.trim();
        const type = document.getElementById('cw-type')?.value?.trim() || 'recovery';
        const load = document.getElementById('cw-load')?.value?.trim() || '';
        const rpe = document.getElementById('cw-rpe')?.value?.trim() || '';
        const structure = document.getElementById('cw-structure')?.value?.trim() || '';
        const notes = document.getElementById('cw-notes')?.value?.trim() || '';
const youtubeUrl = document.getElementById('cw-youtube')?.value?.trim() || '';
const imageUrl = document.getElementById('cw-image')?.value?.trim() || '';
const startUrl = document.getElementById('cw-starturl')?.value?.trim() || '';
const emojiInput = document.getElementById('cw-emoji')?.value?.trim() || '';

        if(!title){
            showToast('اكتب اسم التمرين');
            return;
        }

await db.collection('coachWorkouts').add({
  emoji: emojiInput || _guessEmoji(type),
  title, type, load, rpe, structure, notes,
  youtubeUrl: youtubeUrl || null,
  imageUrl: imageUrl || null,
  startUrl: startUrl || null,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
});
        // reset a few fields
        document.getElementById('cw-title').value = '';
        document.getElementById('cw-load').value = '';
        document.getElementById('cw-rpe').value = '';
        document.getElementById('cw-structure').value = '';
        document.getElementById('cw-notes').value = '';
        document.getElementById('cw-youtube').value = '';
const emEl = document.getElementById('cw-emoji'); if(emEl) emEl.value='';
const imgEl = document.getElementById('cw-image'); if(imgEl) imgEl.value='';
const stEl = document.getElementById('cw-starturl'); if(stEl) stEl.value='';

        showToast('تم إضافة التمرين ✅');
        await adminLoadCoachWorkoutsIntoSelects();
        await adminRenderWorkoutsList();
    }catch(e){
        console.error(e);
        showToast('حصل خطأ…');
    }
}

function _guessEmoji(type){
    const map = { recovery:'🫁', hills:'🏔️', intervals:'⚡', fartlek:'🎲', tempo:'🔥', long:'🐢', strength:'🏋️', mobility:'🧘‍♂️' };
    return map[type] || '🔥';
}

async function adminDeleteWorkout(id){
    if(!id) return;
    if(!confirm('حذف التمرين؟')) return;
    try{
        await db.collection('coachWorkouts').doc(id).delete();
        showToast('اتحذف ✅');
        await adminLoadCoachWorkoutsIntoSelects();
        await adminRenderWorkoutsList();
    }catch(e){
        console.error(e);
        showToast('تعذر الحذف');
    }
}

async function adminEditWorkout(id){
    if(!id) return;
    try{
        const snap = await db.collection('coachWorkouts').doc(id).get();
        if(!snap.exists) return;
        const w = snap.data() || {};

        const newTitle = prompt('اسم التمرين:', w.title || '');
        if(newTitle === null) return;

        const newLoad = prompt('المدة/المسافة (نص):', w.load || '');
        if(newLoad === null) return;

        const newRpe = prompt('RPE:', w.rpe || '');
        if(newRpe === null) return;

        const newNotes = prompt('تعليمات الكوتش (مختصر):', w.notes || '');
        if(newNotes === null) return;

        const newYT = prompt('رابط يوتيوب (اختياري):', w.youtubeUrl || '');
        if(newYT === null) return;

        const newImg = prompt('رابط صورة (اختياري):', w.imageUrl || '');
        if(newImg === null) return;

        const newStart = prompt('رابط (لبدء التدريب) اختياري:', w.startUrl || '');
        if(newYT === null) return;

        await db.collection('coachWorkouts').doc(id).set({
            title: (newTitle||'').trim(),
            load: (newLoad||'').trim(),
            rpe: (newRpe||'').trim(),
            notes: (newNotes||'').trim(),
            youtubeUrl: (newYT||'').trim() || null,
            imageUrl: (newImg||'').trim() || null,
            startUrl: (newStart||'').trim() || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        showToast('تم التحديث ✅');
        await adminLoadCoachWorkoutsIntoSelects();
        await adminRenderWorkoutsList();
    }catch(e){
        console.error(e);
        showToast('تعذر التعديل');
    }
}

async function adminPublishDailyOverride(){
    if(!(userData && userData.isAdmin===true) || !db) return;
    const dateKey = document.getElementById('coach-ov-date')?.value || _ersDateKey(new Date());
    const workoutId = document.getElementById('coach-ov-workout')?.value || '';
    const hint = document.getElementById('coach-ov-hint');

    if(!workoutId){
        showToast('اختر تمرين');
        return;
    }

    try{
        await db.collection('coachOverrides').doc(dateKey).set({
            workoutId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        if(hint) hint.innerText = 'تم النشر ✅ (الناس هتشوفه فوراً)';
        showToast('نشرنا تمرين اليوم ✅');
    }catch(e){
        console.error(e);
        showToast('تعذر النشر');
    }
}

async function adminClearDailyOverride(){
    if(!(userData && userData.isAdmin===true) || !db) return;
    const dateKey = document.getElementById('coach-ov-date')?.value || _ersDateKey(new Date());
    const hint = document.getElementById('coach-ov-hint');

    try{
        await db.collection('coachOverrides').doc(dateKey).delete();
        if(hint) hint.innerText = 'تم المسح ✅ سيستخدم جدول الأسبوع ♻️';
        showToast('تم مسح التعيين');
    }catch(e){
        console.error(e);
        showToast('تعذر المسح');
    }
}

async function adminSaveWeeklySchedule(){
    if(!(userData && userData.isAdmin===true) || !db) return;

    const get = (id)=> document.getElementById(id)?.value || '';
    const data = {
        sat: get('wk-sat'),
        sun: get('wk-sun'),
        mon: get('wk-mon'),
        tue: get('wk-tue'),
        wed: get('wk-wed'),
        thu: get('wk-thu'),
        fri: get('wk-fri'),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try{
        await db.collection('coachConfig').doc('weeklySchedule').set(data, { merge:true });
        const hint = document.getElementById('coach-week-hint');
        if(hint) hint.innerText = 'تم حفظ جدول الأسبوع ✅';
        showToast('اتحفظ ✅');
    }catch(e){
        console.error(e);
        showToast('تعذر الحفظ');
    }
}

async function adminPublishWeeklyChallenge(){
    if(!(userData && userData.isAdmin===true) || !db) return;

    const emoji = document.getElementById('coach-ch-emoji')?.value?.trim() || '🏁';
    const title = document.getElementById('coach-ch-title')?.value?.trim() || '';
    const desc = document.getElementById('coach-ch-desc')?.value?.trim() || '';
    const requireImage = document.getElementById('coach-ch-require-img')?.checked ?? true;

    if(!title || !desc){
        showToast('اكتب العنوان والوصف');
        return;
    }

    try{
        await db.collection('coachConfig').doc('weeklyChallenge').set({
            emoji, title, desc, requireImage,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });

        const hint = document.getElementById('coach-ch-hint');
        if(hint) hint.innerText = 'تم نشر تحدي الأسبوع ✅';
        showToast('نشرنا التحدي 🚀');
    }catch(e){
        console.error(e);
        showToast('تعذر النشر');
    }
}



function getDayName(d) {
    const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    return days[d];
}
function getGoalName(g) {
    const names = { weight_loss: "حرق دهون", speed: "سرعة", endurance: "تحمل", general: "لياقة" };
    return names[g] || "عام";
}


/* Admin Dashboard */
// ==================== 8. V3.0 Admin Dashboard (The Command Center) ====================

function openAdminAuth() {
    if (currentUser && userData && userData.isAdmin === true) {
        closeModal('modal-settings'); 
        setTimeout(() => { 
            switchView('admin'); 
            switchAdminTab('overview'); // تشغيل التبويب الافتراضي
        }, 100);
    } else { 
        showToast("⛔ هذه المنطقة محظورة", "error"); 
    }
}

function loadAdminDashboard() {
    loadAllUsersTable();
    detectSuspiciousActivity();
}

async function loadAllUsersTable() {
    const tbody = document.getElementById('users-table-body');
    const countEl = document.getElementById('total-users-count');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        const snap = await db.collection('users').orderBy('totalDist', 'desc').limit(100).get();
        if(countEl) countEl.innerText = snap.size;
        let html = '';
        snap.forEach(doc => {
            const u = doc.data();
            const isBanned = u.isBanned === true;
            html += `
            <tr style="${isBanned ? 'opacity:0.5; background:rgba(239,68,68,0.1);' : ''}">
                <td><div style="font-weight:bold;">${u.name}</div><div style="font-size:9px; color:#9ca3af;">${u.email||'-'}</div></td>
                <td>${u.region}</td>
                <td>
                    ${isBanned ? 
                        `<button class="action-btn" style="background:#10b981; color:#000;" onclick="toggleBan('${doc.id}', false)">فك</button>` : 
                        `<button class="action-btn btn-ban" onclick="toggleBan('${doc.id}', true)">حظر</button>`
                    }
                    <button class="action-btn" onclick="viewUserProfile('${doc.id}')">👤</button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch(e) { tbody.innerHTML = '<tr><td colspan="3" style="color:red;">خطأ</td></tr>'; }
}

async function toggleBan(uid, banStatus) {
    if(!confirm(banStatus ? "حظر العضو؟" : "فك الحظر؟")) return;
    try {
        await db.collection('users').doc(uid).update({ isBanned: banStatus });
        showToast(banStatus ? "تم الحظر 🚫" : "تم الفك ✅", "success");
        loadAllUsersTable();
    } catch(e) { showToast("خطأ", "error"); }
}

async function detectSuspiciousActivity() {
    const list = document.getElementById('suspicious-list');
    const countEl = document.getElementById('flagged-runs-count');
    if(!list) return;
    
    const snap = await db.collection('activity_feed').orderBy('timestamp', 'desc').limit(100).get();
    let suspiciousCount = 0;
    let html = '';

    snap.forEach(doc => {
        const run = doc.data();
        const dist = parseFloat(run.dist);
        const time = parseFloat(run.time);
        const pace = dist > 0 ? time / dist : 0;
        const kind = run.autoKind || _ersAutoKind(run.type || run.activityType || 'Run', pace);
        const isTooFast = pace < 2.5 && dist > 1;
        const isTooFar = dist > 45;
        const isWalkLikeRun = ((run.type === 'Run' || run.type === 'Race') && kind === 'Walk' && dist >= 2);

        if (isTooFast || isTooFar || isWalkLikeRun) {
            suspiciousCount++;
            const reason = isTooFast ? `🚀 سرعة (${pace.toFixed(1)} د/كم)` : (isTooFar ? `🗺️ مسافة (${dist} كم)` : `🚶‍♂️ مشي متسجل كجري (${pace.toFixed(1)} د/كم)`);
          
            html += `
            <div class="alert-card">
                <div class="alert-info">
                    <strong>${run.userName}</strong>
                    <span>${reason} • ${getArabicTimeAgo(run.timestamp)}</span>
                </div>
                <button class="action-btn btn-ban" onclick="adminForceDelete('${doc.id}', '${run.uid}', ${dist})">حذف</button>
            </div>`;
        }
    });

    if(countEl) countEl.innerText = suspiciousCount;
    list.innerHTML = html || '<div style="text-align:center; color:#10b981; font-size:11px;">الوضع آمن ✅</div>';
}

async function adminDelete(id, dist) {
    if(!confirm("حذف هذا النشاط المشبوه؟")) return;
    // استدعاء دالة الحذف العادية لكن بدون تأكيد إضافي لو أردنا، أو استخدام نفس الدالة
    // هنا سنستخدم دالة الحذف العامة
    deleteRun(id, dist || 0); 
    setTimeout(detectSuspiciousActivity, 2000); // تحديث القائمة
}


// دالة الحذف القسري للمشرفين (V3.1 Admin Fix)
async function adminForceDelete(feedId, userId, runDist) {
    if(!confirm("هل أنت متأكد من حذف هذا النشاط للمستخدم؟")) return;
    
    // تغيير نص الزر ليعرف الأدمن أن العملية جارية
    const btn = event.target;
    btn.innerText = "...";

    try {
        // 1. جلب بيانات المنشور من الـ Feed لمعرفة توقيته
        const feedDoc = await db.collection('activity_feed').doc(feedId).get();
        if (!feedDoc.exists) {
            // ربما حذفت بالفعل، نحذفها من الشاشة فقط
            btn.closest('.alert-card').remove();
            return;
        }
        const feedData = feedDoc.data();

        // 2. حذف الجرية من سجل المستخدم الأصلي (إذا وجدنا الرابط)
        // ملاحظة: الـ feed لا يحتوي دائماً على runId المربوط، لكننا سنحاول البحث بالتوقيت
        const runsQuery = await db.collection('users').doc(userId).collection('runs')
            .where('timestamp', '==', feedData.timestamp).get();
            
        if (!runsQuery.empty) {
            // وجدنا الجرية الأصلية عند المستخدم! نحذفها ونخصم المسافة
            runsQuery.forEach(async (doc) => {
                await doc.ref.delete();
            });
            
            // خصم المسافة من إجمالي المستخدم
            await db.collection('users').doc(userId).update({
                totalDist: firebase.firestore.FieldValue.increment(-runDist),
                totalRuns: firebase.firestore.FieldValue.increment(-(_ersIsCoreType(feedData.type) ? 1 : 0)),
                monthDist: firebase.firestore.FieldValue.increment(-runDist)
            });
        }

        // 3. حذف المنشور من الـ Feed
        await db.collection('activity_feed').doc(feedId).delete();

        // 4. تحديث الرادار فوراً
        btn.closest('.alert-card').remove();
        showToast("تم تنظيف السجل بنجاح 🧹", "success");
        
        // تحديث العداد
        const countEl = document.getElementById('flagged-runs-count');
        if(countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);

    } catch (e) {
        console.error(e);
        showToast("خطأ في الحذف: " + e.message, "error");
        btn.innerText = "حذف";
    }
}


    // تغيير نصوص الواجهة حسب النوع
function updateChallengeUI() {
    const type = document.getElementById('adv-ch-type').value;
    const lbl = document.getElementById('lbl-target');
    const input = document.getElementById('adv-ch-target');
    
    if(type === 'distance') {
        lbl.innerText = "المسافة الإجمالية (كم)";
        input.placeholder = "100";
    } else if (type === 'frequency') {
        lbl.innerText = "عدد الجريات المطلوبة";
        input.placeholder = "15";
    } else if (type === 'speed') {
        lbl.innerText = "أقصى بيس (دقيقة/كم)";
        input.placeholder = "4.5"; 
    }
}

// إظهار/إخفاء القواعد المتقدمة
// إصلاح زر الشروط الخاصة
function toggleRules() {
    const content = document.getElementById('rules-content');
    const currentStyle = window.getComputedStyle(content).display;
    
    if (currentStyle === 'none') {
        content.style.display = 'block';
        // تمرير لأسفل لرؤية الشروط
        content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        content.style.display = 'none';
    }
}
// ==================== 9. Charts & Graphs (V2.0) ====================
let currentChartMode = 'week'; 

function loadChart(mode, btnElement) {
    currentChartMode = mode;
    if (btnElement) {
        document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const chartDiv = document.getElementById('main-chart-area');
    if(!chartDiv) return;
    chartDiv.innerHTML = '<div style="margin:auto; font-size:11px; color:#6b7280;">جاري التحليل...</div>';
    chartDiv.classList.remove('monthly');

    const daysCount = mode === 'week' ? 7 : 30;
    const daysMap = [];
    const daysAr = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    for(let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().slice(0, 10);
        let label = mode === 'week' ? daysAr[d.getDay()] : `${d.getDate()}/${d.getMonth()+1}`;
        daysMap.push({ label: label, dateKey: dateKey, dist: 0 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);

    db.collection('users').doc(currentUser.uid).collection('runs')
      .where('timestamp', '>=', startDate)
      .get().then(snap => {
          snap.forEach(doc => {
              const run = doc.data();
              if(run.timestamp) {
                  const runDate = run.timestamp.toDate().toISOString().slice(0, 10);
                  const target = daysMap.find(d => d.dateKey === runDate);
                  if(target) target.dist += (run.dist || 0);
              }
          });

          if (mode === 'month') chartDiv.classList.add('monthly');
          let html = '';
          const maxDist = Math.max(...daysMap.map(d => d.dist), 5);

          daysMap.forEach(day => {
              const heightPerc = (day.dist / maxDist) * 100;
              let barClass = day.dist > 10 ? 'high' : (day.dist > 3 ? 'med' : 'low');
              if(day.dist === 0) barClass = 'low';

              html += `
                <div class="chart-column">
                    <span class="bar-tooltip">${day.dist > 0 ? day.dist.toFixed(1) : ''}</span>
                    <div class="bar-bg"><div class="bar-fill ${barClass}" style="height: ${heightPerc}%"></div></div>
                    <span class="bar-label" style="font-size:${mode==='month'?'8px':'9px'}">${day.label}</span>
                </div>`;
          });
          chartDiv.innerHTML = html;
          if(mode === 'month') {
             const wrapper = document.querySelector('.chart-scroll-wrapper');
             if(wrapper) wrapper.scrollLeft = 0; 
          }
      });
}

