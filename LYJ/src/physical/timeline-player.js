"use strict";
// 时间线执行器：按事件保存的 delayMs 等待，再交给物理输入设备发送。
// 组合关系：PhysicalRunController 创建它；它依赖 repeat-plan、输入设备和进度回调。
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelinePlayer = void 0;
const repeat_plan_1 = require("./repeat-plan");
class TimelinePlayer {
    constructor(options) {
        this.options = options;
        this.paused = false;
        this.stopped = false;
        this.waiting = null;
    }
    // 执行一次完整重播，支持指定事件范围、有限次数和无限循环。
    async play(script, options) {
        this.paused = false;
        this.stopped = false;
        const plan = (0, repeat_plan_1.buildPlaybackPlan)(script, options);
        let iteration = 0;
        while (plan.repeatTotal === undefined || iteration < plan.repeatTotal) {
            iteration += 1;
            for (let index = 0; index < plan.eventCount; index += 1) {
                const event = script.events[plan.startIndex + index];
                if (!await this.waitWhileActive(event.delayMs))
                    return "stopped";
                if (this.stopped)
                    return "stopped";
                await this.send(event);
                this.options.onProgress?.(index, plan.eventCount, iteration, plan.repeatTotal, event);
            }
        }
        return this.stopped ? "stopped" : "completed";
    }
    // 控制器调用这些方法实现暂停、继续和停止。
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    stop() { this.stopped = true; this.paused = false; }
    async waitWhileActive(durationMs) {
        let remaining = Math.max(0, durationMs);
        while (remaining > 0) {
            if (this.stopped)
                return false;
            while (this.paused && !this.stopped)
                await this.sleep(50);
            if (this.stopped)
                return false;
            const slice = Math.min(remaining, 50);
            await this.sleep(slice);
            remaining -= slice;
        }
        return !this.stopped;
    }
    async sleep(ms) {
        this.waiting = this.options.sleep?.(ms) ?? new Promise((resolve) => setTimeout(resolve, ms));
        await this.waiting;
        this.waiting = null;
    }
    send(event) {
        if (event.type === "mouse-click")
            return this.options.input.click(event.x, event.y);
        return this.options.input.pressKey(event.virtualKey, event.modifiers);
    }
}
exports.TimelinePlayer = TimelinePlayer;
