/* ==================== ERS AI Smart Coach (Gemini Powered) V1.0 ==================== */

// ==================== 1. Configuration ====================
const ERS_AI_CONFIG = {
    apiKey: 'AIzaSyAQ_4A1JoYLSSpjV271a7SAwVaiaGW9nps',
    model: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    cacheKey: 'ers_ai_insight',
    cacheDuration: 24 * 60 * 60 * 1000 // 24 hours
};

// ==================== 2. Core AI Functions ====================

/**
 * Get AI Coach insight for the user
 * @param {boolean} forceRefresh - Skip cache and get fresh insight
 * @returns {Promise<{success: boolean, insight: string, error?: string}>}
 */
async function getAICoachInsight(forceRefresh = false) {
    console.log('[AI Coach] getAICoachInsight called, forceRefresh:', forceRefresh);
    try {
        // 1. Check cache first
        if (!forceRefresh) {
            const cached = getAIInsightFromCache();
            if (cached) {
                console.log('[AI Coach] Returning cached insight');
                return { success: true, insight: cached, fromCache: true };
            }
        }

        // 2. Gather user data
        console.log('[AI Coach] Gathering weekly data...');
        const weeklyData = await gatherWeeklyData();
        console.log('[AI Coach] runCount:', weeklyData?.runCount);

        // If no runs, show encouraging default message
        if (!weeklyData || weeklyData.runs.length === 0) {
            console.log('[AI Coach] No runs found, showing default advice');
            return {
                success: true,
                insight: `يا ${weeklyData?.userName || 'بطل'}! 🏃‍♂️\n\nمشوفناش نشاط الأسبوع ده!\n\n**اقتراحاتي ليك:**\n- ابدأ بـ 20-30 دقيقة مشي سريع\n- جرب جرية خفيفة 2-3 كم\n- الأهم من المسافة: الاستمرارية!\n\n💪 أول خطوة هي أصعب خطوة. يلا نبدأ!`,
                fromCache: false
            };
        }

        // 3. Build the prompt
        const prompt = buildCoachPrompt(weeklyData);

        // 4. Call Gemini API
        const response = await callGeminiAPI(prompt);

        if (response.success) {
            // Cache the result
            saveAIInsightToCache(response.text);
            return { success: true, insight: response.text };
        } else {
            console.error('[AI Coach] API call failed:', response.error);
            return { success: false, insight: 'تعذر الاتصال بالكوتش الذكي: ' + (response.error || 'خطأ غير معروف'), error: response.error };
        }

    } catch (e) {
        console.error('[AI Coach] Error:', e);
        return { success: false, insight: 'حصل خطأ، جرب تاني', error: e.message };
    }
}

/**
 * Gather weekly training data for AI analysis
 */
