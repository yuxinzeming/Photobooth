"use strict";
// 主进程入口：创建 Electron 窗口、初始化物理操作模块、管理配置并注册 IPC。
// 组合关系：Renderer 通过 preload.js 的 desktopApi 调用这里；这里组合录制、重播、存储、启动器和悬浮窗。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const physical_run_controller_1 = require("./physical/physical-run-controller");
const script_store_1 = require("./physical/script-store");
const target_launcher_1 = require("./physical/target-launcher");
const input_recorder_1 = require("./physical/input-recorder");
const floating_window_1 = require("./main/floating-window");
let mainWindow = null;
let floatingWindow = null;
let physicalController = null;
let currentConfig = {};
const preferredDataRoot = "E:\\ChatGPT-data\\ai-program-1-data";
electron_1.app.disableHardwareAcceleration();
// 优先把配置和脚本放到 E 盘，避免占用系统盘；E 盘目录不存在时使用 Electron 默认目录。
function dataRoot() { return (0, node_fs_1.existsSync)("E:\\ChatGPT-data") ? preferredDataRoot : electron_1.app.getPath("userData"); }
function configFile() { return node_path_1.default.join(dataRoot(), "physical-config.json"); }
function scriptRoot() { return node_path_1.default.join(dataRoot(), "RecordedScripts"); }
function normalizeConfig(value) { const raw = value && typeof value === "object" ? value : {}; return { theme: raw.theme === "dark" ? "dark" : "light", hasCompletedIntro: raw.hasCompletedIntro === true, targetApplicationPath: raw.targetApplicationPath, targetApplicationName: raw.targetApplicationName, recordingName: raw.recordingName, recordingLaunchMode: raw.recordingLaunchMode === "manual" ? "manual" : "auto-launch" }; }
async function loadConfig() { try {
    currentConfig = normalizeConfig(JSON.parse(await promises_1.default.readFile(configFile(), "utf8")));
}
catch {
    currentConfig = normalizeConfig({});
} return currentConfig; }
async function saveConfig(config) { currentConfig = normalizeConfig(config); await promises_1.default.mkdir(dataRoot(), { recursive: true }); await promises_1.default.writeFile(configFile(), JSON.stringify(currentConfig, null, 2), "utf8"); }
// 计算虚拟桌面边界；脚本保存它，重播前用来判断显示器布局是否变化。
function currentScreen() { const displays = electron_1.screen.getAllDisplays(); const left = Math.min(...displays.map((item) => item.bounds.x)); const top = Math.min(...displays.map((item) => item.bounds.y)); const right = Math.max(...displays.map((item) => item.bounds.x + item.bounds.width)); const bottom = Math.max(...displays.map((item) => item.bounds.y + item.bounds.height)); return { originX: left, originY: top, width: right - left, height: bottom - top }; }
function requireController() { if (!physicalController)
    throw new Error("物理操作模块还没有准备好，请稍后再试。"); return physicalController; }
function recordingRequest() { const manual = currentConfig.recordingLaunchMode === "manual"; if (!manual && !currentConfig.targetApplicationPath)
    throw new Error("请先选择要操作的文件，或切换为手动模式。"); return { name: currentConfig.recordingName, targetPath: currentConfig.targetApplicationPath, targetName: currentConfig.targetApplicationName ?? (currentConfig.targetApplicationPath ? node_path_1.default.basename(currentConfig.targetApplicationPath) : "当前已打开的应用"), launchMode: manual ? "manual" : "auto-launch", screen: currentScreen() }; }
