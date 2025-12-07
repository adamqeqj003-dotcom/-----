/**
 * logger.js - 日志模块
 * 功能：提供统一的日志记录和显示接口
 */

// ==================== 日志类型枚举 ====================

const LogType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARN: 'warn',
    ERROR: 'error'
};

// ==================== 日志管理类 ====================

const Logger = {
    // 内存中的日志缓存
    _logs: [],

    // DOM 元素引用 (由 popup.js 初始化)
    _consoleElement: null,

    // 最大日志行数
    _maxLines: 100,

    /**
     * 初始化日志模块
     * @param {HTMLElement} consoleElement - 日志显示容器的 DOM 元素
     * @param {number} maxLines - 最大日志行数
     */
    init(consoleElement, maxLines = 100) {
        this._consoleElement = consoleElement;
        this._maxLines = maxLines;
        console.log('[Logger] 日志模块已初始化');
    },

    /**
     * 记录日志
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型 (info/success/warn/error)
     */
    log(message, type = LogType.INFO) {
        const timestamp = new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const logEntry = {
            timestamp,
            message,
            type
        };

        // 添加到缓存
        this._logs.push(logEntry);

        // 限制最大日志数量，防止内存泄漏
        if (this._logs.length > this._maxLines) {
            this._logs.shift();
        }

        // 更新 UI
        this._renderLog(logEntry);

        // 同时输出到控制台
        const consoleMethod = type === LogType.ERROR ? 'error' :
            type === LogType.WARN ? 'warn' : 'log';
        console[consoleMethod](`[${timestamp}] ${message}`);
    },

    /**
     * 快捷方法：记录信息日志
     */
    info(message) {
        this.log(message, LogType.INFO);
    },

    /**
     * 快捷方法：记录成功日志
     */
    success(message) {
        this.log(message, LogType.SUCCESS);
    },

    /**
     * 快捷方法：记录警告日志
     */
    warn(message) {
        this.log(message, LogType.WARN);
    },

    /**
     * 快捷方法：记录错误日志
     */
    error(message) {
        this.log(message, LogType.ERROR);
    },

    /**
     * 渲染单条日志到 UI
     * @param {Object} logEntry - 日志条目
     */
    _renderLog(logEntry) {
        if (!this._consoleElement) return;

        const logLine = document.createElement('div');
        logLine.className = `log-line ${logEntry.type}`;
        logLine.textContent = `> [${logEntry.timestamp}] ${logEntry.message}`;

        this._consoleElement.appendChild(logLine);

        // 限制 DOM 中的日志行数
        while (this._consoleElement.children.length > this._maxLines) {
            this._consoleElement.removeChild(this._consoleElement.firstChild);
        }

        // 自动滚动到底部
        this._consoleElement.scrollTop = this._consoleElement.scrollHeight;
    },

    /**
     * 获取最近的日志
     * @param {number} count - 获取的数量
     * @returns {Array} 日志数组
     */
    getRecentLogs(count = 50) {
        return this._logs.slice(-count);
    },

    /**
     * 清空日志
     */
    clear() {
        this._logs = [];
        if (this._consoleElement) {
            this._consoleElement.innerHTML = '<div class="log-line">> 日志已清空</div>';
        }
        console.log('[Logger] 日志已清空');
    },

    /**
     * 重新渲染所有日志 (用于恢复状态)
     */
    refresh() {
        if (!this._consoleElement) return;

        this._consoleElement.innerHTML = '';
        this._logs.forEach(entry => this._renderLog(entry));
    }
};

// 导出供其他模块使用
window.Logger = Logger;
window.LogType = LogType;
