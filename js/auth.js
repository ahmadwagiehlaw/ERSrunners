/* ERS Auth */

// ==================== 1. Authentication ====================

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    const fields = document.getElementById('signup-fields');
    const btn = document.getElementById('toggleAuthBtn');
    const mainBtn = document.querySelector('.auth-box .btn-primary');
    
    if (fields) fields.style.display = isSignupMode ? 'block' : 'none';
    if (btn) btn.innerText = isSignupMode ? "لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ سجل الآن";
    if (mainBtn) mainBtn.innerText = isSignupMode ? "إنشاء حساب جديد" : "دخول";
}

// ==================== 1. Authentication (Fixed for Glass Design) ====================
async function handleAuth() {
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    const msgEl = document.getElementById('auth-msg');
    
    // 🔥 هنا التغيير المهم: بنختار الزرار بالاسم الجديد
    const activeBtn = document.querySelector('.btn-auth-glass');
    const btnTextSpan = document.getElementById('btn-auth-text');
    
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    
    if (msgEl) msgEl.innerText = "";

    // حفظ النص الأصلي
    let originalText = "تسجيل الدخول";
    if (btnTextSpan) {
        originalText = btnTextSpan.innerText;
        btnTextSpan.innerText = 'جاري الاتصال...';
    }

    // تعطيل الزر مؤقتاً
    if (activeBtn) {
        activeBtn.disabled = true;
        activeBtn.style.opacity = "0.7";
    }

    try {
        if (!email || !pass) throw new Error("يرجى ملء البيانات");

        if (typeof isSignupMode !== 'undefined' && isSignupMode) {
            // --- إنشاء حساب ---
            const name = document.getElementById('username').value;
            const region = document.getElementById('region').value;
            if (!name || !region) throw new Error("البيانات ناقصة");

            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(cred.user.uid).set({
                name: name, region: region, email: email,
                totalDist: 0, totalRuns: 0, badges: [],
                isAdmin: false, isBanned: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // --- تسجيل دخول ---
            await auth.signInWithEmailAndPassword(email, pass);
        }
    } catch (err) {
        console.error("Auth Error:", err);
        if (msgEl) {
            if(err.code === 'auth/email-already-in-use') msgEl.innerText = "هذا البريد مسجل بالفعل.";
            else if(err.code === 'auth/wrong-password') msgEl.innerText = "كلمة المرور خاطئة.";
            else if(err.code === 'auth/user-not-found') msgEl.innerText = "غير مسجل.";
            else msgEl.innerText = "خطأ: " + err.message;
        }
        
        // إرجاع الزر لحالته
        if (btnTextSpan) btnTextSpan.innerText = originalText;
        if (activeBtn) {
            activeBtn.disabled = false;
            activeBtn.style.opacity = "1";
        }
    }
}








function logout() {
    if(confirm("تسجيل خروج؟")) {
        try{ if(typeof _resetCoachFeed === 'function') _resetCoachFeed(); }catch(e){}
        auth.signOut();
        window.location.reload();
    }
}

// مراقب الدخول (تم دمج المنطق هنا وحذف التكرار)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                userData = doc.data();
                
                // --- نظام الحظر (V3.0) ---
                if (userData.isBanned === true) {
                    auth.signOut();
                    alert("⛔ تم حظر حسابك لمخالفة القوانين.");
                    window.location.reload();
                    return;
                }
                
                if (!userData.badges) userData.badges = [];
                initApp();
            } else {
                userData = { name: "Runner", region: "Cairo", totalDist: 0, totalRuns: 0, badges: [] };
                initApp();
            }
        } catch (e) { console.error(e); }
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});







// ==================== 2. Strava OAuth ====================

function connectStrava() {
    const clientID = window.STRAVA_CONFIG?.CLIENT_ID;
    if (!clientID || clientID.includes("تجدها")) {
        return showToast("خطأ: يرجى وضع رقم Client ID في ملف env.js", "error");
    }

    // بناء الرابط بشكل ديناميكي ليتوافق مع جيت هب
    const REDIRECT_URI = window.location.origin + window.location.pathname; 
    
    // تأكد من أن الـ scope يغطي قراءة الأنشطة
    const scope = "activity:read_all,profile:read_all";
    
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&approval_prompt=force&scope=${scope}`;
    
    localStorage.setItem('ers_is_linking_strava', 'true');
    window.location.href = authUrl;
}