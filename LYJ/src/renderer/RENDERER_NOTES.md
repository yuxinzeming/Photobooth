# Renderer Notes / 前端备注

`renderer.bundle.js` is the production-compressed React bundle recovered from the Electron package.

`renderer.bundle.js` 是从 Electron 发布包恢复的生产压缩 React bundle。

## Views / 页面

- Home / 首页：显示目标文件、脚本数量和快速入口。
- Record / 录制操作：选择自动或手动启动方式，开始/暂停/停止录制。
- Scripts / 操作脚本：查看脚本事件，配置范围和重复次数，开始/暂停/停止重播。
- Run Logs / 运行记录：显示当前会话的状态消息。
- Settings / 设置：修改录制名称、打开数据目录和重新查看引导。
- Floating / 悬浮窗：主窗口最小化后提供录制和重播控制。

## Bridge calls / 桥接调用

The page calls `window.desktopApi` methods exposed by `src/preload/preload.js`. The bridge maps to configuration, target selection, physical recording, script management, playback, and floating-window IPC handlers in `src/main/main.js`.

页面调用 `src/preload/preload.js` 暴露的 `window.desktopApi`，桥接到 `src/main/main.js` 中的配置、目标选择、物理录制、脚本管理、重播和悬浮窗 IPC 处理器。
