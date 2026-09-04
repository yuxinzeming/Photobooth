"use strict";
// 目标启动器：检查文件路径，再交给 Electron shell 打开关联程序或文件。
// 组合关系：录制和重播都由 PhysicalRunController 调用它，支持自动打开和手动模式。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TargetLauncher = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
class TargetLauncher {
    constructor(openPath) {
        this.openPath = openPath;
    }
    // 启动前检查路径；alreadyRunning=true 时只确认目标存在，不重复打开。
    async launch(filePath, alreadyRunning = false) {
        if (!filePath.trim())
            return { success: false, alreadyRunning: false, message: "还没有选择要打开的目标文件。" };
        try {
            await promises_1.default.access(filePath);
        }
        catch {
            return { success: false, alreadyRunning: false, message: "找不到目标文件，请重新选择要操作的文件。" };
        }
        if (alreadyRunning)
            return { success: true, alreadyRunning: true, message: "目标文件已经打开，工具将直接继续。" };
        const error = await this.openPath(filePath);
        if (error)
            return { success: false, alreadyRunning: false, message: `目标文件无法打开：${error}` };
        return { success: true, alreadyRunning: false, message: "已成功打开目标文件。" };
    }
}
exports.TargetLauncher = TargetLauncher;
