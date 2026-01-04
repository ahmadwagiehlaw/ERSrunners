/* ERS Activities */

// ==================== 5. Activity Log Logic ====================
// ==================== 1. فتح نافذة نشاط جديد (تنظيف كامل) ====================
function openNewRun() {
    // 1. تصفير متغيرات التعديل
    editingRunId = null;
    editingOldDist = 0;

    // 2. تنظيف الحقول النصية
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    document.getElementById('log-type').value = 'Run';
    document.getElementById('log-link').value = '';
    document.getElementById('save-run-btn').innerText = "حفظ النشاط";
    
    // 3. ضبط التاريخ
    const dateInput = document.getElementById('log-date');
    if (dateInput && typeof getLocalInputDate === 'function') dateInput.value = getLocalInputDate();

    // 4. (مهم) تنظيف حقول الصورة لضمان عدم وجود بقايا
    const imgInput = document.getElementById('uploaded-img-url');
    const preview = document.getElementById('img-preview');
    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('log-img-file');

    if (imgInput) imgInput.value = '';
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (status) status.innerText = '';
    if (fileInput) fileInput.value = '';

    // 5. فتح النافذة وتفعيل اللصق
    openLogModal();
    if (typeof enableSmartPaste === 'function') enableSmartPaste();

    // 6) إن كان فتح المودال من زر "نفّذ التمرين" (تمرين الكوتش)
    const coachCtx = window._ersCoachLogCtx || null;
    if (coachCtx) {
        // عنوان المودال
        const h = document.querySelector('#modal-log h3');
        if (h) h.innerText = `${coachCtx.emoji || '📣'} سجل تمرينة الكوتش`;

        // النوع الافتراضي (لو متبعتش، نخليه Run)
        const typeSel = document.getElementById('log-type');
        if (typeSel && coachCtx.suggestedType) typeSel.value = coachCtx.suggestedType;

        // رابط بدء التدريب (لو موجود)
        const linkEl = document.getElementById('log-link');
        if (linkEl && coachCtx.startUrl) linkEl.value = coachCtx.startUrl;

        // لو في تاريخ محدد (اختياري)
        if (dateInput && coachCtx.dateISO) dateInput.value = coachCtx.dateISO;

        // تذكير بالصورة (الإلزام الحقيقي في submitRun)
        if (coachCtx.requireImage) showToast('ارفق صورة إثبات عشان تتحسب تمرينة الكوتش 📸');
    }
}

// ==================== 2. تعديل نشاط موجود (إظهار البيانات) ====================
// لاحظ: قمت بإضافة (img) في الأقواس لاستلام الصورة
window.editRun = function(id, dist, time, type, link, img, xtDist) {
    // 1. وضع بيانات التعديل
    editingRunId = id;
    editingOldDist = dist;
    editingOldType = type || 'Run';

    // 2. تعبئة الحقول
    document.getElementById('log-dist').value = _ersIsCoreType(type) ? dist : (xtDist || '');
    document.getElementById('log-time').value = time;
    document.getElementById('log-type').value = type;
    try{ document.getElementById('log-type').dispatchEvent(new Event('change')); }catch(e){}
    document.getElementById('log-link').value = link || '';
    document.getElementById('save-run-btn').innerText = "تعديل النشاط";

    // 3. معالجة الصورة في التعديل
    const imgInput = document.getElementById('uploaded-img-url');
    const preview = document.getElementById('img-preview');
    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('log-img-file');

    // تنظيف رسائل الحالة والملف القديم
    if(status) status.innerText = '';
    if(fileInput) fileInput.value = '';

    // لو الجرية فيها صورة، نعرضها ونحط الرابط في الحقل المخفي
    if (img && img !== 'undefined' && img !== 'null') {
        if(imgInput) imgInput.value = img;
        if(preview) { 
            preview.src = img; 
            preview.style.display = 'block'; 
        }
    } else {
        // لو مفيش صورة، ننظف الحقول
        if(imgInput) imgInput.value = '';
        if(preview) { preview.src = ''; preview.style.display = 'none'; }
    }

    // 4. فتح النافذة (مرة واحدة فقط)
    openLogModal();
}


// ================================================================= 