async function gatherWeeklyData() {
    console.log('[AI Coach] Gathering weekly data...');

    // Try to get runs from cache or userData
    let runs = window._ersRunsCache || [];

    // Fallback: if cache is empty, try to get from userData
    if (runs.length === 0 && window.userData && window.userData.runs) {
        runs = window.userData.runs;
    }

    console.log('[AI Coach] Found', runs.length, 'runs in cache');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Safe date parser
    function safeGetDate(r) {
        try {
            if (r.timestamp) {
                if (typeof r.timestamp.toDate === 'function') {
                    return r.timestamp.toDate();
                } else if (r.timestamp.seconds) {
                    return new Date(r.timestamp.seconds * 1000);
                } else if (typeof r.timestamp === 'string' || typeof r.timestamp === 'number') {
                    return new Date(r.timestamp);
                }
            }
            if (r.date) {
                return new Date(r.date);
            }
            return null;
        } catch (e) {
            console.warn('[AI Coach] Date parse error:', e);
            return null;
        }
    }

    // Filter runs from last 7 days
    const weekRuns = runs.filter(r => {
        const d = safeGetDate(r);
        return d && d >= weekAgo;
    }).map(r => {
        const d = safeGetDate(r);
        return {
            date: d ? d.toLocaleDateString('ar-EG', { weekday: 'long' }) : 'غير محدد',
            dist: parseFloat(r.dist) || 0,
            time: parseFloat(r.time) || 0,
            type: r.type || 'Run',
            pace: r.pace || (r.dist && r.time ? (r.time / r.dist).toFixed(2) : null)
        };
    });

    console.log('[AI Coach] Week runs:', weekRuns.length);

    // Calculate totals
    const totalDist = weekRuns.reduce((sum, r) => sum + r.dist, 0);
    const totalTime = weekRuns.reduce((sum, r) => sum + r.time, 0);
    const avgPace = totalDist > 0 ? (totalTime / totalDist) : 0;

    // Get user info from multiple sources
    const user = window.userData || {};

    // Try to get username from multiple fallbacks
    let userName = 'بطل';
    if (user.name) {
        userName = user.name.split(' ')[0];
    } else if (user.displayName) {
        userName = user.displayName.split(' ')[0];
    } else {
        // Try to get from the header element
        const headerName = document.querySelector('.user-greeting-box h3');
        if (headerName && headerName.textContent) {
            userName = headerName.textContent.split(' ')[0];
        } else {
            // Try localStorage
            try {
                const storedUser = localStorage.getItem('ers_user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    if (parsed.name) userName = parsed.name.split(' ')[0];
                }
            } catch (e) { }
        }
    }

    console.log('[AI Coach] userName:', userName);

    return {
        runs: weekRuns,
        totalDist: totalDist.toFixed(1),
        totalTime: Math.round(totalTime),
        avgPace: avgPace.toFixed(2),
        runCount: weekRuns.length,
        userName: userName,
        userGoal: user.trainingGoal || 'general',
        userLevel: user.manualLevel || 'beginner',
        currentStreak: user.currentStreak || 0,
        monthDist: (user.monthDist || 0).toFixed(1)
    };
}

/**
 * Build the AI prompt with user context
 */
function buildCoachPrompt(data) {
    const runsText = data.runs.length > 0
        ? data.runs.map(r => `- ${r.date}: ${r.dist} كم في ${r.time} دقيقة (${r.type})`).join('\n')
        : 'لا توجد جريات هذا الأسبوع';

    const goalMap = {
        'weight_loss': 'خسارة وزن',
        'speed': 'تحسين السرعة',
        'endurance': 'بناء التحمل (ماراثون)',
        'general': 'لياقة عامة'
    };

    const levelMap = {
        'beginner': 'مبتدئ',
        'intermediate': 'متوسط',
        'advanced': 'متقدم'
    };

    return `أنت "كوتش ERS" — مدرب جري مصري ودود وخبير ومشجع.

## بيانات المستخدم:
- الاسم: ${data.userName}
- الهدف: ${goalMap[data.userGoal] || 'لياقة عامة'}
- المستوى: ${levelMap[data.userLevel] || 'مبتدئ'}
- الستريك الحالي: ${data.currentStreak} يوم
- إجمالي الشهر: ${data.monthDist} كم

## نشاط آخر 7 أيام:
${runsText}

📊 الإجمالي: ${data.totalDist} كم في ${data.runCount} جريات
⚡ متوسط البيس: ${data.avgPace} د/كم

## المطلوب:
1. قيّم الأداء في جملة واحدة مشجعة.
2. اقترح 3 تمارين للأسبوع القادم (متنوعة: سهل، سرعات، طويل).
3. نصيحة شخصية قصيرة تناسب هدفه.

## القواعد الصارمة:
- استخدم لغة عربية عامية مصرية (زي: "يا وحش"، "جامد"، "شد حيلك").
- كن مشجعاً وإيجابياً حتى لو الأداء ضعيف.
- لا تتجاوز 120 كلمة.
- استخدم إيموجي باعتدال (2-3 فقط).
- لا تكرر البيانات التي أعطيتها لك.`;
}

/**
 * Call Gemini API
 */
