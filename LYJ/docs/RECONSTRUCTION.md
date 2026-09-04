# Reconstruction Notes / 源码恢复说明

## Source status / 源码状态

The original development project was not available. The source files in `src/` were recovered from the compiled `resources/app.asar` contained in the version `0.0.3` Electron distribution.

原始开发工程已经遗失。本仓库的 `src/` 文件来自 `0.0.3` Electron 发布包中的 `resources/app.asar`，属于编译后运行时代码恢复。

## What was recovered / 已恢复内容

- Electron main-process JavaScript
- preload bridge
- physical input recorder
- script storage and validation
- target launcher
- replay plan and timeline player
- Windows `SendInput` adapter
- floating-window manager
- the production React Renderer bundle and stylesheet

## What was not recovered / 无法恢复内容

- Original TypeScript source
- Original React JSX component files
- Original build configuration
- Original lockfile and complete development dependencies
- Original tests and commit history
- Guaranteed reproducible build of the installer

The Renderer bundle is minified, so the original component names and file boundaries cannot be reconstructed reliably. Its behavior is documented in `src/renderer/RENDERER_NOTES.md`.

Renderer bundle 已经压缩，无法可靠恢复原始组件名称和文件边界；其功能记录在 `src/renderer/RENDERER_NOTES.md`。

## Runtime reference / 运行参考

The untouched installer is kept under `release/`. The original extracted distribution used as the recovery reference was the desktop `001` folder. The executable and ASAR should be treated as release artifacts, not as editable source.

未修改的安装包保存在 `release/`。源码恢复参考为桌面 `001` 文件夹。EXE 和 ASAR 应被视为发布产物，不应直接编辑。

## Maintenance guidance / 维护建议

Future maintenance should gradually convert the recovered modules into clean TypeScript and split the Renderer bundle into real React components. Until that work is done, documentation and comments should clearly distinguish recovered runtime code from newly written code.
