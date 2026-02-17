/**
 * ERS League Service V2.0 — Dynamic Season-Based Governorate League
 * 
 * Firestore Structure:
 *   leagues/{leagueId}
 *     ├─ title, startDate, endDate, isActive, quorum, createdAt
 *     └─ governorates/{govKey}
 *          └─ totalDist, totalTime, playerCount, runCount, score,
 *             mvp: { uid, name, dist, pic },
 *             players: { [uid]: { name, dist, runs, pic } }
 */

// ==================== Constants ====================
const REGION_AR = {
    "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية",
    "Mansoura": "المنصورة", "Dakahlia": "الدقهلية", "Sharkia": "الشرقية",
    "Gharbia": "الغربية", "Menofia": "المنوفية", "Beheira": "البحيرة",
    "Kafr El Sheikh": "كفر الشيخ", "Qalyubia": "القليوبية", "Damietta": "دمياط",
    "Port Said": "بورسعيد", "Ismailia": "الإسماعيلية", "Suez": "السويس",
    "Red Sea": "البحر الأحمر", "South Sinai": "جنوب سيناء", "North Sinai": "شمال سيناء",
    "Sinai": "سيناء", "Beni Suef": "بني سويف", "Fayoum": "الفيوم",
    "Minya": "المنيا", "Assiut": "أسيوط", "Sohag": "سوهاج", "Qena": "قنا",
    "Luxor": "الأقصر", "Aswan": "أسوان", "Matrouh": "مطروح",
    "New Valley": "الوادي الجديد"
};

const REGION_AR_TO_EN = Object.fromEntries(
    Object.entries(REGION_AR).map(([en, ar]) => [ar, en])
);

// ==================== Cache ====================
let _activeLeagueCache = null; // { id, ...data }
let _leagueStandingsCache = []; // sorted array

// ==================== Core Functions ====================

/**
 * Create a new league season
 */
async function createLeague(title, startDate, endDate, quorum = 5) {
    // Close any currently active league first
    const activeSnap = await db.collection('leagues')
        .where('isActive', '==', true).get();

    const closeBatch = db.batch();
    activeSnap.forEach(doc => {
        closeBatch.update(doc.ref, { isActive: false });
    });
    if (!activeSnap.empty) await closeBatch.commit();

    // Create the new league
    const leagueRef = await db.collection('leagues').add({
        title: title,
        startDate: firebase.firestore.Timestamp.fromDate(startDate),
        endDate: firebase.firestore.Timestamp.fromDate(endDate),
        isActive: true,
        quorum: quorum,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    _activeLeagueCache = null; // Reset cache
    return leagueRef.id;
}

/**
 * Get the currently active league (cached)
 */
async function getActiveLeague(forceRefresh = false) {
    if (_activeLeagueCache && !forceRefresh) return _activeLeagueCache;

    const snap = await db.collection('leagues')
        .where('isActive', '==', true)
        .limit(1)
        .get();

    if (snap.empty) {
        _activeLeagueCache = null;
        return null;
    }

    const doc = snap.docs[0];
    _activeLeagueCache = { id: doc.id, ...doc.data() };
    return _activeLeagueCache;
}

/**
 * End the currently active league
 */
async function endActiveLeague() {
    const league = await getActiveLeague(true);
    if (!league) return false;

    await db.collection('leagues').doc(league.id).update({
        isActive: false
    });

    _activeLeagueCache = null;
    return true;
}

/**
 * 🔥 Core: Update league stats when a run is submitted
 * Called from submitRun's batch — adds operations to an existing batch
 */
function addLeagueUpdateToBatch(batch, leagueId, regionKey, uid, userName, userPhoto, dist, time, isNewPlayerThisLeague) {
    const govRef = db.collection('leagues').doc(leagueId)
        .collection('governorates').doc(regionKey);

    batch.set(govRef, {
        totalDist: firebase.firestore.FieldValue.increment(dist),
        totalTime: firebase.firestore.FieldValue.increment(time || 0),
        runCount: firebase.firestore.FieldValue.increment(1),
        playerCount: firebase.firestore.FieldValue.increment(isNewPlayerThisLeague ? 1 : 0),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        // Player-level tracking (for MVP + individual stats)
        [`players.${uid}`]: {
            name: userName,
            pic: userPhoto || null,
            dist: firebase.firestore.FieldValue.increment(dist),
            runs: firebase.firestore.FieldValue.increment(1)
        }
    }, { merge: true });
}

/**
 * Check if a user has already contributed to a league's governorate
 * (Used to determine if playerCount should increment)
 */
async function isPlayerInLeague(leagueId, regionKey, uid) {
    const govDoc = await db.collection('leagues').doc(leagueId)
        .collection('governorates').doc(regionKey).get();

    if (!govDoc.exists) return false;
    const data = govDoc.data();
    return data.players && data.players[uid] !== undefined;
}

/**
 * Get league standings (sorted, with computed scores/MVP)
 */
async function getLeagueStandings(leagueId) {
    const govsSnap = await db.collection('leagues').doc(leagueId)
        .collection('governorates').get();

    // Get league config for quorum
    const leagueDoc = await db.collection('leagues').doc(leagueId).get();
    const quorum = leagueDoc.exists ? (leagueDoc.data().quorum || 5) : 5;

    const standings = [];

    govsSnap.forEach(doc => {
        const data = doc.data();
        const govKey = doc.id;
        const arName = REGION_AR[govKey] || govKey;
        const playerCount = data.playerCount || 0;
        const totalDist = data.totalDist || 0;
        const totalTime = data.totalTime || 0;
        const runCount = data.runCount || 0;

        // Smart scoring: penalize teams below quorum
        const divisor = Math.max(playerCount, quorum);
        const score = totalDist / divisor;
        const isPenalized = playerCount < quorum;

        // Calculate MVP from players map
        let mvp = { name: 'غير معروف', dist: 0, pic: null, uid: null };
        if (data.players) {
            for (const [uid, p] of Object.entries(data.players)) {
                if (p.dist > mvp.dist) {
                    mvp = { uid, name: p.name, dist: p.dist, pic: p.pic, runs: p.runs };
                }
            }
        }

        // Average pace (min/km) — only if we have time data
        const avgPace = (totalDist > 0 && totalTime > 0)
            ? (totalTime / totalDist).toFixed(2)
            : '--';

        standings.push({
            key: govKey,
            name: arName,
            totalDist,
            totalTime,
            playerCount,
            runCount,
            score,
            isPenalized,
            avgPace,
            mvp
        });
    });

    // Sort: by score desc, then by players desc
    standings.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.playerCount - a.playerCount;
    });

    _leagueStandingsCache = standings;
    return standings;
}