async function openChallengeDetails(chId) {
    const modal = document.getElementById('modal-challenge-details');
    const header = document.getElementById('ch-modal-header');
    const list = document.getElementById('ch-leaderboard-list');
    
    if(!modal) return;

    modal.style.display = 'flex';
    // تصفير المحتوى القديم وإظهار اللودر
    header.innerHTML = '<div style="padding:20px; text-align:center; color:#9ca3af;">جاري تحميل التفاصيل...</div>';
    list.innerHTML = '<div class="loader-placeholder">جاري سحب الأبطال...</div>';
    document.getElementById('ch-modal-title').innerText = "التفاصيل";

    try {
        // 1. جلب بيانات التحدي
        const chDoc = await db.collection('challenges').doc(chId).get();
        if (!chDoc.exists) {
            header.innerHTML = "التحدي غير موجود";
            return;
        } 
        const ch = chDoc.data();
        
        document.getElementById('ch-modal-title').innerText = ch.title;
        
        // تجهيز نصوص القواعد
        let rulesText = [];
        if(ch.rules?.requireImg) rulesText.push("📸 صورة مطلوبة");
        if(ch.rules?.minDistPerRun) rulesText.push(`📏 أقل مسافة ${ch.rules.minDistPerRun} كم`);
        if(rulesText.length === 0) rulesText.push("لا توجد شروط خاصة");
        
        // عرض الهيدر (الكارت العلوي)
        header.innerHTML = `
            <div style="font-size:14px; color:#fff; font-weight:bold;">
                ${ch.type === 'speed' ? '⚡ تحدي سرعة' : (ch.type === 'frequency' ? '🗓️ تحدي التزام' : '🛣️ سباق مسافات')}
            </div>
            <div style="font-size:11px; color:#9ca3af; margin-top:5px;">${rulesText.join(" • ")}</div>
            <div style="margin-top:10px; font-size:24px; font-weight:900; color:var(--primary);">
                ${ch.target} <span style="font-size:12px;">${ch.type==='frequency'?'مرة':'كم'}</span>
            </div>
        `;

        // 2. جلب المتصدرين
        const snap = await db.collection('challenges').doc(chId).collection('participants')
            .orderBy('progress', 'desc').limit(50).get();

        let html = '';
        if(snap.empty) { 
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">كن أول المنضمين!</div>'; 
            return; 
        }
        
        snap.forEach((doc, index) => {
            const p = doc.data();
            const rank = index + 1;
            const isMe = (currentUser && doc.id === currentUser.uid);
            
            // تصحيح الأرقام لمنع خطأ NaN
            let safeProgress = Number(p.progress) || 0;
            
            // حساب نسبة التقدم
            let perc = 0;
            if(ch.target > 0) perc = Math.min((safeProgress / ch.target) * 100, 100);
            if(ch.type === 'speed' && p.completed) perc = 100;

            html += `
            <div class="leader-row" style="${isMe ? 'border:1px solid var(--primary); background:rgba(16,185,129,0.05);' : ''}">
                <div class="rank-col" style="color:#fff; font-weight:bold;">#${rank}</div>
                <div class="avatar-col" style="background-image:url('${p.photoUrl||''}'); background-size:cover;">
                    ${p.photoUrl ? '' : (p.name ? p.name[0] : '?')}
                </div>
                <div class="info-col">
                    <div class="name">${p.name} ${isMe?'(أنت)':''} ${p.completed?'✅':''}</div>
                    <div class="mini-xp-track" style="margin-top:5px; height:4px; background:rgba(255,255,255,0.1);">
                        <div class="mini-xp-fill" style="width:${perc}%; background:var(--accent);"></div>
                    </div>
                </div>
                <div class="dist-col" style="font-size:12px;">
                    ${safeProgress.toFixed(1)} <span style="font-size:9px; color:#6b7280;">${ch.type==='frequency'?'مرة':'كم'}</span>
                </div>
            </div>`;
        });
        
        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div style="text-align:center; color:#ef4444;">حدث خطأ في تحميل البيانات</div>';
    }
}





