import { db, showToast } from './admin.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const Ads_Manage_Module = {
    loadAdConfigurations: async function() {
        try {
            const configRef = doc(db, "app_config", "ad_settings");
            const configSnap = await getDoc(configRef);

            if (configSnap.exists()) {
                const data = configSnap.data();

                // Network 1: Adsgram
                const net1Toggle = document.getElementById('net1-toggle');
                const adsgramBlock = document.getElementById('adsgram-block-id');
                if (net1Toggle) net1Toggle.checked = data.network1Enabled ?? true;
                if (adsgramBlock) adsgramBlock.value = data.adsgramBlockId || "431323";

                // Network 2: Adexium & Tads
                const net2Toggle = document.getElementById('net2-toggle');
                const adexiumZone = document.getElementById('adexium-zone-id');
                const tadsadsKey = document.getElementById('tadsads-key');
                if (net2Toggle) net2Toggle.checked = data.network2Enabled ?? true;
                if (adexiumZone) adexiumZone.value = data.adexiumZoneId || "11907";
                if (tadsadsKey) tadsadsKey.value = data.tadsadsKey || "1751";

                // Network 3: Monetag
                const net3Toggle = document.getElementById('net3-toggle');
                const monetagId = document.getElementById('monetag-id');
                if (net3Toggle) net3Toggle.checked = data.network3Enabled ?? true;
                if (monetagId) monetagId.value = data.monetagId || "9669121";

                // Overview Stat Badges
                const statAdsgram = document.getElementById('stat-adsgram-status');
                if (statAdsgram) {
                    statAdsgram.innerText = data.network1Enabled ? "ON 🟢" : "OFF 🔴";
                }
            }
        } catch (error) {
            console.error("Error loading ad configs:", error);
        }
    },

    toggleNetwork: function(netNumber, isChecked) {
        showToast(`Ad Network ${netNumber} toggled ${isChecked ? 'ON' : 'OFF'}. Save changes to apply.`);
    },

    saveAdConfigurations: async function() {
        const net1Enabled = document.getElementById('net1-toggle')?.checked ?? true;
        const adsgramBlockId = document.getElementById('adsgram-block-id')?.value.trim() || "";

        const net2Enabled = document.getElementById('net2-toggle')?.checked ?? true;
        const adexiumZoneId = document.getElementById('adexium-zone-id')?.value.trim() || "";
        const tadsadsKey = document.getElementById('tadsads-key')?.value.trim() || "";

        const net3Enabled = document.getElementById('net3-toggle')?.checked ?? true;
        const monetagId = document.getElementById('monetag-id')?.value.trim() || "";

        try {
            showToast("⏳ Saving Ad Configurations...");

            const configRef = doc(db, "app_config", "ad_settings");
            await setDoc(configRef, {
                // Network 1
                network1Enabled: net1Enabled,
                adsgramBlockId: adsgramBlockId,

                // Network 2
                network2Enabled: net2Enabled,
                adexiumZoneId: adexiumZoneId,
                tadsadsKey: tadsadsKey,

                // Network 3
                network3Enabled: net3Enabled,
                monetagId: monetagId,

                updatedAt: serverTimestamp()
            }, { merge: true });

            const statAdsgram = document.getElementById('stat-adsgram-status');
            if (statAdsgram) {
                statAdsgram.innerText = net1Enabled ? "ON 🟢" : "OFF 🔴";
            }

            showToast("✅ All Ad Network Configurations Saved Successfully!");

        } catch (error) {
            console.error("Error saving ad settings:", error);
            showToast(`❌ ${error.message || "Failed to save ad settings."}`);
        }
    }
};

window.Ads_Manage_Module = Ads_Manage_Module;
