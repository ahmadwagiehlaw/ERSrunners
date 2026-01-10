/* ERS Activities */

// ==================== 5. Activity Log Logic ====================
// ==================== 1. فتح نافذة نشاط جديد (تنظيف كامل) ====================
// ==================== 1. فتح نافذة نشاط جديد (تنظيف كامل) ====================
// ==================== Unified GPS & Manual Log Logic ====================

// 1. فتح المودال (النسخة المطورة)
function openNewRun() {
    editingRunId = null;
    editingOldDist = 0;
    
    // تنظيف الحقول (تأكدنا أن الـ IDs مطابقة للـ HTML الجديد)
    document.getElementById('log-dist').value = '';
    document.getElementById('log-time').value = '';
    
    // ضبط التاريخ الافتراضي
    const dateInput = document.getElementById('log-date');
    if (dateInput && typeof getLocalInputDate === 'function') dateInput.value = getLocalInputDate();


// يوضع داخل openNewRun()
document.getElementById('log-date').value = new Date().toISOString().split('T')[0];

// تعديل دالة المزامنة لتقبل (عدد الأنشطة)
async function syncFromStrava(count = 30) {
    // الكود الذي كتبناه سابقاً مع تمرير count لـ per_page
    // وتأكد من جلب act.type === 'VirtualRun' للتريدميل
}



    openModal('modal-log');
}



async function toggleGPSLog() {
    const btn = document.getElementById('btn-start-gps');
    
    if (!gpsWatchId) {
        // Start
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
        
        gpsStartTime = new Date();
        gpsPath = [];
        gpsCurrentDist = 0;
        
        gpsWatchId = navigator.geolocation.watchPosition(updateGPSPosition, console.error, {
            enableHighAccuracy: true, maximumAge: 0
        });
        
        gpsTimerInterval = setInterval(updateGPSTimeUI, 1000);
        
        btn.innerHTML = 'إيقاف مؤقت <i class="ri-pause-fill"></i>';
        document.getElementById('btn-finish-gps').style.display = 'block';
        
    } else {
        // Pause (Just stop updating, don't finish)
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
        clearInterval(gpsTimerInterval);
        
        btn.innerHTML = 'استئناف <i class="ri-play-fill"></i>';
    }
}

function updateGPSPosition(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;
    
    if(accuracy > 30) return; // تصفية الدقة الضعيفة

    const point = [lat, lng];
    
    if (gpsPath.length > 0) {
        const last = gpsPath[gpsPath.length-1];
        const d = calcCrow(last[0], last[1], lat, lng);
        if(d > 0.001 && d < 0.1) {
            gpsCurrentDist += d;
            gpsPath.push(point);
        }
    } else {
        gpsPath.push(point);
    }
    
    // Update UI
    document.getElementById('live-gps-dist').innerText = gpsCurrentDist.toFixed(2);
    
    // Draw
    if(!polylineInstance) polylineInstance = L.polyline(gpsPath, {color:'#3b82f6', weight:5}).addTo(mapInstance);
    else polylineInstance.setLatLngs(gpsPath);
    
    mapInstance.setView(point);
}