// تحديث إحصائيات شاشة الترحيب من نفس بيانات الـ runs (بدون الاعتماد على challenges.js)
function _ersUpdateCoachHeroStatsFromRuns(runs) {
    const weekEl = document.getElementById('hero-week-dist');
    const monthEl = document.getElementById('hero-month-dist');
    const streakEl = document.getElementById('hero-streak');

    // لو كارت الترحيب مش موجود في الصفحة الحالية، نخرج بهدوء
    if (!weekEl) return;

    const toNum = (v) => {
        const n = (typeof v === 'number') ? v : parseFloat(v);
        return Number.isFinite(n) ? n : 0;
    };

    const toDateSafe = (ts, fallback) => {
        try {
            if (!ts) return fallback || null;
            if (typeof ts.toDate === 'function') return ts.toDate(); // Firestore Timestamp
            if (ts instanceof Date) return ts;                       // JS Date
            const d = new Date(ts);                                  // string/number
            return isNaN(d.getTime()) ? (fallback || null) : d;
        } catch (e) {
            return fallback || null;
        }
    };

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    const safeRuns = Array.isArray(runs) ? runs : [];
    const weekDist = safeRuns.reduce((sum, r) => {
        const d = toDateSafe(r?.timestamp, toDateSafe(r?.date, null));
        if (!d) return sum;
        if (d >= oneWeekAgo) return sum + toNum(r?.dist);
        return sum;
    }, 0);

    weekEl.innerText = weekDist.toFixed(1);

    if (monthEl) monthEl.innerText = toNum(userData?.monthDist).toFixed(1);
    if (streakEl) streakEl.innerText = (parseInt(userData?.currentStreak, 10) || 0);
}

// ==================== 6. سجل الأنشطة (تصميم كروت احترافي V3.0) ====================
// ==================== 6. سجل الأنشطة (New Badge Logic) ====================
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;

    // جلب البيانات
    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
          
