import { db, Telegram_Controller, UI_Helper, Router } from './app.js';
import { doc, getDoc, setDoc, updateDb, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let generatedPacketSlug = "";

export const Dashboard_Module = {
    loadDashboardData: async function() {
        const user = Telegram_Controller.getUser();
        try {
            const adminDoc = await getDoc(doc(db, "admins", user.id.toString()));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                document.getElementById('dash-chan-name').innerText = data.channelName || "My Channel";
            }
            
            // Render demo or fetched active/history packets
            document.getElementById('stat-total-packets').innerText = "25";
            document.getElementById('stat-total-opens').innerText = "4,850";
            document.getElementById('stat-total-earnings').innerText = "$9.700 USDT";

            document.getElementById('admin-packets-list').innerHTML = `
                <div class="packet-item-card">
                    <div class="packet-info">
                        <h4>USDT Red Packet (100 USDT)</h4>
                        <p>Limit: 500 | Opened: 327 | Remaining: 173</p>
                    </div>
                    <span class="packet-status">🟢 Active</span>
                </div>
            `;
        } catch (e) {
            console.error("Error loading dashboard:", e);
        }
    },

    checkCooldownStatus: function() {
        const lastPublishTime = localStorage.getItem('admin_last_publish');
        const cooldownDuration = 60 * 60 * 1000; // 1 Hour
        const cooldownBox = document.getElementById('cooldown-timer-box');
        const submitBtn = document.getElementById('publish-submit-btn');

        if (lastPublishTime) {
            const elapsed = Date.now() - parseInt(lastPublishTime);
            if (elapsed < cooldownDuration) {
                const remaining = cooldownDuration - elapsed;
                const min = Math.floor(remaining / 60000);
                const sec = Math.floor((remaining % 60000) / 1000);
                
                document.getElementById('cooldown-time').innerText = `${min}:${sec < 10 ? '0' : ''}${sec}`;
                cooldownBox.style.display = 'block';
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.5";
                return false;
            }
        }
        cooldownBox.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        return true;
    },

    initCreateForm: function() {
        const form = document.getElementById('create-packet-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            if (!this.checkCooldownStatus()) {
                UI_Helper.showToast("⏱️ 1-hour cooldown active. Please wait.");
                return;
            }

            const tokenName = document.getElementById('token-name').value.trim();
            const amount = document.getElementById('token-amount').value.trim();
            const openLimit = parseInt(document.getElementById('open-limit').value);
            const binanceLink = document.getElementById('binance-link').value.trim();

            if (!binanceLink.includes("binance.com")) {
                UI_Helper.showToast("❌ Red Packet Link must be a valid Binance link.");
                return;
            }

            UI_Helper.showToast("Publishing Red Packet...");

            setTimeout(() => {
                const packetId = 'rp_' + Math.random().toString(36).substring(2, 9);
                generatedPacketSlug = `https://t.me/YourBotName?startapp=${packetId}`;

                // Save cooldown timestamp in local storage
                localStorage.setItem('admin_last_publish', Date.now().toString());

                // Hide form, show success link box
                form.style.display = 'none';
                document.getElementById('success-link-box').style.display = 'block';
                document.getElementById('generated-link').value = generatedPacketSlug;

                UI_Helper.showToast("✅ Red Packet published successfully!");
            }, 1000);
        };
    },

    copyLink: function() {
        const linkInput = document.getElementById('generated-link');
        linkInput.select();
        navigator.clipboard.writeText(linkInput.value);
        UI_Helper.showToast("📋 Link copied to clipboard!");
    },

    shareToTelegram: function() {
        const shareNote = "🔥 Exclusive Crypto Drop! Claim your free USDT Red Packet now before it expires. Fast fingers only! 👇\n\n" + generatedPacketSlug;
        const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(generatedPacketSlug)}&text=${encodeURIComponent(shareNote)}`;
        window.location.href = tgShareUrl;
    }
};

window.Dashboard_Module = Dashboard_Module;
window.addEventListener('DOMContentLoaded', () => {
    Dashboard_Module.initCreateForm();
});
