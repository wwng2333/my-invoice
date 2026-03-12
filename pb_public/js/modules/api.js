import { CONFIG } from '../config.js';
import { state } from './state.js';

const pb = new PocketBase(CONFIG.PB_URL);

function handleAuthError(e) {
    if (e.status === 401) {
        pb.authStore.clear();
        document.dispatchEvent(new CustomEvent('auth:expired'));
        return true;
    }
    return false;
}

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
        try {
            const { showToast } = await import('./ui.js');
            if (err.message.includes('autocancelled')) {
                showToast("上一次登录请求已取消，请重试。", 'warning');
            } else {
                showToast("登录失败：" + err.message, 'danger');
            }
        } catch (e) {
            console.warn('showToast not available:', e);
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

export async function getInvoices(searchTerm = '', statusValue = '') {
    const filters = [];

    if (searchTerm) {
        const term = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        filters.push(`(invoice_number ~ "${term}" || vendor ~ "${term}" || description ~ "${term}")`);
    }
    if (statusValue) {
        filters.push(`status = "${statusValue}"`);
    }

    try {
        const result = await pb.collection("invoices").getList(state.currentPage, state.itemsPerPage, {
            sort: `${state.sortOrder === "desc" ? "-" : ""}${state.sortBy}`,
            filter: filters.join(" && "),
            fields: "id,invoice_number,invoice_date,vendor,amount,status,description,attachments"
        });
        return result;
    } catch (e) {
        if (handleAuthError(e)) return null;
        if (e.status !== 0) {
            console.error("Failed to load invoices:", e);
            try { const { showToast } = await import('./ui.js'); showToast("加载失败：" + e.message, 'danger'); } catch(_) { }
        }
        return null;
    }
}

export async function getInvoice(id) {
    try {
        return await pb.collection("invoices").getOne(id);
    } catch (e) {
        if (handleAuthError(e)) return null;
        console.error("Failed to get full record:", e);
        return null;
    }
}

export async function saveInvoice(id, formData) {
    try {
        const model = getAuthModel();
        if (!model) {
            try { const { showToast } = await import('./ui.js'); showToast("未登录，请先登录。", 'warning'); } catch(_) { }
            return false;
        }
        formData.append("user", model.id);
        if (id) {
            await pb.collection("invoices").update(id, formData);
            try { const { showToast } = await import('./ui.js'); showToast("更新成功", 'success'); } catch(_) { }
        } else {
            await pb.collection("invoices").create(formData);
            try { const { showToast } = await import('./ui.js'); showToast("创建成功", 'success'); } catch(_) { }
        }
        return true;
    } catch (e) {
        if (handleAuthError(e)) return false;
        try { const { showToast } = await import('./ui.js'); showToast("保存失败：" + e.message, 'danger'); } catch(_) { }
        return false;
    }
}

export async function deleteInvoice(id) {
    try {
        await pb.collection("invoices").delete(id);
        return true;
    } catch (e) {
        if (handleAuthError(e)) return false;
        try { const { showToast } = await import('./ui.js'); showToast("删除失败：" + e.message, 'danger'); } catch(_) { }
        return false;
    }
}

export async function batchUpdateInvoices(ids, newStatus) {
    try {
        await Promise.all([...ids].map(id =>
            pb.collection("invoices").update(id, { status: newStatus })
        ));
        try { const { showToast } = await import('./ui.js'); showToast("批量更新成功", 'success'); } catch(_) { }
        return true;
    } catch (e) {
        if (handleAuthError(e)) return false;
        try { const { showToast } = await import('./ui.js'); showToast("操作失败：" + e.message, 'danger'); } catch(_) { }
        return false;
    }
}
