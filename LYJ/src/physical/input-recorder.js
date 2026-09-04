"use strict";
// 全局输入录制器：启动隐藏 PowerShell Hook，解析 stdout 的 JSON 行并生成带时间间隔的事件。
// 组合关系：PhysicalRunController 管理它的生命周期；事件通过回调推送给 UI，并最终交给 ScriptStore 保存。
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsInputRecorder = void 0;
exports.parseHookEventLine = parseHookEventLine;
exports.normalizeRawEvent = normalizeRawEvent;
exports.isBlockedEvent = isBlockedEvent;
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const keyNames = {
    8: "BACKSPACE", 9: "TAB", 13: "ENTER", 16: "SHIFT", 17: "CTRL", 18: "ALT", 27: "ESC", 32: "SPACE",
    33: "PAGEUP", 34: "PAGEDOWN", 35: "END", 36: "HOME", 37: "LEFT", 38: "UP", 39: "RIGHT", 40: "DOWN", 46: "DELETE",
    91: "WIN", 92: "WIN", 93: "APPS", 112: "F1", 113: "F2", 114: "F3", 115: "F4", 116: "F5", 117: "F6",
    118: "F7", 119: "F8", 120: "F9", 121: "F10", 122: "F11", 123: "F12",
};
for (let code = 0; code < 26; code += 1)
    keyNames[65 + code] = String.fromCharCode(65 + code);
for (let code = 0; code < 10; code += 1)
    keyNames[48 + code] = String(code);
