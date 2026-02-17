/* ERS Activities - Final Clean Version V3.5 */

let _isSubmitting = false; // حماية من الضغط المتكرر على زر الحفظ
let _activityLogUnsubscribe = null; // لتتبع مستمع onSnapshot ومنع التسريب

// ==================== 1. إدارة نافذة النشاط الجديد ====================

function openNewRun() {
    editingRunId = null; // تصفير وضع التعديل
    editingOldDist = 0;

    // تنظيف الحقول
    if (document.getElementById('log-dist')) document.getElementById('log-dist').value = '';
    if (document.getElementById('log-time')) document.getElementById('log-time').value = '';
    if (document.getElementById('log-link')) document.getElementById('log-link').value = '';

    // تنظيف الصورة
    removeImage();

    // ضبط التاريخ الافتراضي لليوم
    const dateInput = document.getElementById('log-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    openModal('modal-log');
}

// ==================== 2. محرك الذكاء الاصطناعي (OCR + Upload) ====================

// ==================== 2. محرك الذكاء الاصطناعي (OCR + Smart Paste) ====================

// --- A. Smart Image Reader (OCR V2) ---
async function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    // 1. عرض الصورة فوراً (Preview)
    const previewBox = document.getElementById('preview-image-box');
    const placeholder = document.getElementById('upload-placeholder');
    const dropZone = document.getElementById('drop-zone');
    const removeBtn = document.getElementById('remove-img-btn');
    const ocrStatus = document.getElementById('ocr-status');

    if (previewBox) {
        previewBox.src = URL.createObjectURL(file);
        previewBox.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (dropZone) dropZone.classList.add('has-image');
    if (removeBtn) removeBtn.style.display = 'flex';

    // 2. تشغيل الرفع في الخلفية
    uploadImageToImgBB(file);

    // 3. تحليل النص (OCR V2 Improved)
    if (ocrStatus) {
        ocrStatus.style.display = 'block';
        ocrStatus.innerHTML = '<span style="color:#f59e0b;">🤖 الكوتش بيقرأ الصورة...</span>';
    }

    try {
        const { data: { text } } = await Tesseract.recognize(file, 'eng'); // Eng often works best for numbers
        console.log("OCR Raw:", text);

        // تنظيف أولي ذكي
        let cleanText = text
            .replace(/O/g, "0").replace(/o/g, "0") // 0/O fix
            .replace(/l/g, "1").replace(/I/g, "1") // 1/l/I fix
            .replace(/S/g, "5").replace(/s/g, "5") // 5/S fix
            .replace(/(\d+)[.,](\d{2})/g, "$1.$2"); // Standardize decimals

        let detectedDist = null;
        let detectedTime = null;

        // --- استراتيجية المسافة ---
        // نبحث عن أرقام بجوار كلمات دالة (km, mi, distance)
        // Regex: (Number) (DistanceUnit) OR (DistanceKeyword) (Number)
        const distMatch = cleanText.match(/(\d+\.?\d*)\s*(?:km|k|mi|كيلو)|(?:distance|dist|مسافة)\D*(\d+\.?\d*)/i);
        if (distMatch) {
            let val = parseFloat(distMatch[1] || distMatch[2]);
            // فلتر: المسافة المنطقية (أكبر من 0.1 وأقل من 200 كم)
            // وفلتر: استبعاد السنوات (2024, 2025)
            if (val > 0.1 && val < 200 && val !== 2024 && val !== 2025 && val !== 2026) {
                detectedDist = val;
            }
        }

        // --- استراتيجية الوقت ---
        // نبحث عن تنسيق H:MM:SS او MM:SS
        // لكن نحذر من Pace (D:CC /km)
        // الحل: نبحث عن الوقت الكلي، عادة بيكون أكبر رقم زمني أو بجوار كلمة Duration/Time

        // 1. تجميع كل التوقيتات
        const timeRegex = /(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/g;
        let potentialTimes = [];
        let match;
        while ((match = timeRegex.exec(cleanText)) !== null) {
            // تجاهل التوقيتات اللي جنبها /km أو word pace
            const surroundText = cleanText.substring(match.index - 10, match.index + 20).toLowerCase();
            if (surroundText.includes('/km') || surroundText.includes('pace') || surroundText.includes('بيس')) continue;

            let h = 0, m = 0;
            if (match[3]) { // H:MM:SS
                h = parseInt(match[1]);
                m = parseInt(match[2]);
            } else { // MM:SS (Assume minutes unless very large)
                m = parseInt(match[1]);
            }

            // تحويل للدقائق
            let totalMins = (h * 60) + m;
            if (totalMins > 0 && totalMins < 600) potentialTimes.push(totalMins);
        }

        // لو لقينا توقيتات، بناخد "الأكبر" منطقياً كونه الوقت الكلي (غالباً البيس أقل من الوقت الكلي)
        if (potentialTimes.length > 0) {
            detectedTime = Math.max(...potentialTimes);
        }

        // --- تطبيق النتائج ---
        fillLogInputs(detectedDist, detectedTime, ocrStatus);

    } catch (err) {
        console.error("OCR Error:", err);
        if (ocrStatus) ocrStatus.innerHTML = '<span style="color:#ef4444;">النت ضعيف، تعذر القراءة. لكن الصورة اترفعت 👍</span>';
    }
}

// --- B. Smart Text Paste (From WhatsApp/Strava Share) ---
window.handleSmartPaste = function () {
    // نطلب من المستخدم اللصق (بسبب قيود المتصفح لازم هو اللي يعمل Paste أحياناً)
    // هنا هنعمل خدعة: نفتح prompt بسيط
    navigator.clipboard.readText().then(text => {
        parseActivityText(text);
    }).catch(err => {
        // Fallback: prompt
        const userText = prompt("الزق النص هنا (Paste Text):");
        if (userText) parseActivityText(userText);
    });
}

function parseActivityText(text) {
    if (!text) return;

    // 1. Distance (look for "5.02 km" etc)
    let dist = null;
    const distMatch = text.match(/(\d+[.,]?\d*)\s*(?:km|k|mi|كيلو)/i);
    if (distMatch) dist = parseFloat(distMatch[1].replace(',', '.'));

    // 2. Time (look for "Time: 30:00" or just "30:00")
    // Similar logic to OCR but text is usually cleaner
    let time = null;
    const timeMatch = text.match(/(?:time|duration|الوقت)[\s:]*(\d{1,2}:)?(\d{1,2}):(\d{2})/i) || text.match(/(\d{1,2}):(\d{2})/);

    if (timeMatch) {
        // rough parsing logic fallback
        let parts = timeMatch[0].split(':').map(p => parseInt(p.replace(/\D/g, ''))); // naive clean
        // Refined logic needs strict regex capture groups usage (implemented simply here for strict types)

        // Let's use the captured groups correctly
        // Group 1: Hours (optional), Group 2: Mins, Group 3: Secs (optional)
        // Actually, let's just parse the full string found like "1:30:00"
        const tStr = timeMatch[0].replace(/[^\d:]/g, '');
        const tParts = tStr.split(':').map(Number);
        if (tParts.length === 3) time = tParts[0] * 60 + tParts[1];
        else if (tParts.length === 2) time = tParts[0]; // Assume MM:SS
    }

    const status = document.getElementById('ocr-status');
    fillLogInputs(dist, time, status, true);
}

// --- Helper: Fill Inputs & Validate ---
function fillLogInputs(dist, time, statusEl, isPaste = false) {
    const distInput = document.getElementById('log-dist');
    const timeInput = document.getElementById('log-time');
    let filled = false;

    if (dist && distInput) {
        distInput.value = dist;
        filled = true;
    }
    if (time && timeInput) {
        timeInput.value = time;
        filled = true;
    }

    // Trigger calculation
    calcPace();

    if (statusEl && filled) {
        const icon = isPaste ? '📋' : '✅';
        const src = isPaste ? 'النص' : 'الصورة';
        statusEl.innerHTML = `<span style="color:#10b981;">${icon} تم التقاط البيانات من ${src}!</span>`;
        statusEl.style.display = 'block';
    } else if (statusEl && !filled) {
        statusEl.innerHTML = '<span style="color:#ef4444;">لم أجد أرقام واضحة، اكتبها يدوياً يا بطل.</span>';
        statusEl.style.display = 'block';
    }
}

// --- C. Real-time Pace Calculator ---
window.calcPace = function () {
    const d = parseFloat(document.getElementById('log-dist').value);
    const t = parseFloat(document.getElementById('log-time').value);
    const lbl = document.getElementById('live-pace-lbl');

    if (d > 0 && t > 0) {
        const paceDec = t / d;
        const pMin = Math.floor(paceDec);
        const pSec = Math.round((paceDec - pMin) * 60);
        const pSecStr = pSec < 10 ? '0' + pSec : pSec;

        lbl.innerText = `${pMin}:${pSecStr} /km`;
        lbl.style.color = (paceDec < 3) ? '#ef4444' : (paceDec > 15 ? '#f59e0b' : '#10b981'); // Warn if unnatural
    } else {
        lbl.innerText = '--:--';
        lbl.style.color = '#6b7280';
    }
}

// دالة الرفع الفعلية (تم إصلاح المفتاح)
async function uploadImageToImgBB(file) {
    const status = document.getElementById('upload-status');
    const hiddenInput = document.getElementById('uploaded-img-url');
    const API_KEY = "0d0b1fefa53eb2fc054b27c6395af35c"; // ✅ المفتاح الصحيح

    if (status) status.innerText = "جاري رفع الصورة للسيرفر... ☁️";

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            hiddenInput.value = data.data.url;
            if (status) {
                status.innerText = "تم إرفاق الصورة بنجاح ✅";
                status.style.color = "#10b981";
            }
        } else {
            throw new Error("API Error");
        }
    } catch (e) {
        console.error(e);
        if (status) {
            status.innerText = "فشل الرفع (تأكد من النت)";
            status.style.color = "#ef4444";
        }
    }
}