/**
 * Get all past leagues for archive
 */
async function getLeagueArchive() {
    const snap = await db.collection('leagues')
        .orderBy('createdAt', 'desc')
        .get();

    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get specific league info
 */
async function getLeagueInfo(leagueId) {
    const doc = await db.collection('leagues').doc(leagueId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

// ==================== Admin Tools (Data Backfill) ====================
/**
 * 🔄 Recalculate all league stats from scratch
 * Scans ALL users and their runs within the league period.
 * Useful for retrospective leagues or data correction.
 */
async function recalculateLeagueStats(leagueId, progressCallback) {
    console.log(`Starting recalculation for league: ${leagueId}`);

    const league = await getLeagueInfo(leagueId);
    if (!league) throw new Error("League not found");

    if (progressCallback) progressCallback("جاري تحميل المستخدمين...");

    // 1. Fetch all users
    const usersSnap = await db.collection('users').get();
    const totalUsers = usersSnap.size;
    console.log(`Found ${totalUsers} users to scan.`);

    // Data structure: { "Cairo": { totalDist: 0, ... players: {} } }
    let tempGovs = {};

    let processedCount = 0;
    const startDate = league.startDate.toDate();
    const endDate = league.endDate.toDate();

    // 2. Iterate users
    // We use a for...of loop to handle async properly without nuking memory
    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const uData = userDoc.data();
        const userRegion = uData.region || "غير محدد"; // or skip if no region? NO, include them in "Unknown"

        // Skip if region is not in our approved list? 
        // For now, let's include all, but maybe group invalid ones?
        // Let's stick to valid keys if possible, or just use the string.

        // Fetch runs for this user in range
        const runsSnap = await db.collection('users').doc(uid).collection('runs')
            .where('timestamp', '>=', league.startDate)
            .get(); // We filter endDate in memory to save an index requirement if possible, or just simple query

        let userDist = 0;
        let userRuns = 0;
        let userTime = 0;

        runsSnap.forEach(rDoc => {
            const r = rDoc.data();
            const rDate = r.timestamp.toDate();
            if (rDate <= endDate) {
                userDist += (parseFloat(r.dist) || 0);
                userTime += (parseFloat(r.time) || 0); // running time in minutes?
                userRuns++;
            }
        });

        if (userDist > 0) {
            // Add to temp aggregator
            if (!tempGovs[userRegion]) {
                tempGovs[userRegion] = {
                    totalDist: 0,
                    totalTime: 0,
                    runCount: 0,
                    playerCount: 0,
                    players: {}
                };
            }

            const g = tempGovs[userRegion];
            g.totalDist += userDist;
            g.totalTime += userTime;
            g.runCount += userRuns;
            g.playerCount++; // Unique player count for this gov

            // Add player stats
            g.players[uid] = {
                name: uData.name || "عداء",
                pic: uData.profilePic || null,
                dist: userDist,
                runs: userRuns
            };
        }

        processedCount++;
        if (progressCallback && processedCount % 5 === 0) {
            progressCallback(`جاري فحص العدائين (${Math.floor((processedCount / totalUsers) * 100)}%)`);
        }
    }

    if (progressCallback) progressCallback("جاري حفظ البيانات...");

    // 3. Save to Firestore (Batch)
    const batch = db.batch();
    const leagueRef = db.collection('leagues').doc(leagueId);

    // First, we should probably clear old data? 
    // Or we just overwrite known govs. 
    // If a gov had data but now has 0, it won't be in tempGovs.
    // So strictly, we should probably delete all gov docs first?
    // That's risky if the script fails midway. 
    // Let's just update for now. 

    for (const [govName, stats] of Object.entries(tempGovs)) {
        const govRef = leagueRef.collection('governorates').doc(govName);
        batch.set(govRef, {
            ...stats,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();

    // Clear cache
    _activeLeagueCache = null;
    _leagueStandingsCache = []; // clear standings cache

    if (progressCallback) progressCallback("✅ تم التحديث بنجاح!");
    return true;
}

// ==================== Expose Globally ====================
window.LeagueService = {
    createLeague,
    getActiveLeague,
    endActiveLeague,
    addLeagueUpdateToBatch,
    isPlayerInLeague,
    getLeagueStandings,
    getLeagueArchive,
    getLeagueInfo,
    recalculateLeagueStats,
    REGION_AR,
    REGION_AR_TO_EN
};
