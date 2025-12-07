/**
 * deepseek.js - DeepSeek API 通信模块
 * 功能：与 DeepSeek LLM API 通信，实现书签分类
 */

// ==================== DeepSeek API 类 ====================

const DeepSeekAPI = {
    // API 配置 (由 Config 模块加载)
    _baseUrl: 'https://api.deepseek.com',
    _apiKey: '',

    // 模型配置
    _model: 'deepseek-chat',

    // 分类预设 (用于 Prompt)
    _categories: [
        'Tech',       // 技术/编程
        'News',       // 新闻资讯
        'Tools',      // 工具/软件
        'Learning',   // 学习/教程
        'Shopping',   // 购物/电商
        'Social',     // 社交/社区
        'Media',      // 媒体/娱乐
        'Work',       // 工作/办公
        'Finance',    // 金融/财务
        'Other'       // 其他
    ],

    /**
     * 初始化 API 配置
     * @param {string} baseUrl - API 基础 URL
     * @param {string} apiKey - API Key
     */
    init(baseUrl, apiKey) {
        this._baseUrl = baseUrl || 'https://api.deepseek.com';
        this._apiKey = apiKey || '';
    },

    /**
     * 从 Config 模块加载配置
     */
    async loadConfig() {
        if (window.Config) {
            const config = await window.Config.load();
            this._baseUrl = config.apiBaseUrl;
            this._apiKey = config.apiKey;
        }
    },

    /**
     * 测试 API 连接
     * 发送一个简单消息验证 API 是否可用
     * @returns {Promise<Object>} { success: boolean, message: string, latency: number }
     */
    async testConnection() {
        const startTime = Date.now();

        try {
            await this.loadConfig();

            if (!this._apiKey) {
                return {
                    success: false,
                    message: '未配置 API Key',
                    latency: 0
                };
            }

            const response = await fetch(`${this._baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._apiKey}`
                },
                body: JSON.stringify({
                    model: this._model,
                    messages: [
                        { role: 'user', content: 'Hello, this is a connection test. Please reply with "OK".' }
                    ],
                    max_tokens: 10
                })
            });

            const latency = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    message: `HTTP ${response.status}: ${errorData.error?.message || '请求失败'}`,
                    latency
                };
            }

            const data = await response.json();

            return {
                success: true,
                message: `连接成功 (${latency}ms)`,
                latency,
                response: data.choices?.[0]?.message?.content || 'OK'
            };

        } catch (error) {
            return {
                success: false,
                message: `连接失败: ${error.message}`,
                latency: Date.now() - startTime
            };
        }
    },

    /**
     * 对书签进行分类
     * @param {string} title - 书签标题
     * @param {string} url - 书签 URL
     * @returns {Promise<Object>} { success: boolean, category: string, error: string }
     */
    async categorizeBookmark(title, url) {
        try {
            await this.loadConfig();

            if (!this._apiKey) {
                return {
                    success: false,
                    category: 'Other',
                    error: '未配置 API Key'
                };
            }

            // 构建 Prompt
            const prompt = this._buildCategorizationPrompt(title, url);

            const response = await fetch(`${this._baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._apiKey}`
                },
                body: JSON.stringify({
                    model: this._model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a bookmark classification assistant. Respond with ONLY the category name, nothing else.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 20,
                    temperature: 0.3  // 低温度以获得更一致的结果
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // 特殊处理 429 限流
                if (response.status === 429) {
                    return {
                        success: false,
                        category: 'Other',
                        error: 'API_RATE_LIMITED',
                        retryAfter: parseInt(response.headers.get('Retry-After') || '60', 10)
                    };
                }

                return {
                    success: false,
                    category: 'Other',
                    error: `HTTP ${response.status}: ${errorData.error?.message || '请求失败'}`
                };
            }

            const data = await response.json();
            const rawCategory = data.choices?.[0]?.message?.content?.trim() || 'Other';

            // 验证返回的分类是否在预设列表中
            const category = this._validateCategory(rawCategory);

            return {
                success: true,
                category,
                error: null
            };

        } catch (error) {
            return {
                success: false,
                category: 'Other',
                error: error.message
            };
        }
    },

    /**
     * 构建分类 Prompt
     * @param {string} title - 书签标题
     * @param {string} url - 书签 URL
     * @returns {string} Prompt 文本
     */
    _buildCategorizationPrompt(title, url) {
        // 提取域名 (用于辅助分类)
        let domain = '';
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            domain = url;
        }

        return `Classify this bookmark into ONE of these categories:
${this._categories.join(', ')}

Bookmark:
- Title: ${title}
- Domain: ${domain}

Reply with ONLY the category name.`;
    },

    /**
     * 验证分类是否有效
     * 如果返回的分类不在预设列表中，返回 "Other"
     * @param {string} rawCategory - 原始分类结果
     * @returns {string} 有效的分类名称
     */
    _validateCategory(rawCategory) {
        // 标准化输入 (去除空格、转小写)
        const normalized = rawCategory.trim().toLowerCase();

        // 在预设分类中查找匹配
        for (const category of this._categories) {
            if (category.toLowerCase() === normalized) {
                return category;
            }
        }

        // 部分匹配 (如 "技术" 匹配 "Tech")
        const keywordMap = {
            '技术': 'Tech',
            '编程': 'Tech',
            '新闻': 'News',
            '工具': 'Tools',
            '学习': 'Learning',
            '购物': 'Shopping',
            '社交': 'Social',
            '媒体': 'Media',
            '工作': 'Work',
            '金融': 'Finance'
        };

        for (const [keyword, category] of Object.entries(keywordMap)) {
            if (rawCategory.includes(keyword)) {
                return category;
            }
        }

        // 默认返回 Other
        return 'Other';
    },

    /**
     * 获取可用分类列表
     * @returns {string[]} 分类名称数组
     */
    getCategories() {
        return [...this._categories];
    },

    /**
     * 设置自定义分类列表
     * @param {string[]} categories - 分类名称数组
     */
    setCategories(categories) {
        if (Array.isArray(categories) && categories.length > 0) {
            this._categories = categories;
        }
    }
};

// 导出供其他模块使用
window.DeepSeekAPI = DeepSeekAPI;