function updateGPSTimeUI() {
    if(!gpsStartTime) return;
    const now = new Date();
    const diff = Math.floor((now - gpsStartTime)/1000);
    const m = Math.floor(diff/60);
    const s = diff % 60;
    document.getElementById('live-gps-time').innerText = 
        `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// 4. إنهاء الـ GPS ونقل البيانات للفورم اليدوي
function finishGPSLog() {
    // إيقاف التتبع
    if(gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    if(gpsTimerInterval) clearInterval(gpsTimerInterval);
    if(wakeLock) wakeLock.release();

    if (gpsCurrentDist < 0.01) {
        showToast("مسافة قصيرة جداً!", "error");
        return;
    }

    // نقل البيانات للحقول اليدوية
    document.getElementById('log-dist').value = gpsCurrentDist.toFixed(2);
    
    const totalSeconds = (new Date() - gpsStartTime) / 1000;
    document.getElementById('log-time').value = Math.floor(totalSeconds / 60);

    // التحويل للتبويب اليدوي
    showToast("تم تسجيل المسافة ✅.. أكمل البيانات", "success");
    switchLogTab('manual');
    
    // إعادة تعيين أزرار الـ GPS للمرة القادمة
    document.getElementById('btn-start-gps').innerHTML = 'ابدأ <i class="ri-play-fill"></i>';
    document.getElementById('btn-finish-gps').style.display = 'none';
    document.getElementById('live-gps-dist').innerText = "0.00";
    document.getElementById('live-gps-time').innerText = "00:00";
    if(polylineInstance) polylineInstance.setLatLngs([]);
}

// (Helper: Haversine - تأكد من وجودها أو أضفها مرة واحدة في activities.js أو utils.js)
function calcCrow(lat1, lon1, lat2, lon2) {
  var R = 6371; 
  var dLat = (lat2-lat1) * Math.PI / 180;
  var dLon = (lon2-lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
// ==================== 2. تعديل نشاط موجود (إظهار البيانات) ====================
// لاحظ: قمت بإضافة (img) في الأقواس لاستلام الصورة
window.editRun = function(id, dist, time, type, link, img) {
    // 1. وضع بيانات التعديل
    editingRunId = id;
    editingOldDist = dist;
    editingOldType = type || 'Run';

    // 2. تعبئة الحقول
document.getElementById('log-dist').value = dist;
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

// 4. فتح النافذة (التصحيح: استخدام اسم المودال الصحيح)
    openModal('modal-log'); // ✅ الدالة الصحيحة
}; // إغلاق الدالة بشكل سليم

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



// ==================== وظيفة التعديل الذكية (Smart Edit) ====================
window.prepareEditRun = function(runId) {
    // 1. البحث عن النشاط في الذاكرة
    const run = (window._ersRunsCache || []).find(r => r.id === runId);
    
    if (!run) {
        // محاولة طوارئ: لو الكاش مش جاهز، نجيب البيانات من HTML لو أمكن (أو نكتفي بالتنبيه)
        alert("بيانات النشاط غير محملة، حاول تحديث الصفحة.");
        return;
    }

    // 2. تحديث المتغيرات العامة للتعديل
    editingRunId = runId;
    editingOldDist = run.dist || 0;
    editingOldType = run.type || 'Run';

    // 3. ملء حقول المودال
    const distInput = document.getElementById('log-dist');
    const timeInput = document.getElementById('log-time');
    const typeInput = document.getElementById('log-type');
    const dateInput = document.getElementById('log-date');
    const imgInput = document.getElementById('uploaded-img-url');
    const preview = document.getElementById('img-preview');
    const saveBtn = document.getElementById('save-run-btn');
    const modalTitle = document.querySelector('#modal-log h3'); // عنوان المودال

    if (distInput) distInput.value = run.dist;
    if (timeInput) timeInput.value = run.time;
    
    if (typeInput) {
        typeInput.value = run.type || 'Run';
        // تفعيل حدث التغيير لضبط الحقول (جري/تمرين)
        try { typeInput.dispatchEvent(new Event('change')); } catch(e){}
    }

    // ضبط التاريخ (معالجة صيغ التاريخ المختلفة)
    if (dateInput) {
        let dateStr = '';
        if (run.dateStr) dateStr = run.dateStr;
        else if (run.timestamp && run.timestamp.toDate) dateStr = run.timestamp.toDate().toISOString().split('T')[0];
        else if (run.date) dateStr = new Date(run.date).toISOString().split('T')[0];
        
        dateInput.value = dateStr;
    }

    // معالجة الصورة
    const imgUrl = run.img || run.imgUrl;
    if (imgInput) imgInput.value = imgUrl || '';
    if (preview) {
        if (imgUrl) {
            preview.src = imgUrl;
            preview.style.display = 'block';
        } else {
            preview.src = '';
            preview.style.display = 'none';
        }
    }

    // 4. تغيير نصوص الزر والعنوان
    if (saveBtn) saveBtn.innerText = "حفظ التعديلات";
    if (modalTitle) modalTitle.innerText = "تعديل النشاط ✏️";

    // 5. فتح المودال
    if (typeof openModal === 'function') {
        openModal('modal-log');
    } else {
        // Fallback لو دالة openModal مش موجودة
        const modal = document.getElementById('modal-log');
        if (modal) modal.style.display = 'flex';
    }
};
// ==================== 6. سجل الأنشطة (تصميم كروت احترافي V3.0) ====================
// ==================== 6. سجل الأنشطة (New Badge Logic) ====================
function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if(!list) return;

    db.collection('users').doc(currentUser.uid).collection('runs')
      .orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {
          
          if(snap.empty) { 
              list.innerHTML = `<div class="no-data">لا توجد أنشطة مسجلة بعد.</div>`; 
              return; 
          }

          const runs = []; 
          let maxDist = 0, maxTime = 0, bestPace = 999;

          // 1. استخراج البيانات وحساب الأرقام القياسية بدقة (لحماية الإحصائيات)
          snap.forEach(doc => {
              const r = doc.data(); r.id = doc.id;
              runs.push(r);
              if (!_ersIsCoreType(r.type)) {
                  if (r.dist > maxDist) maxDist = r.dist;
                  if (r.time > maxTime) maxTime = r.time;
                  if (r.dist >= 1 && r.time > 0) {
                      const p = r.time / r.dist;
                      if (p < bestPace) bestPace = p;
                  }
              }
          });

          // ✅ تحديث الكاش العالمي (مهم جداً للتحديات والكوتش)
          window._ersRunsCache = runs; 
          if (typeof updateHeroWeekDist === 'function') updateHeroWeekDist();
          if (typeof updateUI === 'function') updateUI();
          if (typeof updateCoachDecisionUI === 'function') updateCoachDecisionUI(runs);

          // 2. تجميع حسب الشهر للعرض البصري
          const groups = {};
          runs.forEach(r => {
              const date = r.timestamp ? r.timestamp.toDate() : new Date();
              const monthKey = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
              if(!groups[monthKey]) groups[monthKey] = [];
              groups[monthKey].push(r);
          });

          let html = '';
          for (const [month, monthRuns] of Object.entries(groups)) {
              const monthTotal = monthRuns.reduce((acc, curr) => acc + (parseFloat(curr.dist)||0), 0).toFixed(1);

              html += `
              <div class="log-group" style="margin-bottom:15px;">
                  <div class="log-month-header" style="display:flex; justify-content:space-between; padding:8px 10px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:10px; font-size:12px;">
                      <span style="color:var(--primary); font-weight:bold;">${month}</span>
                      <span style="color:var(--text-muted);">إجمالي: ${monthTotal} كم</span>
                  </div>`;

              // 3. عرض الجريات (الشكل الجديد المطور)
              monthRuns.forEach(r => {
                  const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                  const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'short' });
                  const dayNum = dateObj.getDate();
                  const pace = (r.dist > 0 && r.time > 0) ? (r.time / r.dist).toFixed(2) : '-';
                  const isWalk = String(r.type).toLowerCase().includes('walk');
                  
                  // تمييز الألوان والأيقونات
                  const themeColor = isWalk ? '#3b82f6' : 'var(--primary)'; 
                  // 1. التحقق هل الجرية من سترافا؟
                  const isStrava = (r.source === 'Strava' || r.stravaId);

                  // 2. تحديد الأيقونة: لو سترافا نعرض اللوجو، لو عادي نعرض أيقونة الجري/المشي
                  let iconHtml = '';
                  if (isStrava) {
                      // أيقونة سترافا SVG
                      iconHtml = `<svg class="icon-strava-brand" viewBox="0 0 24 24"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>`;
                  } else {
                      // الأيقونة العادية
                      const iconClass = isWalk ? 'ri-walk-line' : 'ri-run-line';
                      iconHtml = `<i class="${iconClass}"></i>`;
                  }

                  const hasMap = r.polyline ? `<i class="ri-map-2-line" style="color:var(--primary)"></i>` : '';
                  const hasImg = (r.img || r.imgUrl) ? `<i class="ri-image-line" style="color:var(--accent)"></i>` : '';
                  
                  // كلاس إضافي لتمييز الخلفية قليلاً (اختياري)
                  const extraClass = isStrava ? 'strava-bg-hint' : '';

                  html += `
                  <div class="log-item ${extraClass}" onclick="openRunDetail('${r.id}')" style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; margin-bottom:8px; border-right:3px solid ${isStrava ? '#FC4C02' : themeColor}; cursor:pointer; position:relative;">
                      
                      <div style="display:flex; flex-direction:column; align-items:center; min-width:40px; text-align:center;">
                          <span style="font-size:10px; color:var(--text-muted);">${dayName}</span>
                          <span style="font-size:16px; font-weight:bold; color:#e5e7eb;">${dayNum}</span>
                      </div>
                  
                      <div style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:${themeColor}; font-size:18px;">
                          ${iconHtml}
                      </div>
                  
                      <div style="flex:1;">
                          <div style="font-size:14px; color:#fff; font-weight:bold; display:flex; align-items:center; gap:6px;">
                              ${r.dist} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">كم</span>
                              ${isStrava ? '<span style="font-size:9px; background:#FC4C02; color:#fff; padding:1px 4px; border-radius:4px;">Strava</span>' : ''}
                          </div>
                          <div style="font-size:11px; color:var(--text-muted);">
                              ${pace} د/كم • ${r.time} دقيقة ${hasMap} ${hasImg}
                          </div>
                      </div>
                  
                      <div style="display:flex; gap:8px;" onclick="event.stopPropagation();">
                          <button onclick="window.prepareEditRun('${r.id}')" style="background:none; border:none; color:#9ca3af; cursor:pointer; padding:4px;">
                              <i class="ri-pencil-line"></i>
                          </button>
                          <button onclick="deleteRun('${r.id}', '${r.dist}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px;">
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
// ==================== 7. حذف نشاط ====================
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


window.renderActivityLog = renderActivityLog;





// ==================== submit run نسخة معدلة ومسحت اللي في ملف ui لان دا المكان الصح====================
async function submitRun() {
    if (!navigator.onLine) return showToast("لا يوجد اتصال بالإنترنت ⚠️", "error");

    const btn = document.getElementById('save-run-btn');
    const dist = parseFloat(document.getElementById('log-dist').value);
    const time = parseFloat(document.getElementById('log-time').value);
    const type = document.getElementById('log-type').value;
    const dateInput = document.getElementById('log-date').value;
    const imgUrlInput = document.getElementById('uploaded-img-url');

    if (!dist || dist <= 0 || !time || time <= 0) return showToast("المسافة أو الوقت غير صحيح", "error");

    const selectedDate = new Date(dateInput);
    const now = new Date();
    if (selectedDate > now) return showToast("لا يمكنك تسجيل نشاط في المستقبل! 🚀", "error");

    if (btn) { btn.innerText = "جاري الحفظ..."; btn.disabled = true; }

    try {
        const uid = currentUser.uid;
        const timestamp = firebase.firestore.Timestamp.fromDate(selectedDate);
        const isRun = (type === 'Run');

        const runData = {
            dist, time, type, timestamp,
            img: imgUrlInput?.value || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingRunId) {
            await db.collection('users').doc(uid).collection('runs').doc(editingRunId).update(runData);
            if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
                const distDiff = dist - editingOldDist;
                await db.collection('users').doc(uid).update({
                    monthDist: firebase.firestore.FieldValue.increment(isRun ? distDiff : 0)
                });
            }
        } else {
            await db.collection('users').doc(uid).collection('runs').add(runData);
            await db.collection('activity_feed').add({
                uid, userName: userData.name, userRegion: userData.region,
                ...runData, likes: []
            });

            let updateFields = {
                totalDist: firebase.firestore.FieldValue.increment(isRun ? dist : 0),
                totalRuns: firebase.firestore.FieldValue.increment(isRun ? 1 : 0)
            };

            if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
                updateFields.monthDist = firebase.firestore.FieldValue.increment(isRun ? dist : 0);
                updateFields.lastRunDate = timestamp;
            }

            await db.collection('users').doc(uid).set(updateFields, { merge: true });
        }

showToast("تم حفظ النشاط بنجاح ✅", "success");
        closeModal('modal-log');
        
        // تحديث الكاش وإعادة الحساب فوراً لكل أجزاء التطبيق
        await loadActivityLog(); 
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateHeroWeekDist === 'function') updateHeroWeekDist(); // 🔥 إضافة لضمان تحديث عداد الأسبوع
        if (typeof loadActiveChallenges === 'function') loadActiveChallenges();

    } catch (e) {
        console.error(e);
        showToast("خطأ في الحفظ: " + e.message, "error");
    } finally {
        if (btn) { btn.innerText = "حفظ النشاط"; btn.disabled = false; }
    } }   

