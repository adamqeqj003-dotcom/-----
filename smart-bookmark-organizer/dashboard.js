/**
 * dashboard.js - 独立标签页控制器
 * 功能：管理 UI 交互、设置面板、任务调度
 * 
 * 与 popup.js 的区别：
 * - 设置面板使用折叠展开而非视图切换
 * - 页面可以在后台运行，不会因点击外部而关闭
 */

// ==================== 全局状态 ====================

const AppState = {
    // 任务状态
    isProcessing: false,
    shouldStop: false,
    currentTask: null,

    // 选中的文件夹 (用于 "选择指定文件夹" 功能)
    selectedFolderId: null,
    selectedFolderTitle: null,

    // 文件夹选择器模式: 'process' | 'whitelist'
    folderSelectorMode: 'process',

    // 配置缓存
    config: null
};

// ==================== DOM 元素引用 ====================

const DOM = {
    // Status
    statusDot: null,
    statusText: null,
    statusDelay: null,

    // Settings
    btnSettings: null,
    settingsPanel: null,
    inputApiUrl: null,
    inputApiKey: null,
    btnTestConnection: null,
    toggleDeadLink: null,
    toggleScatter: null,
    togglePrefix: null,
    inputDelay: null,
    btnSaveSettings: null,

    // Progress
    progressSection: null,
    progressText: null,
    progressBar: null,
    btnStop: null,

    // Actions
    btnQuickTidy: null,
    btnDeepClean: null,
    btnSelectFolder: null,
    btnWhitelist: null,

    // Log
    logConsole: null,
    btnClearLog: null,

    // Modals
    modalFolder: null,
    folderTree: null,
    btnConfirmFolder: null,
    modalWhitelist: null,
    whitelistContainer: null,
    btnAddToWhitelist: null,

    // Toast
    toast: null,
    toastMessage: null
};

// ==================== 初始化 ====================

/**
 * 初始化应用
 */
async function initApp() {
    console.log('[Dashboard] 初始化应用...');

    // 获取 DOM 元素引用
    initDOMReferences();

    // 初始化日志模块
    if (window.Logger) {
        Logger.init(DOM.logConsole, 100);
    }

    // 加载配置
    await loadConfiguration();

    // 绑定事件
    bindEvents();

    // 更新 API 状态显示
    updateConnectionStatus(false);

    Logger.info('独立控制台已启动');
    Logger.info('💡 提示: 此页面可在后台运行，切换标签不会中断任务');
    console.log('[Dashboard] 应用初始化完成');

    // 检查是否有自动启动参数
    const urlParams = new URLSearchParams(window.location.search);
    const autostart = urlParams.get('autostart');
    if (autostart === 'quick') {
        Logger.info('自动启动快速整理...');
        setTimeout(() => startProcessing('quick'), 500);
    }
}

/**
 * 获取所有 DOM 元素引用
 */
function initDOMReferences() {
    // Status
    DOM.statusDot = document.getElementById('status-dot');
    DOM.statusText = document.getElementById('status-text');
    DOM.statusDelay = document.getElementById('status-delay');

    // Settings
    DOM.btnSettings = document.getElementById('btn-settings');
    DOM.settingsPanel = document.getElementById('settings-panel');
    DOM.inputApiUrl = document.getElementById('input-api-url');
    DOM.inputApiKey = document.getElementById('input-api-key');
    DOM.btnTestConnection = document.getElementById('btn-test-connection');
    DOM.toggleDeadLink = document.getElementById('toggle-dead-link');
    DOM.toggleScatter = document.getElementById('toggle-scatter');
    DOM.togglePrefix = document.getElementById('toggle-prefix');
    DOM.inputDelay = document.getElementById('input-delay');
    DOM.btnSaveSettings = document.getElementById('btn-save-settings');

    // Progress
    DOM.progressSection = document.getElementById('progress-section');
    DOM.progressText = document.getElementById('progress-text');
    DOM.progressBar = document.getElementById('progress-bar');
    DOM.btnStop = document.getElementById('btn-stop');

    // Actions
    DOM.btnQuickTidy = document.getElementById('btn-quick-tidy');
    DOM.btnDeepClean = document.getElementById('btn-deep-clean');
    DOM.btnSelectFolder = document.getElementById('btn-select-folder');
    DOM.btnWhitelist = document.getElementById('btn-whitelist');

    // Log
    DOM.logConsole = document.getElementById('log-console');
    DOM.btnClearLog = document.getElementById('btn-clear-log');

    // Modals
    DOM.modalFolder = document.getElementById('modal-folder');
    DOM.folderTree = document.getElementById('folder-tree');
    DOM.btnConfirmFolder = document.getElementById('btn-confirm-folder');
    DOM.modalWhitelist = document.getElementById('modal-whitelist');
    DOM.whitelistContainer = document.getElementById('whitelist-container');
    DOM.btnAddToWhitelist = document.getElementById('btn-add-to-whitelist');

    // Toast
    DOM.toast = document.getElementById('toast');
    DOM.toastMessage = document.getElementById('toast-message');
}

