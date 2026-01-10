/**
 * 🧠 ERS Mastermind Coach - Core Logic V1.0
 * محرك الكوتش العبقري: إدارة الخطط، التأجيل، التحقق البيومتري، والاحتفالات.
 */

// 1. محرك التحقق البيومتري (Biometric Compliance)
function autoCheckCompliance() {
    const planData = JSON.parse(localStorage.getItem('ers_user_custom_plan'));
    const allRuns = window.allRunsCache || [];
    if(!planData || allRuns.length === 0) return;

    let updated = false;
    planData.steps.forEach(step => {
        if(step.status === 'pending') {
            const matchingRun = allRuns.find(run => {
                const runDate = run.timestamp?.toDate().toISOString().split('T')[0];
                const distDiff = Math.abs(run.dist - step.dist);
                // شرط المطابقة: نفس التاريخ + فرق مسافة أقل من 500 متر
                return runDate === step.date && (step.dist === 0 || distDiff < 0.5);
            });

            if(matchingRun) {
                step.status = 'completed';
                step.actualDist = matchingRun.dist;
                updated = true;
            }
        }
    });

    if(updated) {
        localStorage.setItem('ers_user_custom_plan', JSON.stringify(planData));
        if(typeof renderMyPlanHero === 'function') renderMyPlanHero();
    }
}

// 2. محرك التأجيل الذكي (Smart Shifting)
function shiftPlanStep(stepId, daysToShift = 1) {
    let planData = JSON.parse(localStorage.getItem('ers_user_custom_plan'));
    if(!planData) return;

    const stepIndex = planData.steps.findIndex(s => s.id === stepId);
    if(stepIndex === -1) return;

    // ترحيل الخطوة المختارة وما بعدها زمنياً
    for (let i = stepIndex; i < planData.steps.length; i++) {
        let currentDate = new Date(planData.steps[i].date);
        currentDate.setDate(currentDate.getDate() + daysToShift);
        planData.steps[i].date = currentDate.toISOString().split('T')[0];
    }

    localStorage.setItem('ers_user_custom_plan', JSON.stringify(planData));
    renderMyPlanHero();
    showToast(`تم ترحيل جدولك بنجاح 🗓️`, "info");
}

// 3. محرك ذاكرة الكوتش (Rehabilitation System)
function checkCoachMemory() {
    const planData = JSON.parse(localStorage.getItem('ers_user_custom_plan'));
    if (!planData) return;

    const today = new Date().toISOString().split('T')[0];
    const missedSteps = planData.steps.filter(s => s.status === 'pending' && s.date < today);

    if (missedSteps.length >= 3) {
        const nextStep = planData.steps.find(s => s.date >= today);
        if (nextStep && !nextStep.isRehab) {
            nextStep.title = "🔄 إعادة تأهيل (استشفاء)";
            nextStep.dist = Math.min(nextStep.dist, 3);
            nextStep.isRehab = true;
            localStorage.setItem('ers_user_custom_plan', JSON.stringify(planData));
            showToast("بسبب غيابك، تم تعديل تمرين اليوم لحمايتك 🛡️", "info");
        }
    }
}

// 4. محرك الاحتفال (Celebration Engine)
function checkForPersonalBests(newRun) {
    const allRuns = window.allRunsCache || [];
    if (allRuns.length < 2) return;

    const previousRuns = allRuns.filter(r => r.id !== newRun.id);
    const maxDist = Math.max(...previousRuns.map(r => r.dist || 0));
    
    if (newRun.dist > maxDist) {
        triggerCelebration('أطول مسافة شخصية! 🏆');
    }
}

function triggerCelebration(msg) {
    const overlay = document.createElement('div');
    overlay.className = 'pb-celebration-overlay';
    overlay.innerHTML = `
        <div class="celebration-content">
            <span class="medal-icon">🥇</span>
            <h2>إنجاز جديد!</h2>
            <p>${msg}</p>
            <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary">استمرار</button>
        </div>
    `;
    document.body.appendChild(overlay);
}