function removeImage() {
    const input = document.getElementById('log-img-file'); // تأكدنا من الـ ID حسب HTML
    const previewBox = document.getElementById('preview-image-box');
    const placeholder = document.getElementById('upload-placeholder');
    const dropZone = document.getElementById('drop-zone');
    const removeBtn = document.getElementById('remove-img-btn');
    const hiddenUrl = document.getElementById('uploaded-img-url');
    const status = document.getElementById('upload-status');
    const ocrStatus = document.getElementById('ocr-status');

    if (input) input.value = '';
    if (hiddenUrl) hiddenUrl.value = '';

    if (previewBox) { previewBox.src = ''; previewBox.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex'; // نعيد ظهور الـ placeholder
    if (dropZone) dropZone.classList.remove('has-image');
    if (removeBtn) removeBtn.style.display = 'none';
    if (status) status.innerHTML = '';
    if (ocrStatus) ocrStatus.innerHTML = '';
}

// ==================== 3. حفظ النشاط (Submit) ====================

async function submitRun() {
    // 🔒 حماية من الضغط المتكرر (re-entry guard)
    if (_isSubmitting) return;

    if (!navigator.onLine) return showToast("لا يوجد اتصال بالإنترنت ⚠️", "error");

    const btn = document.getElementById('save-run-btn');
    const distInput = document.getElementById('log-dist');
    const timeInput = document.getElementById('log-time');
    const typeInput = document.getElementById('log-type');
    const dateInput = document.getElementById('log-date');
    const imgUrlInput = document.getElementById('uploaded-img-url');

    const dist = parseFloat(distInput.value);
    const time = parseFloat(timeInput.value);
    const type = typeInput.value;
    const dateVal = dateInput.value;

    // التحقق من صحة البيانات
    if (!dist || dist <= 0 || isNaN(dist)) return showToast("يرجى كتابة المسافة بشكل صحيح", "error");
    if (!time || time <= 0 || isNaN(time)) return showToast("يرجى كتابة الوقت بالدقائق", "error");
    if (!dateVal) return showToast("يرجى اختيار التاريخ", "error");

    const selectedDate = new Date(dateVal);
    const now = new Date();
    if (selectedDate > now) return showToast("لا يمكنك تسجيل نشاط في المستقبل! 🚀", "error");

    // 🔒 تفعيل القفل + تعطيل الزر
    _isSubmitting = true;
    if (btn) {
        btn.innerText = "جاري الحفظ...";
        btn.disabled = true;
        btn.style.opacity = "0.7";
    }

    try {
        const uid = currentUser.uid;
        const timestamp = firebase.firestore.Timestamp.fromDate(selectedDate);
        const isRun = (type === 'Run' || type === 'Treadmill');

        const runData = {
            dist: dist,
            time: time,
            type: type,
            timestamp: timestamp,
            dateStr: dateVal, // لتسهيل الفلترة
            img: imgUrlInput?.value || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingRunId) {
            // --- حالة التعديل (Atomic Batch) ---
            const editBatch = db.batch();

            // 1. تعديل الجرية
            const editRunRef = db.collection('users').doc(uid).collection('runs').doc(editingRunId);
            editBatch.update(editRunRef, runData);

            // 2. تحديث إجمالي الشهر (لو في نفس الشهر)
            if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
                const distDiff = dist - editingOldDist;
                if (distDiff !== 0) {
                    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    const userRef = db.collection('users').doc(uid);
                    editBatch.update(userRef, {
                        monthDist: firebase.firestore.FieldValue.increment(isRun ? distDiff : 0),
                        lastMonthKey: currentMonthKey
                    });

                    // 3. 🔥 تحديث الدوري الديناميكي (League 2.0)
                    if (userData.region && isRun && window.LeagueService) {
                        const activeLeague = await LeagueService.getActiveLeague();
                        if (activeLeague) {
                            const regionKey = userData.region.trim();
                            // Edit = just increment the diff (no new player)
                            LeagueService.addLeagueUpdateToBatch(
                                editBatch, activeLeague.id, regionKey,
                                uid, userData.name, userData.photoUrl,
                                distDiff, 0, false
                            );
                        }
                    }
                }
            }

            // ✅ Commit كل العمليات مرة واحدة
            await editBatch.commit();
            showToast("تم تعديل النشاط بنجاح ✏️", "success");

        } else {
            // --- حالة الإضافة الجديدة (Atomic Batch) ---
            const batch = db.batch();

            // 1. إضافة الجرية (نولّد الـ ID يدويًا عشان نقدر نستخدم batch)
            const newRunRef = db.collection('users').doc(uid).collection('runs').doc();
            batch.set(newRunRef, runData);

            // 2. إضافة للـ Feed العام
            const newFeedRef = db.collection('activity_feed').doc();
            batch.set(newFeedRef, {
                uid: uid,
                userName: userData.name,
                userRegion: userData.region,
                userPhoto: userData.photoUrl || null,
                ...runData,
                likes: []
            });

            // 3. تحديث إحصائيات المستخدم
            const userRef = db.collection('users').doc(uid);
            let updateFields = {
                totalDist: firebase.firestore.FieldValue.increment(isRun ? dist : 0),
                totalRuns: firebase.firestore.FieldValue.increment(isRun ? 1 : 0)
            };

            // لو الجرية في الشهر الحالي، زود عداد الشهر
            if (selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear()) {
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                updateFields.monthDist = firebase.firestore.FieldValue.increment(isRun ? dist : 0);
                updateFields.lastMonthKey = currentMonthKey;
                updateFields.lastRunDate = dateVal; // لتحديث الـ Streak
            }

            batch.set(userRef, updateFields, { merge: true });

            // 4. 🔥 تحديث الدوري الديناميكي (League 2.0)
            if (userData.region && isRun && window.LeagueService) {
                const activeLeague = await LeagueService.getActiveLeague();
                if (activeLeague) {
                    const regionKey = userData.region.trim();
                    const runDate = selectedDate;
                    const leagueStart = activeLeague.startDate.toDate();
                    const leagueEnd = activeLeague.endDate.toDate();

                    // فقط لو تاريخ الجرية داخل فترة الدوري
                    if (runDate >= leagueStart && runDate <= leagueEnd) {
                        const isNewPlayer = !(await LeagueService.isPlayerInLeague(activeLeague.id, regionKey, uid));
                        LeagueService.addLeagueUpdateToBatch(
                            batch, activeLeague.id, regionKey,
                            uid, userData.name, userData.photoUrl,
                            dist, parseInt(runData.time || 0), isNewPlayer
                        );
                    }
                }
            }

            // ✅ Commit كل العمليات مرة واحدة (تنجح كلها أو تفشل كلها)
            await batch.commit();

            // فحص الأوسمة الجديدة (بعد نجاح الحفظ)
            if (typeof checkNewBadges === 'function') checkNewBadges();

            showToast("تم حفظ النشاط بنجاح ✅", "success");
        }

        closeModal('modal-log');

        // تحديث الواجهة
        if (typeof loadActivityLog === 'function') loadActivityLog();
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateHeroWeekDist === 'function') updateHeroWeekDist();
        if (typeof loadActiveChallenges === 'function') loadActiveChallenges();

    } catch (e) {
        console.error(e);
        showToast("خطأ في الحفظ: " + e.message, "error");
    } finally {
        _isSubmitting = false; // 🔓 فك القفل
        if (btn) {
            btn.innerText = "حفظ وتسجيل ✅";
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
}

// ==================== 4. تعديل نشاط موجود ====================

window.prepareEditRun = function (runId) {
    const run = (window._ersRunsCache || []).find(r => r.id === runId);
    if (!run) return showToast("بيانات النشاط غير محملة", "error");

    editingRunId = runId;
    editingOldDist = run.dist || 0;

    // ملء الحقول
    document.getElementById('log-dist').value = run.dist;
    document.getElementById('log-time').value = run.time;
    document.getElementById('log-type').value = run.type || 'Run';

    // ضبط التاريخ
    let dateStr = '';
    if (run.dateStr) dateStr = run.dateStr;
    else if (run.timestamp) dateStr = run.timestamp.toDate().toISOString().split('T')[0];
    document.getElementById('log-date').value = dateStr;

    // عرض الصورة القديمة
    const imgUrl = run.img || run.imgUrl;
    const previewBox = document.getElementById('preview-image-box');
    const placeholder = document.getElementById('upload-placeholder');
    const hiddenUrl = document.getElementById('uploaded-img-url');
    const dropZone = document.getElementById('drop-zone');
    const removeBtn = document.getElementById('remove-img-btn');

    if (imgUrl) {
        hiddenUrl.value = imgUrl;
        previewBox.src = imgUrl;
        previewBox.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (dropZone) dropZone.classList.add('has-image');
        if (removeBtn) removeBtn.style.display = 'flex';
    } else {
        removeImage(); // تنظيف لو مفيش صورة
    }

    // تغيير زر الحفظ
    const btn = document.getElementById('save-run-btn');
    if (btn) btn.innerText = "حفظ التعديلات";

    openModal('modal-log');
};

// ==================== 5. سجل الأنشطة (للعرض في البروفايل) ====================

function loadActivityLog() {
    const list = document.getElementById('activity-log');
    if (!list || !currentUser) return;

    // 🔒 إلغاء المستمع السابق لمنع التسريب
    if (_activityLogUnsubscribe) {
        _activityLogUnsubscribe();
        _activityLogUnsubscribe = null;
    }

    _activityLogUnsubscribe = db.collection('users').doc(currentUser.uid).collection('runs')
        .orderBy('timestamp', 'desc').limit(50).onSnapshot(snap => {

            if (snap.empty) {
                list.innerHTML = `<div class="no-data">لا توجد أنشطة مسجلة بعد.</div>`;
                return;
            }

            const runs = [];
            let maxDist = 0;

            snap.forEach(doc => {
                const r = doc.data(); r.id = doc.id;
                runs.push(r);
                if (r.type === 'Run' && r.dist > maxDist) maxDist = r.dist;
            });

            // تحديث الكاش العالمي
            window._ersRunsCache = runs;
            if (typeof updateHeroWeekDist === 'function') updateHeroWeekDist();
            if (typeof updateUI === 'function') updateUI();
            if (typeof loadActiveChallenges === 'function') loadActiveChallenges(); // 🔥 Auto-sync challenges

            // تجميع حسب الشهر
            const groups = {};
            runs.forEach(r => {
                const date = r.timestamp ? r.timestamp.toDate() : new Date();
                const monthKey = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                if (!groups[monthKey]) groups[monthKey] = [];
                groups[monthKey].push(r);
            });

            let html = '';
            for (const [month, monthRuns] of Object.entries(groups)) {
                html += `<div class="log-month-header" style="font-size:12px; color:var(--primary); margin:15px 0 5px 0; font-weight:bold;">${month}</div>`;

                monthRuns.forEach(r => {
                    const dateObj = r.timestamp ? r.timestamp.toDate() : new Date();
                    const dayNum = dateObj.getDate();
                    const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'short' });

                    const isRun = (r.type === 'Run');
                    const icon = isRun ? 'ri-run-line' : (r.type === 'Walk' ? 'ri-walk-line' : 'ri-bike-line');
                    const color = isRun ? 'var(--primary)' : '#6b7280';

                    html += `
                  <div class="log-item" onclick="openRunDetail('${r.id}')" style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; margin-bottom:8px; border-right:3px solid ${color};">
                      <div style="text-align:center; min-width:35px;">
                          <div style="font-size:10px; color:#9ca3af;">${dayName}</div>
                          <div style="font-size:16px; font-weight:bold; color:#fff;">${dayNum}</div>
                      </div>
                      <div style="font-size:20px; color:${color};"><i class="${icon}"></i></div>
                      <div style="flex:1;">
                          <div style="font-size:14px; color:#fff; font-weight:bold;">${r.dist} كم <span style="font-size:10px; font-weight:normal; color:#9ca3af;">(${r.type})</span></div>
                          <div style="font-size:11px; color:#9ca3af;">${r.time} دقيقة</div>
                      </div>
                       <button onclick="event.stopPropagation(); window.prepareEditRun('${r.id}')" style="background:none; border:none; color:#9ca3af; margin-left:8px;"><i class="ri-pencil-line"></i></button>
                       <button onclick="event.stopPropagation(); deleteRun('${r.id}', ${r.dist})" style="background:none; border:none; color:#ef4444;"><i class="ri-delete-bin-line"></i></button>
                  </div>`;
                });
            }
            list.innerHTML = html;
        });
}