/**
 * 加载配置到表单
 */
async function loadConfiguration() {
    if (!window.Config) return;

    AppState.config = await Config.load();

    // 填充设置表单
    DOM.inputApiUrl.value = AppState.config.apiBaseUrl;
    DOM.inputApiKey.value = AppState.config.apiKey;
    DOM.toggleDeadLink.checked = AppState.config.enableDeadLinkCheck;
    DOM.toggleScatter.checked = AppState.config.enableScatterMode;
    DOM.togglePrefix.checked = AppState.config.enableCategoryPrefix;
    DOM.inputDelay.value = AppState.config.requestDelay;

    // 更新状态栏延时显示
    DOM.statusDelay.textContent = AppState.config.requestDelay;
}

// ==================== 事件绑定 ====================

/**
 * 绑定所有事件监听器
 */
function bindEvents() {
    // 设置面板切换
    DOM.btnSettings.addEventListener('click', toggleSettingsPanel);

    // 设置页
    DOM.btnTestConnection.addEventListener('click', handleTestConnection);
    DOM.btnSaveSettings.addEventListener('click', handleSaveSettings);

    // 操作按钮
    DOM.btnQuickTidy.addEventListener('click', () => startProcessing('quick'));
    DOM.btnDeepClean.addEventListener('click', () => startProcessing('deep'));
    DOM.btnSelectFolder.addEventListener('click', openFolderModal);
    DOM.btnStop.addEventListener('click', stopProcessing);

    // 日志
    DOM.btnClearLog.addEventListener('click', () => Logger.clear());

    // 白名单
    DOM.btnWhitelist.addEventListener('click', openWhitelistModal);

    // 延迟绑定白名单添加按钮 (因为它在 Modal 内)
    setTimeout(() => {
        if (DOM.btnAddToWhitelist) {
            DOM.btnAddToWhitelist.addEventListener('click', openFolderSelectorForWhitelist);
        }
    }, 100);

    // Modal 关闭按钮
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal;
            if (modalId) {
                document.getElementById(modalId).classList.add('hidden');
            }
        });
    });

    // 文件夹选择确认
    DOM.btnConfirmFolder.addEventListener('click', handleFolderConfirm);
}

// ==================== 设置面板 ====================

/**
 * 切换设置面板显示/隐藏
 */
function toggleSettingsPanel() {
    DOM.settingsPanel.classList.toggle('hidden');
    DOM.btnSettings.textContent = DOM.settingsPanel.classList.contains('hidden')
        ? '⚙️ 设置'
        : '⚙️ 收起设置';
}

/**
 * 处理测试连接
 */
async function handleTestConnection() {
    DOM.btnTestConnection.disabled = true;
    DOM.btnTestConnection.textContent = '⏳ 测试中...';

    // 临时应用当前表单值
    if (window.DeepSeekAPI) {
        DeepSeekAPI.init(DOM.inputApiUrl.value, DOM.inputApiKey.value);
    }

    try {
        const result = await DeepSeekAPI.testConnection();

        if (result.success) {
            showToast('✅ ' + result.message, false);
            updateConnectionStatus(true);
        } else {
            showToast('❌ ' + result.message, true);
            updateConnectionStatus(false);
        }
    } catch (error) {
        showToast('❌ 测试失败: ' + error.message, true);
        updateConnectionStatus(false);
    }

    DOM.btnTestConnection.disabled = false;
    DOM.btnTestConnection.textContent = '🧪 测试连接';
}

/**
 * 保存设置
 */
