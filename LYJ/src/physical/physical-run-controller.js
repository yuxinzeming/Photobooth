"use strict";
// 物理操作总控制器：协调录制、保存、目标启动、重播、暂停/停止和统一事件通知。
// 组合关系：它是 main.js 的核心业务对象，连接 TargetLauncher、ScriptStore、Recorder、TimelinePlayer 和输入设备。
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicalRunController = void 0;
const node_crypto_1 = require("node:crypto");
const windows_input_device_1 = require("./windows-input-device");
const input_recorder_1 = require("./input-recorder");
const timeline_player_1 = require("./timeline-player");
const repeat_plan_1 = require("./repeat-plan");
// 录制与重播不能并行；recordingStatus/playbackStatus 是整个应用的状态源。
class PhysicalRunController {
    constructor(options) {
        this.options = options;
        this.listeners = new Set();
        this.recorder = null;
        this.player = null;
        this.recordingRequest = null;
        this.recordingStatus = "idle";
        this.playbackStatus = "idle";
        this.recordingEvents = 0;
        this.recordingStartedAt = 0;
        this.playbackToken = 0;
        this.playbackPlan = null;
        this.now = options.now ?? (() => new Date());
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    getState() { return { recordingStatus: this.recordingStatus, playbackStatus: this.playbackStatus, eventCount: this.recordingEvents }; }
    toggleRecording() { if (this.recordingStatus === "recording")
        this.pauseRecording();
    else if (this.recordingStatus === "paused")
        this.resumeRecording(); }
    listScripts() { return this.options.scriptStore.list(); }
    loadScript(scriptId) { return this.options.scriptStore.load(scriptId); }
    deleteScript(scriptId) { return this.options.scriptStore.delete(scriptId); }
    // 根据请求自动/手动准备目标程序，再启动全局输入录制。
    async startRecording(request) {
        if (this.recordingStatus !== "idle" || this.playbackStatus !== "idle")
            throw new Error("当前已有录制或重播正在进行。");
        const targetName = request.targetName || "当前已打开的应用";
        if (request.launchMode !== "manual") {
            if (!request.targetPath)
                throw new Error("请先选择要操作的文件，或切换为手动模式。");
            this.emitRecording("launching", "正在打开目标文件。", targetName);
            const launch = await this.options.targetLauncher.launch(request.targetPath);
            if (!launch.success) {
                this.recordingStatus = "error";
                this.emit({ type: "physical-error", message: launch.message });
                throw new Error(launch.message);
            }
        }
        const recorder = this.options.recorder ?? new input_recorder_1.WindowsInputRecorder({ excludedProcessId: this.options.processId ?? process.pid });
        recorder.setEventHandler((event) => {
            this.recordingEvents += 1;
            this.emit({ type: "recorded-input", event, count: this.recordingEvents });
        });
        recorder.setErrorHandler((error) => this.emit({ type: "physical-error", message: error.message }));
        this.recordingEvents = 0;
        this.recordingStartedAt = Date.now();
        this.recordingRequest = { ...request, targetName, launchMode: request.launchMode ?? "auto-launch", screen: request.screen ?? this.options.getScreen() };
        try {
            await recorder.start();
        }
        catch (error) {
            this.recordingStatus = "idle";
            this.recordingRequest = null;
            const message = error instanceof Error ? error.message : "无法开始记录键盘和鼠标。";
            this.emit({ type: "physical-error", message });
            throw new Error(message);
        }
        this.recorder = recorder;
        this.emitRecording("recording", request.launchMode === "manual" ? "请先打开并聚焦目标应用，然后开始操作。" : "已经打开目标文件，请开始操作。", targetName);
        return this.recordingSession();
    }
    pauseRecording() { if (this.recordingStatus !== "recording")
        return; this.recorder?.pause(); this.emitRecording("paused", "录制已暂停。", this.recordingRequest?.targetName); }
    resumeRecording() { if (this.recordingStatus !== "paused")
        return; this.recorder?.resume(); this.emitRecording("recording", "录制已继续。", this.recordingRequest?.targetName); }
    // 停止 Hook、生成脚本元数据并持久化；空录制不会写入文件。
    async stopRecording() {
        if (!this.recorder || !this.recordingRequest)
            return null;
        this.emitRecording("saving", "正在保存这次操作。", this.recordingRequest.targetName);
        const events = await this.recorder.stop();
        const request = this.recordingRequest;
        this.recorder = null;
        this.recordingRequest = null;
        this.recordingStatus = "idle";
        if (!events.length) {
            this.emitRecording("saved", "没有记录到操作，这次不会保存空脚本。", request.targetName);
            return null;
        }
        const timestamp = this.now().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const script = { id: `script-${(0, node_crypto_1.randomUUID)()}`, name: request.name?.trim() || `未命名操作-${timestamp}`, targetPath: request.targetPath, targetName: request.targetName, launchMode: request.launchMode ?? "auto-launch", createdAt: this.now().toISOString(), updatedAt: this.now().toISOString(), screen: request.screen ?? this.options.getScreen(), events };
        await this.options.scriptStore.save(script);
        this.emit({ type: "recording-saved", scriptId: script.id, count: script.events.length, message: `已保存“${script.name}”，共记录 ${script.events.length} 个操作。` });
        this.emitRecording("saved", "操作已经保存。", request.targetName);
        this.recordingStatus = "idle";
        return script;
    }
    // 加载脚本、生成重播计划、等待目标程序准备后异步运行时间线。
    async startPlayback(scriptId, options) {
        if (this.recordingStatus !== "idle" || this.playbackStatus !== "idle")
            throw new Error("当前已有录制或重播正在进行。");
        const script = await this.options.scriptStore.load(scriptId);
        const plan = (0, repeat_plan_1.buildPlaybackPlan)(script, options);
        this.playbackPlan = plan;
        this.playbackToken += 1;
        const token = this.playbackToken;
        this.playbackStatus = "launching";
        this.emitPlayback("launching", `正在打开“${script.targetName}”。`, script, 0, 0);
        if (script.launchMode !== "manual") {
            if (!script.targetPath)
                return this.failPlayback("这套脚本没有目标文件，请重新选择或改用手动模式。");
            const launch = await this.options.targetLauncher.launch(script.targetPath);
            if (!launch.success)
                return this.failPlayback(launch.message);
        }
        this.playbackStatus = "countdown";
        this.emitPlayback("countdown", script.launchMode === "manual" ? "请确认目标应用已打开，3 秒后开始重播。" : "目标文件已打开，3 秒后开始重播。", script, 0, 0);
        await this.sleep(3000);
        if (token !== this.playbackToken)
            return this.playbackRun(script, "stopped", 0, 0, "重播已停止。", plan);
        this.playbackStatus = "playing";
        const player = new timeline_player_1.TimelinePlayer({ input: this.options.input ?? new windows_input_device_1.WindowsPhysicalInputDevice(), onProgress: (index, total, iteration, repeatTotal, event) => this.emit({ type: "playback-progress", scriptId: script.id, index, total, iteration, repeatTotal, event }) });
        this.player = player;
        const run = this.playbackRun(script, "playing", 0, 0, "正在按原来的时间间隔重播。", plan);
        void player.play(script, options).then((result) => {
            if (token !== this.playbackToken)
                return;
            this.player = null;
            this.playbackStatus = result === "completed" ? "completed" : "stopped";
            const finalIteration = result === "completed" ? plan.repeatTotal ?? 0 : 0;
            this.emitPlayback(this.playbackStatus, result === "completed" ? "操作已经重播完成。" : "重播已停止。", script, plan.eventCount, finalIteration);
            setTimeout(() => { if (token === this.playbackToken)
                this.playbackStatus = "idle"; }, 0);
        }).catch((error) => { if (token !== this.playbackToken)
            return; this.failPlayback(error instanceof Error ? error.message : "重播时设备输入失败。"); });
        return run;
    }
    // 重播控制由 TimelinePlayer 实际执行，控制器负责状态和事件同步。
    pausePlayback() { if (this.playbackStatus !== "playing")
        return; this.player?.pause(); this.playbackStatus = "paused"; this.emit({ type: "playback-status", status: "paused", message: "重播已暂停。" }); }
    resumePlayback() { if (this.playbackStatus !== "paused")
        return; this.player?.resume(); this.playbackStatus = "playing"; this.emit({ type: "playback-status", status: "playing", message: "重播已继续。" }); }
    stopPlayback() { if (["idle", "completed", "stopped"].includes(this.playbackStatus))
        return; this.playbackToken += 1; this.player?.stop(); this.player = null; this.playbackPlan = null; this.playbackStatus = "stopped"; this.emit({ type: "playback-status", status: "stopped", message: "重播已停止。" }); }
    async dispose() { await this.recorder?.stop(); this.recorder = null; this.stopPlayback(); }
    recordingSession() { return { status: this.recordingStatus, targetName: this.recordingRequest?.targetName ?? "", eventCount: this.recordingEvents, elapsedMs: Math.max(0, Date.now() - this.recordingStartedAt) }; }
    emitRecording(status, message, targetName) { this.recordingStatus = status; this.emit({ type: "recording-status", status, message, session: { status, targetName: targetName ?? "", eventCount: this.recordingEvents, elapsedMs: this.recordingStartedAt ? Math.max(0, Date.now() - this.recordingStartedAt) : 0 } }); }
    emitPlayback(status, message, script, index, iteration) { this.emit({ type: "playback-status", status, message, run: this.playbackRun(script, status, index, iteration, message) }); }
    playbackRun(script, status, index, iteration, message, plan = this.playbackPlan ?? (0, repeat_plan_1.buildPlaybackPlan)(script)) { return { scriptId: script.id, status, index, total: plan.eventCount, iteration, repeatTotal: plan.repeatTotal, message }; }
    failPlayback(message) { this.playbackStatus = "error"; this.playbackPlan = null; this.emit({ type: "physical-error", message }); const run = { scriptId: "", status: "error", index: 0, total: 0, iteration: 0, message }; setTimeout(() => { if (this.playbackStatus === "error")
        this.playbackStatus = "idle"; }, 0); return run; }
    emit(event) { for (const listener of this.listeners)
        listener(event); }
    sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
}
exports.PhysicalRunController = PhysicalRunController;
