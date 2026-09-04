[README.md](https://github.com/user-attachments/files/31840487/README.md)
# Photobooth / 留影机

## 中文说明

Photobooth（应用内名称：**留影机**）是一个 Windows 桌面端鼠标和键盘操作录制、保存与自动重播工具。

> 注意：本仓库中的源码是从 Electron 安装包中恢复的编译后 JavaScript，并不是遗失的原始 TypeScript/React JSX 工程。它适合阅读、研究和二次整理，但当前不能保证直接重新构建出完全相同的安装包。

### 功能

- 自动打开目标程序、快捷方式或文件
- 手动打开并聚焦目标应用
- 录制鼠标左键点击和键盘按键
- 保存、读取和删除本地操作脚本
- 按原始时间间隔重播操作
- 重播整套脚本或指定步骤范围
- 设置执行次数或无限循环
- 暂停、继续和停止录制/重播
- 主窗口最小化后的悬浮控制窗
- 明暗主题和首次使用引导

### 界面概览

主界面包含首页、录制操作、操作脚本、运行记录和设置页面。Renderer 通过 `preload` 提供的 `window.desktopApi` 调用 Electron 主进程，主进程再协调录制器、脚本仓库、目标启动器和重播执行器。

### 安装和运行

1. 从 `release/VisualWorkflowTowerSetup-0.0.3.exe` 下载安装包。
2. 在 Windows 上运行安装程序。
3. 启动“留影机”。
4. 选择目标程序，开始录制操作。
5. 在“操作脚本”页面选择脚本并重播。

录制和重播只支持 Windows，因为底层输入使用 Windows Hook、PowerShell、C# 和 `user32.dll` 的 `SendInput`。

### 快捷键

```text
Ctrl + R             开始录制
Ctrl + T             停止录制
Ctrl + Shift + F12   紧急停止重播
```

### 源码目录

```text
src/main/       Electron 主进程和悬浮窗
src/preload/    Renderer 与主进程之间的安全桥接
src/physical/   输入录制、脚本存储、重播和 Windows 输入
src/shared/     共享类型和快捷键说明
src/renderer/   HTML、CSS 和压缩后的 React bundle
docs/           代码备注和恢复说明
release/        Windows 安装包
```

详细模块关系请阅读 [`docs/CODE_NOTES.md`](docs/CODE_NOTES.md)，源码恢复边界请阅读 [`docs/RECONSTRUCTION.md`](docs/RECONSTRUCTION.md)。

### 隐私和安全

录制期间会启用全局键盘监听。请不要输入密码、验证码、银行卡信息或其他敏感内容。录制脚本默认保存在本机，不应将包含个人操作的脚本提交到公开仓库。

### 已知限制

- 目前只记录鼠标左键和键盘按键。
- 不支持鼠标移动、拖拽、右键、滚轮、文本级输入或条件判断。
- 重播使用屏幕绝对坐标，显示器布局、分辨率或缩放变化可能造成偏移。
- 重播只等待固定时间，不会识别目标窗口是否真正加载完成。
- 键盘布局变化可能影响虚拟键的实际含义。
- 运行记录只保存在当前应用会话中。

### 版本

当前版本：`0.0.3`

本仓库目前没有 LICENSE 文件。公开仓库不等于自动授予他人复制、修改或再发布的权利；如果以后希望正式开源，应补充明确的许可证。

---

## English Documentation

Photobooth (application name: **留影机**) is a Windows desktop tool for recording, saving, and replaying physical mouse and keyboard operations.

> Important: the source in this repository was recovered from the compiled JavaScript inside an Electron installation package. The original TypeScript/React JSX source is no longer available. The recovered files are useful for inspection and further organization, but they are not guaranteed to rebuild the exact original installer.

### Features

- Automatically open a target application, shortcut, or file
- Manually open and focus the target application
- Record left mouse clicks and keyboard key presses
- Save, load, and delete local operation scripts
- Replay operations with their original timing intervals
- Replay a complete script or a selected step range
- Run a fixed number of repetitions or loop indefinitely
- Pause, resume, and stop recording or replay
- Floating controls shown when the main window is minimized
- Light/dark themes and a first-run guide

### Interface Overview

The interface contains Home, Record, Scripts, Run Logs, and Settings pages. The Renderer calls the Electron main process through `window.desktopApi`, which is exposed by the preload bridge. The main process coordinates the recorder, script store, target launcher, and playback engine.

### Installation and Usage

1. Download `release/VisualWorkflowTowerSetup-0.0.3.exe`.
2. Run the installer on Windows.
3. Launch Photobooth / 留影机.
4. Select a target application and start recording.
5. Select a saved script on the Scripts page and replay it.

Windows is required because the input layer uses Windows hooks, PowerShell, C#, and `user32.dll` `SendInput`.

### Keyboard Shortcuts

```text
Ctrl + R             Start recording
Ctrl + T             Stop recording
Ctrl + Shift + F12   Emergency stop playback
```

### Source Structure

```text
src/main/       Electron main process and floating window
src/preload/    Secure Renderer-to-main-process bridge
src/physical/   Input recording, script storage, playback, and Windows input
src/shared/     Shared types and shortcut information
src/renderer/   HTML, CSS, and the minified React bundle
docs/           Code notes and reconstruction notes
release/        Windows installer
```

See [`docs/CODE_NOTES.md`](docs/CODE_NOTES.md) for module relationships and [`docs/RECONSTRUCTION.md`](docs/RECONSTRUCTION.md) for recovery limitations.

### Privacy and Security

Recording enables a global keyboard listener. Do not enter passwords, verification codes, payment information, or other sensitive data while recording. Scripts are stored locally by default, and personal scripts should not be committed to a public repository.

### Known Limitations

- Only left mouse clicks and keyboard key presses are currently recorded.
- Mouse movement, dragging, right clicks, scrolling, text-level input, and conditional logic are not supported.
- Playback uses absolute screen coordinates; display layout, resolution, or scaling changes may shift the target position.
- Playback waits for a fixed delay and does not verify that the target window has finished loading.
- Keyboard layout changes may affect virtual-key behavior.
- Run logs only exist in the current application session.

### Version

Current version: `0.0.3`

This repository currently has no LICENSE file. A public repository does not automatically grant permission to copy, modify, or redistribute the code. Add an explicit license if formal open-source reuse is intended later.
