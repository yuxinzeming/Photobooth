"use strict";
// 首次使用引导的纯函数模块；引导完成状态由 main.js 的 config:save 持久化。
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldShowFirstRunGuide = shouldShowFirstRunGuide;
exports.completeFirstRunGuide = completeFirstRunGuide;
function shouldShowFirstRunGuide(config) {
    return config.hasCompletedIntro !== true;
}
function completeFirstRunGuide(config) {
    return { ...config, hasCompletedIntro: true };
}
