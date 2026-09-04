# CODE NOTES / 代码备注

## 项目定位 / Project Role

这是一个 Windows Electron 物理操作录制器。Renderer 负责界面，preload 负责安全桥接，main 负责 Electron 生命周期和 IPC，`PhysicalRunController` 负责业务状态，物理模块负责录制和发送输入。

This is a Windows Electron physical-operation recorder. The Renderer owns the UI, preload provides the secure bridge, main owns the Electron lifecycle and IPC, `PhysicalRunController` owns business state, and the physical modules record and send input.

## Module Graph / 模块关系

```text
React Renderer
  -> src/preload/preload.js / window.desktopApi
  -> src/main/main.js / ipcMain
  -> src/physical/physical-run-controller.js
       -> input-recorder.js          record global input
       -> target-launcher.js         open target application
       -> script-store.js            persist JSON scripts
       -> repeat-plan.js             validate replay scope/count
       -> timeline-player.js         replay with timing
            -> windows-input-device.js
                 -> PowerShell + C# + user32.dll / SendInput
  -> src/main/floating-window.js    minimized-window controls
```

## Module Responsibilities / 模块职责

| Module | 中文职责 | English responsibility | Composes with |
|---|---|---|---|
| `src/main/main.js` | 创建窗口、加载配置、注册 IPC 和快捷键 | Creates windows, loads config, registers IPC and shortcuts | All main-process modules |
| `src/preload/preload.js` | 暴露受控的 `desktopApi` | Exposes the restricted `desktopApi` bridge | Renderer and main IPC |
| `src/physical/physical-run-controller.js` | 协调录制、保存、启动、重播和状态事件 | Coordinates recording, saving, launching, playback, and state events | Recorder, Store, Launcher, Player |
| `src/physical/input-recorder.js` | 启动 Windows Hook，解析输入并计算时间间隔 | Starts the Windows hook, parses input, and calculates delays | Controller and PowerShell hook |
| `src/physical/script-store.js` | 校验并读写 JSON 脚本 | Validates and reads/writes JSON scripts | Controller and local data directory |
| `src/physical/target-launcher.js` | 检查路径并打开目标文件 | Checks a path and opens the target file | Controller and Electron shell |
| `src/physical/repeat-plan.js` | 生成范围和重复次数计划 | Builds replay scope and repetition plans | Renderer, Controller, TimelinePlayer |
| `src/physical/timeline-player.js` | 按 `delayMs` 顺序执行事件 | Executes events in order using `delayMs` | Repeat plan and input device |
| `src/physical/windows-input-device.js` | 调用 `SendInput` 发送鼠标/键盘 | Sends mouse/keyboard input through `SendInput` | TimelinePlayer and Windows APIs |
| `src/main/floating-window.js` | 管理最小化后的悬浮窗和快照 | Manages the minimized floating window and snapshots | Main, preload, floating Renderer |
| `src/renderer/renderer.bundle.js` | 压缩后的 React UI | Minified React UI bundle | `window.desktopApi` |

## Main Data Flow / 主要数据流

```text
record request
  -> TargetLauncher (optional auto-launch)
  -> WindowsInputRecorder
  -> normalized events + delayMs
  -> PhysicalRunController
  -> ScriptStore -> RecordedScripts/*.json

play request
  -> ScriptStore.load
  -> RepeatPlan
  -> TargetLauncher (optional)
  -> TimelinePlayer
  -> WindowsPhysicalInputDevice
```

## Script Shape / 脚本格式

Scripts contain target metadata, screen bounds, timestamps, and an `events` array. The current event types are:

```text
mouse-click: x, y, button, delayMs
key-press: key, virtualKey, modifiers, delayMs
```

脚本还保存录制时的虚拟桌面边界，用于重播前提示显示器布局变化。

## Important Safety Notes / 安全说明

The recorder uses a global keyboard hook. The original program warns users not to enter passwords or verification codes. Mouse clicks inside the tool window are excluded, but keyboard input is not fully filtered by target window. Playback also relies on absolute screen coordinates and does not perform visual target verification.
