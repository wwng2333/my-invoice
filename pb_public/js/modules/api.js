import { CONFIG } from '../app.js';
import { state } from './state.js';
import { showToast } from './ui.js';

const pb = new PocketBase(CONFIG.PB_URL);

export async function login(email, password) {
    try {
        await pb.collection("users").authWithPassword(email, password);
        return true;
    } catch (err) {
        console.error("Login error:", err);
        if (err.isAbort) {
            // Don't show a toast for intentional cancellations
            return false;
        }
        if (err.message.includes('autocancelled')) {
            showToast("Previous login attempt cancelled. Please try again.", 'warning');
        } else {
            showToast("Login failed: " + err.message, 'danger');
        }
        return false;
    }
}

export function logout() {
    pb.authStore.clear();
}

export function isValidAuth() {
    return pb.authStore.isValid;
}

export function getAuthModel() {
    return pb.authStore.model;
}

export function getFileUrl(record, filename) {
    return pb.files.getURL(record, filename);
}

export async function getInvoices() {
    const filters = [];
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');

    if (searchInput?.value) {
        const term = searchInput.value.trim();
        filters.push(`(invoice_number ~ "${term}" || vendor ~ "${term}" || description ~ "${term}")`);
    }
    if (statusFilter?.value) {
        filters.push(`status = "${statusFilter.value}"`);
    }

    try {
        const result = await pb.collection("invoices").getList(state.currentPage, state.itemsPerPage, {
            sort: `${state.sortOrder === "desc" ? "-" : ""}${state.sortBy}`,
            filter: filters.join(" && "),
            fields: "id,invoice_number,invoice_date,vendor,amount,status,description,attachments"
        });
        return result;
    } catch (e) {
        if (e.status !== 0) {
            console.error("Failed to load invoices:", e);
            showToast("Failed to load: " + e.message, 'danger');
        }
        return null;
    }
}

export async function getInvoice(id) {
    try {
        return await pb.collection("invoices").getOne(id);
    } catch (e) {
        console.error("Failed to get full record:", e);
        return null;
    }
}

export async function saveInvoice(id, formData) {
    try {
        formData.append("user", getAuthModel().id);
        if (id) {
            await pb.collection("invoices").update(id, formData);
            showToast("Update successful", 'success');
        } else {
            await pb.collection("invoices").create(formData);
            showToast("Creation successful", 'success');
        }
        return true;
    } catch (e) {
        showToast("Save failed: " + e.message, 'danger');
        return false;
    }
}

export async function deleteInvoice(id) {
    try {
        await pb.collection("invoices").delete(id);
        return true;
    } catch (e) {
        showToast("Deletion failed: " + e.message, 'danger');
        return false;
    }
}

export async function batchUpdateInvoices(ids, newStatus) {
    try {
        await Promise.all([...ids].map(id =>
            pb.collection("invoices").update(id, { status: newStatus })
        ));
        showToast("Batch update successful", 'success');
        return true;
    } catch (e) {
        showToast("Operation failed: " + e.message, 'danger');
        return false;
    }
}
