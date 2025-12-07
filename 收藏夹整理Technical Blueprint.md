📂 Technical\_Blueprint\_v2.md
==============================

1\. Project Identity
--------------------

*   **Name:** Smart Bookmark Organizer (DeepSeek Edition)
*   **Type:** Chrome Extension (Manifest V3)
*   **Architecture:** Popup (UI/Logic) + Background (Context Menu)
*   **Safety Policy:** Conservative (No Delete, Archive Only)

2\. Tech Stack & Directory Structure (Updated)
----------------------------------------------

*   **Manifest:** V3
*   **Permissions:**
    *   `bookmarks`: 搬运工的通行证。
    *   `storage`: 记忆配置和白名单。
    *   `contextMenus`: **\[NEW\]** 右键菜单权限。
    *   `background`: **\[NEW\]** 后台服务权限。
    *   `host_permissions`: `["<all_urls>"]` (用于死链检测)。

### File Tree

```
/smart-bookmark-organizer
├── manifest.json            # [UPDATED] Added background & contextMenus
├── popup.html               # [UPDATED] Added Warning Banner
├── popup.js                 # UI Interaction
├── background.js            # [NEW] 负责右键菜单的监听
├── /src
│   ├── config.js
│   ├── deepseek.js
│   ├── bookmarkOps.js       # [UPDATED] Added archiveDeadLink()
│   ├── cleaner.js
│   └── logger.js
└── /lib
    └── tailwind.min.js      # [FIX] Local copy instead of CDN (V3 Compliant)
```

3\. Key Logic Modules (伪代码与大白话)
-------------------------------

### 3.1. Background Service (`background.js`) - The "Do Not Disturb" Sign

*   **大白话：** 这是一个 24 小时待命的管家。当你对着某个文件夹点右键时，它会立刻把这个文件夹的 ID 记在小本本（Storage）上，告诉主程序：“这个别碰”。
    
```
// 1. Setup Menu on Install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lock-folder",
    title: "Lock/Pin this Folder (DeepSeek)",
    contexts: ["bookmark"] // Only show on bookmarks/folders
  });
});

// 2. Listen for Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lock-folder") {
    const nodeId = info.bookmarkId; // Get the ID
    // Save to 'whitelist' in local storage
    addToWhitelist(nodeId); 
  }
});
```

### 3.2. Dead Link Archiver (`bookmarkOps.js`) - The "Graveyard" Keeper

*   **大白话：** 发现死链后，不再只是打个叉。系统会先检查有没有“墓地”（\_Dead\_Links\_Archive 文件夹）。如果没有就挖一个。然后把死链搬进去，并把墓碑（标题）改好。
    
```
async function archiveDeadLink(nodeId, originalTitle) {
  // 1. Find or Create the Graveyard Folder
  let archiveFolderId = await findFolderByTitle("_Dead_Links_Archive");
  if (!archiveFolderId) {
    archiveFolderId = await createFolder("_Dead_Links_Archive");
  }

  // 2. Rename the Tombstone (Title)
  const newTitle = `[DEAD] ${originalTitle}`;
  await chrome.bookmarks.update(nodeId, { title: newTitle });

  // 3. Move the Body
  await chrome.bookmarks.move(nodeId, { parentId: archiveFolderId });
  
  return true; // Mission Accomplished
}
```

### 3.3. UI Safety Warning (`popup.html`) - The "Seatbelt" Light

*   **大白话：** 在进度条上方加一个红色的警示牌，用最大的声音告诉用户：**“正在干活，别关窗户！”**
    
```
<div id="progress-section" class="hidden">
  <div class="bg-red-900 text-red-100 p-2 text-xs font-bold border border-red-500 mb-2 blink">
    ⚠️ PROCESSING... DO NOT CLOSE THIS WINDOW OR CLICK AWAY!
  </div>
  
  <div class="progress-bar">...</div>
</div>
```

### 3.4. Whitelist Modal Update (`popup.js` / HTML)

*   **大白话：** 在白名单列表的弹窗里，加一句话提示用户：“别光在这看，去浏览器书签栏上点右键也能加锁。”
    
```
<div class="modal-header">
  <h3>Whitelist Manager</h3>
  <p class="text-gray-500 text-xs mt-1">
    Tip: Right-click any folder in your bookmarks bar to Lock/Pin it quickly.
  </p>
</div>
```