async function handleSaveSettings() {
    const newConfig = {
        apiBaseUrl: DOM.inputApiUrl.value.trim(),
        apiKey: DOM.inputApiKey.value.trim(),
        enableDeadLinkCheck: DOM.toggleDeadLink.checked,
        enableScatterMode: DOM.toggleScatter.checked,
        enableCategoryPrefix: DOM.togglePrefix.checked,
        requestDelay: parseInt(DOM.inputDelay.value, 10) || 500
    };

    const success = await Config.save({ ...AppState.config, ...newConfig });

    if (success) {
        AppState.config = { ...AppState.config, ...newConfig };
        DOM.statusDelay.textContent = newConfig.requestDelay;
        showToast('✅ 设置已保存', false);
        Logger.success('配置已更新');
    } else {
        showToast('❌ 保存失败', true);
    }
}

/**
 * 更新连接状态显示
 * @param {boolean} connected - 是否已连接
 */
function updateConnectionStatus(connected) {
    if (connected) {
        DOM.statusDot.className = 'status-dot connected';
        DOM.statusText.textContent = '已连接';
    } else {
        DOM.statusDot.className = 'status-dot disconnected';
        DOM.statusText.textContent = '未连接';
    }
}

// ==================== 任务处理 ====================

/**
 * 开始处理任务
 * @param {string} mode - 'quick' | 'deep' | 'folder'
 */
async function startProcessing(mode) {
    if (AppState.isProcessing) {
        showToast('⚠️ 已有任务在运行中', true);
        return;
    }

    AppState.isProcessing = true;
    AppState.shouldStop = false;
    AppState.currentTask = mode;

    // 锁定 UI
    setButtonsEnabled(false);
    DOM.progressSection.classList.remove('hidden');

    Logger.info(`开始${mode === 'quick' ? '快速整理' : mode === 'deep' ? '深度清理' : '文件夹处理'}...`);

    try {
        // 获取要处理的书签
        let bookmarks = [];

        if (mode === 'quick') {
            bookmarks = await BookmarkOps.getRootLooseItems();
            Logger.info(`找到 ${bookmarks.length} 个散乱书签`);
        } else if (mode === 'deep') {
            bookmarks = await BookmarkOps.getAllBookmarks(false);
            Logger.info(`找到 ${bookmarks.length} 个书签`);
        } else if (mode === 'folder' && AppState.selectedFolderId) {
            bookmarks = await BookmarkOps.getFolderContents(AppState.selectedFolderId);
            // 过滤出书签 (排除子文件夹)
            bookmarks = bookmarks.filter(b => b.url);
            Logger.info(`文件夹 "${AppState.selectedFolderTitle}" 中有 ${bookmarks.length} 个书签`);
        }

        if (bookmarks.length === 0) {
            Logger.warn('没有找到需要处理的书签');
            finishProcessing();
            return;
        }

        // 获取白名单
        const whitelist = await Whitelist.get();

        // 过滤白名单
        const filteredBookmarks = bookmarks.filter(b => !whitelist.includes(b.id));
        const skippedCount = bookmarks.length - filteredBookmarks.length;

        if (skippedCount > 0) {
            Logger.info(`已跳过 ${skippedCount} 个白名单书签`);
        }

        // 处理队列
        await processQueue(filteredBookmarks);

    } catch (error) {
        Logger.error(`处理出错: ${error.message}`);
        console.error('[Dashboard] 处理错误:', error);
    }

    finishProcessing();
}

/**
 * 处理书签队列 (主控循环)
 * @param {Array} bookmarks - 要处理的书签数组
 */
async function processQueue(bookmarks) {
    const total = bookmarks.length;
    const config = AppState.config;

    for (let i = 0; i < total; i++) {
        // 检查是否应该停止
        if (AppState.shouldStop) {
            Logger.warn('用户中止了任务');
            break;
        }

        const bookmark = bookmarks[i];
        const progress = ((i + 1) / total * 100).toFixed(0);

        // 更新进度
        updateProgress(i + 1, total, progress);

        try {
            // 步骤 1: 死链检测 (如果启用)
            if (config.enableDeadLinkCheck) {
                Logger.info(`[${i + 1}/${total}] 检测: ${bookmark.title.substring(0, 30)}...`);

                const checkResult = await Cleaner.checkLink(bookmark.url);

                if (!checkResult.alive) {
                    // 是死链，归档
                    Logger.warn(`死链: ${bookmark.title} (${checkResult.error})`);
                    await BookmarkOps.archiveDeadLink(bookmark.id, bookmark.title);
                    Logger.success(`已归档到墓地`);

                    // 跳过分类步骤
                    await delay(config.requestDelay);
                    continue;
                }
            }

            // 步骤 2: AI 分类
            Logger.info(`[${i + 1}/${total}] 分类: ${bookmark.title.substring(0, 30)}...`);

            const categoryResult = await DeepSeekAPI.categorizeBookmark(bookmark.title, bookmark.url);

            if (categoryResult.success) {
                // 移动到分类文件夹
                await BookmarkOps.categorize(
                    bookmark.id,
                    bookmark.title,
                    categoryResult.category,
                    config.enableCategoryPrefix
                );
                Logger.success(`✓ ${bookmark.title.substring(0, 20)}... → ${categoryResult.category}`);
            } else {
                // API 调用失败
                if (categoryResult.error === 'API_RATE_LIMITED') {
                    Logger.error('API 限流，暂停 60 秒...');
                    await delay(60000);
                    i--; // 重试当前书签
                    continue;
                }
                Logger.warn(`分类失败: ${categoryResult.error}`);
            }

        } catch (error) {
            Logger.error(`处理 "${bookmark.title}" 时出错: ${error.message}`);
        }

        // 请求间隔
        await delay(config.requestDelay);
    }
}

