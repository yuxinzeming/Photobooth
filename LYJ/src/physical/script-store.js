"use strict";
// 本地脚本仓库：负责 JSON 脚本的列出、读取、校验、保存和删除。
// 组合关系：PhysicalRunController 依赖 ScriptStore；Renderer 只能通过 main.js IPC 间接访问它。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptStore = void 0;
exports.validateScript = validateScript;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
class ScriptStore {
    constructor(directory) {
        this.directory = directory;
    }
    // 返回所有合法脚本的摘要，并按更新时间倒序排列。
    async list() {
        await promises_1.default.mkdir(this.directory, { recursive: true });
        const names = await promises_1.default.readdir(this.directory);
        const scripts = [];
        for (const name of names.filter((item) => item.endsWith(".json"))) {
            try {
                const script = await this.load(node_path_1.default.basename(name, ".json"));
                scripts.push({ id: script.id, name: script.name, targetName: script.targetName, targetPath: script.targetPath, launchMode: script.launchMode ?? "auto-launch", eventCount: script.events.length, createdAt: script.createdAt, updatedAt: script.updatedAt });
            }
            catch { /* 损坏脚本不阻塞其他脚本显示 */ }
        }
        return scripts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    // 写入前校验完整脚本，避免生成不可重播的数据文件。
    async save(script) {
        validateScript(script);
        await promises_1.default.mkdir(this.directory, { recursive: true });
        const file = node_path_1.default.join(this.directory, `${safeId(script.id)}.json`);
        await promises_1.default.writeFile(file, JSON.stringify(script, null, 2), "utf8");
        return script;
    }
    // 按安全 ID 读取并校验完整脚本。
    async load(id) {
        const file = node_path_1.default.join(this.directory, `${safeId(id)}.json`);
        const script = JSON.parse(await promises_1.default.readFile(file, "utf8"));
        validateScript(script);
        return script;
    }
    async delete(id) { await promises_1.default.unlink(node_path_1.default.join(this.directory, `${safeId(id)}.json`)); }
}
exports.ScriptStore = ScriptStore;
// 约束目标信息、屏幕信息和每一种物理事件的字段。
function validateScript(value) {
    if (!value || typeof value !== "object")
        throw new Error("这套操作文件无法读取，请重新录制。");
    const script = value;
    if (typeof script.id !== "string" || typeof script.name !== "string" || typeof script.targetName !== "string" || !Array.isArray(script.events) || !script.screen)
        throw new Error("这套操作文件内容不完整，请重新录制。");
    if (script.targetPath !== undefined && typeof script.targetPath !== "string")
        throw new Error("操作文件中的目标文件信息无效，请重新录制。");
    if (script.launchMode !== undefined && script.launchMode !== "auto-launch" && script.launchMode !== "manual")
        throw new Error("操作文件中的启动方式无效，请重新录制。");
    if (!Number.isFinite(script.screen.width) || !Number.isFinite(script.screen.height) || !Number.isFinite(script.screen.originX) || !Number.isFinite(script.screen.originY))
        throw new Error("录制时的屏幕信息无效，请重新录制。");
    for (const event of script.events) {
        if (!event || typeof event !== "object" || typeof event.id !== "string" || !Number.isFinite(event.delayMs))
            throw new Error("操作文件中包含无法识别的动作。");
        if (event.type === "mouse-click") {
            if (!Number.isInteger(event.x) || !Number.isInteger(event.y) || event.button !== "left")
                throw new Error("操作文件中的鼠标动作无效。");
        }
        else if (event.type === "key-press") {
            if (!Number.isInteger(event.virtualKey) || typeof event.key !== "string" || !Array.isArray(event.modifiers))
                throw new Error("操作文件中的键盘动作无效。");
        }
        else
            throw new Error("操作文件中包含当前版本不支持的动作。");
    }
}
function safeId(id) { if (!/^[A-Za-z0-9_-]+$/.test(id))
    throw new Error("操作文件编号无效。"); return id; }
