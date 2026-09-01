import { db, showToast, Admin_Module } from './admin.js';
import { 
    collection, 
    getDocs, 
    doc, 
    runTransaction, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let withdrawalsCache = [];

export const Status_Module = {
    loadWithdrawals: async function() {
        const tbody = document.getElementById('withdrawals-table-body');
        if (!tbody) return;

        try {
            const querySnapshot = await getDocs(collection(db, "withdrawals"));
            withdrawalsCache = [];

            if (querySnapshot.empty) {
                tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">No withdrawal requests recorded.</td></tr>`;
                return;
            }

            let pendingCount = 0;
            let totalPaid = 0;

            querySnapshot.forEach(docSnap => {
                const item = docSnap.data();
                withdrawalsCache.push({ id: docSnap.id, ...item });

                if (item.status === 'pending') pendingCount++;
                if (item.status === 'approved') totalPaid += (item.netAmount || 0);
            });

            // Sort from newest to oldest
            withdrawalsCache.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const statPending = document.getElementById('stat-pending-withdrawals');
            const statPaid = document.getElementById('stat-total-paid');
            if (statPending) statPending.innerText = pendingCount;
            if (statPaid) statPaid.innerText = `$${totalPaid.toFixed(2)}`;

            this.filterWithdrawals();

        } catch (error) {
            console.error("Error loading withdrawals:", error);
            tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">Failed to load withdrawal requests.</td></tr>`;
        }
    },

    filterWithdrawals: function() {
        const filter = document.getElementById('withdraw-filter')?.value || 'all';
        const tbody = document.getElementById('withdrawals-table-body');
        if (!tbody) return;

        let filtered = withdrawalsCache;
        if (filter !== 'all') {
            filtered = withdrawalsCache.filter(w => w.status === filter);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">No withdrawal requests found for selected filter.</td></tr>`;
            return;
        }

        let html = "";
        filtered.forEach(req => {
            const dateStr = req.createdAt?.seconds 
                ? new Date(req.createdAt.seconds * 1000).toLocaleString() 
                : 'N/A';

            let statusBadge = `<span class="badge badge-pending">Pending</span>`;
            if (req.status === 'approved') statusBadge = `<span class="badge badge-approved">Approved</span>`;
            if (req.status === 'rejected') statusBadge = `<span class="badge badge-rejected">Rejected</span>`;

            let actionBtns = `-`;
            if (req.status === 'pending') {
                actionBtns = `
                    <div class="action-btn-group">
                        <button class="btn-approve" onclick="Status_Module.approveWithdrawal('${req.id}')">Approve</button>
                        <button class="btn-reject" onclick="Status_Module.rejectWithdrawal('${req.id}')">Reject</button>
                    </div>
                `;
            }

            html += `
                <tr>
                    <td><b>${req.telegramUserId}</b></td>
                    <td>${req.binanceUid}</td>
                    <td>$${(req.requestedAmount || 0).toFixed(2)}</td>
                    <td>$${(req.netAmount || 0).toFixed(2)}</td>
                    <td>${statusBadge}</td>
                    <td>${dateStr}</td>
                    <td>${actionBtns}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    approveWithdrawal: async function(requestId) {
        if (!confirm("Are you sure you want to APPROVE this withdrawal request?")) return;

        try {
            showToast("⏳ Approving withdrawal...");

            const withdrawRef = doc(db, "withdrawals", requestId);
            await runTransaction(db, async (transaction) => {
                const withdrawSnap = await transaction.get(withdrawRef);
                if (!withdrawSnap.exists()) throw new Error("Request doc does not exist.");
                if (withdrawSnap.data().status !== 'pending') throw new Error("Request is not pending.");

                transaction.update(withdrawRef, {
                    status: "approved",
                    approvedAt: serverTimestamp()
                });
            });

            showToast("✅ Withdrawal request APPROVED!");
            await this.loadWithdrawals();

        } catch (error) {
            console.error("Approve error:", error);
            showToast(`❌ ${error.message || "Failed to approve request."}`);
        }
    },

    rejectWithdrawal: async function(requestId) {
        if (!confirm("Are you sure you want to REJECT this request? Balance will be refunded to user.")) return;

        try {
            showToast("⏳ Rejecting request & refunding balance...");

            const withdrawRef = doc(db, "withdrawals", requestId);

            await runTransaction(db, async (transaction) => {
                const withdrawSnap = await transaction.get(withdrawRef);
                if (!withdrawSnap.exists()) throw new Error("Withdrawal record not found.");
                
                const data = withdrawSnap.data();
                if (data.status !== 'pending') throw new Error("Request is no longer pending.");

                const userRef = doc(db, "admins", data.telegramUserId);
                const userSnap = await transaction.get(userRef);

                if (userSnap.exists()) {
                    const currentWith = userSnap.data().withdrawableBalance || 0;
                    const currentAvail = userSnap.data().availableBalance || 0;

                    // Refund requested amount back to withdrawable & available balance
                    transaction.update(userRef, {
                        withdrawableBalance: currentWith + data.requestedAmount,
                        availableBalance: currentAvail + data.requestedAmount,
                        updatedAt: serverTimestamp()
                    });
                }

                transaction.update(withdrawRef, {
                    status: "rejected",
                    rejectedAt: serverTimestamp()
                });
            });

            showToast("✅ Withdrawal REJECTED and balance refunded successfully!");
            await this.loadWithdrawals();
            await Admin_Module.loadPartners();

        } catch (error) {
            console.error("Reject error:", error);
            showToast(`❌ ${error.message || "Failed to reject request."}`);
        }
    }
};

window.Status_Module = Status_Module;