async function callGeminiAPI(prompt) {
    console.log('[AI Coach] callGeminiAPI starting...');
    try {
        const url = `${ERS_AI_CONFIG.endpoint}/${ERS_AI_CONFIG.model}:generateContent?key=${ERS_AI_CONFIG.apiKey}`;
        console.log('[AI Coach] API URL:', url.substring(0, 80) + '...');

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 300,
                    topP: 0.9
                }
            })
        });

        console.log('[AI Coach] API response status:', response.status);

        if (!response.ok) {
            const err = await response.text();
            console.error('[Gemini] API Error Response:', err);
            return { success: false, error: `خطأ ${response.status}: ${err.substring(0, 100)}` };
        }

        const data = await response.json();
        console.log('[AI Coach] API response received, candidates:', data?.candidates?.length);

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            console.log('[AI Coach] Got response text, length:', text.length);
            return { success: true, text: text.trim() };
        } else {
            console.error('[AI Coach] Empty text in response:', JSON.stringify(data).substring(0, 200));
            return { success: false, error: 'رد فارغ من الـ API' };
        }

    } catch (e) {
        console.error('[Gemini] Fetch Error:', e.name, e.message);
        // Check if it's a network error (likely blocked by ad blocker)
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
            return { success: false, error: 'الطلب محظور - جرب غلق الـ Ad Blocker' };
        }
        return { success: false, error: e.message };
    }
}

// ==================== 3. Cache Management ====================

