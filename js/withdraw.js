import { Telegram_Controller, UI_Helper } from './app.js';

let pendingWithdrawAmount = 0;

export const Withdraw_Module = {
    loadProfileData: function() {
        // Fetch real-time balance data from DB / simulation
        document.getElementById('bal-available').innerText = "$12.450 USDT";
        document.getElementById('bal-holding').innerText = "$5.200 USDT";
        document.getElementById('bal-withdrawable').innerText = "$7.250 USDT";

        document.getElementById('prof-total-posts').innerText = "25";
        document.getElementById('prof-total-claimed').innerText = "4,850";

        this.initWithdrawForm();
    },

    switchTab: function(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
        document.querySelectorAll('.profile-tabs button').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(tabId).style.display = 'block';
        event.currentTarget.classList.add('active');
    },

    initWithdrawForm: function() {
        const form = document.getElementById('withdraw-form');
        form.onsubmit = (e) => {
            e.preventDefault();
            const binanceUid = document.getElementById('binance-uid').value.trim();
            const amount = parseFloat(document.getElementById('withdraw-amount').value);

            const availableBalance = 7.25; // Simulated available balance check

            if (amount < 1.0) {
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
            document.getElementById('modal-req-amt').innerText = amount.toFixed(2);
            document.getElementById('modal-fee-amt').innerText = fee.toFixed(2);
            document.getElementById('modal-net-amt').innerText = net.toFixed(2);
            document.getElementById('withdraw-modal').style.display = 'flex';
        };
    },

    confirmWithdraw: function() {
        document.getElementById('withdraw-modal').style.display = 'none';
        UI_Helper.showToast("✅ Withdrawal request submitted successfully!");
        document.getElementById('withdraw-form').reset();
    },

    closeModal: function() {
        document.getElementById('withdraw-modal').style.display = 'none';
    }
};

window.Withdraw_Module = Withdraw_Module;
