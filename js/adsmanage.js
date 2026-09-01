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

                // Network 1 Settings
                const net1Toggle = document.getElementById('net1-toggle');
                const adsgramBlock = document.getElementById('adsgram-block-id');
                if (net1Toggle) net1Toggle.checked = data.network1Enabled ?? false;
                if (adsgramBlock) adsgramBlock.value = data.adsgramBlockId || "";

                // Network 2 Settings
                const net2Toggle = document.getElementById('net2-toggle');
                const monetagId = document.getElementById('monetag-id');
                const adexiumZone = document.getElementById('adexium-zone-id');
                const tadsadsKey = document.getElementById('tadsads-key');

                if (net2Toggle) net2Toggle.checked = data.network2Enabled ?? false;
                if (monetagId) monetagId.value = data.monetagId || "";
                if (adexiumZone) adexiumZone.value = data.adexiumZoneId || "";
                if (tadsadsKey) tadsadsKey.value = data.tadsadsKey || "";

                // Update Overview Stat Badge
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
        const net1Enabled = document.getElementById('net1-toggle')?.checked || false;
        const adsgramBlockId = document.getElementById('adsgram-block-id')?.value.trim() || "";

        const net2Enabled = document.getElementById('net2-toggle')?.checked || false;
        const monetagId = document.getElementById('monetag-id')?.value.trim() || "";
        const adexiumZoneId = document.getElementById('adexium-zone-id')?.value.trim() || "";
        const tadsadsKey = document.getElementById('tadsads-key')?.value.trim() || "";

        try {
            showToast("⏳ Saving Ad Configurations...");

            const configRef = doc(db, "app_config", "ad_settings");
            await setDoc(configRef, {
                // Network 1: Adsgram
                network1Enabled: net1Enabled,
                adsgramBlockId: adsgramBlockId,

                // Network 2: Monetag + Adexium + TadsAds
                network2Enabled: net2Enabled,
                monetagId: monetagId,
                adexiumZoneId: adexiumZoneId,
                tadsadsKey: tadsadsKey,

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