const blockedCombos = new Set(["ALT+F4", "ALT+TAB", "CTRL+ALT+DELETE", "CTRL+SHIFT+ESC", "CTRL+ESC", "WIN+L", "WIN+R", "CTRL+R", "CTRL+T", "CTRL+SHIFT+F12"]);
// 录制状态机：start/pause/resume/stop 控制 Hook 子进程和事件收集。
class WindowsInputRecorder {
    constructor(options = {}) {
        this.options = options;
        this.process = null;
        this.events = [];
        this.lastEventAt = 0;
        this.paused = false;
        this.stopped = false;
        this.lineCarry = "";
        this.now = options.now ?? Date.now;
    }
    async start() {
        if (process.platform !== "win32")
            throw new Error("物理录制目前只支持 Windows。");
        if (this.process)
            throw new Error("已经有一项录制正在进行。");
        this.events.length = 0;
        this.paused = false;
        this.stopped = false;
        this.lineCarry = "";
        this.lastEventAt = this.now();
        const spawnHook = this.options.spawnHook ?? spawnHookProcess;
        const child = spawnHook(this.options.excludedProcessId);
        this.process = child;
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => this.consumeOutput(chunk));
        child.on("error", (error) => { if (!this.stopped)
            this.stopProcess(); this.onError?.(error); });
        child.on("close", () => { this.process = null; });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => { cleanup(); resolve(); }, 500);
            const onError = (error) => { cleanup(); reject(new Error(`无法开始记录键盘和鼠标：${error.message}`)); };
            const onClose = (code) => { cleanup(); reject(new Error(code === 1 ? "无法开始记录键盘和鼠标：系统监听模块加载失败。" : "无法开始记录键盘和鼠标。")); };
            const cleanup = () => { clearTimeout(timer); child.off("error", onError); child.off("close", onClose); };
            child.once("error", onError);
            child.once("close", onClose);
        });
    }
    setErrorHandler(handler) { this.onError = handler; }
    pause() { if (this.process && !this.stopped)
        this.paused = true; }
    resume() { if (this.process && !this.stopped) {
        this.paused = false;
        this.lastEventAt = this.now();
    } }
    async stop() {
        this.stopped = true;
        this.stopProcess();
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [...this.events];
    }
    stopProcess() {
        if (!this.process)
            return;
        this.process.kill();
        this.process = null;
    }
    consumeOutput(chunk) {
        this.lineCarry += chunk;
        const lines = this.lineCarry.split(/\r?\n/);
        this.lineCarry = lines.pop() ?? "";
        for (const line of lines) {
            const event = parseHookEventLine(line);
            if (event)
                this.record(event);
        }
    }
    record(raw) {
        if (this.paused || this.stopped || !this.process)
            return;
        const event = normalizeRawEvent(raw);
        if (!event || isBlockedEvent(event))
            return;
        const now = this.now();
        const delayMs = Math.max(0, now - this.lastEventAt);
        this.lastEventAt = now;
        this.events.push({ ...event, id: `event-${(0, node_crypto_1.randomUUID)()}`, delayMs });
        this.onEvent?.(this.events[this.events.length - 1]);
    }
    setEventHandler(handler) { this.onEvent = handler; }
}
exports.WindowsInputRecorder = WindowsInputRecorder;
// 解析 Hook 输出的一行 JSON；无效行和未知事件类型直接忽略。
function parseHookEventLine(line) {
    try {
        const value = JSON.parse(line);
        if (value.type !== "mouse-click" && value.type !== "key-press")
            return undefined;
        return value;
    }
    catch {
        return undefined;
    }
}
// 把底层鼠标/虚拟键数据归一化为脚本协议，并补充可读键名。
function normalizeRawEvent(raw) {
    if (raw.type === "mouse-click" && Number.isInteger(raw.x) && Number.isInteger(raw.y))
        return { type: "mouse-click", x: raw.x, y: raw.y, button: "left" };
    if (raw.type === "key-press" && Number.isInteger(raw.virtualKey)) {
        const key = keyNames[raw.virtualKey];
        if (!key)
            return undefined;
        return { type: "key-press", key, virtualKey: raw.virtualKey, modifiers: normalizeModifiers(raw.modifiers).filter((modifier) => modifier !== key) };
    }
    return undefined;
}
// 屏蔽会干扰工具控制或系统安全的快捷键组合。
function isBlockedEvent(event) {
    if (event.type !== "key-press")
        return false;
    const modifiers = event.modifiers.filter((item) => item !== event.key);
    return blockedCombos.has([...modifiers, event.key].join("+"));
}
function normalizeModifiers(modifiers) {
    const order = ["CTRL", "SHIFT", "ALT", "WIN"];
    return order.filter((item) => modifiers?.some((modifier) => modifier.toUpperCase() === item));
}
// 启动 Windows 低级 Hook；Hook 脚本通过 stdout 向 Node 进程发送事件。
function spawnHookProcess(excludedProcessId) {
    const script = powershellHookSource.replace("__EXCLUDED_PID__", String(excludedProcessId ?? 0));
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    return (0, node_child_process_1.spawn)("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
}
const powershellHookSource = String.raw `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class VisualWorkflowHook {
  delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData; public uint flags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KBDLLHOOKSTRUCT { public uint vkCode; public uint scanCode; public uint flags; public uint time; public IntPtr extra; }
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint threadId);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool GetMessage(out MSG msg, IntPtr hWnd, uint min, uint max);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }
  const int MOUSE = 14, KEYBOARD = 13, LBUTTONDOWN = 0x0201, KEYDOWN = 0x0100, SYSKEYDOWN = 0x0104, KEYUP = 0x0101, SYSKEYUP = 0x0105;
  const int CTRL = 0x11, SHIFT = 0x10, ALT = 0x12, LWIN = 0x5b, RWIN = 0x5c;
  static int excludedPid = __EXCLUDED_PID__;
  static HookProc mouseProc = Mouse; static HookProc keyboardProc = Keyboard; static IntPtr mouseHook, keyboardHook;
  static HashSet<uint> pressed = new HashSet<uint>();
  static void Write(string json) { Console.WriteLine(json); Console.Out.Flush(); }
  static bool Down(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
  static string Mods() { var list = new List<string>(); if (Down(CTRL)) list.Add("CTRL"); if (Down(SHIFT)) list.Add("SHIFT"); if (Down(ALT)) list.Add("ALT"); if (Down(LWIN) || Down(RWIN)) list.Add("WIN"); return string.Join(",", list); }
  static bool OwnWindow(POINT point) { var hwnd = WindowFromPoint(point); if (hwnd == IntPtr.Zero) return false; uint pid; GetWindowThreadProcessId(hwnd, out pid); return pid == excludedPid; }
  static IntPtr Mouse(int code, IntPtr wParam, IntPtr lParam) { if (code >= 0 && wParam.ToInt32() == LBUTTONDOWN) { var data = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT)); if (!OwnWindow(data.pt)) Write("{\"type\":\"mouse-click\",\"x\":" + data.pt.x + ",\"y\":" + data.pt.y + "}"); } return CallNextHookEx(mouseHook, code, wParam, lParam); }
  static IntPtr Keyboard(int code, IntPtr wParam, IntPtr lParam) { var message = wParam.ToInt32(); var data = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT)); if (message == KEYUP || message == SYSKEYUP) pressed.Remove(data.vkCode); if (code >= 0 && (message == KEYDOWN || message == SYSKEYDOWN) && !pressed.Contains(data.vkCode)) { pressed.Add(data.vkCode); Write("{\"type\":\"key-press\",\"virtualKey\":" + data.vkCode + ",\"modifiers\":[\"" + Mods().Replace(",", "\",\"") + "\"]}"); } return CallNextHookEx(keyboardHook, code, wParam, lParam); }
  public static void Run() { mouseHook = SetWindowsHookEx(MOUSE, mouseProc, IntPtr.Zero, 0); keyboardHook = SetWindowsHookEx(KEYBOARD, keyboardProc, IntPtr.Zero, 0); if (mouseHook == IntPtr.Zero || keyboardHook == IntPtr.Zero) throw new InvalidOperationException("HOOK_INSTALL_FAILED"); MSG msg; while (GetMessage(out msg, IntPtr.Zero, 0, 0)) { } UnhookWindowsHookEx(mouseHook); UnhookWindowsHookEx(keyboardHook); }
}
'@
try { [VisualWorkflowHook]::Run() } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
`;
