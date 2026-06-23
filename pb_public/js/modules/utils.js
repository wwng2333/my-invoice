/**
 * Debounce function to limit the rate at which a function get executed.
 * @param {Function} fn The function to debounce.
 * @param {number} ms The debounce timeout.
 * @returns {Function} The debounced function.
 */
export function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Escapes HTML to prevent XSS attacks.
 * @param {string} text The text to escape.
 * @returns {string} The escaped text.
 */
export function escapeHtml(text) {
    if (!text) return "";
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Gets a DOM element by its ID.
 * @param {string} id The ID of the element.
 * @returns {HTMLElement} The DOM element.
 */
export const getEl = (id) => document.getElementById(id);

/**
 * Escapes a string for safe use inside a PocketBase filter expression.
 *
 * PocketBase filter syntax only treats backslash and double-quote as string
 * escapes; inside a quoted string, parentheses and logical operators are
 * treated as ordinary characters. However, raw control characters (\n, \r, …)
 * can confuse the parser, so we strip them and escape the two syntactic
 * characters PocketBase actually recognises.
 *
 * @param {string} text The raw user input.
 * @returns {string} A value safe to embed between double-quotes in a filter.
 */
export function escapeFilter(text) {
    if (text == null) return "";
    return String(text)
        // 去除所有 ASCII 控制字符（含 \n / \r / \t）以防过滤器解析器被干扰
        .replace(/[\x00-\x1F\x7F]/g, "")
        // 反斜杠必须先转义（顺序重要）
        .replace(/\\/g, "\\\\")
        // 双引号需要转义以避免提前结束字符串
        .replace(/"/g, '\\"');
}

/**
 * Converts a Chinese numeric string to a number.
 * @param {string} chineseStr The Chinese numeric string.
 * @returns {number} The converted number.
 */
export function convertChineseToNumber(chineseStr) {
    const chineseNumMap = { '零': 0, '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9 };
    const chineseUnitMap = { '拾': 10, '佰': 100, '仟': 1000, '万': 10000, '亿': 100000000 };
    let result = 0, tempNum = 0, section = 0, decimalPart = 0;
    
    let cleanStr = chineseStr.replace(/整$/, ''); 
    let [integerStr, decimalStr] = cleanStr.split(/[圆元]/);
    if(!decimalStr && (cleanStr.indexOf('角')>-1 || cleanStr.indexOf('分')>-1)) {
        integerStr = ""; decimalStr = cleanStr;
    }
    
    if (decimalStr) {
        let val = 0;
        for(let char of decimalStr) {
            if(chineseNumMap[char] !== undefined) val = chineseNumMap[char];
            else if(char === '角') { decimalPart += val * 0.1; val=0; }
            else if(char === '分') { decimalPart += val * 0.01; val=0; }
        }
    }
  
    if (integerStr) {
        for(let char of integerStr) {
            if(chineseNumMap[char] !== undefined) tempNum = chineseNumMap[char];
            else if(chineseUnitMap[char] !== undefined) {
                if(char === '万' || char === '亿') {
                    section = (section + tempNum) * chineseUnitMap[char];
                    result += section; section = 0; tempNum = 0;
                } else {
                    section += tempNum * chineseUnitMap[char];
                    tempNum = 0;
                }
            }
        }
        result += section + tempNum;
    }
    return result + decimalPart;
}
