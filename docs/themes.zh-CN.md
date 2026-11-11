# 主题与外观

Motrix Turbo 提供了可扩展的主题系统，支持精选预设主题、自定义 JSON 主题以及通用的 **Base16** 主题配色方案。

## 内置精选预设

Motrix 内置了多款广受欢迎的社区经典主题：

- **Dracula**（深色）
- **Nord Dark 与 Nord Light**（深色/浅色）
- **Catppuccin Mocha**（深色）与 **Catppuccin Latte**（浅色）
- **One Dark**（经典深色）
- **Solarized Dark**（深色）
- **GitHub Dark**（深色）
- **Tokyo Night**（深色）

## 主题导入与导出

进入 **设置** > **外观** > **自定义主题与预设**：

### 导入主题
点击 **导入主题** 按钮并选择文件：
1. **Motrix 主题 JSON**（`.json`）：直接定义各语义颜色标记（`background`、`foreground`、`primary`、`card`、`sidebar` 等）。
2. **Base16 配色方案**（`.yaml`、`.yml`、`.json`）：任意标准的 16 色 Base16 配色（`base00` 至 `base0F`）。解析器会自动映射各颜色至 Motrix 界面组件，并自动推导浅色/深色类型。

### 导出主题
在激活某款主题后，点击 **导出 JSON** 或 **导出 Base16** 下载主题文件：
- **导出 JSON**：完整导出 Motrix 语义化主题结构（`<theme-id>.motrix-theme.json`）。
- **导出 Base16**：生成通用的 Base16 调色盘文件（`<theme-id>.base16.json`），方便在其他支持 Base16 的终端或编辑器中使用。

### WCAG 2.1 对比度校验
加载或导入主题时，系统采用 W3C WCAG 2.1 相对亮度算法自动分析文字与背景颜色的对比度。当文字对比度低于推荐的 4.5:1（或关键控件低于 3.0:1）时，将呈现友好的对比度提示。
