import { db } from './app.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const AdsManager = {
    config: {
        network1Enabled: true,
        adexiumZoneId: "9f52803f-59b8-42ff-b041-fe7a7863ea7c",

        network2Enabled: true,
        tadsKeys: ["11905", "11906", "11907"],

        network3Enabled: true,
        monetagFnName: "show_11714437"
    },

    async fetchConfig() {
        try {
            const configRef = doc(db, "app_config", "ad_settings");
            const snap = await getDoc(configRef);
            if (snap.exists()) {
                const data = snap.data();
                this.config = { ...this.config, ...data };
                
                if (typeof this.config.tadsKeys === 'string') {
                    this.config.tadsKeys = this.config.tadsKeys.split(',').map(k => k.trim());
                }
            }
        } catch (e) {
            console.warn("Could not load dynamic ad config, using defaults:", e);
        }
    },

    async playAd() {
        await this.fetchConfig();

        // Step 1: Try Adexium (বাস্তবে অ্যাড স্ক্রিনে না আসলে পরেরটাতে যাবে)
        if (this.config.network1Enabled) {
            const resAdexium = await this.tryAdexium();
            if (resAdexium) return true;
        }

        // Step 2: Try Tadsads (৩টি ID পর পর ট্রাই করবে)
        if (this.config.network2Enabled) {
            const keys = Array.isArray(this.config.tadsKeys) && this.config.tadsKeys.length > 0
                ? this.config.tadsKeys 
                : ["11905", "11906", "11907"];

            for (const key of keys) {
                const resTads = await this.tryTadsSingleKey(key);
                if (resTads) return true;
            }
        }

        // Step 3: Try Monetag (রিওয়ার্ডেড অ্যাড কমপ্লিট হলে True হবে)
        if (this.config.network3Enabled) {
            const resMonetag = await this.tryMonetag();
            if (resMonetag) return true;
        }

        throw new Error("No ads available or ad failed to display.");
    },

    // ----- 1. Adexium (Real DOM Check) -----
    tryAdexium() {
        return new Promise((resolve) => {
            if (typeof AdexiumWidget !== "undefined") {
                try {
                    const zoneId = this.config.adexiumZoneId || "9f52803f-59b8-42ff-b041-fe7a7863ea7c";
                    const initialIframes = document.querySelectorAll('iframe').length;

                    const widget = new AdexiumWidget({
                        wid: zoneId,
                        adFormat: "interstitial"
                    });
                    widget.autoMode();

                    // ২ সেকেন্ড পর চেক করবে Adexium নতুন কোনো iframe বা Element স্ক্রিনে এনেছে কিনা
                    setTimeout(() => {
                        const newIframes = document.querySelectorAll('iframe').length;
                        const adexiumEl = document.querySelector('[class*="adexium"], [id*="adexium"]');

                        if (newIframes > initialIframes || adexiumEl) {
                            // অ্যাড সত্যি স্ক্রিনে প্রদর্শিত হলে Success
                            resolve(true);
                        } else {
                            // অ্যাড লোড না হলে Fail ধরে Tadsads / Monetag-এ পাঠাবে
                            console.warn("Adexium did not show any ad. Moving to fallback...");
                            resolve(false);
                        }
                    }, 2200);

                } catch (e) {
                    console.warn("Adexium error:", e);
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    },

    // ----- 2. Tadsads Single Key Attempt -----
    tryTadsSingleKey(key) {
        return new Promise((resolve) => {
            if (typeof window.tads === "undefined") {
                return resolve(false);
            }

            try {
                let isResolved = false;

                const finish = (status) => {
                    if (!isResolved) {
                        isResolved = true;
                        resolve(status);
                    }
                };

                const adController = window.tads.init({
                    widgetId: String(key),
                    type: "fullscreen",
                    onShowReward: () => {
                        finish(true); // ইউজার সম্পূর্ণ অ্যাড দেখলে Success
                    },
                    onAdsNotFound: () => {
                        finish(false); // অ্যাড না পেলে পরের ID
                    },
                    onError: () => {
                        finish(false);
                    },
                    onClose: () => {
                        setTimeout(() => finish(false), 500);
                    }
                });

                if (adController && typeof adController.showAd === "function") {
                    adController.showAd().catch(() => finish(false));
                } else {
                    finish(false);
                }

                // ১০ সেকেন্ডের মধ্যে সাড়া না দিলে ফেল
                setTimeout(() => finish(false), 10000);

            } catch (e) {
                console.warn(`Tads Exception Key ${key}:`, e);
                resolve(false);
            }
        });
    },

    // ----- 3. Monetag -----
    tryMonetag() {
        return new Promise((resolve) => {
            const fnName = this.config.monetagFnName || "show_11714437";
            const monetagFn = window[fnName] || window.show_11714437;

            if (typeof monetagFn === "function") {
                monetagFn()
                    .then(() => resolve(true))
                    .catch((err) => {
                        console.warn("Monetag view failed/closed:", err);
                        resolve(false);
                    });
            } else {
                resolve(false);
            }
        });
    }
};
