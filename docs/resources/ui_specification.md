# Flock Agent 极智 UI & 排版设计规范
> 本规范定义了 Flock Agent 及其衍生项目的前端视觉体验、色彩系统、字体排版以及动效交互规范。旨在构建一套极简、现代化、且充满科技智慧感的用户界面。

---

## 1. 设计哲学 (Design Philosophy)
*   **极简与克制 (Minimalism)**：界面布局应留白得当，摒弃繁杂、高饱和度的硬编码色彩，通过优雅的灰度层次表达信息架构。
*   **智慧与科技感 (Intelligence)**：在核心操作区、状态指示器及特色组件中，融入标志性的**科技蓝青微渐变**与**外发光发光动效**，渲染智能助理的智慧感。
*   **高敏捷响应 (High Responsiveness)**：通过丝滑的弹性贝塞尔曲线（Cubic Bezier）动效，让用户的每一次鼠标悬停、点击等交互均能获得充满立体感、轻量悬浮的实时反馈。

---

## 2. 色彩系统 (Color Tokens)

本系统全面采用无缝的冷灰色（Zinc/Titanium）做背景垫底，搭配极光蓝青作为亮点点缀，完全逆转并摒弃任何偏紫或红的杂色，在双模下均保持极致的高档感。

### 2.1 全局基础调色盘 (Base Palette)
| 属性变量 | 浅色模式 (Light Mode) | 深色模式 (Dark Mode) | 场景释义 |
| :--- | :--- | :--- | :--- |
| `--flock-bg-deepest` | `#f2f4f7` | `#161618` | 页面最底层背景、代码块背景 |
| `--flock-bg-deep` | `rgba(242, 244, 247, 0.9)` | `#1c1c1f` | 工作区/侧边栏主底色 |
| `--flock-bg-base` | `#ffffff` | `#222225` | 聊天区、主内容区背景 |
| `--flock-bg-raised` | `#ffffff` | `#2a2b2f` | 悬浮卡片、弹窗面板背景 |
| `--flock-bg-surface` | `#f9fafb` | `#1c1c1f` | 辅助表单区域、输入框背景 |
| `--flock-bg-hover` | `rgba(16, 24, 40, 0.04)` | `rgba(255, 255, 255, 0.06)` | 列表项悬浮背景 |
| `--flock-border-subtle`| `rgba(16, 24, 40, 0.05)` | `rgba(255, 255, 255, 0.04)` | 超轻量级分割线与内边框 |
| `--flock-border-dim` | `rgba(16, 24, 40, 0.08)` | `rgba(255, 255, 255, 0.08)` | 标准组件与卡片边框 |
| `--flock-border-base` | `rgba(16, 24, 40, 0.14)` | `rgba(255, 255, 255, 0.15)` | 激活态/高亮边框色 |

### 2.2 核心品牌与高亮色 (Brand Accent & Solid Colors)
*   **品牌高亮主色 (`--flock-accent`)**：全局（浅色与深色模式下）一致采用高雅纯净的统一主题深蓝色 `#155aef`，确保最极致的品牌专注度、高清晰对比度以及低视觉压力。
*   **设计原则**：全局彻底摒弃高频刺眼的双色线性渐变背景，以自适应的纯净主题蓝色 `var(--flock-accent)` 代替，以实现高度沉静、专业、无视觉压力的界面观感。
*   **应用场景**：系统主 Logo 背景、特色助手头像背景、核心预览打开按钮背景、聊天气泡 Bot 头像背景。
*   **微发光投影**：在应用该主题色时，可辅以极轻量的柔和蓝色发光投影，例如 `0 2px 8px rgba(21, 90, 239, 0.2)`，杜绝过度闪耀的刺眼发光。

---

## 3. 字体与排版规范 (Typography)

为了保证全局用户（尤其是中英文混合排版下）极致一致的高清视觉效果，全局对排版字体做出了最严密的标准限制。

### 3.1 无衬线主体字体 (Sans-serif)
*   **字体声明顺序**：
    ```css
    font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ```
