import { db, Telegram_Controller, UI_Helper, Router } from './partner.js';
import { doc, getDoc, setDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let generatedPacketSlug = "";
let cooldownTimerInterval = null;

export const Dashboard_Module = {
    loadDashboardData: async function() {
        const user = Telegram_Controller.getUser();
        try {
            const adminDoc = await getDoc(doc(db, "admins", user.id.toString()));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                const chanElem = document.getElementById('dash-chan-name');
                if (chanElem) chanElem.innerText = data.channelName || "My Channel";
            }
            
            // Render demo / dynamic stats safely
            const statPackets = document.getElementById('stat-total-packets');
            const statOpens = document.getElementById('stat-total-opens');
            const statEarnings = document.getElementById('stat-total-earnings');
            const packetsList = document.getElementById('admin-packets-list');

            if (statPackets) statPackets.innerText = "25";
            if (statOpens) statOpens.innerText = "4,850";
            if (statEarnings) statEarnings.innerText = "$9.700 USDT";

            if (packetsList) {
                packetsList.innerHTML = `
                    <div class="packet-item-card">
                        <div class="packet-info">
                            <h4>USDT Red Packet (100 USDT)</h4>
                            <p>Limit: 500 | Opened: 327 | Remaining: 173</p>
                        </div>
                        <span class="packet-status">🟢 Active</span>
                    </div>
                `;
            }
        } catch (e) {
            console.error("Error loading dashboard:", e);
        }
    },

    checkCooldownStatus: function() {
        if (cooldownTimerInterval) clearInterval(cooldownTimerInterval);

        const cooldownBox = document.getElementById('cooldown-timer-box');
        const submitBtn = document.getElementById('publish-submit-btn');

        const updateTimer = () => {
            const lastPublishTime = localStorage.getItem('admin_last_publish');
            const cooldownDuration = 60 * 60 * 1000; // 1 Hour in ms

            if (!lastPublishTime) {
                if (cooldownBox) cooldownBox.style.display = 'none';
                if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
                if (cooldownTimerInterval) clearInterval(cooldownTimerInterval);
                return true;
            }

            const elapsed = Date.now() - parseInt(lastPublishTime);
            if (elapsed < cooldownDuration) {
                const remaining = cooldownDuration - elapsed;
                const min = Math.floor(remaining / 60000);
                const sec = Math.floor((remaining % 60000) / 1000);
                
                const timerText = document.getElementById('cooldown-time');
                if (timerText) timerText.innerText = `${min}:${sec < 10 ? '0' : ''}${sec}`;
                
                if (cooldownBox) cooldownBox.style.display = 'flex';
                if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = "0.5"; }
                return false;
            } else {
                if (cooldownBox) cooldownBox.style.display = 'none';
                if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
                if (cooldownTimerInterval) clearInterval(cooldownTimerInterval);
                return true;
            }
        };

        const isReady = updateTimer();
        if (!isReady) {
            cooldownTimerInterval = setInterval(updateTimer, 1000);
        }
        return isReady;
    },

    initCreateForm: function() {
        const form = document.getElementById('create-packet-form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            if (!this.checkCooldownStatus()) {
                UI_Helper.showToast("⏱️ 1-hour cooldown active. Please wait.");
                return;
            }

            const tokenName = document.getElementById('token-name')?.value.trim();
            const amount = document.getElementById('token-amount')?.value.trim();
            const openLimit = parseInt(document.getElementById('open-limit')?.value || "0");
            const binanceLink = document.getElementById('binance-link')?.value.trim();

            if (!binanceLink || !binanceLink.includes("binance.com")) {
                UI_Helper.showToast("❌ Red Packet Link must be a valid Binance link.");
                return;
            }

            UI_Helper.showToast("Publishing Red Packet...");

            setTimeout(() => {
                const packetId = 'rp_' + Math.random().toString(36).substring(2, 9);
                generatedPacketSlug = `https://t.me/YourBotName?startapp=${packetId}`;

                // Save cooldown timestamp
                localStorage.setItem('admin_last_publish', Date.now().toString());

                // Hide form, show success link box
                form.style.display = 'none';
                
                const successBox = document.getElementById('success-link-box');
                const generatedInput = document.getElementById('generated-link');
                
                if (successBox) successBox.style.display = 'block';
                if (generatedInput) generatedInput.value = generatedPacketSlug;

                UI_Helper.showToast("✅ Red Packet published successfully!");
                this.checkCooldownStatus();
            }, 1000);
        };
    },

    resetCreateForm: function() {
        const form = document.getElementById('create-packet-form');
        const successBox = document.getElementById('success-link-box');
        if (form) {
            form.reset();
            form.style.display = 'block';
        }
        if (successBox) {
            successBox.style.display = 'none';
        }
        this.checkCooldownStatus();
    },

    copyLink: function() {
        const linkInput = document.getElementById('generated-link');
        if (linkInput) {
            linkInput.select();
            navigator.clipboard.writeText(linkInput.value);
            UI_Helper.showToast("📋 Link copied to clipboard!");
        }
    },

    shareToTelegram: function() {
        if (!generatedPacketSlug) return;
        const shareNote = "🔥 Exclusive Crypto Drop! Claim your free USDT Red Packet now before it expires. Fast fingers only! 👇\n\n" + generatedPacketSlug;
        const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(generatedPacketSlug)}&text=${encodeURIComponent(shareNote)}`;
        
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(tgShareUrl);
        } else {
            window.location.href = tgShareUrl;
        }
    }
};

window.Dashboard_Module = Dashboard_Module;

window.addEventListener('DOMContentLoaded', () => {
    Dashboard_Module.initCreateForm();
});
