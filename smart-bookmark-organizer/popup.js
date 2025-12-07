/**
 * popup.js - 弹窗启动器
 * 功能：打开独立控制台标签页
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Popup] 启动器已加载');

    // 打开独立控制台
    document.getElementById('btn-open-dashboard').addEventListener('click', () => {
        console.log('[Popup] 正在打开控制台...');
        const url = chrome.runtime.getURL('dashboard.html');
        console.log('[Popup] URL:', url);
        chrome.tabs.create({ url: url }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('[Popup] 打开失败:', chrome.runtime.lastError);
            } else {
                console.log('[Popup] 已打开标签页:', tab.id);
                window.close();
            }
        });
    });

    // 快速开始：打开控制台并自动执行快速整理
    document.getElementById('btn-quick-start').addEventListener('click', () => {
        console.log('[Popup] 正在快速启动...');
        const url = chrome.runtime.getURL('dashboard.html') + '?autostart=quick';
        chrome.tabs.create({ url: url }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('[Popup] 打开失败:', chrome.runtime.lastError);
            } else {
                window.close();
            }
        });
    });
});
