"use strict";
// 安全桥接层：只暴露明确的业务方法，不开放 Node.js 或原始 ipcRenderer 给页面。
// 组合关系：React 页面调用 window.desktopApi；方法对应 main.js 中注册的 ipcMain handler。
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const physical = {
    startRecording: (request) => electron_1.ipcRenderer.invoke("physical:start-recording", request),
    pauseRecording: () => electron_1.ipcRenderer.invoke("physical:pause-recording"),
    resumeRecording: () => electron_1.ipcRenderer.invoke("physical:resume-recording"),
    stopRecording: () => electron_1.ipcRenderer.invoke("physical:stop-recording"),
    listScripts: () => electron_1.ipcRenderer.invoke("physical:list-scripts"),
    loadScript: (scriptId) => electron_1.ipcRenderer.invoke("physical:load-script", scriptId),
    deleteScript: (scriptId) => electron_1.ipcRenderer.invoke("physical:delete-script", scriptId),
    startPlayback: (scriptId, options) => electron_1.ipcRenderer.invoke("physical:start-playback", scriptId, options),
    pausePlayback: () => electron_1.ipcRenderer.invoke("physical:pause-playback"),
    resumePlayback: () => electron_1.ipcRenderer.invoke("physical:resume-playback"),
    stopPlayback: () => electron_1.ipcRenderer.invoke("physical:stop-playback"),
    onEvent: (callback) => { const listener = (_event, value) => callback(value); electron_1.ipcRenderer.on("physical:event", listener); return () => electron_1.ipcRenderer.removeListener("physical:event", listener); },
};
electron_1.contextBridge.exposeInMainWorld("desktopApi", {
    loadConfig: () => electron_1.ipcRenderer.invoke("config:load"),
    saveConfig: (config) => electron_1.ipcRenderer.invoke("config:save", config),
    openDataFolder: () => electron_1.ipcRenderer.invoke("data:open"),
    target: { chooseApplication: () => electron_1.ipcRenderer.invoke("target:choose-application") },
    physical,
    floating: {
        ready: () => electron_1.ipcRenderer.send("floating:ready"),
        getSnapshot: () => electron_1.ipcRenderer.invoke("floating:snapshot"),
        onSnapshot: (callback) => { const listener = (_event, snapshot) => callback(snapshot); electron_1.ipcRenderer.on("floating:snapshot", listener); return () => electron_1.ipcRenderer.removeListener("floating:snapshot", listener); },
        dismiss: () => electron_1.ipcRenderer.send("floating:dismiss"),
        startRecording: () => electron_1.ipcRenderer.invoke("floating:start-recording"),
        pauseRecording: () => electron_1.ipcRenderer.invoke("floating:pause-recording"),
        resumeRecording: () => electron_1.ipcRenderer.invoke("floating:resume-recording"),
        stopRecording: () => electron_1.ipcRenderer.invoke("floating:stop-recording"),
        pausePlayback: () => electron_1.ipcRenderer.invoke("floating:pause-playback"),
        resumePlayback: () => electron_1.ipcRenderer.invoke("floating:resume-playback"),
        stopPlayback: () => electron_1.ipcRenderer.invoke("floating:stop-playback"),
    },
});
