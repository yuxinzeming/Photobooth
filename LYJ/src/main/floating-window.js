"use strict";
// 悬浮窗管理器：主窗口最小化后显示一个始终置顶的控制面板。
// 组合关系：main.js 把控制器事件交给 updateFromEvent，再通过 floating:snapshot 推送给悬浮窗页面。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloatingWindowManager = void 0;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const initialSnapshot = { recordingStatus: "idle", playbackStatus: "idle", message: "操作已就绪。", eventCount: 0, elapsedMs: 0 };
class FloatingWindowManager {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.window = null;
        this.rendererReady = false;
        this.visibleAfterReady = false;
        this.dismissedForMinimize = false;
        this.allowClose = false;
        this.snapshot = initialSnapshot;
    }
    // 主窗口最小化后的显示入口，并恢复上次保存的位置。
    async showAfterMinimize() { this.dismissedForMinimize = false; this.visibleAfterReady = true; await this.ensureWindow(); this.showIfReady(); }
    markRestored() { this.dismissedForMinimize = false; this.visibleAfterReady = false; this.window?.hide(); }
    dismissForCurrentMinimize() { this.dismissedForMinimize = true; this.visibleAfterReady = false; this.window?.hide(); }
    setCanStartRecording(value, targetName) { this.snapshot = { ...this.snapshot, canStartRecording: value, targetName }; this.sendSnapshot(); }
    updateFromEvent(event) { this.snapshot = snapshotFromEvent(event, this.snapshot); this.sendSnapshot(); }
    getSnapshot() { return this.snapshot; }
    destroy() { if (!this.window || this.window.isDestroyed())
        return; this.allowClose = true; this.window.destroy(); this.window = null; }
    // 延迟创建悬浮窗，避免应用启动时无条件创建第二个窗口。
    async ensureWindow() {
        if (this.window && !this.window.isDestroyed())
            return;
        const bounds = await this.readBounds();
        this.rendererReady = false;
        this.window = new electron_1.BrowserWindow({ width: bounds?.width ?? 390, height: bounds?.height ?? 250, x: bounds?.x, y: bounds?.y, minWidth: 320, minHeight: 190, maxWidth: 560, maxHeight: 450, show: false, frame: false, resizable: true, alwaysOnTop: true, skipTaskbar: true, focusable: true, acceptFirstMouse: true, backgroundColor: "#0c1320", webPreferences: { preload: this.dependencies.preloadPath, contextIsolation: true, nodeIntegration: false } });
        this.window.on("moved", () => void this.saveBounds());
        this.window.on("resized", () => void this.saveBounds());
        this.window.on("close", (event) => { if (this.allowClose)
            return; event.preventDefault(); this.dismissForCurrentMinimize(); });
        this.window.on("closed", () => { this.window = null; this.rendererReady = false; });
        await this.window.loadFile(node_path_1.default.join(this.dependencies.appPath, "dist", "index.html"), { query: { view: "floating" } });
    }
    markRendererReady() { this.rendererReady = true; this.sendSnapshot(); this.showIfReady(); }
    showIfReady() { if (!this.window || this.window.isDestroyed() || !this.rendererReady || !this.visibleAfterReady || this.dismissedForMinimize)
        return; this.window.showInactive(); }
    sendSnapshot() { if (this.window && !this.window.isDestroyed() && this.rendererReady)
        this.window.webContents.send("floating:snapshot", this.snapshot); }
    async readBounds() { try {
        return this.clampBounds(JSON.parse(await promises_1.default.readFile(this.dependencies.stateFile, "utf8")));
    }
    catch {
        return undefined;
    } }
    async saveBounds() { if (!this.window || this.window.isDestroyed())
        return; await promises_1.default.mkdir(node_path_1.default.dirname(this.dependencies.stateFile), { recursive: true }); await promises_1.default.writeFile(this.dependencies.stateFile, JSON.stringify(this.clampBounds(this.window.getBounds())), "utf8"); }
    clampBounds(bounds) { const display = electron_1.screen.getDisplayMatching(bounds); const area = display.workArea; return { width: Math.min(bounds.width, area.width), height: Math.min(bounds.height, area.height), x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - Math.min(bounds.width, area.width))), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - Math.min(bounds.height, area.height))) }; }
}
exports.FloatingWindowManager = FloatingWindowManager;
// 将统一物理事件转换成悬浮窗使用的简化状态快照。
function snapshotFromEvent(event, current) {
    if (event.type === "recording-status")
        return { ...current, recordingStatus: event.status, playbackStatus: "idle", message: event.message, targetName: event.session?.targetName ?? current.targetName, eventCount: event.session?.eventCount ?? current.eventCount, elapsedMs: event.session?.elapsedMs ?? current.elapsedMs, lastEvent: current.lastEvent };
    if (event.type === "recorded-input")
        return { ...current, recordingStatus: "recording", message: "正在记录操作。", eventCount: event.count, lastEvent: event.event };
    if (event.type === "recording-saved")
        return { ...current, recordingStatus: "saved", message: event.message, eventCount: event.count };
    if (event.type === "playback-status")
        return { ...current, recordingStatus: "idle", playbackStatus: event.status, message: event.message, playbackIndex: event.run?.index, playbackTotal: event.run?.total, playbackIteration: event.run?.iteration, playbackRepeatTotal: event.run?.repeatTotal };
    if (event.type === "playback-progress")
        return { ...current, playbackStatus: "playing", message: event.repeatTotal === undefined ? `正在重播第 ${event.iteration} 遍，第 ${event.index + 1} / ${event.total} 个操作。` : `正在重播第 ${event.iteration} / ${event.repeatTotal} 遍，第 ${event.index + 1} / ${event.total} 个操作。`, playbackIndex: event.index + 1, playbackTotal: event.total, playbackIteration: event.iteration, playbackRepeatTotal: event.repeatTotal, lastEvent: event.event };
    return { ...current, recordingStatus: "error", message: event.message };
}