// ==================== 6. حذف نشاط ====================
async function deleteRun(id, dist, timestamp) {
    showConfirm("هل أنت متأكد من حذف هذا النشاط نهائياً؟ \n(سيتم خصم المسافة من رصيدك وتحديث التحديات)", async () => {
        try {
            const uid = currentUser.uid;
            const runDoc = await db.collection('users').doc(uid).collection('runs').doc(id).get();
            if (!runDoc.exists) return; // Already deleted

            const runData = runDoc.data();
            const dateObj = runData.timestamp ? runData.timestamp.toDate() : new Date();

            await db.collection('users').doc(uid).collection('runs').doc(id).delete();

            // 🔥 حذف من الفيد العام (activity_feed) لمنع الأشباح في صفحة الفريق
            try {
                const feedSnap = await db.collection('activity_feed')
                    .where('uid', '==', uid)
                    .where('timestamp', '==', runData.timestamp)
                    .limit(5)
                    .get();
                const feedDeletePromises = feedSnap.docs.map(doc => doc.ref.delete());
                await Promise.all(feedDeletePromises);
                console.log(`🗑️ تم حذف ${feedSnap.size} إدخالات من الفيد العام`);
            } catch (feedErr) {
                console.warn('تعذر حذف الفيد:', feedErr);
            }

            // 1. خصم الإجماليات
            const updateLoad = {
                totalDist: firebase.firestore.FieldValue.increment(-dist),
                totalRuns: firebase.firestore.FieldValue.increment(-1)
            };

            // 2. خصم من الشهر الحالي لو الجرية في نفس الشهر
            const now = new Date();
            if (dateObj.getMonth() === now.getMonth() && dateObj.getFullYear() === now.getFullYear()) {
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                updateLoad.monthDist = firebase.firestore.FieldValue.increment(-dist);
                updateLoad.lastMonthKey = currentMonthKey;

                // 🔥 Aggregated Stats Update (Delete)
                if (userData.region) {
                    const regionKey = userData.region.trim();
                    await db.collection('stats').doc('league').set({
                        [regionKey]: {
                            totalDist: firebase.firestore.FieldValue.increment(-dist)
                            // Note: We don't decrement players here safely without knowing if it was their only run.
                            // For MVP, we accept player count might be slightly off until next migration.
                        },
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            }

            await db.collection('users').doc(uid).update(updateLoad);

            showToast("تم الحذف بنجاح 🗑️", "success");
            closeModal('modal-run-detail'); // Close detail modal if open
            // loadActivityLog() is triggered automatically by onSnapshot

        } catch (e) {
            console.error(e);
            showToast("فشل الحذف", "error");
        }
    });
}

// ==================== 7. عرض التفاصيل (Modal) ====================
function openRunDetail(runId) {
    const run = (window._ersRunsCache || []).find(r => r.id === runId);
    if (!run) return;

    document.getElementById('detail-type').innerText = (run.type === 'Run') ? 'جري 🏃‍♂️' : run.type;
    document.getElementById('detail-dist').innerText = run.dist;
    document.getElementById('detail-time').innerText = run.time;

    // التاريخ
    let d = run.dateStr;
    if (!d && run.timestamp) d = run.timestamp.toDate().toLocaleDateString('ar-EG');
    document.getElementById('detail-date').innerText = d || '--';

    // السرعة (Pace)
    const pace = run.dist > 0 ? (run.time / run.dist).toFixed(2) : '-';
    document.getElementById('detail-pace').innerText = pace + " د/كم";

    // الصورة والخريطة
    const imgEl = document.getElementById('detail-img');
    const mapEl = document.getElementById('detail-map');

    imgEl.style.display = 'none';
    mapEl.style.display = 'none';

    if (run.img || run.imgUrl) {
        imgEl.src = run.img || run.imgUrl;
        imgEl.style.display = 'block';
    }

    // إضافة زر الحذف
    const modalBox = document.querySelector('#modal-run-detail .modal-box');
    // Remove old delete button if exists
    const oldBtn = document.getElementById('btn-delete-run-detail');
    if (oldBtn) oldBtn.remove();

    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'btn-delete-run-detail';
    deleteBtn.className = 'btn';
    deleteBtn.innerHTML = '<i class="ri-delete-bin-line"></i> حذف النشاط';
    deleteBtn.style.cssText = "width:100%; margin-top:15px; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.2);";
    deleteBtn.onclick = () => deleteRun(run.id, run.dist);

    // Append to padding container
    const paddingDiv = modalBox.querySelector('div[style*="padding: 20px"]');
    if (paddingDiv) paddingDiv.appendChild(deleteBtn);

    openModal('modal-run-detail');
}

// ==================== 8. Strava Sync (Anti-Duplicate + Feed + Stats) ====================
async function syncFromStrava(count = 30) {
    if (!window.STRAVA_CONFIG) return showToast("Strava غير مفعّل", "error");

    const btn = document.getElementById('strava-sync-btn');
    if (btn) btn.innerText = "جاري المزامنة...";

    try {
        const refreshToken = userData.stravaRefreshToken || window.STRAVA_CONFIG.REFRESH_TOKEN;
        if (!refreshToken) throw new Error("يرجى ربط الحساب أولاً");

        // 1. Refresh Token
        const authRes = await fetch(`https://www.strava.com/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: window.STRAVA_CONFIG.CLIENT_ID,
                client_secret: window.STRAVA_CONFIG.CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });
        const authData = await authRes.json();

        // 2. Fetch Activities
        const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${count}`, {
            headers: { 'Authorization': `Bearer ${authData.access_token}` }
        });
        const activities = await res.json();

        // 3. Filter & Save (with Feed + Stats)
        const existingRuns = window._ersRunsCache || [];
        const uid = currentUser.uid;
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let added = 0;
        let totalDistAdded = 0;

        for (const act of activities) {
            if (act.type !== 'Run' && act.type !== 'Walk') continue;

            // منع التكرار بواسطة Strava ID
            if (existingRuns.some(r => r.stravaId === act.id)) continue;

            const dist = parseFloat((act.distance / 1000).toFixed(2));
            const actDate = new Date(act.start_date);
            const isRun = (act.type === 'Run');
            const runData = {
                stravaId: act.id,
                dist: dist,
                time: Math.round(act.moving_time / 60),
                type: act.type,
                dateStr: act.start_date.split('T')[0],
                timestamp: firebase.firestore.Timestamp.fromDate(actDate),
                source: 'Strava',
                polyline: act.map?.summary_polyline || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // 🔥 Atomic Batch: runs + activity_feed + stats
            const batch = db.batch();

            // A. حفظ الجرية
            const newRunRef = db.collection('users').doc(uid).collection('runs').doc();
            batch.set(newRunRef, runData);

            // B. إضافة للـ Feed العام (عشان تظهر في صفحة الفريق)
            const newFeedRef = db.collection('activity_feed').doc();
            batch.set(newFeedRef, {
                uid: uid,
                userName: userData.name,
                userRegion: userData.region,
                userPhoto: userData.photoUrl || null,
                ...runData,
                likes: []
            });

            // C. تحديث إحصائيات المستخدم
            const userRef = db.collection('users').doc(uid);
            let updateFields = {
                totalDist: firebase.firestore.FieldValue.increment(isRun ? dist : 0),
                totalRuns: firebase.firestore.FieldValue.increment(isRun ? 1 : 0)
            };

            // لو الجرية في الشهر الحالي
            if (actDate.getMonth() === now.getMonth() && actDate.getFullYear() === now.getFullYear()) {
                updateFields.monthDist = firebase.firestore.FieldValue.increment(isRun ? dist : 0);
                updateFields.lastMonthKey = currentMonthKey;
            }

            batch.set(userRef, updateFields, { merge: true });

            // D. تحديث إحصائيات الدوري
            if (userData.region && isRun) {
                const regionKey = userData.region.trim();
                const leagueRef = db.collection('stats').doc('league');
                batch.set(leagueRef, {
                    [regionKey]: {
                        totalDist: firebase.firestore.FieldValue.increment(dist)
                    },
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            await batch.commit();
            added++;
            totalDistAdded += dist;
        }

        if (added > 0) {
            showToast(`تم استيراد ${added} نشاط من Strava (${totalDistAdded.toFixed(1)} كم) 🏃`, "success");
            loadActivityLog();
            if (typeof updateUI === 'function') updateUI();
            if (typeof loadActiveChallenges === 'function') loadActiveChallenges();
        } else {
            showToast("كل الأنشطة موجودة بالفعل 👍", "info");
        }

    } catch (e) {
        console.error(e);
        showToast("فشل المزامنة: " + e.message, "error");
    } finally {
        if (btn) btn.innerText = "مزامنة تلقائية";
    }
}

// ==================== 8. Ghost Runner Helper ====================
window.fetchBestPace = async function () {
    if (!currentUser) return null;
    try {
        // Fetch last 20 runs to find the best pace
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('runs')
            .orderBy('date', 'desc')
            .limit(20)
            .get();

        if (snapshot.empty) return null;

        let bestPace = Infinity; // Seconds per km

        snapshot.forEach(doc => {
            const data = doc.data();
            const dist = parseFloat(data.dist);
            const time = parseFloat(data.time); // minutes

            if (dist > 0 && time > 0) {
                // Calculate Pace (Seconds per km)
                const paceSeconds = (time * 60) / dist;

                // Filter: Ignore impossible/walking paces (e.g. < 2 min/km or > 15 min/km)
                if (paceSeconds > 120 && paceSeconds < 900) {
                    if (paceSeconds < bestPace) bestPace = paceSeconds;
                }
            }
        });

        return bestPace === Infinity ? null : bestPace;
    } catch (e) {
        console.error("Ghost Runner Error:", e);
        return null;
    }
};