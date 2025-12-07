/**
 * background.js - 后台服务 (Service Worker)
 * 功能：管理右键菜单，实现书签白名单锁定功能
 */

// ==================== 右键菜单初始化 ====================

/**
 * 插件安装时创建右键菜单
 * 注意：contextMenus 在 MV3 中需要在 onInstalled 事件中创建
 */
chrome.runtime.onInstalled.addListener(() => {
    // 为书签创建"锁定"菜单项
    chrome.contextMenus.create({
        id: 'lock-bookmark',
        title: '🔒 锁定/加入白名单 (Smart Bookmark)',
        contexts: ['bookmark']
    });

    // 为书签创建"解锁"菜单项
    chrome.contextMenus.create({
        id: 'unlock-bookmark',
        title: '🔓 解锁/移出白名单 (Smart Bookmark)',
        contexts: ['bookmark']
    });

    console.log('[Background] 右键菜单已创建');
});

// ==================== 右键菜单点击事件 ====================

/**
 * 监听右键菜单点击事件
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const bookmarkId = info.bookmarkId;

    if (!bookmarkId) {
        console.warn('[Background] 未获取到书签 ID');
        return;
    }

    try {
        if (info.menuItemId === 'lock-bookmark') {
            await addToWhitelist(bookmarkId);
            console.log(`[Background] 已锁定: ${bookmarkId}`);
        } else if (info.menuItemId === 'unlock-bookmark') {
            await removeFromWhitelist(bookmarkId);
            console.log(`[Background] 已解锁: ${bookmarkId}`);
        }
    } catch (error) {
        console.error('[Background] 操作失败:', error);
    }
});

// ==================== 白名单管理函数 ====================

/**
 * 获取当前白名单
 * @returns {Promise<string[]>} 白名单 ID 数组
 */
async function getWhitelist() {
    const result = await chrome.storage.local.get('whitelist');
    return result.whitelist || [];
}

/**
 * 添加节点到白名单
 * @param {string} nodeId - 书签或文件夹 ID
 */
async function addToWhitelist(nodeId) {
    const whitelist = await getWhitelist();

    // 避免重复添加
    if (!whitelist.includes(nodeId)) {
        whitelist.push(nodeId);
        await chrome.storage.local.set({ whitelist });

        // 获取书签信息用于通知
        try {
            const [bookmark] = await chrome.bookmarks.get(nodeId);
            console.log(`[Background] 已添加到白名单: "${bookmark.title}"`);
        } catch (e) {
            console.log(`[Background] 已添加到白名单: ${nodeId}`);
        }
    }
}

/**
 * 从白名单移除节点
 * @param {string} nodeId - 书签或文件夹 ID
 */
async function removeFromWhitelist(nodeId) {
    const whitelist = await getWhitelist();
    const index = whitelist.indexOf(nodeId);

    if (index !== -1) {
        whitelist.splice(index, 1);
        await chrome.storage.local.set({ whitelist });
        console.log(`[Background] 已从白名单移除: ${nodeId}`);
    }
}

// ==================== 消息通信 ====================

/**
 * 监听来自 popup 的消息
 * 用于在 popup 和 background 之间同步白名单状态
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getWhitelist') {
        getWhitelist().then(whitelist => {
            sendResponse({ whitelist });
        });
        return true; // 保持消息通道开放以支持异步响应
    }

    if (message.action === 'addToWhitelist') {
        addToWhitelist(message.nodeId).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === 'removeFromWhitelist') {
        removeFromWhitelist(message.nodeId).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }
});

console.log('[Background] Service Worker 已启动');
