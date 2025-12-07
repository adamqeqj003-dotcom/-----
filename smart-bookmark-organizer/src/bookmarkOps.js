/**
 * bookmarkOps.js - 书签操作封装模块
 * 功能：封装 Chrome Bookmarks API，提供 CRUD 和死链归档功能
 */

// ==================== 常量定义 ====================

// 死链归档文件夹名称 (墓地) - 中文名称
const DEAD_LINKS_FOLDER = '_死链归档';

// ==================== 书签操作类 ====================

const BookmarkOps = {

    // ==================== 读取操作 ====================

    /**
     * 获取完整的书签树
     * @returns {Promise<Array>} 书签树数组
     */
    async getTree() {
        try {
            const tree = await chrome.bookmarks.getTree();
            return tree;
        } catch (error) {
            console.error('[BookmarkOps] 获取书签树失败:', error);
            throw error;
        }
    },

    /**
     * 获取根目录下的散乱项 (未归档的书签)
     * 只返回根目录一级的书签，不包括文件夹
     * @returns {Promise<Array>} 散乱书签数组
     */
    async getRootLooseItems() {
        try {
            const tree = await this.getTree();
            const rootChildren = tree[0].children || [];
            const looseItems = [];

            // 书签栏 (id: "1") 和其他书签 (id: "2") 下的直接子书签
            for (const root of rootChildren) {
                const children = root.children || [];
                for (const child of children) {
                    // 只收集书签 (有 url)，跳过文件夹
                    if (child.url) {
                        looseItems.push(child);
                    }
                }
            }

            return looseItems;
        } catch (error) {
            console.error('[BookmarkOps] 获取散乱项失败:', error);
            throw error;
        }
    },

    /**
     * 获取所有书签 (递归遍历)
     * @param {boolean} includeFolders - 是否包含文件夹
     * @returns {Promise<Array>} 书签数组
     */
    async getAllBookmarks(includeFolders = false) {
        const tree = await this.getTree();
        const bookmarks = [];

        const traverse = (nodes) => {
            for (const node of nodes) {
                if (node.url) {
                    // 这是一个书签
                    bookmarks.push(node);
                } else if (node.children) {
                    // 这是一个文件夹
                    if (includeFolders && node.title) {
                        bookmarks.push(node);
                    }
                    traverse(node.children);
                }
            }
        };

        traverse(tree);
        return bookmarks;
    },

    /**
     * 获取指定文件夹的内容
     * @param {string} folderId - 文件夹 ID
     * @returns {Promise<Array>} 子节点数组
     */
    async getFolderContents(folderId) {
        try {
            const children = await chrome.bookmarks.getChildren(folderId);
            return children;
        } catch (error) {
            console.error('[BookmarkOps] 获取文件夹内容失败:', error);
            throw error;
        }
    },

    /**
     * 获取单个书签/文件夹的信息
     * @param {string} nodeId - 节点 ID
     * @returns {Promise<Object>} 节点信息
     */
    async getNode(nodeId) {
        try {
            const [node] = await chrome.bookmarks.get(nodeId);
            return node;
        } catch (error) {
            console.error('[BookmarkOps] 获取节点失败:', error);
            throw error;
        }
    },

    // ==================== 写入操作 ====================

    /**
     * 移动书签到指定文件夹
     * @param {string} nodeId - 书签 ID
     * @param {string} parentId - 目标文件夹 ID
     * @param {number} index - 可选，在目标文件夹中的位置
     * @returns {Promise<Object>} 移动后的书签信息
     */
    async move(nodeId, parentId, index = undefined) {
        try {
            const destination = { parentId };
            if (index !== undefined) {
                destination.index = index;
            }
            const result = await chrome.bookmarks.move(nodeId, destination);
            return result;
        } catch (error) {
            console.error('[BookmarkOps] 移动书签失败:', error);
            throw error;
        }
    },

    /**
     * 重命名书签或文件夹
     * @param {string} nodeId - 节点 ID
     * @param {string} newTitle - 新标题
     * @returns {Promise<Object>} 更新后的节点信息
     */
    async rename(nodeId, newTitle) {
        try {
            const result = await chrome.bookmarks.update(nodeId, { title: newTitle });
            return result;
        } catch (error) {
            console.error('[BookmarkOps] 重命名失败:', error);
            throw error;
        }
    },

    /**
     * 查找文件夹 (按标题)
     * @param {string} folderName - 文件夹名称
     * @param {string} parentId - 可选，父文件夹 ID (限定搜索范围)
     * @returns {Promise<Object|null>} 找到的文件夹或 null
     */
    async findFolder(folderName, parentId = null) {
        try {
            const results = await chrome.bookmarks.search({ title: folderName });

            for (const node of results) {
                // 必须是文件夹 (没有 url)
                if (!node.url) {
                    // 如果指定了父文件夹，需要检查
                    if (parentId && node.parentId !== parentId) {
                        continue;
                    }
                    return node;
                }
            }

            return null;
        } catch (error) {
            console.error('[BookmarkOps] 查找文件夹失败:', error);
            return null;
        }
    },

    /**
     * 创建文件夹
     * @param {string} folderName - 文件夹名称
     * @param {string} parentId - 父文件夹 ID (默认为书签栏)
     * @returns {Promise<Object>} 新建的文件夹信息
     */
    async createFolder(folderName, parentId = '1') {
        try {
            const result = await chrome.bookmarks.create({
                parentId,
                title: folderName
            });
            return result;
        } catch (error) {
            console.error('[BookmarkOps] 创建文件夹失败:', error);
            throw error;
        }
    },

    /**
     * 查找或创建文件夹
     * 如果文件夹已存在则返回它，否则创建新的
     * @param {string} folderName - 文件夹名称
     * @param {string} parentId - 父文件夹 ID
     * @returns {Promise<Object>} 文件夹信息
     */
    async findOrCreateFolder(folderName, parentId = '1') {
        // 先尝试查找
        let folder = await this.findFolder(folderName, parentId);

        if (!folder) {
            // 不存在则创建
            folder = await this.createFolder(folderName, parentId);
            console.log(`[BookmarkOps] 已创建文件夹: "${folderName}"`);
        }

        return folder;
    },

    // ==================== 死链归档 ====================

    /**
     * 归档死链
     * 将死链移动到 "_Dead_Links_Archive" 文件夹并重命名
     * @param {string} nodeId - 书签 ID
     * @param {string} originalTitle - 原始标题
     * @returns {Promise<boolean>} 是否归档成功
     */
    async archiveDeadLink(nodeId, originalTitle) {
        try {
            // 1. 查找或创建墓地文件夹
            const archiveFolder = await this.findOrCreateFolder(DEAD_LINKS_FOLDER, '1');

            // 2. 生成新标题 (添加日期标记) - 中文标签
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const newTitle = `[失效 ${dateStr}] ${originalTitle}`;

            // 3. 重命名
            await this.rename(nodeId, newTitle);

            // 4. 移动到墓地
            await this.move(nodeId, archiveFolder.id);

            console.log(`[BookmarkOps] 已归档死链: "${originalTitle}"`);
            return true;
        } catch (error) {
            console.error('[BookmarkOps] 归档死链失败:', error);
            return false;
        }
    },

    // ==================== 分类处理 ====================

    /**
     * 对书签进行分类处理
     * 移动到分类文件夹并可选地添加前缀
     * @param {string} nodeId - 书签 ID
     * @param {string} originalTitle - 原始标题
     * @param {string} category - 分类名称
     * @param {boolean} addPrefix - 是否添加分类前缀
     * @returns {Promise<boolean>} 是否处理成功
     */
    async categorize(nodeId, originalTitle, category, addPrefix = true) {
        try {
            // 1. 查找或创建分类文件夹
            const categoryFolder = await this.findOrCreateFolder(category, '1');

            // 2. 可选：添加分类前缀
            if (addPrefix && !originalTitle.startsWith(`[${category}]`)) {
                const newTitle = `[${category}] ${originalTitle}`;
                await this.rename(nodeId, newTitle);
            }

            // 3. 移动到分类文件夹
            await this.move(nodeId, categoryFolder.id);

            console.log(`[BookmarkOps] 已分类: "${originalTitle}" -> ${category}`);
            return true;
        } catch (error) {
            console.error('[BookmarkOps] 分类处理失败:', error);
            return false;
        }
    },

    // ==================== 工具方法 ====================

    /**
     * 获取文件夹树 (用于 UI 渲染)
     * 只返回文件夹结构，不包含书签
     * @returns {Promise<Array>} 文件夹树
     */
    async getFolderTree() {
        const tree = await this.getTree();

        const buildFolderTree = (nodes) => {
            const folders = [];

            for (const node of nodes) {
                // 只处理文件夹 (没有 url 且有 title)
                if (!node.url && node.title !== undefined) {
                    const folder = {
                        id: node.id,
                        title: node.title || '(无标题)',
                        parentId: node.parentId,
                        children: node.children ? buildFolderTree(node.children) : []
                    };
                    folders.push(folder);
                }
            }

            return folders;
        };

        // 从根节点开始构建
        return buildFolderTree(tree[0].children || []);
    }
};

// 导出供其他模块使用
window.BookmarkOps = BookmarkOps;
window.DEAD_LINKS_FOLDER = DEAD_LINKS_FOLDER;
