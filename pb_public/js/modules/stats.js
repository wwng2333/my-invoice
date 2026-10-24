import { els, STATUS_MAP } from './ui.js';
import { loadChartJs } from './loaders.js';

let chartInstances = [];

// 各状态对应的图表配色（与界面徽章语义一致）
const STATUS_HEX = {
    pending_application: '#94a3b8',
    in_invoicing: '#f59e0b',
    in_reimbursement: '#0ea5e9',
    reimbursed: '#22c55e'
};

// 归属分布使用的调色板
const PALETTE = ['#0d9488', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#22c55e', '#94a3b8', '#ef4444'];

function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode');
}

function destroyCharts() {
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];
}

function sumBy(list, keyFn) {
    const map = {};
    for (const r of list) {
        const key = keyFn(r);
        map[key] = (map[key] || 0) + Number(r.amount || 0);
    }
    return map;
}

/**
 * 渲染全局统计弹窗：总览卡片 + 四个图表。
 * @param {Array|null} records 全部发票记录（null 表示加载失败，展示空状态）。
 */
export async function renderGlobalStats(records) {
    destroyCharts();
    els.statsLoading.style.display = "none";
    els.statsContent.style.display = "";

    const list = Array.isArray(records) ? records : [];
    if (list.length === 0) {
        els.statsSummaryRow.style.display = "none";
        els.statsChartsGrid.style.display = "none";
        els.statsEmpty.style.display = "";
        return;
    }
    els.statsSummaryRow.style.display = "";
    els.statsChartsGrid.style.display = "";
    els.statsEmpty.style.display = "none";

    // --- 总览卡片 ---
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearKey = String(now.getFullYear());
    const totalAmount = list.reduce((s, r) => s + Number(r.amount || 0), 0);
    const monthAmount = list.filter(r => (r.invoice_date || '').startsWith(monthKey)).reduce((s, r) => s + Number(r.amount || 0), 0);
    const yearAmount = list.filter(r => (r.invoice_date || '').startsWith(yearKey)).reduce((s, r) => s + Number(r.amount || 0), 0);

    els.gsCount.textContent = String(list.length);
    els.gsAmount.textContent = totalAmount.toFixed(2);
    els.gsMonth.textContent = monthAmount.toFixed(2);
    els.gsYear.textContent = yearAmount.toFixed(2);

    // --- 图表（主题感知配色）---
    const Chart = await loadChartJs();
    const dark = isDarkMode();
    const textColor = dark ? '#cbd5e1' : '#4b5563';
    const gridColor = dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(107, 114, 128, 0.15)';
    const primary = '#0d9488';
    const font = { family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" };
    const currency = (v) => '¥' + Number(v).toFixed(2);

    // 1. 近 12 个月金额趋势
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const monthSums = sumBy(list, r => (r.invoice_date || '').slice(0, 7));
    chartInstances.push(new Chart(els.monthlyChart, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: '金额',
                data: months.map(m => monthSums[m] || 0),
                backgroundColor: primary,
                borderRadius: 6,
                maxBarThickness: 36
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => currency(ctx.parsed.y) } }
            },
            scales: {
                x: { ticks: { color: textColor, font }, grid: { display: false } },
                y: { ticks: { color: textColor, font }, grid: { color: gridColor }, beginAtZero: true }
            }
        }
    }));

    // 2. 状态分布（按数量）
    const statusCounts = {};
    for (const r of list) {
        const key = r.status || 'pending_application';
        statusCounts[key] = (statusCounts[key] || 0) + 1;
    }
    const statusKeys = Object.keys(statusCounts);
    chartInstances.push(new Chart(els.statusChart, {
        type: 'doughnut',
        data: {
            labels: statusKeys.map(k => STATUS_MAP[k] || k),
            datasets: [{
                data: statusKeys.map(k => statusCounts[k]),
                backgroundColor: statusKeys.map(k => STATUS_HEX[k] || '#94a3b8'),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font, boxWidth: 12, padding: 12 } },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}：${ctx.parsed} 张` } }
            }
        }
    }));

    // 3. 供应商 Top 5（按金额）
    const vendorSums = Object.entries(sumBy(list, r => r.vendor || '未知'))
        .sort((a, b) => b[1] - a[1]).slice(0, 5);
    chartInstances.push(new Chart(els.vendorChart, {
        type: 'bar',
        data: {
            labels: vendorSums.map(([v]) => v),
            datasets: [{
                label: '金额',
                data: vendorSums.map(([, v]) => v),
                backgroundColor: '#0ea5e9',
                borderRadius: 6,
                maxBarThickness: 24
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => currency(ctx.parsed.x) } }
            },
            scales: {
                x: { ticks: { color: textColor, font }, grid: { color: gridColor }, beginAtZero: true },
                y: { ticks: { color: textColor, font }, grid: { display: false } }
            }
        }
    }));

    // 4. 归属分布（按金额，超出前 6 名合并为“其他”）
    const attrEntries = Object.entries(sumBy(list, r => r.attribution || 'Default'))
        .sort((a, b) => b[1] - a[1]);
    const topAttrs = attrEntries.slice(0, 6);
    const restSum = attrEntries.slice(6).reduce((s, [, v]) => s + v, 0);
    if (restSum > 0) topAttrs.push(['其他', restSum]);
    chartInstances.push(new Chart(els.attributionChart, {
        type: 'doughnut',
        data: {
            labels: topAttrs.map(([a]) => a),
            datasets: [{
                data: topAttrs.map(([, v]) => v),
                backgroundColor: topAttrs.map((_, i) => PALETTE[i % PALETTE.length]),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font, boxWidth: 12, padding: 12 } },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}：${currency(ctx.parsed)}` } }
            }
        }
    }));
}