/**
 * 更新进度显示
 */
function updateProgress(current, total, percent) {
    DOM.progressText.textContent = `处理中: ${current}/${total}`;
    DOM.progressBar.style.width = `${percent}%`;
}

/**
 * 停止处理
 */
function stopProcessing() {
    AppState.shouldStop = true;
    Logger.warn('正在停止任务...');
    DOM.btnStop.disabled = true;
    DOM.btnStop.textContent = '停止中...';
}

/**
 * 完成处理，恢复 UI
 */
function finishProcessing() {
    AppState.isProcessing = false;
    AppState.shouldStop = false;
    AppState.currentTask = null;

    setButtonsEnabled(true);
    DOM.progressSection.classList.add('hidden');
    DOM.btnStop.disabled = false;
    DOM.btnStop.textContent = '停止';

    Logger.success('任务完成');
}

/**
 * 设置按钮启用/禁用状态
 * @param {boolean} enabled - 是否启用
 */
function setButtonsEnabled(enabled) {
    DOM.btnQuickTidy.disabled = !enabled;
    DOM.btnDeepClean.disabled = !enabled;
    DOM.btnSelectFolder.disabled = !enabled;
}

// ==================== 文件夹选择器 Modal ====================

/**
 * 打开文件夹选择器
 */
async function openFolderModal() {
    // 如果不是从白名单调用，重置模式
    if (AppState.folderSelectorMode !== 'whitelist') {
        AppState.folderSelectorMode = 'process';
    }

    DOM.modalFolder.classList.remove('hidden');
    DOM.folderTree.innerHTML = '<div class="text-gray-secondary text-sm">加载中...</div>';
    DOM.btnConfirmFolder.disabled = true;
    AppState.selectedFolderId = null;
    AppState.selectedFolderTitle = null;

    try {
        // 白名单模式下获取完整树 (包含书签)，否则只获取文件夹
        const tree = AppState.folderSelectorMode === 'whitelist'
            ? await BookmarkOps.getFullTree()
            : await BookmarkOps.getFolderTree();
        renderBookmarkTree(tree, DOM.folderTree);
    } catch (error) {
        DOM.folderTree.innerHTML = '<div class="text-error">加载失败</div>';
        console.error('[Dashboard] 加载书签树失败:', error);
    }
}

/**
 * 渲染书签树 (支持文件夹和书签)
 * @param {Array} items - 书签/文件夹数组
 * @param {HTMLElement} container - 容器元素
 */
function renderBookmarkTree(items, container) {
    container.innerHTML = '';

    const renderNode = (item, parentEl) => {
        const itemEl = document.createElement('div');
        itemEl.className = item.isFolder ? 'folder-item' : 'folder-item bookmark-item';
        itemEl.dataset.id = item.id;
        itemEl.dataset.title = item.title;

        // 文件夹用 📁，书签用 🔗
        const icon = item.isFolder ? '📁' : '🔗';
        const titleText = item.title.length > 40 ? item.title.substring(0, 40) + '...' : item.title;

        itemEl.innerHTML = `
      <span class="folder-icon">${icon}</span>
      <span class="folder-title">${titleText}</span>
    `;

        itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // 移除其他选中状态
            document.querySelectorAll('.folder-item.selected').forEach(el => el.classList.remove('selected'));
            itemEl.classList.add('selected');

            AppState.selectedFolderId = item.id;
            AppState.selectedFolderTitle = item.title;
            DOM.btnConfirmFolder.disabled = false;
        });

        parentEl.appendChild(itemEl);

        // 递归渲染子节点 (只有文件夹有子节点)
        if (item.children && item.children.length > 0) {
            const childrenEl = document.createElement('div');
            childrenEl.className = 'folder-children';
            item.children.forEach(child => renderNode(child, childrenEl));
            parentEl.appendChild(childrenEl);
        }
    };

    items.forEach(item => renderNode(item, container));
}

