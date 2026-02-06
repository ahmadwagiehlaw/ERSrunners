/* ERS Admin - League Diagnostic & Fixer Tool */

// ==================== دوري المحافظات: أداة التشخيص المتقدمة ====================

async function loadLeagueDiagnostics() {
    const container = document.getElementById('league-diagnostics-container');
    if (!container) return;

    container.innerHTML = `
        <div style="padding:20px; text-align:center;">
            <div class="spinner" style="margin:0 auto 15px; border-top-color:#f59e0b;"></div>
            <div style="font-size:12px; color:#9ca3af;">جاري تحليل بيانات دوري المحافظات...</div>
        </div>`;

    try {
        // 1. Force refresh للبيانات
        allUsersCache = [];
        await fetchTopRunners();

        // 2. مفتاح الشهر الحالي
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // 3. قاموس التحليل
        const REGION_AR = {
            "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية",
            "Mansoura": "المنصورة", "Dakahlia": "الدقهلية", "Sharkia": "الشرقية",
            "Gharbia": "الغربية", "Menofia": "المنوفية", "Beheira": "البحيرة",
            "Kafr El Sheikh": "كفر الشيخ", "Qalyubia": "القليوبية", "Damietta": "دمياط",
            "Port Said": "بورسعيد", "Ismailia": "الإسماعيلية", "Suez": "السويس",
            "Red Sea": "البحر الأحمر", "South Sinai": "جنوب سيناء", "North Sinai": "شمال سيناء",
            "Sinai": "سيناء", "Beni Suef": "بني سويف", "Fayoum": "الفيوم",
            "Minya": "المنيا", "Assiut": "أسيوط", "Sohag": "سوهاج",
            "Qena": "قنا", "Luxor": "الأقصر", "Aswan": "أسوان",
            "Matrouh": "مطروح", "New Valley": "الوادي الجديد"
        };

        // 4. تجميع البيانات مع تسجيل تفصيلي
        let analysisData = {};
        let totalUsers = 0;
        let usersWithData = 0;
        let missingRegion = 0;
        let zeroMonth = 0;

        allUsersCache.forEach(user => {
            totalUsers++;

            // فحص البيانات
            const region = user.region ? user.region.trim() : null;
            const monthDist = parseFloat(user.monthDist) || 0;
            const lastMonthKey = user.lastMonthKey || "";
            const isCurrentMonth = lastMonthKey === currentMonthKey;

            // تسجيل الإحصائيات
            if (!region) {
                missingRegion++;
                return;
            }

            if (monthDist === 0) {
                zeroMonth++;
            } else {
                usersWithData++;
            }

            // إعداد المفتاح العربي
            const govName = REGION_AR[region] || region;

            if (!analysisData[govName]) {
                analysisData[govName] = {
                    englishName: region,
                    arabicName: govName,
                    totalPlayers: 0,
                    activePlayers: 0,
                    totalDist: 0,
                    players: []
                };
            }

            const gov = analysisData[govName];
            gov.totalPlayers++;

            if (monthDist > 0 && isCurrentMonth) {
                gov.activePlayers++;
                gov.totalDist += monthDist;
            }

            // تسجيل تفاصيل اللاعب
            gov.players.push({
                name: user.name,
                monthDist: monthDist,
                lastMonthKey: lastMonthKey,
                isCurrentMonth: isCurrentMonth,
                hasData: monthDist > 0
            });
        });

        // 5. ترتيب المحافظات
        const sorted = Object.values(analysisData).sort((a, b) => b.totalDist - a.totalDist);

        // 6. بناء التقرير
        let html = `
            <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:10px; padding:15px; margin-bottom:20px;">
                <h3 style="color:#10b981; margin:0 0 10px 0; font-size:16px;">📊 ملخص التشخيص</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; font-size:12px;">
                    <div><strong>إجمالي الأعضاء:</strong> ${totalUsers}</div>
                    <div><strong>لديهم بيانات:</strong> ${usersWithData}</div>
                    <div><strong>بدون محافظة:</strong> <span style="color:#ef4444;">${missingRegion}</span></div>
                    <div><strong>مسافة شهرية = 0:</strong> ${zeroMonth}</div>
                    <div><strong>مفتاح الشهر:</strong> <code>${currentMonthKey}</code></div>
                    <div><strong>المحافظات النشطة:</strong> ${sorted.filter(g => g.activePlayers > 0).length}</div>
                </div>
            </div>

            <div style="margin-bottom:15px;">
                <h3 style="color:#fff; font-size:14px; margin:0 0 10px 0;">🏆 ترتيب المحافظات (حسب إجمالي المسافات)</h3>
                <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:10px;">
        `;

        if (sorted.length === 0) {
            html += `<div style="text-align:center; padding:20px; color:#9ca3af;">لا توجد محافظات مسجلة</div>`;
        } else {
            sorted.forEach((gov, index) => {
                const rank = index + 1;
                const isGiza = gov.arabicName === 'الجيزة';
                const highlightStyle = isGiza ? 'background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3);' : '';

                html += `
                    <div style="padding:10px; margin-bottom:8px; border-radius:8px; ${highlightStyle}">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="color:#fff; font-size:14px;">
                                    ${rank}. ${gov.arabicName} ${isGiza ? '⚠️' : ''}
                                </strong>
                                <div style="font-size:11px; color:#9ca3af; margin-top:3px;">
                                    ${gov.englishName} • ${gov.activePlayers} نشط من ${gov.totalPlayers}
                                </div>
                            </div>
                            <div style="text-align:left;">
                                <div style="font-weight:bold; color:var(--primary); font-size:16px;">
                                    ${gov.totalDist.toFixed(1)}
                                </div>
                                <div style="font-size:10px; color:#9ca3af;">كم</div>
                            </div>
                        </div>
                        
                        <!-- تفاصيل اللاعبين -->
                        <details style="margin-top:10px;">
                            <summary style="cursor:pointer; font-size:11px; color:#9ca3af;">
                                👥 عرض اللاعبين (${gov.players.length})
                            </summary>
                            <div style="margin-top:10px; max-height:200px; overflow-y:auto;">
                                ${gov.players.map(p => {
                    const statusIcon = p.hasData && p.isCurrentMonth ? '✅' : (p.hasData ? '⚠️' : '❌');
                    const statusColor = p.hasData && p.isCurrentMonth ? '#10b981' : (p.hasData ? '#f59e0b' : '#ef4444');
                    return `
                                        <div style="display:flex; justify-content:space-between; padding:5px; font-size:11px; border-bottom:1px solid rgba(255,255,255,0.05);">
                                            <div>
                                                ${statusIcon} ${p.name}
                                                ${!p.isCurrentMonth && p.hasData ? `<span style="font-size:9px; color:#f59e0b;">(Month: ${p.lastMonthKey})</span>` : ''}
                                            </div>
                                            <div style="color:${statusColor}; font-weight:bold;">
                                                ${p.monthDist.toFixed(1)} كم
                                            </div>
                                        </div>
                                    `;
                }).join('')}
                            </div>
                        </details>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>

            <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:10px; padding:15px;">
                <h3 style="color:#ef4444; margin:0 0 10px 0; font-size:14px;">🔧 أدوات الإصلاح</h3>
                <div style="display:flex; flex-wrap:wrap; gap:10px;">
                    <button class="btn btn-primary" onclick="fixRegionMismatch()" style="flex:1; min-width:150px;">
                        🔄 إعادة حساب البيانات
                    </button>
                    <button class="btn btn-secondary" onclick="exportLeagueDataAsCSV()" style="flex:1; min-width:150px;">
                        📥 تصدير كـ CSV
                    </button>
                    <button class="btn btn-ghost" onclick="loadLeagueDiagnostics()" style="flex:1; min-width:150px;">
                        🔃 تحديث
                    </button>
                </div>
                <div style="margin-top:10px; font-size:10px; color:#9ca3af;">
                    💡 <strong>ملاحظة:</strong> إعادة الحساب ستقوم بإصلاح البيانات المحفوظة في قاعدة البيانات
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (e) {
        console.error('Error in League Diagnostics:', e);
        container.innerHTML = `
            <div style="text-align:center; padding:30px; color:#ef4444;">
                <div style="font-size:40px; margin-bottom:10px;">❌</div>
                <div style="font-size:14px;">حدث خطأ أثناء التحليل</div>
                <div style="font-size:11px; color:#9ca3af; margin-top:10px;">${e.message}</div>
            </div>`;
    }
}

// دالة إصلاح التباين في البيانات
async function fixRegionMismatch() {
    if (!confirm('هل أنت متأكد من إعادة حساب البيانات لجميع المستخدمين؟\n\nهذا قد يستغرق بعض الوقت...')) {
        return;
    }

    const btn = event.target;
    btn.innerText = 'جاري المعالجة...';
    btn.disabled = true;

    try {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // جلب جميع المستخدمين
        const usersSnap = await db.collection('users').get();
        let updated = 0;
        let skipped = 0;

        for (const userDoc of usersSnap.docs) {
            const uid = userDoc.id;
            const userData = userDoc.data();

            // حساب المسافة الشهرية الحقيقية من السجلات
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const runsSnap = await db.collection('users').doc(uid).collection('runs')
                .where('timestamp', '>=', startOfMonth)
                .get();

            let calculatedMonthDist = 0;
            runsSnap.forEach(runDoc => {
                const run = runDoc.data();
                if (run.type === 'Run' || run.type === 'Race') {
                    calculatedMonthDist += parseFloat(run.dist) || 0;
                }
            });

            // تحديث البيانات إذا اختلفت
            const storedMonthDist = parseFloat(userData.monthDist) || 0;
            const diff = Math.abs(calculatedMonthDist - storedMonthDist);

            if (diff > 0.01) {
                await db.collection('users').doc(uid).update({
                    monthDist: calculatedMonthDist,
                    lastMonthKey: currentMonthKey
                });
                updated++;
            } else {
                // فقط تحديث lastMonthKey إذا كان ناقصاً
                if (userData.lastMonthKey !== currentMonthKey) {
                    await db.collection('users').doc(uid).update({
                        lastMonthKey: currentMonthKey
                    });
                    updated++;
                } else {
                    skipped++;
                }
            }
        }

        showToast(`✅ تم تحديث ${updated} عضو • تم تخطي ${skipped}`, 'success');

        // إعادة تحميل التشخيص
        setTimeout(loadLeagueDiagnostics, 1000);

    } catch (e) {
        console.error('Fix error:', e);
        showToast('حدث خطأ أثناء الإصلاح', 'error');
    } finally {
        btn.innerText = '🔄 إعادة حساب البيانات';
        btn.disabled = false;
    }
}

// تصدير البيانات كـ CSV
function exportLeagueDataAsCSV() {
    try {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let csv = 'الاسم,المحافظة,مسافة الشهر,مفتاح الشهر الأخير,متطابق؟\n';

        allUsersCache.forEach(user => {
            const name = (user.name || '').replace(/,/g, ' ');
            const region = (user.region || 'غير محدد').replace(/,/g, ' ');
            const monthDist = parseFloat(user.monthDist) || 0;
            const lastMonthKey = user.lastMonthKey || 'غير محدد';
            const isMatch = lastMonthKey === currentMonthKey ? 'نعم' : 'لا';

            csv += `${name},${region},${monthDist.toFixed(2)},${lastMonthKey},${isMatch}\n`;
        });

        // تحويل إلى Blob وتنزيل
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // \ufeff = UTF-8 BOM
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `league_data_${currentMonthKey}.csv`;
        link.click();

        showToast('✅ تم التصدير بنجاح', 'success');
    } catch (e) {
        console.error('Export error:', e);
        showToast('حدث خطأ أثناء التصدير', 'error');
    }
}
