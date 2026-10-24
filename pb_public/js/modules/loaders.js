import { CONFIG } from '../config.js';

const loadedScripts = new Map();

/**
 * 动态插入 <script> 按需加载第三方库；同一地址只加载一次，带 SRI 校验。
 * @param {string} src 脚本地址
 * @param {string} [integrity] SRI 完整性哈希
 * @returns {Promise<void>}
 */
export function loadScript(src, integrity = '') {
    if (loadedScripts.has(src)) return loadedScripts.get(src);

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.referrerPolicy = 'no-referrer';
        if (integrity) {
            script.integrity = integrity;
            script.crossOrigin = 'anonymous';
        }
        script.onload = () => resolve();
        script.onerror = () => {
            // 加载失败后从缓存移除，允许下次操作时重试
            loadedScripts.delete(src);
            reject(new Error('脚本加载失败: ' + src));
        };
        document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
    return promise;
}

let flatpickrPromise = null;
/**
 * 按需加载 flatpickr 及其中文语言包。
 * @returns {Promise<object>} window.flatpickr
 */
export function loadFlatpickr() {
    if (!flatpickrPromise) {
        flatpickrPromise = (async () => {
            for (const { src, integrity } of CONFIG.VENDORS.FLATPICKR_JS) {
                await loadScript(src, integrity);
            }
            return window.flatpickr;
        })().catch(err => { flatpickrPromise = null; throw err; });
    }
    return flatpickrPromise;
}

let pdfjsPromise = null;
/**
 * 按需加载 PDF.js 并配置 worker 与中文 cMap（避免中文 PDF 乱码）。
 * @returns {Promise<object>} window.pdfjsLib
 */
export function loadPdfJs() {
    if (!pdfjsPromise) {
        pdfjsPromise = loadScript(CONFIG.VENDORS.PDFJS_LIB.src, CONFIG.VENDORS.PDFJS_LIB.integrity)
            .then(() => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.VENDORS.PDFJS_WORKER;
                window.pdfjsLib.GlobalWorkerOptions.cMapUrl = CONFIG.VENDORS.PDFJS_CMAPS;
                window.pdfjsLib.GlobalWorkerOptions.cMapPacked = true;
                return window.pdfjsLib;
            })
            .catch(err => { pdfjsPromise = null; throw err; });
    }
    return pdfjsPromise;
}

let zipPromise = null;
/**
 * 按需加载 JSZip 与 FileSaver（批量下载 ZIP 时使用）。
 * @returns {Promise<{JSZip: object, saveAs: Function}>}
 */
export function loadZipTools() {
    if (!zipPromise) {
        zipPromise = (async () => {
            await loadScript(CONFIG.VENDORS.JSZIP.src, CONFIG.VENDORS.JSZIP.integrity);
            await loadScript(CONFIG.VENDORS.FILESAVER.src, CONFIG.VENDORS.FILESAVER.integrity);
            return { JSZip: window.JSZip, saveAs: window.saveAs };
        })().catch(err => { zipPromise = null; throw err; });
    }
    return zipPromise;
}

let chartjsPromise = null;
/**
 * 按需加载 Chart.js（统计弹窗首次打开时使用）。
 * @returns {Promise<object>} window.Chart
 */
export function loadChartJs() {
    if (!chartjsPromise) {
        chartjsPromise = loadScript(CONFIG.VENDORS.CHARTJS.src, CONFIG.VENDORS.CHARTJS.integrity)
            .then(() => window.Chart)
            .catch(err => { chartjsPromise = null; throw err; });
    }
    return chartjsPromise;
}
