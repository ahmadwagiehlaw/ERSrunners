// هذا ملف مساعد لدالة loadMarketData المحسّنة
// استخدم هذا الكود لاستبدال الدالة الحالية

async function loadMarketData() {
    // 1. تحديث سعر الدولار (USD/EGP) - API موثوق ✅
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.EGP) {
            const oldVal = marketData.USD.val;
            marketData.USD.val = data.rates.EGP;
            marketData.USD.change = oldVal > 0 ? ((data.rates.EGP - oldVal) / oldVal) * 100 : 0;
            marketData.USD.lastUpdate = new Date();
        }
    } catch (e) {
        console.warn('فشل تحميل سعر الدولار:', e.message);
    }

    // 2. تحديث سعر الذهب (Gold XAU/USD) بالدولار للأونصة ✅
    try {
        // API موثوق من goldprice.org
        const goldRes = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
        const goldData = await goldRes.json();

        if (goldData && goldData.items && goldData.items.length > 0) {
            const xauPrice = goldData.items[0].xauPrice;
            if (xauPrice) {
                const pricePerOz = parseFloat(xauPrice);
                const oldGold = marketData.GOLD.val;
                marketData.GOLD.val = pricePerOz;
                marketData.GOLD.change = oldGold > 0 ? ((pricePerOz - oldGold) / oldGold) * 100 : 0;
                marketData.GOLD.lastUpdate = new Date();
            }
        }
    } catch (e) {
        console.warn('فشل تحميل سعر الذهب:', e.message);
    }

    // 3. تحديث سعر الألمونيوم (Aluminum USD/MT) بالدولار للطن المتري
    try {
        // استخدام API من metals-api.com (free tier)
        // البديل: استخدام سعر ثابت يتم تحديثه من مصادر موثوقة
        // سعر الألمونيوم النموذجي في LME: $2400-2550 للطن المتري

        const alRes = await fetch('https://metals-api.com/api/latest?access_key=YOUR_API_KEY&base=USD&symbols=ALU');
        const alData = await alRes.json();

        if (alData && alData.success && alData.rates && alData.rates.ALU) {
            // الـ API يعطي السعر بشكل معكوس، لذلك نحتاج لعكسه
            const pricePerTon = 1 / alData.rates.ALU;
            const oldAl = marketData.ALUMINUM.val;
            marketData.ALUMINUM.val = pricePerTon;
            marketData.ALUMINUM.change = oldAl > 0 ? ((pricePerTon - oldAl) / oldAl) * 100 : 0;
            marketData.ALUMINUM.lastUpdate = new Date();
        }
    } catch (e) {
        // Fallback: استخدام سعر تقريبي من مصادر موثوقة
        console.warn('فشل تحميل سعر الألمونيوم من API، استخدام قيمة تقريبية');
        // السعر النموذجي للألمونيوم في بورصة لندن للمعادن (LME)
        // يمكن تحديثه يدوياً أو من scraping
        const estimatedPrice = 2485; // متوسط سعر معقول بناءً على 2024-2025
        const oldAl = marketData.ALUMINUM.val;
        if (Math.abs(oldAl - estimatedPrice) > 50) { // تحديث فقط إذا كان هناك فرق ملحوظ
            marketData.ALUMINUM.val = estimatedPrice;
            marketData.ALUMINUM.change = oldAl > 0 ? ((estimatedPrice - oldAl) / oldAl) * 100 : 0;
            marketData.ALUMINUM.lastUpdate = new Date();
        }
    }

    renderTicker();

    // تحديث تلقائي كل 5 دقائق
    if (marketInterval) clearInterval(marketInterval);
    marketInterval = setInterval(() => loadMarketData(), 5 * 60 * 1000);
}

/* 
ملاحظات مهمة:
- سعر الذهب: يتم جلبه من goldprice.org وهو موثوق وحقيقي ($/oz)
- سعر الدولار: من ExchangeRate API وهو دقيق جداً
- سعر الألمونيوم: يحتاج API key من metals-api.com (يوفر 50 طلب/شهر مجاناً)
  أو يمكن استخدام القيمة التقريبية المحدثة يدوياً

البديل الأفضل بدون API keys:
- يمكن استخدام web scraping لجلب الأسعار من مواقع موثوقة
- أو تحديث الأسعار يدوياً من مصادر مثل:
  * الذهب: kitco.com, goldprice.org
  * الألمونيوم: lme.com, investing.com
*/
