# ArmedHelicopter · 2.5D HD-2D 国立武汉大学校园沙盘主页

> **“穿坊入珈”** —— 零外部美术/模型依赖的纯代码 Three.js 2.5D HD-2D 交互式个人主页。支持自由鼠标拖拽旋转视角、滚轮缩放以及分段加载进度条，以 **「午后琥珀 (amber)」** 与 **「收敛夜灯 (night)」** 双重光影氛围忠实呈现 **国立武汉大学牌坊**、**老斋舍与百步梯**、**樱顶老图书馆** 及 **东湖凌波门栈桥**，展现 Ruining Yang (`@ArmedHelicopter`) 的科研与工程履历。

## 在线访问

- **首页 (2.5D HD-2D 主版本)**：https://armedhelicopter.github.io/
- **旧版备份归档**：
  - [旧版 3D 沙盘 (`archive/v1/index.html`)](https://armedhelicopter.github.io/archive/v1/) · Git 分支 `archive/v1-legacy-main` / 标签 `v1.0-legacy-main` (`d8ea7f9`)
  - [旧版 FPV 稳像实验版 (`archive/v1-fpv/index.html`)](https://armedhelicopter.github.io/archive/v1-fpv/) · Git 分支 `archive/v1-fpv-dev` (`100daa4`)

## 核心特性

1. **100% 纯代码单文件生成（零外部资源请求）**：[index.html](index.html) 与 [standalone.html](standalone.html) 均由 [tools/build_full_single_file.py](tools/build_full_single_file.py) 内联构建，所有几何体、Canvas 程序化贴图、GLSL 着色器、字体回退排版及 Web Audio 音效均纯代码生成。
2. **独立模块化 3D 组件**：所有主要 3D 物体均拆分为独立模块并在运行时暴露于 `window.__WHU_COMPONENTS__`：
   - [src/archway.js](src/archway.js) — 国立武汉大学石坊
   - [src/terrain.js](src/terrain.js) — 珞珈台地、树坑覆土与梯级挡土墙
   - [src/dormitory.js](src/dormitory.js) — 老斋舍、罗马拱门、百步梯与千字号亭
   - [src/library.js](src/library.js) — 樱顶老图书馆与双翼庭院
   - [src/lake.js](src/lake.js) — 东湖自定义 GLSL 水波、实时平面倒影、凌波栈桥与游船
   - [src/foliage.js](src/foliage.js) — 樱花林、香樟远林与飘落樱瓣
   - [src/protagonist.js](src/protagonist.js) — 2.5D 像素主角与接触阴影
   - [src/lighting.js](src/lighting.js) & [src/postfx.js](src/postfx.js) — `amber`/`night` 双氛围光照、雾效与移轴后处理
3. **自由浏览与流畅性能**：支持鼠标拖拽轨道旋转、滚轮缩放（`scrollTourEnabled: false`）、地标巡游与 `amber`/`night` 光影切换，采用静态阴影烘焙 (`2048×2048`) 与 `InstancedMesh` 合批保证笔记本流畅运行。

## 本地运行与重新打包

```bash
python tools/build_full_single_file.py
python -m http.server 8765
```

或直接用浏览器双击打开 [index.html](index.html) / [standalone.html](standalone.html)。
