/**
 * config.js - 配置管理模块
 * 功能：管理插件配置和白名单的读写
 */

// ==================== 默认配置 ====================

const DEFAULT_CONFIG = {
    // API 设置
    apiBaseUrl: 'https://api.deepseek.com',
    apiKey: '',

    // 策略设置
    enableDeadLinkCheck: true,    // 检测死链
    enableScatterMode: false,      // 强制打散模式
    enableCategoryPrefix: true,    // 添加分类前缀
    requestDelay: 500,             // 请求延时 (ms)

    // 系统设置
    maxLogLines: 100,              // 最大日志行数
    requestTimeout: 10000          // 请求超时时间 (ms)
};

// ==================== 配置管理类 ====================

const Config = {
    /**
     * 加载配置
     * 如果 Storage 中没有配置，则返回默认配置
     * @returns {Promise<Object>} 配置对象
     */
    async load() {
        try {
            const result = await chrome.storage.local.get('config');
            // 合并默认配置和已保存配置，确保新增字段有默认值
            return { ...DEFAULT_CONFIG, ...(result.config || {}) };
        } catch (error) {
            console.error('[Config] 加载配置失败:', error);
            return { ...DEFAULT_CONFIG };
        }
    },

    /**
     * 保存配置
     * @param {Object} config - 要保存的配置对象
     * @returns {Promise<boolean>} 是否保存成功
     */
    async save(config) {
        try {
            await chrome.storage.local.set({ config });
            console.log('[Config] 配置已保存');
            return true;
        } catch (error) {
            console.error('[Config] 保存配置失败:', error);
            return false;
        }
    },

    /**
     * 获取单个配置项
     * @param {string} key - 配置项键名
     * @returns {Promise<any>} 配置值
     */
    async get(key) {
        const config = await this.load();
        return config[key];
    },

    /**
     * 更新单个配置项
     * @param {string} key - 配置项键名
     * @param {any} value - 配置值
     * @returns {Promise<boolean>} 是否更新成功
     */
    async set(key, value) {
        const config = await this.load();
        config[key] = value;
        return await this.save(config);
    },

    /**
     * 重置为默认配置
     * @returns {Promise<boolean>} 是否重置成功
     */
    async reset() {
        return await this.save({ ...DEFAULT_CONFIG });
    }
};

// ==================== 白名单管理 ====================

const Whitelist = {
    /**
     * 获取白名单
     * @returns {Promise<string[]>} 白名单 ID 数组
     */
    async get() {
        try {
            const result = await chrome.storage.local.get('whitelist');
            return result.whitelist || [];
        } catch (error) {
            console.error('[Whitelist] 获取白名单失败:', error);
            return [];
        }
    },

    /**
     * 添加到白名单
     * @param {string} nodeId - 节点 ID
     * @returns {Promise<boolean>} 是否添加成功
     */
    async add(nodeId) {
        try {
            const whitelist = await this.get();
            if (!whitelist.includes(nodeId)) {
                whitelist.push(nodeId);
                await chrome.storage.local.set({ whitelist });
            }
            return true;
        } catch (error) {
            console.error('[Whitelist] 添加失败:', error);
            return false;
        }
    },

    /**
     * 从白名单移除
     * @param {string} nodeId - 节点 ID
     * @returns {Promise<boolean>} 是否移除成功
     */
    async remove(nodeId) {
        try {
            const whitelist = await this.get();
            const index = whitelist.indexOf(nodeId);
            if (index !== -1) {
                whitelist.splice(index, 1);
                await chrome.storage.local.set({ whitelist });
            }
            return true;
        } catch (error) {
            console.error('[Whitelist] 移除失败:', error);
            return false;
        }
    },

    /**
     * 检查节点是否在白名单中
     * @param {string} nodeId - 节点 ID
     * @returns {Promise<boolean>} 是否在白名单中
     */
    async includes(nodeId) {
        const whitelist = await this.get();
        return whitelist.includes(nodeId);
    },

    /**
     * 清空白名单
     * @returns {Promise<boolean>} 是否清空成功
     */
    async clear() {
        try {
            await chrome.storage.local.set({ whitelist: [] });
            return true;
        } catch (error) {
            console.error('[Whitelist] 清空失败:', error);
            return false;
        }
    }
};

// 导出供其他模块使用
// 注意：Chrome 扩展中通常通过全局变量而非 ES6 模块导出
window.Config = Config;
window.Whitelist = Whitelist;
window.DEFAULT_CONFIG = DEFAULT_CONFIG;
