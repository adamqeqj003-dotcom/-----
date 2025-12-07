/**
 * cleaner.js - 死链检测模块
 * 功能：检测 URL 是否可达，判定死链
 * 
 * 策略说明 (保守策略):
 * - 明确的 4xx/5xx 状态码 → 判定为死链
 * - 网络超时 → 判定为死链
 * - CORS 错误 / 其他网络错误 → 视为存活 (防止误判)
 */

// ==================== 检测结果类型 ====================

const LinkStatus = {
    ALIVE: 'alive',           // 存活
    DEAD: 'dead',             // 死链
    UNKNOWN: 'unknown'        // 无法判定 (视为存活)
};

// ==================== 死链检测类 ====================

const Cleaner = {
    // 默认超时时间 (毫秒)
    _timeout: 10000,

    /**
     * 设置超时时间
     * @param {number} ms - 超时毫秒数
     */
    setTimeout(ms) {
        this._timeout = ms;
    },

    /**
     * 检测单个 URL 是否可达
     * @param {string} url - 要检测的 URL
     * @returns {Promise<Object>} 检测结果 { status, alive, statusCode, error }
     */
    async checkLink(url) {
        // 跳过特殊协议 (chrome://, file://, javascript: 等)
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return {
                status: LinkStatus.UNKNOWN,
                alive: true,  // 保守策略：无法检测的视为存活
                statusCode: null,
                error: '非 HTTP 协议，跳过检测'
            };
        }

        try {
            // 创建 AbortController 用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._timeout);

            // 优先使用 HEAD 请求 (更轻量)
            let response;
            try {
                response = await fetch(url, {
                    method: 'HEAD',
                    mode: 'no-cors',  // 避免 CORS 问题
                    signal: controller.signal,
                    redirect: 'follow'
                });
            } catch (headError) {
                // HEAD 失败时尝试 GET 请求
                if (headError.name !== 'AbortError') {
                    response = await fetch(url, {
                        method: 'GET',
                        mode: 'no-cors',
                        signal: controller.signal,
                        redirect: 'follow'
                    });
                } else {
                    throw headError;
                }
            }

            clearTimeout(timeoutId);

            // no-cors 模式下，response.type 为 'opaque'，无法获取状态码
            // 如果能获取到响应，说明服务器有响应
            if (response.type === 'opaque') {
                // 服务器有响应但无法读取详情 (CORS 限制)
                // 保守策略：视为存活
                return {
                    status: LinkStatus.ALIVE,
                    alive: true,
                    statusCode: null,
                    error: null
                };
            }

            // 可以读取状态码的情况
            const statusCode = response.status;

            // 判定逻辑：4xx 和 5xx 视为死链
            if (statusCode >= 400) {
                return {
                    status: LinkStatus.DEAD,
                    alive: false,
                    statusCode,
                    error: `HTTP ${statusCode}`
                };
            }

            return {
                status: LinkStatus.ALIVE,
                alive: true,
                statusCode,
                error: null
            };

        } catch (error) {
            // 超时错误
            if (error.name === 'AbortError') {
                return {
                    status: LinkStatus.DEAD,
                    alive: false,
                    statusCode: null,
                    error: '请求超时'
                };
            }

            // 网络错误 (CORS、DNS 失败等)
            // 保守策略：无法确定的情况视为存活，防止误删
            console.warn(`[Cleaner] 检测异常 (${url}):`, error.message);
            return {
                status: LinkStatus.UNKNOWN,
                alive: true,
                statusCode: null,
                error: error.message
            };
        }
    },

    /**
     * 批量检测 URL
     * @param {Array<{id: string, url: string, title: string}>} bookmarks - 书签数组
     * @param {Function} onProgress - 进度回调 (current, total, result)
     * @param {number} delay - 每次检测间隔 (毫秒)
     * @returns {Promise<Array>} 检测结果数组
     */
    async batchCheck(bookmarks, onProgress = null, delay = 100) {
        const results = [];
        const total = bookmarks.length;

        for (let i = 0; i < total; i++) {
            const bookmark = bookmarks[i];
            const result = await this.checkLink(bookmark.url);

            const checkResult = {
                ...bookmark,
                checkResult: result
            };

            results.push(checkResult);

            // 进度回调
            if (onProgress) {
                onProgress(i + 1, total, checkResult);
            }

            // 添加延迟，避免请求过快
            if (i < total - 1 && delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    },

    /**
     * 筛选死链
     * @param {Array} checkResults - batchCheck 的结果
     * @returns {Array} 死链书签数组
     */
    filterDeadLinks(checkResults) {
        return checkResults.filter(item =>
            item.checkResult.status === LinkStatus.DEAD
        );
    },

    /**
     * 筛选存活链接
     * @param {Array} checkResults - batchCheck 的结果
     * @returns {Array} 存活书签数组
     */
    filterAliveLinks(checkResults) {
        return checkResults.filter(item =>
            item.checkResult.alive === true
        );
    }
};

// 导出供其他模块使用
window.Cleaner = Cleaner;
window.LinkStatus = LinkStatus;