if(snap.empty) { 
  list.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:#6b7280;">
      ...
    </div>`; 
try { window._ersRunsCache = []; } catch(e) {}

// تحديث كارت الترحيب مباشرة
try { _ersUpdateCoachHeroStatsFromRuns([]); } catch(e) {}

try { if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI([]); } catch(e) {}
return;
}

          const runs = []; 
          
          // 1. استخراج البيانات وحساب الأرقام القياسية
          let maxDist = 0;
          let maxTime = 0;
          let bestPace = 999; // رقم كبير مبدئياً

          snap.forEach(doc => {
              const r = doc.data(); 
              r.id = doc.id;
              runs.push(r); // إضافة الجرية للمصفوفة

              // حساب الأرقام القياسية
              if (r.dist > maxDist) maxDist = r.dist;
              if (r.time > maxTime) maxTime = r.time;
              
              // حساب أفضل بيس (بشرط المسافة > 1 كم لتجنب أخطاء الـ GPS)
              if (r.dist >= 1 && r.time > 0) {
                  const p = r.time / r.dist;
                  if (p < bestPace) bestPace = p;
              }
          });

          // Cache for Coach V2 decision engine
window._ersRunsCache = runs;
if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI(runs);

// تحديث كارت الترحيب مباشرة (الأسبوع/الشهر/الستريك)
try { _ersUpdateCoachHeroStatsFromRuns(runs); } catch(e) {}

// Notify other modules that runs cache is ready/updated
try {
  window.dispatchEvent(new CustomEvent('ers:runs-updated', { detail: { count: runs.length } }));
} catch(e) {}

          // 2. تجميع حسب الشهر
          const groups = {};
          runs.forEach(r => {
              const date = r.timestamp ? r.timestamp.toDate() : new Date();
              const monthKey = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if(!groups[monthKey]) groups[monthKey] = [];
              groups[monthKey].push(r);
          });

          let html = '';

          // 3. عرض البيانات (لوب الشهور)
          for (const [month, monthRuns] of Object.entries(groups)) {
              const monthTotal = monthRuns.reduce((acc, curr) => acc + (parseFloat(curr.dist)||0), 0).toFixed(1);

              html += `
              <div class="log-group">
                  <div class="log-month-header">
                      <span>${month}</span>
                      <span style="font-size:10px; opacity:0.8;">إجمالي: ${monthTotal} كم</span>
                  </div>
              `;

              // 4. عرض الجريات داخل الشهر
              monthRuns.forEach(r => {
                  const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                  const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
                  const dayNum = dateObj.getDate();
                  
                  // حساب البيس الحالي
                  let currentPace = 0;
                  if(r.dist > 0 && r.time > 0) currentPace = r.time / r.dist;
                  const paceDisplay = currentPace > 0 ? currentPace.toFixed(1) : '-';

                  // 🔥 تحديد نوع الإنجاز والألوان
                  let iconClass = r.type !== 'Walk' ? 'ri-run-line' : 'ri-walk-line';
                  let typeClass = r.type !== 'Walk' ? 'run' : 'walk';
                  let recordLabel = ''; 

                  // أ) هل هي الأطول مسافة؟ (الذهبي)
                  if (_ersIsCoreType(r.type) && r.dist === maxDist && maxDist > 5) {
                      iconClass = 'ri-trophy-fill';
                      typeClass = 'record-gold';
                      recordLabel = '<span style="font-size:9px; color:#f59e0b; margin-right:5px;">(الأطول)</span>';
                  } 
                  // ب) هل هي الأسرع؟ (الأحمر) - بشرط تكون جري وليست مشي
                  else if (_ersIsCoreType(r.type) && currentPace === bestPace && r.dist >= 1 && r.type === 'Run') {
                      iconClass = 'ri-flashlight-fill'; 
                      typeClass = 'record-fire';
                      recordLabel = '<span style="font-size:9px; color:#ef4444; margin-right:5px;">(الأسرع)</span>';
                  }
                  // ج) هل هي الأطول زمناً؟ (البنفسجي)
                  else if (_ersIsCoreType(r.type) && r.time === maxTime && maxTime > 30) {
                      iconClass = 'ri-hourglass-fill';
                      typeClass = 'record-time';
                      recordLabel = '<span style="font-size:9px; color:#a78bfa; margin-right:5px;">(تحمل)</span>';
                  }
const coachBadge = r.coachWorkout
  ? '<span class="badge-coach-run"><i class="ri-whistle-line"></i> تمرين الكوتش</span>'
  : '';



                  html += `
                  <div class="log-row-compact">
                      <div class="log-icon-wrapper ${typeClass}">
                          <i class="${iconClass}"></i>
                      </div>

                      <div class="log-details">
                          <div class="log-main-stat">
                              ${(_ersIsCoreType(r.type) ? `${formatNumber(r.dist)} <span class="log-unit">كم</span> ${recordLabel}` : `<span class="xt-badge">XT</span> <span class="log-unit">${r.type || 'Cross'}</span>`)}
                          </div>
                          <div class="log-sub-stat">
                              <span><i class="ri-calendar-line"></i> ${dayNum} ${dayName}</span>
                              ${(_ersIsCoreType(r.type) ? `<span><i class="ri-timer-flash-line"></i> ${paceDisplay} د/كم</span>` : `<span><i class="ri-time-line"></i> ${r.time || 0} دقيقة</span>`)}
                          </div>
                      </div>

                      <div class="log-actions">
                          <button class="btn-icon-action share" onclick="generateShareCard('${r.dist}', '${r.time}', '${dayNum} ${month}')">
                              <i class="ri-share-forward-line"></i>
                          </button>
                          
                          <button class="btn-icon-action" onclick="editRun('${r.id}', ${r.dist}, ${r.time}, '${r.type}', '${r.link || ''}', '${r.img || ''}', ${r.xtDist || 0})">
                              <i class="ri-pencil-line"></i>
                          </button>
                          
                          <button class="btn-icon-action delete" onclick="deleteRun('${r.id}', ${r.dist})">
                              <i class="ri-delete-bin-line"></i>
                          </button>
                      </div>
                  </div>`;
              });

              html += `</div>`; // إغلاق ديف الشهر
          }

          list.innerHTML = html;
      });
}
async function deleteRun(id, dist) {
    dist = parseFloat(dist);
    if(!confirm("هل أنت متأكد من الحذف؟")) return;
    
    try {
        const uid = currentUser.uid;
        const runDoc = await db.collection('users').doc(uid).collection('runs').doc(id).get();
        if (!runDoc.exists) return; 
        const runData = runDoc.data();

        await db.collection('users').doc(uid).collection('runs').doc(id).delete();
        await db.collection('users').doc(uid).update({
            totalDist: firebase.firestore.FieldValue.increment(-dist),
            totalRuns: firebase.firestore.FieldValue.increment(-(_ersIsCoreType(runData.type) ? 1 : 0)),
            monthDist: firebase.firestore.FieldValue.increment(-dist)
        });

        if (runData.timestamp) {
            const feedQuery = await db.collection('activity_feed')
                .where('uid', '==', uid).where('timestamp', '==', runData.timestamp).get();
            const batch = db.batch();
            feedQuery.forEach(doc => batch.delete(doc.ref));
            await batch.commit(); 
        }

        userData.totalDist = Math.max(0, (userData.totalDist || 0) - dist);
        userData.totalRuns = Math.max(0, (userData.totalRuns || 0) - 1);
        userData.monthDist = Math.max(0, (userData.monthDist || 0) - dist);

        allUsersCache = [];
        updateUI();
        loadActivityLog(); 
        loadGlobalFeed();
        showToast("تم الحذف 🗑️", "success");
    } catch (error) { showToast("فشل الحذف", "error"); }
}



/* ImgBB Upload Logic */
// ==================== 13. ImgBB Upload Logic (V1.6) ====================
async function uploadImageToImgBB() {
    const fileInput = document.getElementById('log-img-file');
    const status = document.getElementById('upload-status');
    const preview = document.getElementById('img-preview');
    const hiddenInput = document.getElementById('uploaded-img-url');
    const saveBtn = document.getElementById('save-run-btn');

    // 1. التأكد من وجود ملف
    if (!fileInput.files || fileInput.files.length === 0) return;
    const file = fileInput.files[0];

    // 2. تحديث الواجهة (جاري الرفع)
    status.innerText = "جاري رفع الصورة... ⏳";
    status.style.color = "#f59e0b"; 
    saveBtn.disabled = true; // تعطيل الزر مؤقتاً
    saveBtn.innerText = "جاري الرفع...";
    saveBtn.style.opacity = "0.5";

    // 3. تجهيز البيانات
    const formData = new FormData();
    formData.append("image", file);
    const API_KEY = "0d0b1fefa53eb2fc054b27c6395af35c"; 

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // نجح الرفع
            const imageUrl = data.data.url;
            hiddenInput.value = imageUrl; 
            
            preview.src = imageUrl;
            preview.style.display = 'block';
            
            status.innerText = "تم إرفاق الصورة بنجاح ✅";
            status.style.color = "#10b981"; 
        } else {
            throw new Error("فشل من المصدر");
        }

    } catch (error) {
        console.error("Upload Error:", error);
        status.innerText = "فشل الرفع! حاول مرة أخرى ❌";
        status.style.color = "#ef4444";
        // تنظيف الحقل المخفي في حالة الفشل
        hiddenInput.value = ""; 
    } finally {
        // 🔥 أهم خطوة: إعادة تفعيل الزر في كل الأحوال (نجح أو فشل)
        saveBtn.disabled = false;
        saveBtn.innerText = "حفظ النشاط";
        saveBtn.style.opacity = "1";
    }
}

// ==================== V6.0 Streak Logic ====================

function updateStreakLogic(newRunDate) {
    const lastRunStr = userData.lastRunDate || "";
    const todayStr = newRunDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    let currentStreak = userData.currentStreak || 0;

    // 1. إذا كان أول مرة يجري
    if (!lastRunStr) {
        return { streak: 1, lastDate: todayStr };
    }

    // 2. إذا كان جرى اليوم بالفعل (لا نزيد العداد)
    if (lastRunStr === todayStr) {
        return { streak: currentStreak, lastDate: todayStr };
    }

    // 3. حساب الفرق بالأيام
    const lastDate = new Date(lastRunStr);
    const newDate = new Date(todayStr);
    const diffTime = Math.abs(newDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        // جرى بالأمس -> سلسلة متصلة 🔥
        return { streak: currentStreak + 1, lastDate: todayStr };
    } else {
        // فاته يوم أو أكثر -> ابدأ من جديد 😢
        return { streak: 1, lastDate: todayStr };
    }
}


