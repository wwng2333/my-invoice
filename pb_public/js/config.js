export const CONFIG = {
    PB_URL: "https://invoice.csgo.ovh/",
    TIMEOUT: {
        INIT_RETRY: 500,
        INIT_DELAY: 100,
        SEARCH_DEBOUNCE: 300
    },
    PAGE_SIZES: [10, 25, 50, 9999],
    RETRY_MAX: 3,
    // 按需加载的第三方库（已从 index.html 移除，首次使用时才下载；SRI 校验与原标签一致）
    VENDORS: {
        FLATPICKR_JS: [
            {
                src: "https://s4.zstatic.net/ajax/libs/flatpickr/4.6.13/flatpickr.min.js",
                integrity: "sha512-K/oyQtMXpxI4+K0W7H25UopjM8pzq0yrVdFdG21Fh5dBe91I40pDd9A4lzNlHPHBIP2cwZuoxaUSX0GJSObvGA=="
            },
            {
                src: "https://s4.zstatic.net/ajax/libs/flatpickr/4.6.13/l10n/zh.min.js",
                // 修复：原 index.html 中该文件的 SRI 哈希错误（少一个字符），
                // 导致中文语言包从未加载成功、日期选择器一直显示英文。
                integrity: "sha512-KU9LjAMoAxs8u2DU62DsIID671imkYuyOkE0/wbjVZDRM259WxX5IhQsWTTBMhtdnhviZEqfkdhG09k7JVf9pg=="
            }
        ],
        PDFJS_LIB: {
            src: "https://s4.zstatic.net/ajax/libs/pdf.js/3.11.174/pdf.min.js",
            integrity: "sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ=="
        },
        PDFJS_WORKER: "https://s4.zstatic.net/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
        PDFJS_CMAPS: "https://s4.zstatic.net/ajax/libs/pdf.js/3.11.174/cmaps/",
        JSZIP: {
            src: "https://s4.zstatic.net/ajax/libs/jszip/3.10.1/jszip.min.js",
            integrity: "sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg=="
        },
        FILESAVER: {
            src: "https://s4.zstatic.net/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js",
            integrity: "sha512-Qlv6VSKh1gDKGoJbnyA5RMXYcvnpIqhO++MhIM2fStMcGT9i2T//tSwYFlcyoRRDcDZ+TYHpH8azBBCyhpSeqw=="
        },
        CHARTJS: {
            src: "https://s4.zstatic.net/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
            integrity: "sha512-CQBWl4fJHWbryGE+Pc7UAxWMUMNMWzWxF4SQo9CgkJIN1kx6djDQZjh3Y8SZ1d+6I+1zze6Z7kHXO7q3UyZAWw=="
        }
    }
};
