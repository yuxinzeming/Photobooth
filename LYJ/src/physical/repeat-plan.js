"use strict";
// 重播计划模块：把“整套/步骤范围 + 次数/无限循环”转换成执行器可用的范围。
// 组合关系：脚本页生成 options，PhysicalRunController 和 TimelinePlayer 共同依赖这里的结果。
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PLAYBACK_COUNT = exports.DEFAULT_PLAYBACK_REPEAT_OPTIONS = void 0;
exports.buildPlaybackPlan = buildPlaybackPlan;
exports.describePlaybackPlan = describePlaybackPlan;
exports.DEFAULT_PLAYBACK_REPEAT_OPTIONS = {
    scope: { type: "script" },
    mode: "count",
    count: 1,
};
exports.MAX_PLAYBACK_COUNT = 9999;
// 校验并生成一次重播的起止索引、事件数量和重复次数。
function buildPlaybackPlan(script, options) {
    if (!script.events.length)
        throw new Error("这套脚本没有可重播的操作。");
    const selected = options?.scope ?? exports.DEFAULT_PLAYBACK_REPEAT_OPTIONS.scope;
    const range = resolveScope(selected, script.events.length);
    const repeatTotal = resolveRepeatTotal(options?.mode ?? "count", options?.count ?? 1);
    const plan = { ...range, eventCount: range.endIndex - range.startIndex + 1 };
    return repeatTotal === undefined ? plan : { ...plan, repeatTotal };
}
function describePlaybackPlan(script, options) {
    const plan = buildPlaybackPlan(script, options);
    const scope = plan.startIndex === 0 && plan.endIndex === script.events.length - 1
        ? "整套脚本"
        : `第 ${plan.startIndex + 1} 步到第 ${plan.endIndex + 1} 步`;
    return plan.repeatTotal === undefined ? `${scope}，一直重复，直到你停止` : `${scope}，执行 ${plan.repeatTotal} 次`;
}
function resolveScope(scope, eventCount) {
    if (scope.type === "script")
        return { startIndex: 0, endIndex: eventCount - 1 };
    const startIndex = clampIndex(scope.startIndex, eventCount);
    const endIndex = clampIndex(scope.endIndex, eventCount);
    if (startIndex > endIndex)
        throw new Error("重复范围无效，请让起始步骤不大于结束步骤。");
    return { startIndex, endIndex };
}
function resolveRepeatTotal(mode, count) {
    if (mode === "infinite")
        return undefined;
    const normalizedCount = count ?? 0;
    if (!Number.isInteger(normalizedCount) || normalizedCount < 1)
        throw new Error("重复次数必须是大于或等于 1 的整数。");
    if (normalizedCount > exports.MAX_PLAYBACK_COUNT)
        throw new Error(`重复次数不能超过 ${exports.MAX_PLAYBACK_COUNT} 次。`);
    return normalizedCount;
}
function clampIndex(value, eventCount) {
    if (!Number.isInteger(value))
        throw new Error("重复范围必须使用有效的步骤编号。");
    return Math.max(0, Math.min(eventCount - 1, value));
}