function getAIInsightFromCache() {
    try {
        const raw = localStorage.getItem(ERS_AI_CONFIG.cacheKey);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        const now = Date.now();

        if (cached.timestamp && (now - cached.timestamp) < ERS_AI_CONFIG.cacheDuration) {
            return cached.insight;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function saveAIInsightToCache(insight) {
    try {
        localStorage.setItem(ERS_AI_CONFIG.cacheKey, JSON.stringify({
            insight: insight,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('[AI Cache] Failed to save:', e);
    }
}

function clearAIInsightCache() {
    try {
        localStorage.removeItem(ERS_AI_CONFIG.cacheKey);
    } catch (e) { }
}

// ==================== 4. UI Integration ====================

/**
 * Render AI Coach card in the UI
 */
async function renderAICoachCard() {
    const container = document.getElementById('ai-coach-card');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div class="ai-coach-loading">
            <div class="ai-pulse"></div>
            <span>🧠 الكوتش بيحلل أداءك...</span>
        </div>
    `;

    // Get insight
    const result = await getAICoachInsight();

    if (result.success) {
        container.innerHTML = `
            <div class="ai-coach-insight">
                <div class="ai-header">
                    <span class="ai-icon">🤖</span>
                    <span class="ai-title">رأي الكوتش الذكي</span>
                    <button class="ai-refresh-btn" onclick="refreshAIInsight()" title="تحديث">
                        <i class="ri-refresh-line"></i>
                    </button>
                </div>
                <div class="ai-content">${formatAIResponse(result.insight)}</div>
                ${result.fromCache ? '<div class="ai-cache-note">💾 من الذاكرة (يتحدث كل 24 ساعة)</div>' : ''}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="ai-coach-error">
                <span class="ai-icon">🤔</span>
                <span>${result.insight}</span>
                <button class="btn-sm" onclick="refreshAIInsight()">حاول تاني</button>
            </div>
        `;
    }
}

/**
 * Force refresh AI insight
 */
async function refreshAIInsight() {
    clearAIInsightCache();
    await renderAICoachCard();
    showToast('تم تحديث رأي الكوتش! 🧠', 'success');
}

/**
 * Format AI response with proper styling
 */
function formatAIResponse(text) {
    // Convert line breaks to HTML
    let html = text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return `<p>${html}</p>`;
}

// ==================== 5. Plan Tracking Integration ====================

/**
 * Analyze session completion after a run is logged
 */
function analyzeSessionCompletion(plannedSession, actualRun) {
    if (!plannedSession || !actualRun) return null;

    const targetDist = plannedSession.targetDist || 5;
    const actualDist = parseFloat(actualRun.dist) || 0;
    const distDiff = (actualDist - targetDist) / targetDist;

    let status, message, emoji;

    if (distDiff >= 0.2) {
        status = 'exceeded';
        message = 'تجاوزت الهدف! ماشاء الله عليك 💪';
        emoji = '🚀';
    } else if (distDiff >= -0.1) {
        status = 'on-track';
        message = 'تمام! في الخط الصح ✅';
        emoji = '✅';
    } else if (distDiff >= -0.3) {
        status = 'partial';
        message = 'مش بعيد! المهم الاستمرار';
        emoji = '👍';
    } else {
        status = 'under';
        message = 'يوم خفيف، هنعوض بكرة إن شاء الله';
        emoji = '💪';
    }

    return { status, message, emoji, actualDist, targetDist, diffPercent: Math.round(distDiff * 100) };
}

/**
 * Check for overtraining risk
 */
function checkOvertrainingRisk(thisWeekDist, lastWeekDist) {
    if (!lastWeekDist || lastWeekDist === 0) return { risk: 'unknown', message: null };

    const increase = (thisWeekDist - lastWeekDist) / lastWeekDist;

    if (increase > 0.3) {
        return {
            risk: 'high',
            message: `⚠️ زيادة ${Math.round(increase * 100)}% في أسبوع! خفف شوية عشان متتعرضش للإصابة.`,
            increase: Math.round(increase * 100)
        };
    } else if (increase > 0.15) {
        return {
            risk: 'medium',
            message: `📈 زيادة ${Math.round(increase * 100)}% - كويس بس خلي بالك.`,
            increase: Math.round(increase * 100)
        };
    }

    return { risk: 'low', message: null, increase: Math.round(increase * 100) };
}

// ==================== 6. Initialize ====================

// Flag to prevent double-loading
let _aiCoachRendered = false;

// Main trigger function
function triggerAICoachIfVisible() {
    const container = document.getElementById('ai-coach-card');
    const coachView = document.getElementById('coach-view') || document.getElementById('view-coach');

    console.log('[AI Coach] triggerAICoachIfVisible called');
    console.log('[AI Coach] container exists:', !!container);
    console.log('[AI Coach] _aiCoachRendered:', _aiCoachRendered);

    if (container && !_aiCoachRendered) {
        // Just render if container exists - don't check visibility
        // The container may be in a tab that's not visually showing yet
        _aiCoachRendered = true;
        console.log('[AI Coach] Triggering render...');
        renderAICoachCard();
    }
}

// Auto-render when page loads (if coach tab is default)
document.addEventListener('DOMContentLoaded', () => {
    console.log('[AI Coach] DOMContentLoaded fired');

    // Delay to allow page to fully render
    setTimeout(() => {
        console.log('[AI Coach] Initial check after 1s');
        triggerAICoachIfVisible();
    }, 1000);

    // Also listen for coach tab clicks
    document.querySelectorAll('[data-tab="today"], .coach-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('[AI Coach] Tab clicked');
            _aiCoachRendered = false; // Allow re-render
            setTimeout(triggerAICoachIfVisible, 300);
        });
    });
});

// Also trigger when switchView is called to 'coach'
const _originalSwitchView = window.switchView;
if (typeof _originalSwitchView === 'function') {
    window.switchView = function (view) {
        const result = _originalSwitchView.apply(this, arguments);
        if (view === 'coach') {
            console.log('[AI Coach] switchView to coach detected');
            _aiCoachRendered = false;
            setTimeout(triggerAICoachIfVisible, 500);
        }
        return result;
    };
}

// Export functions for global access
window.getAICoachInsight = getAICoachInsight;
window.renderAICoachCard = renderAICoachCard;
window.refreshAIInsight = refreshAIInsight;
window.analyzeSessionCompletion = analyzeSessionCompletion;
window.checkOvertrainingRisk = checkOvertrainingRisk;
window.triggerAICoachIfVisible = triggerAICoachIfVisible;

console.log('[ERS AI Coach] Module loaded ✅');
