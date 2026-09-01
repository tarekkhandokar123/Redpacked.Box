import { db, Telegram_Controller, UI_Helper } from './partner.js';
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    runTransaction, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let pendingWithdrawAmount = 0;
let pendingBinanceUid = "";
let isFormInitialized = false;

export const Withdraw_Module = {
    // ==========================================
    // 1. LOAD REAL-TIME PROFILE & STATS FROM FIRESTORE
    // ==========================================
    loadProfileData: async function() {
        const user = Telegram_Controller.getUser();
        if (!user || !user.id) return;
        
        try {
            // Fetch real-time balances from admin profile
            const adminRef = doc(db, "admins", user.id.toString());
            const adminSnap = await getDoc(adminRef);

            let available = 0.00;
            let holding = 0.00;
            let withdrawable = 0.00;

            if (adminSnap.exists()) {
                const data = adminSnap.data();
                available = data.availableBalance ?? 0.00;
                holding = data.holdingBalance ?? 0.00;
                withdrawable = data.withdrawableBalance ?? 0.00;
            }

            // Query live stats from Firestore red_packets collection
            let totalPosts = 0;
            let totalClaimed = 0;

            const q = query(
                collection(db, "red_packets"),
                where("creatorTelegramId", "==", user.id.toString())
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                totalPosts = querySnapshot.size;
                querySnapshot.forEach(docSnap => {
                    const packet = docSnap.data();
                    totalClaimed += (packet.opened || packet.claimedCount || 0);
                });
            }

            // Safely update UI elements with live data
            const elemAvail = document.getElementById('bal-available');
            const elemHold = document.getElementById('bal-holding');
            const elemWith = document.getElementById('bal-withdrawable');
            const elemPosts = document.getElementById('prof-total-posts');
            const elemClaimed = document.getElementById('prof-total-claimed');

            if (elemAvail) elemAvail.innerText = `$${available.toFixed(3)} USDT`;
            if (elemHold) elemHold.innerText = `$${holding.toFixed(3)} USDT`;
            if (elemWith) elemWith.innerText = `$${withdrawable.toFixed(3)} USDT`;

            if (elemPosts) elemPosts.innerText = totalPosts.toLocaleString();
            if (elemClaimed) elemClaimed.innerText = totalClaimed.toLocaleString();

        } catch (e) {
            console.error("Error loading profile data:", e);
        }

        this.initWithdrawForm();
    },

    // ==========================================
    // 2. TAB NAVIGATION CONTROLLER
    // ==========================================
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

    // ==========================================
    // 3. INITIALIZE WITHDRAWAL FORM
    // ==========================================
    initWithdrawForm: function() {
        const form = document.getElementById('withdraw-form');
        if (!form || isFormInitialized) return;

        isFormInitialized = true;

        form.onsubmit = (e) => {
            e.preventDefault();
            const binanceUid = document.getElementById('binance-uid')?.value.trim();
            const amountInput = document.getElementById('withdraw-amount')?.value;
            const amount = parseFloat(amountInput);

            const withdrawableText = document.getElementById('bal-withdrawable')?.innerText.replace(/[^0-9.]/g, '') || "0.00";
            const availableBalance = parseFloat(withdrawableText);

            if (!binanceUid) {
                UI_Helper.showToast("❌ Please enter your Binance Pay UID.");
                return;
            }

            if (isNaN(amount) || amount < 1.0) {
                UI_Helper.showToast("❌ Minimum withdrawal amount is $1.00 USDT.");
                return;
            }

            if (amount > availableBalance) {
                UI_Helper.showToast("❌ Insufficient withdrawable balance.");
                return;
            }

            pendingWithdrawAmount = amount;
            pendingBinanceUid = binanceUid;
            
            const fee = amount * 0.10; // 10% platform fee
            const net = amount - fee;

            // Render details to confirmation modal
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

    // ==========================================
    // 4. CONFIRM & SUBMIT WITHDRAWAL TO FIRESTORE
    // ==========================================
    confirmWithdraw: async function() {
        const user = Telegram_Controller.getUser();
        if (!user || !user.id || pendingWithdrawAmount <= 0 || !pendingBinanceUid) return;

        const modal = document.getElementById('withdraw-modal');
        
        try {
            UI_Helper.showToast("⏳ Submitting withdrawal request...");

            const fee = pendingWithdrawAmount * 0.10;
            const net = pendingWithdrawAmount - fee;
            const adminRef = doc(db, "admins", user.id.toString());

            // Run atomic transaction to safely deduct balance and create request record
            await runTransaction(db, async (transaction) => {
                const adminSnap = await transaction.get(adminRef);
                if (!adminSnap.exists()) {
                    throw new Error("Admin record not found.");
                }

                const currentWithdrawable = adminSnap.data().withdrawableBalance || 0;
                if (currentWithdrawable < pendingWithdrawAmount) {
                    throw new Error("Insufficient withdrawable balance.");
                }

                const currentAvailable = adminSnap.data().availableBalance || 0;
                const newWithdrawable = Math.max(0, currentWithdrawable - pendingWithdrawAmount);
                const newAvailable = Math.max(0, currentAvailable - pendingWithdrawAmount);

                // Update admin balance
                transaction.update(adminRef, {
                    withdrawableBalance: newWithdrawable,
                    availableBalance: newAvailable,
                    updatedAt: serverTimestamp()
                });

                // Create new withdrawal request document
                const withdrawRef = doc(collection(db, "withdrawals"));
                transaction.set(withdrawRef, {
                    id: withdrawRef.id,
                    telegramUserId: user.id.toString(),
                    username: user.username || "",
                    binanceUid: pendingBinanceUid,
                    requestedAmount: pendingWithdrawAmount,
                    feeAmount: fee,
                    netAmount: net,
                    status: "pending",
                    createdAt: serverTimestamp()
                });
            });

            if (modal) modal.style.display = 'none';
            UI_Helper.showToast("✅ Withdrawal request submitted successfully!");

            const form = document.getElementById('withdraw-form');
            if (form) form.reset();

            pendingWithdrawAmount = 0;
            pendingBinanceUid = "";

            // Reload profile data to reflect updated balances
            await this.loadProfileData();

        } catch (error) {
            console.error("Withdrawal submission error:", error);
            UI_Helper.showToast(`❌ ${error.message || "Failed to submit withdrawal request."}`);
        }
    },

    // ==========================================
    // 5. CLOSE MODAL
    // ==========================================
    closeModal: function() {
        const modal = document.getElementById('withdraw-modal');
        if (modal) modal.style.display = 'none';
    }
};

window.Withdraw_Module = Withdraw_Module;
