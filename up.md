 TG Cloud Drive 前端全面视觉重构方案

 Context

 当前前端使用金色品牌色 (#D4AF37) + 玻璃态 (Glassmorphism) 设计风格，整体偏科技冷峻。用户希望重构为自然有机 (Organic) 风格，参考 Notion/Arc Browser 和 Apple
 iCloud 的设计语言，追求高级、优雅、富有设计感的视觉体验。品牌色从金色系切换为暖色系，深色/浅色双模式并重。

 ---
 一、新设计语言定义

 1.1 品牌色：暖赭 (Warm Terracotta)

 主色 #C96B4F — 温暖、自然、沉稳，兼具有机感和高级感。

 brand-50:  #FDF5F2    (几乎白色的暖底)
 brand-100: #FAE8E1    (浅暖粉)
 brand-200: #F5CFC2    (柔和赭粉)
 brand-300: #E8A892    (暖桃)
 brand-400: #D88A70    (活力赭)
 brand-500: #C96B4F    ← 主色
 brand-600: #B25840    (深赭)
 brand-700: #8F4533    (浓赭)
 brand-800: #733828    (暗赭)
 brand-900: #5A2D20    (极深赭)

 1.2 暖中性色 (Warm Neutrals)

 替换当前冷灰色阶，所有中性色注入微暖色调（参考 Notion 的暖灰体系）：

 warm-50:   #FAF8F5    (暖白)
 warm-100:  #F3F0EC    (象牙)
 warm-200:  #E8E4DE    (暖灰白)
 warm-300:  #D5D0C8    (浅暖灰)
 warm-400:  #A9A29A    (中暖灰)
 warm-500:  #7A746D    (暖灰)
 warm-600:  #57524C    (深暖灰)
 warm-700:  #413D38    (炭暖灰)
 warm-800:  #2A2724    (暗暖灰)
 warm-900:  #1A1816    (近黑暖)
 warm-950:  #0F0E0C    (极暗暖)

 1.3 表面系统：从玻璃态到有机实体面

 核心转变：移除 backdrop-filter: blur() 透明模糊，改为高不透明度暖色实体面 + 微妙阴影层次。
 ┌────────────────┬──────────────────┬─────────────────────────┐
 │    原 class    │      新设计      │          说明           │
 ├────────────────┼──────────────────┼─────────────────────────┤
 │ .glass         │ .surface         │ 实体暖白/暖黑面，无模糊 │
 ├────────────────┼──────────────────┼─────────────────────────┤
 │ .glass-card    │ .surface-card    │ 圆润卡片面 + 柔和阴影   │
 ├────────────────┼──────────────────┼─────────────────────────┤
 │ .glass-sidebar │ .surface-sidebar │ 侧边栏实体面 + 右边框   │
 ├────────────────┼──────────────────┼─────────────────────────┤
 │ .glass-header  │ .surface-header  │ 顶栏实体面 + 底边框     │
 └────────────────┴──────────────────┴─────────────────────────┘
 浅色模式表面：#FFFFFF / #FAF8F5 背景 + 暖色边框 #E8E4DE
 深色模式表面：#1A1816 / #0F0E0C 背景 + 暖色边框 #2A2724

 1.4 阴影系统：柔和有机阴影

 替换当前冷调硬阴影为暖色柔阴影：

 /* 浅色模式 */
 --shadow-sm: 0 1px 3px rgba(90, 45, 32, 0.06);
 --shadow-md: 0 4px 16px -4px rgba(90, 45, 32, 0.08);
 --shadow-lg: 0 12px 32px -8px rgba(90, 45, 32, 0.10);

 /* 深色模式 */
 --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
 --shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.3);
 --shadow-lg: 0 12px 32px -8px rgba(0, 0, 0, 0.4);

 1.5 背景：微妙暖渐变

 /* 浅色 — 柔和暖调 */
 body { background-color: #FAF8F5; }
 background-image:
   radial-gradient(ellipse at 15% 5%, rgba(201, 107, 79, 0.06), transparent 40%),
   radial-gradient(ellipse at 85% 8%, rgba(168, 130, 100, 0.04), transparent 35%);

 /* 深色 — 深沉暖调 */
 body { background-color: #0F0E0C; }
 background-image:
   radial-gradient(ellipse at 10% 5%, rgba(201, 107, 79, 0.05), transparent 35%),
   radial-gradient(ellipse at 90% 8%, rgba(65, 61, 56, 0.25), transparent 30%);

 1.6 字体调整

 - 标题字体：保留 Sora（几何感 + 现代感，与有机风格形成高级对比）
 - 正文字体：保留 Noto Sans SC（中文最佳可读性）
 - 代码字体：保留 JetBrains Mono
 - 无需更换字体，当前选择已与有机风格兼容

 1.7 动画哲学：自然弹性

 替换机械 ease-out 为弹性缓动函数，模拟自然物理运动：

 /* 标准交互 */
 --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
 /* 优雅展开 */
 --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
 /* 导航切换 */
 --ease-nav: cubic-bezier(0.22, 1, 0.36, 1);  /* 保留当前 */

 - navActivePulse 动画中的金色 → 品牌赭色
 - hover lift 效果保留但阴影改为暖色调
 - 新增 --duration-fast: 180ms / --duration-normal: 280ms

 ---
 二、逐文件修改清单

 阶段 1：基础设计系统 (globals.css)

 文件: frontend/src/styles/globals.css

 修改内容：
 1. @theme 块：替换所有品牌色变量（gold → brand terracotta），替换 neutral 色阶为暖中性色
 2. body 背景：新暖渐变
 3. .dark body 背景：新深色暖渐变
 4. ::selection 颜色：gold → brand
 5. 滚动条颜色：冷灰 → 暖灰
 6. 删除 .glass / .glass-card / .glass-sidebar / .glass-header，替换为 .surface / .surface-card / .surface-sidebar / .surface-header
 7. .btn-gold → .btn-brand：新品牌色
 8. .dropzone-active 颜色更新
 9. .hover-lift 阴影改为暖色调
 10. 所有 @keyframes 中的金色 rgba → 品牌色 rgba
 11. 新增 CSS 自定义属性：--ease-spring / --ease-smooth / --duration-*

 阶段 2：设计原语 (HeroActionPrimitives)

 文件: frontend/src/components/ui/HeroActionPrimitives.tsx

 修改内容（6 处品牌色引用）：
 1. toneClassName.brand 中 #B8962E / #D4AF37 / #E6C86A → 新品牌色阶
 2. ActionStatusPill brand tone 中的 #D4AF37 / #7A6116 → 新品牌色阶
 3. focus-visible:ring-[#D4AF37]/70 → focus-visible:ring-brand-500/50（全组件）
 4. ActionTextButton active 状态的 brand 颜色更新
 5. neutral 色引用检查（neutral-100~800 已在 globals.css 层面统一替换为暖色）

 阶段 3：布局骨架

 文件 3a: frontend/src/components/layout/Sidebar.tsx (6 处)
 - Logo 图标背景 bg-[#D4AF37] → bg-brand-500
 - 连接状态卡片 border-[#D4AF37]/25 bg-[#D4AF37]/10 → border-brand-500/25 bg-brand-500/10
 - NavButton 激活态渐变 from-[#D4AF37]/18 to-[#D4AF37]/8 → from-brand-500/15 to-brand-500/6
 - NavButton 激活态 ring ring-[#D4AF37]/30 → ring-brand-500/25
 - 左侧指示条 bg-[#D4AF37] → bg-brand-500
 - 图标容器激活 bg-[#D4AF37]/15 → bg-brand-500/12
 - 图标颜色激活 text-[#D4AF37] → text-brand-500
 - glass-sidebar → surface-sidebar

 文件 3b: frontend/src/components/layout/Header.tsx (9 处)
 - glass-header → surface-header
 - 用户头像渐变 from-[#D4AF37] to-[#B8962E] → from-brand-500 to-brand-600
 - 头像 ring ring-[#D4AF37]/60 → ring-brand-500/50
 - 用户菜单渐变头部 from-[#D4AF37]/20 → from-brand-500/15
 - 主题选中项 text-[#D4AF37] → text-brand-500
 - 服务切换卡片激活 border-[#D4AF37] bg-[#D4AF37]/10 → border-brand-500 bg-brand-500/10
 - 服务切换图标 text-[#D4AF37] → text-brand-500
 - 所有阴影值更新为暖色阴影

 文件 3c: frontend/src/components/layout/MainLayout.tsx
 - 检查是否有直接颜色引用（预计无需修改）

 阶段 4：文件管理组件

 文件 4a: frontend/src/components/file/FileCard.tsx (1 处)
 - 选中 ring ring-[#D4AF37] → ring-brand-500
 - 阴影值更新为暖色

 文件 4b: frontend/src/components/file/FileRow.tsx (1 处)
 - 选中背景 bg-[#D4AF37]/8 → bg-brand-500/8

 文件 4c: frontend/src/components/file/FilePreview.tsx (1 处)
 - 检查品牌色引用并替换

 文件 4d: frontend/src/components/file/FileBrowser.tsx
 - 容器阴影更新为暖色

 文件 4e: frontend/src/components/file/FileList.tsx
 - 表头背景从半透明模糊改为暖实体面

 文件 4f: frontend/src/components/file/FileContextMenu.tsx
 - 检查是否有颜色引用

 阶段 5：其他 UI 组件

 文件 5a: frontend/src/components/ui/Input.tsx (1 处)
 - focus ring ring-[#D4AF37] → ring-brand-500

 文件 5b: frontend/src/components/ui/SearchBar.tsx (1 处)
 - focus border border-[#D4AF37] → border-brand-500

 文件 5c: frontend/src/components/ui/ProgressBar.tsx (2 处)
 - gold 渐变色更新为品牌色渐变

 文件 5d: frontend/src/components/ui/Modal.tsx
 - 检查阴影和边框是否需要暖色化

 文件 5e: frontend/src/components/ui/Pagination.tsx
 - 检查颜色引用

 文件 5f: frontend/src/components/ui/ToastContainer.tsx
 - 检查颜色引用

 阶段 6：功能页面

 文件 6a: frontend/src/components/upload/DropZone.tsx (2 处)
 - 拖拽激活状态颜色更新

 文件 6b: frontend/src/components/upload/UploadProgress.tsx (3 处)
 - 品牌色引用更新

 文件 6c: frontend/src/components/settings/SettingsPage.tsx (2 处)
 - 品牌色引用更新
 - Tab 激活态颜色

 文件 6d: frontend/src/components/transfer/TransferCenterPage.tsx (5 处)
 - 顶部卡片渐变颜色更新
 - 装饰 blob 颜色更新
 - 品牌色引用更新

 文件 6e: frontend/src/components/vault/PasswordVaultPage.tsx (3 处)
 - 品牌色引用更新

 文件 6f: frontend/src/components/setup/SetupInitPage.tsx (3 处)
 - 全屏渐变背景更新
 - 接入卡片激活态更新
 - 品牌色引用更新

 文件 6g: frontend/src/components/navigation/Breadcrumb.tsx
 - 检查颜色引用

 ---
 三、实施策略

 全局替换规则

 所有组件中的硬编码颜色统一替换为 Tailwind 主题变量：
 ┌───────────────────────────┬───────────────────────────┐
 │           旧值            │           新值            │
 ├───────────────────────────┼───────────────────────────┤
 │ #D4AF37 (所有出现)        │ brand-500 或 CSS var      │
 ├───────────────────────────┼───────────────────────────┤
 │ #B8962E                   │ brand-600                 │
 ├───────────────────────────┼───────────────────────────┤
 │ #E6C86A                   │ brand-300                 │
 ├───────────────────────────┼───────────────────────────┤
 │ #7A6116                   │ brand-700                 │
 ├───────────────────────────┼───────────────────────────┤
 │ #DAB957                   │ brand-400                 │
 ├───────────────────────────┼───────────────────────────┤
 │ #C09A2A                   │ brand-600                 │
 ├───────────────────────────┼───────────────────────────┤
 │ #CAA63E                   │ brand-500                 │
 ├───────────────────────────┼───────────────────────────┤
 │ #AF891F                   │ brand-700                 │
 ├───────────────────────────┼───────────────────────────┤
 │ glass-* class             │ surface-* class           │
 ├───────────────────────────┼───────────────────────────┤
 │ 冷色阴影 rgba(15,23,42,*) │ 暖色阴影 rgba(90,45,32,*) │
 └───────────────────────────┴───────────────────────────┘
 实施顺序

 1. globals.css — 基础变量和表面系统（其余文件的基础）
 2. HeroActionPrimitives.tsx — 原语组件（被所有业务组件依赖）
 3. Sidebar.tsx + Header.tsx + MainLayout.tsx — 布局骨架
 4. File 组件群 — 核心业务界面
 5. UI 组件群 — 通用基础组件
 6. 功能页面群 — 各独立页面

 ---
 四、验证方案

 1. 视觉验证：npm run dev 启动开发服务器，逐页面检查
   - 浅色模式：所有表面使用暖白色，品牌色为赭色调
   - 深色模式：所有表面使用暖黑色，品牌色保持可读对比度
   - 响应式：移动端侧边栏、文件网格、表单布局
 2. 构建验证：npm run build 确保 TypeScript 和 Vite 构建通过
 3. 文案巡检：npm run copy:audit:check 确保无回归
 4. 交互验证：
   - 导航切换动画（弹性缓动）
   - 文件卡片 hover lift 效果
   - 模态框打开/关闭动画
   - 拖拽上传区域激活状态
   - 主题切换（浅色 ↔ 深色 ↔ 跟随系统）
 5. 无障碍：prefers-reduced-motion 降级仍然正常工作