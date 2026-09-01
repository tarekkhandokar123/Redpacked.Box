import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { Status_Module } from './status.js';
import { Ads_Manage_Module } from './adsmanage.js';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBObsWUTRpIESXNW_wa2MvoblEmJc27TaQ",
  authDomain: "gift-box-io.firebaseapp.com",
  projectId: "gift-box-io",
  storageBucket: "gift-box-io.firebasestorage.app",
  messagingSenderId: "578138378445",
  appId: "1:578138378445:web:a74b708976e87c150d5984"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

let allPartnersCache = [];

export function showToast(message) {
    const container = document.getElementById('toast-container');
    if (container) {
        container.innerText = message;
        container.classList.add('show');
        setTimeout(() => container.classList.remove('show'), 3000);
    }
}

export const Admin_Module = {
    init: async function() {
        await this.loadPartners();
        await Status_Module.loadWithdrawals();
        await Ads_Manage_Module.loadAdConfigurations();
        this.initEditPartnerForm();
    },

    loadPartners: async function() {
        const tbody = document.getElementById('partners-table-body');
        if (!tbody) return;

        try {
            const querySnapshot = await getDocs(collection(db, "admins"));
            allPartnersCache = [];

            if (querySnapshot.empty) {
                tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">No partner accounts found.</td></tr>`;
                return;
            }

            let html = "";
            let totalPartners = 0;

            querySnapshot.forEach(docSnap => {
                const partner = docSnap.data();
                const userId = docSnap.id;
                allPartnersCache.push({ id: userId, ...partner });

                totalPartners++;

                html += `
                    <tr>
                        <td><b>${userId}</b></td>
                        <td>${partner.creatorName || partner.channelUsername || 'N/A'}</td>
                        <td>${partner.channelName || 'N/A'}</td>
                        <td>$${(partner.availableBalance || 0).toFixed(3)}</td>
                        <td>$${(partner.holdingBalance || 0).toFixed(3)}</td>
                        <td>$${(partner.withdrawableBalance || 0).toFixed(3)}</td>
                        <td>
                            <button class="btn-edit" onclick="Admin_Module.openPartnerModal('${userId}')">Edit</button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

            const statPartners = document.getElementById('stat-total-partners');
            if (statPartners) statPartners.innerText = totalPartners;

        } catch (error) {
            console.error("Error loading partners:", error);
            tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">Error loading partners.</td></tr>`;
        }
    },

    searchPartners: function() {
        const query = document.getElementById('partner-search-input')?.value.toLowerCase().trim();
        const tbody = document.getElementById('partners-table-body');
        if (!tbody) return;

        const filtered = allPartnersCache.filter(p => 
            p.id.toLowerCase().includes(query) || 
            (p.creatorName && p.creatorName.toLowerCase().includes(query)) ||
            (p.channelName && p.channelName.toLowerCase().includes(query))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">No matching partners found.</td></tr>`;
            return;
        }

        let html = "";
        filtered.forEach(partner => {
            html += `
                <tr>
                    <td><b>${partner.id}</b></td>
                    <td>${partner.creatorName || partner.channelUsername || 'N/A'}</td>
                    <td>${partner.channelName || 'N/A'}</td>
                    <td>$${(partner.availableBalance || 0).toFixed(3)}</td>
                    <td>$${(partner.holdingBalance || 0).toFixed(3)}</td>
                    <td>$${(partner.withdrawableBalance || 0).toFixed(3)}</td>
                    <td>
                        <button class="btn-edit" onclick="Admin_Module.openPartnerModal('${partner.id}')">Edit</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    openPartnerModal: function(userId) {
        const partner = allPartnersCache.find(p => p.id === userId);
        if (!partner) return;

        document.getElementById('edit-user-id').value = userId;
        document.getElementById('edit-user-id-disp').value = userId;
        document.getElementById('edit-avail-bal').value = partner.availableBalance || 0;
        document.getElementById('edit-hold-bal').value = partner.holdingBalance || 0;
        document.getElementById('edit-with-bal').value = partner.withdrawableBalance || 0;

        document.getElementById('partner-modal').style.display = 'flex';
    },

    closePartnerModal: function() {
        document.getElementById('partner-modal').style.display = 'none';
    },

    initEditPartnerForm: function() {
        const form = document.getElementById('edit-partner-form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-user-id').value;
            const availBal = parseFloat(document.getElementById('edit-avail-bal').value);
            const holdBal = parseFloat(document.getElementById('edit-hold-bal').value);
            const withBal = parseFloat(document.getElementById('edit-with-bal').value);

            try {
                showToast("⏳ Updating partner balances...");
                await updateDoc(doc(db, "admins", userId), {
                    availableBalance: availBal,
                    holdingBalance: holdBal,
                    withdrawableBalance: withBal,
                    updatedAt: serverTimestamp()
                });

                showToast("✅ Partner account updated successfully!");
                this.closePartnerModal();
                await this.loadPartners();
            } catch (error) {
                console.error("Error updating partner:", error);
                showToast(`❌ ${error.message || "Failed to update partner."}`);
            }
        };
    }
};

window.switchSection = function(sectionId, btn) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(sectionId)?.classList.add('active');
    btn.classList.add('active');
};

window.Admin_Module = Admin_Module;

window.addEventListener('DOMContentLoaded', () => {
    Admin_Module.init();
});