async function checkNewBadges() {
    if (!currentUser || !userData) return;
    
    const myBadges = userData.badges || [];
    let newBadgesEarned = [];
    const totalDist = userData.totalDist || 0;
    const allRuns = window._ersRunsCache || [];

    // --- منطق فحص المسافات التراكمية ---
    if (!myBadges.includes('dist_50k') && totalDist >= 50) newBadgesEarned.push('dist_50k');
    if (!myBadges.includes('dist_100k') && totalDist >= 100) newBadgesEarned.push('dist_100k');
    if (!myBadges.includes('dist_500k') && totalDist >= 500) newBadgesEarned.push('dist_500k');
    if (!myBadges.includes('dist_1000k') && totalDist >= 1000) newBadgesEarned.push('dist_1000k');

    // --- منطق فحص الأرقام القياسية في الجرية الواحدة ---
    allRuns.forEach(run => {
        const d = parseFloat(run.dist) || 0;
        const p = run.time ? (run.time / run.dist) : 99;

        if (!myBadges.includes('dist_half_marathon') && d >= 21) newBadgesEarned.push('dist_half_marathon');
        if (!myBadges.includes('dist_marathon') && d >= 42) newBadgesEarned.push('dist_marathon');
        if (!myBadges.includes('speed_flash') && p < 4.0) newBadgesEarned.push('speed_flash');
    });

    // --- تحديث قاعدة البيانات لو فيه جديد ---
    if (newBadgesEarned.length > 0) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                badges: firebase.firestore.FieldValue.arrayUnion(...newBadgesEarned)
            });
            userData.badges = [...myBadges, ...newBadgesEarned];
            renderBadges(); // تحديث العرض فوراً
            showToast(`🎉 مبروك! حصلت على أوسمة جديدة: ${newBadgesEarned.length}`, "success");
        } catch (e) { console.error("Badges Error:", e); }
    }
}


