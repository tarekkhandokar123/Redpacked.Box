import { db, Telegram_Controller, UI_Helper, Router } from './partner.js';
import { 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let generatedPacketSlug = "";
let cooldownTimerInterval = null;

export const Dashboard_Module = {
    // ==========================================
    // 1. LOAD REAL-TIME DASHBOARD STATS FROM FIRESTORE
    // ==========================================
    loadDashboardData: async function() {
        const user = Telegram_Controller.getUser();
        try {
            // ১. এডমিন প্রোফাইল থেকে চ্যানেল নেম লোড
            const adminDoc = await getDoc(doc(db, "admins", user.id.toString()));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                const chanElem = document.getElementById('dash-chan-name');
                if (chanElem) chanElem.innerText = data.channelName || data.channelUsername || "My Channel";
            }
            
            // ২. ফায়ারবেস থেকে এই এডমিনের পাবলিশ করা সমস্ত Red Packet রিড করা
            const q = query(
                collection(db, "red_packets"),
                where("creatorTelegramId", "==", user.id.toString())
            );
            
            const querySnapshot = await getDocs(q);

            let totalPackets = 0;
            let totalOpens = 0;
            let listHTML = "";

            if (!querySnapshot.empty) {
                const packets = [];
                querySnapshot.forEach(docSnap => {
                    packets.push({ id: docSnap.id, ...docSnap.data() });
                });

                // নতুন থেকে পুরানো ক্রমানুসারে সর্ট (Client-side Sort)
                packets.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                totalPackets = packets.length;

                packets.forEach(packet => {
                    const opened = packet.opened || 0;
                    const limit = packet.openLimit || 0;
                    const remaining = Math.max(0, limit - opened);
                    totalOpens += opened;

                    const isActive = remaining > 0;
                    const statusBadge = isActive 
                        ? `<span class="packet-status" style="background: rgba(46, 204, 113, 0.15); color: #2ecc71;">🟢 Active</span>`
                        : `<span class="packet-status" style="background: rgba(231, 76, 60, 0.15); color: #e74c3c;">🔴 Completed</span>`;

                    listHTML += `
                        <div class="packet-item-card" style="margin-bottom: 12px;">
                            <div class="packet-info">
                                <h4>${packet.tokenName || 'USDT'} Red Packet (${packet.amount || '0'})</h4>
                                <p>Limit: ${limit} | Opened: ${opened} | Remaining: ${remaining}</p>
                            </div>
                            ${statusBadge}
                        </div>
                    `;
                });
            } else {
                listHTML = `<div style="text-align: center; color: #888; padding: 25px;">No Red Packets published yet.</div>`;
            }

            // প্রতি ক্লেইমে ইয়ার্নিং ক্যালকুলেশন ($0.002 CPM রেট অনুযায়ী)
            const totalEarnings = (totalOpens * 0.002).toFixed(3);

            // UI এলিমেন্টসমূহে অরিজিনাল লাইভ ডাটা বসানো
            const statPackets = document.getElementById('stat-total-packets');
            const statOpens = document.getElementById('stat-total-opens');
            const statEarnings = document.getElementById('stat-total-earnings');
            const packetsList = document.getElementById('admin-packets-list');

            if (statPackets) statPackets.innerText = totalPackets.toLocaleString();
            if (statOpens) statOpens.innerText = totalOpens.toLocaleString();
            if (statEarnings) statEarnings.innerText = `$${totalEarnings} USDT`;
            if (packetsList) packetsList.innerHTML = listHTML;

        } catch (e) {
            console.error("Error loading dashboard data:", e);
        }
    },

    // ==========================================
    // 2. COOLDOWN TIMER CONTROLLER
    // ==========================================
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

    // ==========================================
    // 3. CREATE & PUBLISH RED PACKET TO FIRESTORE
    // ==========================================
    initCreateForm: function() {
        const form = document.getElementById('create-packet-form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            if (!this.checkCooldownStatus()) {
                UI_Helper.showToast("⏱️ 1-hour cooldown active. Please wait.");
                return;
            }

            const tokenName = document.getElementById('token-name')?.value.trim() || 'USDT';
            const amount = document.getElementById('token-amount')?.value.trim();
            const openLimit = parseInt(document.getElementById('open-limit')?.value || "0");
            const binanceLink = document.getElementById('binance-link')?.value.trim();

            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                UI_Helper.showToast("⚠️ Please enter a valid Token Amount.");
                return;
            }

            if (!openLimit || isNaN(openLimit) || openLimit <= 0) {
                UI_Helper.showToast("⚠️ Please enter a valid Claim Limit (> 0).");
                return;
            }

            if (!binanceLink || !binanceLink.includes("binance.com")) {
                UI_Helper.showToast("❌ Red Packet Link must be a valid Binance link.");
                return;
            }

            const user = Telegram_Controller.getUser();
            const submitBtn = document.getElementById('publish-submit-btn');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Publishing..."; }

            UI_Helper.showToast("⏳ Publishing Red Packet to Live Database...");

            try {
                // এডমিনের ভেরিফাইড চ্যানেলের ইউজারনেম রিড করা
                let channelUsername = "";
                let channelTitle = "";
                const adminSnap = await getDoc(doc(db, "admins", user.id.toString()));
                if (adminSnap.exists()) {
                    const admData = adminSnap.data();
                    channelUsername = admData.channelUsername || "";
                    channelTitle = admData.channelName || "";
                }

                // সরাসরি ফায়ারবেসের 'red_packets' কালেকশনে লাইভ সেভ
                const docRef = await addDoc(collection(db, "red_packets"), {
                    creatorTelegramId: user.id.toString(),
                    creatorUsername: user.username,
                    creatorName: user.name,
                    channelUsername: channelUsername,
                    channelTitle: channelTitle,
                    tokenName: tokenName,
                    amount: amount,
                    openLimit: openLimit,
                    opened: 0, // সিকিউরিটি রুলসের শর্ত অনুযায়ী প্রাথমিক মান ০
                    binanceLink: binanceLink,
                    status: "active",
                    createdAt: serverTimestamp()
                });

                // ইউজার অ্যাপে ক্লেইম করার বট লিংক তৈরি
                const botUsername = "RedPacketBoxBot"; // আপনার আসল টেলিগ্রাম বট ইউজারনেম
                generatedPacketSlug = `https://t.me/${botUsername}?startapp=${docRef.id}`;

                // কুলডাউন টাইম সেভ করা
                localStorage.setItem('admin_last_publish', Date.now().toString());

                // ফর্ম হাইড করে সাকসেস বক্স শো করা
                form.style.display = 'none';
                
                const successBox = document.getElementById('success-link-box');
                const generatedInput = document.getElementById('generated-link');
                
                if (successBox) successBox.style.display = 'block';
                if (generatedInput) generatedInput.value = generatedPacketSlug;

                UI_Helper.showToast("🎉 Red Packet Published Live!");
                this.checkCooldownStatus();

            } catch (err) {
                console.error("Error publishing Red Packet:", err);
                UI_Helper.showToast(`❌ Error: ${err.message || "Failed to publish"}`);
            } finally {
                if (submitBtn) { 
                    submitBtn.disabled = false; 
                    submitBtn.innerText = "Verify & Publish Red Packet"; 
                }
            }
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