/**
 * 确认文件夹选择
 */
function handleFolderConfirm() {
    if (!AppState.selectedFolderId) return;

    DOM.modalFolder.classList.add('hidden');

    if (AppState.folderSelectorMode === 'whitelist') {
        // 白名单模式：添加选中项到白名单
        addSelectedToWhitelist();
    } else {
        // 处理模式：开始处理选中的文件夹
        Logger.info(`已选择文件夹: "${AppState.selectedFolderTitle}"`);
        startProcessing('folder');
    }
}

/**
 * 打开书签选择器用于添加白名单 (支持文件夹和书签)
 */
function openFolderSelectorForWhitelist() {
    AppState.folderSelectorMode = 'whitelist';
    DOM.modalWhitelist.classList.add('hidden');  // 先关闭白名单弹窗
    openFolderModal();  // 打开选择器
}

/**
 * 将选中的项目添加到白名单 (文件夹或书签)
 */
async function addSelectedToWhitelist() {
    if (!AppState.selectedFolderId) return;

    try {
        await Whitelist.add(AppState.selectedFolderId);
        Logger.success(`已锁定: "${AppState.selectedFolderTitle}"`);
        showToast(`✅ 已添加到白名单: ${AppState.selectedFolderTitle}`, false);

        // 重新打开白名单弹窗以刷新列表
        setTimeout(() => {
            openWhitelistModal();
        }, 300);
    } catch (error) {
        Logger.error(`添加白名单失败: ${error.message}`);
        showToast('❌ 添加失败', true);
    }

    // 重置模式
    AppState.folderSelectorMode = 'process';
}

// ==================== 白名单 Modal ====================

/**
 * 打开白名单管理器
 */
async function openWhitelistModal() {
    DOM.modalWhitelist.classList.remove('hidden');
    DOM.whitelistContainer.innerHTML = '<div class="text-gray-secondary text-sm text-center py-4">加载中...</div>';

    try {
        const whitelist = await Whitelist.get();

        if (whitelist.length === 0) {
            DOM.whitelistContainer.innerHTML = '<div class="text-gray-secondary text-sm text-center py-4">暂无锁定项</div>';
            return;
        }

        DOM.whitelistContainer.innerHTML = '';

        for (const nodeId of whitelist) {
            try {
                const node = await BookmarkOps.getNode(nodeId);
                const itemEl = document.createElement('div');
                itemEl.className = 'whitelist-item';
                itemEl.innerHTML = `
          <span class="item-title" title="${node.title}">${node.url ? '🔗' : '📁'} ${node.title}</span>
          <button class="btn-remove" data-id="${nodeId}" title="解锁">🗑️</button>
        `;

                itemEl.querySelector('.btn-remove').addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    await Whitelist.remove(id);
                    itemEl.remove();
                    Logger.info(`已从白名单移除: ${node.title}`);

                    // 检查是否为空
                    if (DOM.whitelistContainer.children.length === 0) {
                        DOM.whitelistContainer.innerHTML = '<div class="text-gray-secondary text-sm text-center py-4">暂无锁定项</div>';
                    }
                });

                DOM.whitelistContainer.appendChild(itemEl);
            } catch (e) {
                // 节点可能已被删除，从白名单中移除
                await Whitelist.remove(nodeId);
            }
        }

    } catch (error) {
        DOM.whitelistContainer.innerHTML = '<div class="text-error">加载失败</div>';
        console.error('[Dashboard] 加载白名单失败:', error);
    }
}

// ==================== 工具函数 ====================

/**
 * 显示 Toast 通知
 * @param {string} message - 消息内容
 * @param {boolean} isError - 是否为错误消息
 */
function showToast(message, isError = false) {
    DOM.toastMessage.textContent = message;
    DOM.toast.className = isError ? 'toast error' : 'toast';
    DOM.toast.classList.remove('hidden');

    setTimeout(() => {
        DOM.toast.classList.add('hidden');
    }, 3000);
}

/**
 * 延迟函数
 * @param {number} ms - 毫秒数
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 启动应用 ====================

document.addEventListener('DOMContentLoaded', initApp);
