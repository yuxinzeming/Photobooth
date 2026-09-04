"use strict";
// Windows 物理输入适配器：通过 PowerShell 动态编译 C#，调用 user32.dll 的 SendInput。
// 组合关系：TimelinePlayer 只依赖 click/pressKey 抽象，因此也可以替换成测试输入设备。
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsPhysicalInputDevice = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const keyCodes = { CTRL: 0x11, SHIFT: 0x10, ALT: 0x12, WIN: 0x5b };
// 把抽象事件转换为 Windows 绝对坐标鼠标点击或虚拟键组合。
class WindowsPhysicalInputDevice {
    async click(x, y) { await runPowerShell(buildCommand(`[VisualWorkflowInput]::ClickAbsolute(${Math.round(x)},${Math.round(y)})`)); }
    async pressKey(virtualKey, modifiers) { const codes = modifiers.map((item) => keyCodes[item.toUpperCase()]).filter((item) => item !== undefined); await runPowerShell(buildCommand(`[VisualWorkflowInput]::Keys(@(${[...codes, virtualKey].join(",")}))`)); }
}
exports.WindowsPhysicalInputDevice = WindowsPhysicalInputDevice;
const source = String.raw `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class VisualWorkflowInput {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public MOUSEINPUT mi; [FieldOffset(8)] public KEYBDINPUT ki; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
  const uint MOUSE=0, KEYBOARD=1, MOVE=0x0001, LEFT_DOWN=0x0002, LEFT_UP=0x0004, ABSOLUTE=0x8000, VIRTUAL_DESK=0x4000, KEY_UP=0x0002;
  static int Position(int value) { return Math.Max(0, Math.Min(65535, value)); }
  static INPUT Mouse(int x, int y, uint flags) { return new INPUT { type=MOUSE, mi=new MOUSEINPUT { dx=x, dy=y, dwFlags=flags } }; }
  static INPUT Key(ushort code, uint flags) { return new INPUT { type=KEYBOARD, ki=new KEYBDINPUT { wVk=code, dwFlags=flags } }; }
  public static void ClickAbsolute(int x, int y) { var ox=GetSystemMetrics(76); var oy=GetSystemMetrics(77); var w=Math.Max(1,GetSystemMetrics(78)); var h=Math.Max(1,GetSystemMetrics(79)); var nx=Position((x-ox)*65535/Math.Max(1,w-1)); var ny=Position((y-oy)*65535/Math.Max(1,h-1)); var inputs=new[]{Mouse(nx,ny,MOVE|ABSOLUTE|VIRTUAL_DESK),Mouse(0,0,LEFT_DOWN),Mouse(0,0,LEFT_UP)}; if(SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(INPUT)))!=(uint)inputs.Length) throw new InvalidOperationException("INPUT_REJECTED"); }
  public static void Keys(int[] codes) { var inputs=new INPUT[codes.Length*2]; for(var i=0;i<codes.Length;i++) inputs[i]=Key((ushort)codes[i],0); for(var i=0;i<codes.Length;i++) inputs[codes.Length+i]=Key((ushort)codes[codes.Length-1-i],KEY_UP); if(SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(INPUT)))!=(uint)inputs.Length) throw new InvalidOperationException("INPUT_REJECTED"); }
}
'@
try { __COMMAND__ } catch { Write-Error $_.Exception.Message; exit 1 }
`;
function buildCommand(command) { return source.replace("__COMMAND__", command); }
// 统一执行隐藏 PowerShell，并将底层失败转换成用户可理解的错误。
async function runPowerShell(script) { if (process.platform !== "win32")
    throw new Error("物理操作目前只支持 Windows。"); const encoded = Buffer.from(script, "utf16le").toString("base64"); try {
    await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { windowsHide: true, maxBuffer: 128 * 1024, encoding: "utf8" });
}
catch (error) {
    const value = error;
    if (/INPUT_REJECTED/i.test(`${value.stderr ?? ""}\n${value.message ?? ""}`))
        throw new Error("系统拒绝了设备输入，请确认目标程序没有以更高权限运行。");
    throw new Error("设备输入模块加载失败，这次操作没有发出。");
} }
