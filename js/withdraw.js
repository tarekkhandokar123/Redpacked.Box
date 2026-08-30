import { db, Telegram_Controller, UI_Helper } from './partner.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let pendingWithdrawAmount = 0;
let isFormInitialized = false;

export const Withdraw_Module = {
    loadProfileData: async function() {
        const user = Telegram_Controller.getUser();
        
        try {
            // Fetch real-time profile & balance data from Firestore
            const adminRef = doc(db, "admins", user.id.toString());
            const adminSnap = await getDoc(adminRef);

            let available = 12.45;
            let holding = 5.20;
            let withdrawable = 7.25;

            if (adminSnap.exists()) {
                const data = adminSnap.data();
                available = data.availableBalance ?? available;
                holding = data.holdingBalance ?? holding;
                withdrawable = data.withdrawableBalance ?? withdrawable;
            }

            // Update UI elements safely
            const elemAvail = document.getElementById('bal-available');
            const elemHold = document.getElementById('bal-holding');
            const elemWith = document.getElementById('bal-withdrawable');
            const elemPosts = document.getElementById('prof-total-posts');
            const elemClaimed = document.getElementById('prof-total-claimed');

            if (elemAvail) elemAvail.innerText = `$${available.toFixed(3)} USDT`;
            if (elemHold) elemHold.innerText = `$${holding.toFixed(3)} USDT`;
            if (elemWith) elemWith.innerText = `$${withdrawable.toFixed(3)} USDT`;

            if (elemPosts) elemPosts.innerText = "25";
            if (elemClaimed) elemClaimed.innerText = "4,850";

        } catch (e) {
            console.error("Error loading profile data:", e);
        }

        this.initWithdrawForm();
    },

    switchTab: function(tabId, btnElement) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
        document.querySelectorAll('.profile-tabs button').forEach(btn => btn.classList.remove('active'));
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.style.display = 'block';

        if (btnElement) {
            btnElement.classList.add('active');
        } else if (window.event && window.event.currentTarget) {
            window.event.currentTarget.classList.add('active');
        }
    },

    initWithdrawForm: function() {
        const form = document.getElementById('withdraw-form');
        if (!form || isFormInitialized) return;

        isFormInitialized = true;

        form.onsubmit = (e) => {
            e.preventDefault();
            const binanceUid = document.getElementById('binance-uid')?.value.trim();
            const amountInput = document.getElementById('withdraw-amount')?.value;
            const amount = parseFloat(amountInput);

            const withdrawableText = document.getElementById('bal-withdrawable')?.innerText.replace(/[^0-9.]/g, '') || "7.25";
            const availableBalance = parseFloat(withdrawableText);

            if (!binanceUid) {
                UI_Helper.showToast("❌ Please enter your Binance Pay UID.");
                return;
            }

            if (isNaN(amount) || amount < 1.0) {
                UI_Helper.showToast("❌ Minimum withdrawal amount is $1.00 USDT");
                return;
            }

            if (amount > availableBalance) {
                UI_Helper.showToast("❌ Insufficient withdrawable balance.");
                return;
            }

            pendingWithdrawAmount = amount;
            const fee = amount * 0.10; // 10% platform fee
            const net = amount - fee;

            // Show confirmation modal
            const modalReq = document.getElementById('modal-req-amt');
            const modalFee = document.getElementById('modal-fee-amt');
            const modalNet = document.getElementById('modal-net-amt');
            const modal = document.getElementById('withdraw-modal');

            if (modalReq) modalReq.innerText = amount.toFixed(2);
            if (modalFee) modalFee.innerText = fee.toFixed(2);
            if (modalNet) modalNet.innerText = net.toFixed(2);
            if (modal) modal.style.display = 'flex';
        };
    },

    confirmWithdraw: function() {
        const modal = document.getElementById('withdraw-modal');
        if (modal) modal.style.display = 'none';

        UI_Helper.showToast("✅ Withdrawal request submitted successfully!");
        
        const form = document.getElementById('withdraw-form');
        if (form) form.reset();
    },

    closeModal: function() {
        const modal = document.getElementById('withdraw-modal');
        if (modal) modal.style.display = 'none';
    }
};

window.Withdraw_Module = Withdraw_Module;
