async function loadRegionsLeague() {
    const container = document.getElementById('regions-league');
    if (!container) return;

    container.innerHTML = getSkeletonHTML('regions');

    try {
        const snap = await db.collection('users').get();

        const regionsMap = {};

        snap.forEach(doc => {
            const u = doc.data();
            const region = u.region;

            if (!region) return;
            if (!u.totalDist || u.totalDist <= 0) return; // محارب فقط

            if (!regionsMap[region]) {
                regionsMap[region] = {
                    name: region,
                    totalDist: 0,
                    warriors: 0
                };
            }

            regionsMap[region].totalDist += u.totalDist;
            regionsMap[region].warriors += 1;
        });

        const regionsArr = Object.values(regionsMap).map(r => {
            return {
                ...r,
                power: r.totalDist / r.warriors
            };
        });

        regionsArr.sort((a, b) => b.power - a.power);

        // Render
        container.innerHTML = regionsArr.map((r, i) => `
            <div class="region-card">
                <div class="rank">#${i + 1}</div>
                <div class="name">${r.name}</div>
                <div class="stats">
                    <span>${r.warriors} محارب</span>
                    <span>${r.totalDist.toFixed(1)} كم</span>
                </div>
                <div class="power-bar">
                    <div class="fill" style="width:${Math.min(r.power / regionsArr[0].power * 100, 100)}%"></div>
                </div>
                <div class="power-value">
                    القوة: ${r.power.toFixed(2)}
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="error">خطأ في تحميل دوري المحافظات</div>`;
    }
}