function configureApplicationMenu() {
    const viewMenu = [{ label: "刷新", role: "reload" }, { label: "强制刷新", role: "forceReload" }, { type: "separator" }, { label: "全屏", role: "togglefullscreen" }];
    if (!electron_1.app.isPackaged)
        viewMenu.push({ label: "开发者工具", role: "toggleDevTools" });
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate([{ label: "文件", submenu: [{ label: "退出", role: "quit" }] }, { label: "编辑", submenu: [{ label: "撤销", role: "undo" }, { label: "重做", role: "redo" }, { type: "separator" }, { label: "剪切", role: "cut" }, { label: "复制", role: "copy" }, { label: "粘贴", role: "paste" }, { label: "全选", role: "selectAll" }] }, { label: "查看", submenu: viewMenu }, { label: "窗口", submenu: [{ label: "最小化", role: "minimize" }, { label: "关闭窗口", role: "close" }] }]));
}
// 页面和悬浮窗共用的 IPC 入口；状态和业务规则由 PhysicalRunController 维护。
async function registerHandlers() {
    electron_1.ipcMain.handle("config:load", loadConfig);
    electron_1.ipcMain.handle("config:save", async (_event, config) => { await saveConfig(config); floatingWindow?.setCanStartRecording(currentConfig.recordingLaunchMode === "manual" || Boolean(currentConfig.targetApplicationPath), currentConfig.targetApplicationName ?? (currentConfig.recordingLaunchMode === "manual" ? "当前已打开的应用" : undefined)); });
    electron_1.ipcMain.handle("data:open", async () => { await promises_1.default.mkdir(dataRoot(), { recursive: true }); await electron_1.shell.openPath(dataRoot()); });
    electron_1.ipcMain.handle("target:choose-application", async () => { const result = await electron_1.dialog.showOpenDialog(mainWindow, { title: "选择要操作的文件", properties: ["openFile"], filters: [{ name: "所有文件", extensions: ["*"] }] }); if (result.canceled || !result.filePaths[0])
        return { canceled: true }; const selectedPath = result.filePaths[0]; const extension = node_path_1.default.extname(selectedPath).toLowerCase(); return { canceled: false, path: selectedPath, name: node_path_1.default.basename(selectedPath), kind: extension === ".lnk" ? "shortcut" : extension === ".exe" ? "exe" : "file" }; });
    electron_1.ipcMain.handle("physical:start-recording", async (_event, request) => requireController().startRecording(request));
    electron_1.ipcMain.handle("physical:pause-recording", () => requireController().pauseRecording());
    electron_1.ipcMain.handle("physical:resume-recording", () => requireController().resumeRecording());
    electron_1.ipcMain.handle("physical:stop-recording", () => requireController().stopRecording());
    electron_1.ipcMain.handle("physical:list-scripts", () => requireController().listScripts?.());
    electron_1.ipcMain.handle("physical:load-script", (_event, scriptId) => requireController().loadScript?.(scriptId));
    electron_1.ipcMain.handle("physical:delete-script", (_event, scriptId) => requireController().deleteScript?.(scriptId));
    electron_1.ipcMain.handle("physical:start-playback", async (_event, scriptId, options) => {
        const script = await requireController().loadScript(scriptId);
        const current = currentScreen();
        const screenChanged = script.screen.originX !== current.originX || script.screen.originY !== current.originY || script.screen.width !== current.width || script.screen.height !== current.height;
        if (screenChanged) {
            const answer = await electron_1.dialog.showMessageBox(mainWindow, { type: "warning", title: "屏幕布局发生变化", message: "当前屏幕布局与录制时不同，原始坐标可能不准确。", detail: "工具不会自动缩放坐标。仍要按原始绝对坐标重播吗？", buttons: ["仍然重播", "取消重播"], defaultId: 1, cancelId: 1 });
            if (answer.response !== 0)
                throw new Error("已取消重播，避免在错误位置操作。");
        }
        return requireController().startPlayback(scriptId, options);
    });
    electron_1.ipcMain.handle("physical:pause-playback", () => requireController().pausePlayback());
    electron_1.ipcMain.handle("physical:resume-playback", () => requireController().resumePlayback());
    electron_1.ipcMain.handle("physical:stop-playback", () => requireController().stopPlayback());
    electron_1.ipcMain.handle("floating:snapshot", () => floatingWindow?.getSnapshot() ?? { recordingStatus: "idle", playbackStatus: "idle", message: "操作已就绪。", eventCount: 0, elapsedMs: 0 });
    electron_1.ipcMain.on("floating:ready", (event) => { if (floatingWindow && electron_1.BrowserWindow.fromWebContents(event.sender))
        floatingWindow.markRendererReady(); });
    electron_1.ipcMain.on("floating:dismiss", () => floatingWindow?.dismissForCurrentMinimize());
    electron_1.ipcMain.handle("floating:start-recording", () => requireController().startRecording(recordingRequest()));
    electron_1.ipcMain.handle("floating:pause-recording", () => requireController().pauseRecording());
    electron_1.ipcMain.handle("floating:resume-recording", () => requireController().resumeRecording());
    electron_1.ipcMain.handle("floating:stop-recording", () => requireController().stopRecording());
    electron_1.ipcMain.handle("floating:pause-playback", () => requireController().pausePlayback());
    electron_1.ipcMain.handle("floating:resume-playback", () => requireController().resumePlayback());
    electron_1.ipcMain.handle("floating:stop-playback", () => requireController().stopPlayback());
}
// 创建主窗口并加载 React 构建产物；最小化时由悬浮窗提供快捷控制。
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({ width: 1440, height: 920, minWidth: 1050, minHeight: 700, show: false, title: "留影机", backgroundColor: "#0c1320", icon: (0, node_fs_1.existsSync)(node_path_1.default.join(electron_1.app.getAppPath(), "build", "icon.ico")) ? node_path_1.default.join(electron_1.app.getAppPath(), "build", "icon.ico") : undefined, webPreferences: { preload: node_path_1.default.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false } });
    mainWindow.webContents.once("did-finish-load", () => { mainWindow?.show(); mainWindow?.restore(); mainWindow?.focus(); mainWindow?.webContents.focus(); });
    mainWindow.on("minimize", () => void floatingWindow?.showAfterMinimize());
    mainWindow.on("restore", () => floatingWindow?.markRestored());
    mainWindow.on("closed", () => { mainWindow = null; });
    void mainWindow.loadFile(node_path_1.default.join(electron_1.app.getAppPath(), "dist", "index.html"));
}
// 启动顺序：加载配置 -> 创建业务对象 -> 建立悬浮窗 -> 注册快捷键/IPC -> 显示主窗口。
electron_1.app.whenReady().then(async () => {
    await loadConfig();
    const launcher = new target_launcher_1.TargetLauncher((filePath) => electron_1.shell.openPath(filePath));
    physicalController = new physical_run_controller_1.PhysicalRunController({ targetLauncher: launcher, scriptStore: new script_store_1.ScriptStore(scriptRoot()), getScreen: currentScreen, recorder: new input_recorder_1.WindowsInputRecorder({ excludedProcessId: process.pid }) });
    floatingWindow = new floating_window_1.FloatingWindowManager({ appPath: electron_1.app.getAppPath(), preloadPath: node_path_1.default.join(__dirname, "preload.js"), stateFile: node_path_1.default.join(dataRoot(), "floating-window.json") });
    floatingWindow.setCanStartRecording(currentConfig.recordingLaunchMode === "manual" || Boolean(currentConfig.targetApplicationPath), currentConfig.targetApplicationName ?? (currentConfig.recordingLaunchMode === "manual" ? "当前已打开的应用" : undefined));
    physicalController.subscribe((event) => { mainWindow?.webContents.send("physical:event", event); floatingWindow?.updateFromEvent(event); });
    electron_1.globalShortcut.register("CommandOrControl+R", () => void startRecordingFromShortcut());
    electron_1.globalShortcut.register("CommandOrControl+T", () => void requireController().stopRecording());
    electron_1.globalShortcut.register("CommandOrControl+Shift+F12", () => requireController().stopPlayback());
    await registerHandlers();
    configureApplicationMenu();
    createWindow();
    electron_1.app.on("activate", () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow(); });
});
electron_1.app.on("will-quit", () => electron_1.globalShortcut.unregisterAll());
electron_1.app.on("before-quit", () => { void physicalController?.dispose(); floatingWindow?.destroy(); });
electron_1.app.on("window-all-closed", () => { if (process.platform !== "darwin")
    electron_1.app.quit(); });
async function startRecordingFromShortcut() {
    const state = requireController().getState();
    if (state.recordingStatus !== "idle" || state.playbackStatus !== "idle")
        return;
    try {
        await requireController().startRecording(recordingRequest());
    }
    catch { /* 页面会显示具体错误；快捷键调用不向系统抛异常。 */ }
}