*   **设计要点**：
    1.  **英文首选 `Inter`**：这是一款极度紧凑、几何线条精美、字距经过极致调优的无衬线现代字体，是目前全球顶级人工智能交互界面的标配。
    2.  **中文首选系统黑体**：在苹果系统上使用 `PingFang SC` (平方-简)，在 Windows 系统上使用 `Microsoft YaHei` (微软雅黑)，保证极佳的跨平台字形表现力。
    3.  **穿透继承规则**：为了解决部分浏览器对表单控件、输入框不继承全局字体的暗病，必须在重置层显式写入以下规则：
        ```css
        body, input, button, select, textarea {
          font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }
        ```

### 3.2 极客等宽字体 (Monospace)
用于渲染代码块、文件名、文件物理路径、终端指令、参数及调试输出。
*   **字体声明变量**：
    使用 CSS 统一变量 `var(--mantine-font-family-monospace)` 控制，或声明为：
    ```css
    font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
    ```
*   **设计要点**：
    1.  **首选 `JetBrains Mono`**：这是一款专为极客代码阅读设计的顶级字体，字面高、字距宽大，具有绝佳的可读性。
    2.  **绝对杜绝裸写 `monospace`**：任何行内 style 绝不允许直接裸写 `fontFamily: 'monospace'`，以防浏览器回退到极丑的 `Courier New`，破坏视觉排版的一致性。

---

## 4. 核心组件与交互动效 (Component Behaviors)

### 4.1 卡片微立体悬浮三阶反馈 (`Hover Lift Effect`)
这是系统交互设计的精髓。任何可互动的卡片组件（如助手卡片、MCP服务卡片、动作面板等）在悬浮时，必须触发以下三阶视觉动效：
1.  **一阶：微缩放** —— 极轻微的整体膨胀（放大为原尺寸 of `1.012` 倍），呈现张力。
2.  **二阶：轻量上浮** —— 平滑上浮 `4px`（`translateY(-4px)`）。
3.  **三阶：蓝青外发光** —— 卡片边框颜色柔和过渡到高亮状态，并散发出淡淡的品牌蓝柔和发光投影。
*   **核心样式实现**：
    ```css
    .hover-card-lift {
      transition: all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
    }
    .hover-card-lift:hover {
      transform: translateY(-4px) scale(1.012);
      box-shadow: 0 12px 24px rgba(21, 90, 239, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03) !important;
      border-color: var(--flock-accent) !important;
    }
    ```

### 4.2 按钮设计 (Buttons)
*   **主确认按钮 (Primary Confirm)**：
    *   *色彩*：采用高亮品牌色 `blue` (浅色 `#155aef`，深色 `#36bffa`)，或特色区域使用蓝青线性渐变背景。
    *   *微发光*：在悬停或激活时，按钮带有微弱的蓝色投影发光，提升点击欲望。
*   **次要按钮 (Secondary/Subtle)**：
    *   *色彩*：在 Light 下为软灰底字，在 Dark 下为深邃半透明底字，且无背景时使用 `color="gray"`。
*   **微操作按钮 (Micro ActionIcon)**：
    *   *交互*：悬停时底座背景微亮 (`var(--flock-bg-hover)`)，图标本身带有些许偏转或缩放过渡。

### 4.3 状态指示灯 (Status Indicators)
*   **正常在线/连接就绪**：使用清新明亮的 `teal` (青绿) 圆点，并配以微脉冲动画（Pulse）来表达活跃生命力。
*   **警示/未绑定**：使用柔和的 `orange` (橙黄) Badge。
*   **异常/错误**：使用纯净 of `red` (中国红) Badge，杜绝偏紫的玫红色。

### 4.4 助手选择与头像 (Assistant Selection & Avatar)
*   **激活状态反馈**：当前选中助手应获得清晰的品牌蓝青色细微描边 (`1.5px solid var(--flock-accent)`) 以及半透明淡蓝色背景。
*   **头像背景**：选中助手的 Avatar 图标使用统一的主题纯色 `var(--flock-accent)` 作为底色。严禁混入任何以紫色/靛蓝色（如 `#6366f1`、`#8b5cf6`）为底座的杂色渐变，且彻底杜绝多余渐变以消除视觉压迫感。
*   **阴影特效**：激活状态下的助手卡片配有品牌浅蓝色发光阴影，即 `0 2px 8px rgba(21, 90, 239, 0.18)`，使小药丸控件平滑融入主视图。