// ==================== 14. مزامنة استرافا (V6.0) ====================
async function syncFromStrava(count = 1) {
    const btn = document.getElementById('strava-sync-btn');
    const originalText = btn.innerText;
    btn.innerText = "جاري الاتصال بـ Strava...";
    btn.disabled = true;

    try {
        const refreshToken = userData.stravaRefreshToken || (window.STRAVA_CONFIG ? window.STRAVA_CONFIG.REFRESH_TOKEN : null);
        if (!refreshToken) throw new Error("لم يتم ربط الحساب");

        const { CLIENT_ID, CLIENT_SECRET } = window.STRAVA_CONFIG;

        // 1. تجديد التصريح (Access Token)
        const authData = await (await fetch(`https://www.strava.com/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' })
        })).json();

        // 2. جلب الأنشطة (توسيع الفلتر ليشمل المشي والتريدميل)
        const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${count}`, {
            headers: { 'Authorization': `Bearer ${authData.access_token}` }
        });
        const activities = await response.json();

        let imported = [];
        for (const act of activities) {
            const isDuplicate = (window._ersRunsCache || []).some(r => r.stravaId === act.id);
            // قبول الجري، المشي، والتمارين الداخلية (VirtualRun)
            const validTypes = ['Run', 'Walk', 'VirtualRun', 'Hike'];
            
            if (!isDuplicate && validTypes.includes(act.type)) {
                const runData = {
                    dist: parseFloat((act.distance / 1000).toFixed(2)),
                    time: Math.round(act.moving_time / 60),
                    type: act.type === 'VirtualRun' ? 'Treadmill' : act.type,
                    dateStr: act.start_date.split('T')[0],
                    timestamp: firebase.firestore.Timestamp.fromDate(new Date(act.start_date)),
                    stravaId: act.id,
                    source: "Strava",
                    polyline: act.map ? act.map.summary_polyline : null
                };
                const docRef = await db.collection('users').doc(currentUser.uid).collection('runs').add(runData);
                imported.push({ id: docRef.id, ...runData });
            }
        }

        if (imported.length > 0) {
            await loadActivityLog(); 
            updateUI();
            closeModal('modal-log');
            // فتح تفاصيل أول تمرين تم استيراده فوراً
            if (typeof showFeedbackModal === 'function') showFeedbackModal(imported[0]);
            showToast(`نجاح! تم استيراد ${imported.length} نشاط 🏆`, "success");
        } else {
            showToast("لا توجد أنشطة جديدة لمزامنتها حالياً", "info");
        }
    } catch (e) {
        console.error("Sync Error:", e);
        showToast("خطأ في الاتصال بالسيرفر. تأكد من ربط حسابك.", "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}


// ==================== 15. تحسينات واجهة المستخدم ====================
// =======================1. دالة رفع الصور لـ ImgBB
async function uploadToImgBB(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('upload-status');
    status.innerText = "جاري الرفع... ⏳";
    
    const formData = new FormData();
    formData.append("image", file);
    
    try {
        const res = await fetch("https://api.imgbb.com/1/upload?key=YOUR_API_KEY", { // ضع مفتاحك هنا
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('uploaded-img-url').value = data.data.url;
            status.innerText = "✅ تم الرفع بنجاح";
        }
    } catch (e) { status.innerText = "❌ فشل الرفع"; }
}



// =================. دالة فتح التفاصيل عند الضغط على الكارت
function openRunDetail(runId) {
    const run = (window._ersRunsCache || []).find(r => r.id === runId);
    if (!run) return;

    // ملء البيانات الأساسية
    document.getElementById('detail-type').innerText = run.type === 'Treadmill' ? 'تمرين تريدميل 🏃‍♀️' : 'نشاط جري 🏃‍♂️';
    document.getElementById('detail-dist').innerText = run.dist;
    document.getElementById('detail-time').innerText = run.time;
    document.getElementById('detail-date').innerText = run.dateStr;
    
    const pace = run.dist > 0 ? (run.time / run.dist).toFixed(2) : '0.00';
    document.getElementById('detail-pace').innerText = pace;

    const mapEl = document.getElementById('detail-map');
    const imgEl = document.getElementById('detail-img');
    
    // إخفاء الكل أولاً
    mapEl.style.display = 'none';
    imgEl.style.display = 'none';

    // 1. لو جاية من سترافا وفيها خريطة
    if (run.polyline) {
        mapEl.style.display = 'block';
        setTimeout(() => {
            // تنظيف الخريطة القديمة لو موجودة
            if (window._detailMap) { window._detailMap.remove(); }
            window._detailMap = L.map('detail-map', { zoomControl: false }).setView([0, 0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window._detailMap);
            const coords = L.Polyline.fromEncoded(run.polyline).getLatLngs();
            const poly = L.polyline(coords, { color: '#10b981', weight: 4 }).addTo(window._detailMap);
            window._detailMap.fitBounds(poly.getBounds());
        }, 300);
    } 
    // 2. لو إدخال يدوي وفيها صورة مرفوعة
    else if (run.imgUrl) {
        imgEl.src = run.imgUrl;
        imgEl.style.display = 'block';
    }

    openModal('modal-run-detail');
}



// ====3. كود Javascript (للتحكم في عرض الصورة - ضعه في ملف activities.js أو في النهاية)
function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            // إظهار الصورة وإخفاء النص
            const previewBox = document.getElementById('preview-image-box');
            const placeholder = document.getElementById('upload-placeholder');
            const dropZone = document.getElementById('drop-zone');
            const removeBtn = document.getElementById('remove-img-btn');

            previewBox.src = e.target.result;
            previewBox.style.display = 'block';
            placeholder.style.display = 'none';
            dropZone.classList.add('has-image');
            removeBtn.style.display = 'flex';
        }

        reader.readAsDataURL(file);
        
        // استدعاء دالة الرفع الأصلية الخاصة بك
        if(typeof uploadToImgBB === 'function') {
            uploadToImgBB(input);
        }
    }
}

function removeImage() {
    const input = document.getElementById('log-file');
    const previewBox = document.getElementById('preview-image-box');
    const placeholder = document.getElementById('upload-placeholder');
    const dropZone = document.getElementById('drop-zone');
    const removeBtn = document.getElementById('remove-img-btn');
    const hiddenUrl = document.getElementById('uploaded-img-url');
    const status = document.getElementById('upload-status');

    input.value = ''; // تصفير الملف
    hiddenUrl.value = ''; // تصفير الرابط
    
    previewBox.src = '';
    previewBox.style.display = 'none';
    placeholder.style.display = 'block';
    dropZone.classList.remove('has-image');
    removeBtn.style.display = 'none';
    
    if(status) status.innerHTML = '';
}




/* ==================== 🕵️‍♂️ Anti-Duplication Engine دالة منع تكرار الجريات==================== */

function isDuplicateRun(newRun, existingRuns) {
    // 1. لو الجرية جاية بـ ID من سترافا، نتأكد إنه مش موجود قبل كدا
    if (newRun.stravaId) {
        const exactMatch = existingRuns.find(r => r.stravaId === newRun.stravaId);
        if (exactMatch) return true; // مكررة بنسبة 100% (نفس المصدر)
    }

    // 2. الفحص الذكي (Fuzzy Logic) للجريات اليدوية أو المتشابهة
    // بنقارن: التاريخ + النوع + (المسافة بتقريب)
    
    // تحويل تواريخ المقارنة لصيغة YYYY-MM-DD
    let newDateStr = '';
    if (newRun.timestamp && newRun.timestamp.toDate) newDateStr = newRun.timestamp.toDate().toISOString().split('T')[0];
    else if (newRun.date) newDateStr = newRun.date; // لو جاية نص

    return existingRuns.some(oldRun => {
        // أ. فحص التاريخ
        let oldDateStr = '';
        if (oldRun.timestamp && oldRun.timestamp.toDate) oldDateStr = oldRun.timestamp.toDate().toISOString().split('T')[0];
        else if (oldRun.dateStr) oldDateStr = oldRun.dateStr;

        if (oldDateStr !== newDateStr) return false; // تواريخ مختلفة = مش مكرر

        // ب. فحص النوع (اختياري لو عايز تدقق أوي)
        if (oldRun.type !== newRun.type) return false; 

        // ج. فحص المسافة (المهم)
        // بنسمح بفرق بسيط (Tolerence) وليكن 0.1 كم (100 متر)
        const distDiff = Math.abs(parseFloat(oldRun.dist) - parseFloat(newRun.dist));
        
        // لو الفرق أقل من 150 متر.. نعتبرها غالباً نفس الجرية
        if (distDiff <= 0.15) {
            console.warn(`Duplicate Detected: ${newRun.dist}km vs existing ${oldRun.dist}km on ${newDateStr}`);
            return true; // قفشناه! دي تكرار
        }

        return false;
    });
}

//=================== 16. مزامنة استرافا مع منع التكرار (V6.1) ====================
async function syncFromStrava(count = 30) {
    // ... (كود جلب التوكن والأنشطة من سترافا زي ما هو) ...
    
    const activities = await response.json();
    
    // 1. نجيب الجريات المسجلة حالياً للمستخدم من الكاش أو الداتابيز
    const existingRuns = window._ersRunsCache || []; // أو هاتهم من الداتابيز لو الكاش فاضي

    let addedCount = 0;

    for (const act of activities) {
        if (act.type !== 'Run' && act.type !== 'Walk') continue;

        // تجهيز بيانات الجرية الجديدة
        const newRunObj = {
            stravaId: act.id,
            dist: (act.distance / 1000).toFixed(2),
            type: act.type,
            date: act.start_date.split('T')[0], // YYYY-MM-DD
            timestamp: firebase.firestore.Timestamp.fromDate(new Date(act.start_date)) // عشان المقارنة الدقيقة
        };

        // 🛑 فحص التكرار قبل الإضافة
        if (isDuplicateRun(newRunObj, existingRuns)) {
            console.log(`Skipping duplicate run: ${act.name}`);
            continue; // فوت اللفة دي وخش علي اللي بعدها
        }

        // ... لو مش مكررة، كمل كود الحفظ في الداتابيز ...
        // await db.collection('runs').add(....);
        addedCount++;
    }

    if (addedCount > 0) {
        showToast(`تم استيراد ${addedCount} نشاط جديد`);
        loadActivityLog(); // تحديث الواجهة
    } else {
        showToast("لا توجد أنشطة جديدة (كل الأنشطة موجودة بالفعل)");
    }
}