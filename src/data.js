/**
 * Verified portfolio & landmark data for Ruining Yang (@ArmedHelicopter).
 *
 * How to extend this file later:
 * - Add awards, GPA/rank, or courses under `PROFILE.highlights` or inside chapter `items`.
 * - Add new publications or repositories to the appropriate chapter's `items` array.
 * - Keep descriptions factual and concise so the 3D campus remains the visual focus.
 */

export const PROFILE = {
  name: 'Ruining Yang',
  handle: '@ArmedHelicopter',
  affiliation: '武汉大学 · 人工智能本科 · @projectluojia',
  interests: ['Deep Learning', 'AI4S', 'BCI'],
  email: '2025302193007@whu.edu.cn',
  githubUrl: 'https://github.com/ArmedHelicopter',
  coords: '30.536°N · 114.364°E',
  motto: '以高精程序化三维建筑与晴空樱云重构珞珈山川，让系统工程严谨性与“可能性感觉”同屏共鸣。',
  highlights: [
    '武汉大学人工智能方向在读本科生',
    '@projectluojia 成员',
    '研究方向聚焦 Deep Learning · AI4S · BCI',
    '热衷 Agent 分权协议、数值信号处理与零外链程序化图形实验',
  ],
};

export const CHAPTERS = [
  {
    id: 'archway',
    index: '01',
    shortLabel: '01 牌坊',
    landmarkName: '国立武汉大学牌坊',
    sectionTitle: '01 牌坊 · 序',
    subtitle: '珞珈序章 · Identity & Engineering Ethos',
    anchor: [0, 7.2, 15.5],
    camPos: [21.0, 15.2, 33.5],
    camTarget: [0.5, 3.2, 16.5],
    accentColor: '#1976a8',
    summary:
      '穿过四柱三间冲天式国立武汉大学石坊，在晴空流云与夹道樱雪间步入珞珈山立体校园。以系统级工程思维审视人工智能、科学计算与人机交互的底层耦合。',
    badges: ['WHU AI Undergrad', '@projectluojia', 'Open-Source Builder'],
    items: [
      {
        title: 'Ruining Yang · @ArmedHelicopter',
        tag: 'PROFILE',
        stack: ['Deep Learning', 'AI4S', 'BCI'],
        description:
          '武汉大学人工智能本科在读，关注智能体可靠性协议、科学计算工作流门控，以及高保真信号还原与交互式视觉叙事。',
        links: [
          { label: 'GitHub 主页', url: 'https://github.com/ArmedHelicopter' },
        ],
      },
      {
        title: '技术叙事观 · Possibility Sense',
        tag: 'ETHOS',
        stack: ['Pre-registered Falsifiers', 'Zero-CDN Procedural 3D', 'Static Shadow Baking'],
        description:
          '拒绝只为旧流程打补丁式的“马拉火车”接口——无论是 Agent 架构还是个人主页，都应让底层系统逻辑、显存预算与视觉表达严丝合缝。',
        links: [],
      },
    ],
  },
  {
    id: 'sakura',
    index: '02',
    shortLabel: '02 老斋舍',
    landmarkName: '老斋舍 & 樱花大道',
    sectionTitle: '02 老斋舍 · 工',
    subtitle: '数值信号与系统工程 · Signal & Systems',
    anchor: [0, 7.6, -0.8],
    camPos: [18.5, 16.2, 15.5],
    camTarget: [0.0, 3.6, 2.2],
    accentColor: '#e67aa3',
    summary:
      '沿百步梯与樱花大道拾级而上，老斋舍三座罗马拱门与孔雀蓝歇山顶千字号亭映照着硬核工程交付：零拷贝 Hankel 音频降噪矩阵、Fail-Closed 隔离协议与 Agent 基础设施工具链。',
    badges: ['Zero-Copy MSSA', 'Fail-Closed Security', 'Agent Infra'],
    items: [
      {
        title: 'Hankel-Stereo-Purify',
        tag: 'PYTHON · DSP',
        stack: ['Python', 'MSSA / SVD', 'Zero-Copy Block Hankel', 'BPW'],
        description:
          '面向 1950 年代 RCA Living Stereo 录音的多通道奇异谱分析（MSSA）高保真降噪系统：利用零拷贝内存视图构建分块 Hankel 矩阵，结合 2kHz 带通分离与可逆高频白化（BPW），锁相保留声场定位与小提琴谐波。',
        links: [
          { label: 'GitHub 仓库', url: 'https://github.com/ArmedHelicopter/Hankel-Stereo-Purify' },
        ],
      },
      {
        title: 'claude-switcher',
        tag: 'SYSTEM · ISOLATION',
        stack: ['11-Point Audit', 'Raw STUN Probe', 'Kill-Switch'],
        description:
          'Fail-Closed 多账号环境隔离管理器：内建 11 项环境指纹审计（Block-on-Fail）、手写 STUN 协议栈的 WebRTC 泄漏探针、断网急停 Kill-Switch 与配置漂移自愈机制。',
        links: [
          { label: 'GitHub 仓库', url: 'https://github.com/ArmedHelicopter/claude-switcher' },
        ],
      },
      {
        title: 'Agent Infra Ecosystem',
        tag: 'TOOLING · FORKS',
        stack: ['magpie', 'EasyCLIProxyAPI', 'opencode-meoo-auth', 'sivtr'],
        description:
          '围绕多模型路由、本地代理客户端、统一记忆工作空间与认证插件体系持续折腾与维护工程生态。',
        links: [
          { label: 'magpie', url: 'https://github.com/ArmedHelicopter/magpie' },
          { label: 'sivtr', url: 'https://github.com/ArmedHelicopter/sivtr' },
        ],
      },
    ],
  },
  {
    id: 'library',
    index: '03',
    shortLabel: '03 老图',
    landmarkName: '樱顶老图书馆',
    sectionTitle: '03 老图 · 研',
    subtitle: '科研协议与 AI4S · Research & Protocols',
    anchor: [0, 13.9, -9.8],
    camPos: [21.5, 22.2, 2.5],
    camTarget: [0.5, 7.6, -8.8],
    accentColor: '#1a96ad',
    summary:
      '狮子山巅孔雀蓝重檐歇山顶与五重轮宝顶之下，是关于科研智能体“分权制衡”与科学计算前置确定性约束的两项核心开源探索。',
    badges: ['Separation of Powers', 'Deterministic Gating', 'AI4S'],
    items: [
      {
        title: 'research-loop',
        tag: 'PYTHON · PROTOCOL',
        stack: ['Python', 'Agent Protocol', 'Label Isolation', 'pytest'],
        description:
          '科研 Agent 的三权分立实验框架：提案（Proposal）、锁定后执行（Locked Execution）与二元审计（Binary Audit）权力不相交，禁止在见到指标后修改判定门槛，用于对照检验目标替换与假完成问题。',
        links: [
          { label: 'GitHub 仓库', url: 'https://github.com/ArmedHelicopter/research-loop' },
        ],
      },
      {
        title: 'ai4s-gate',
        tag: 'TYPESCRIPT · MIDDLEWARE',
        stack: ['TypeScript', 'AI4S', 'Precondition Gating', 'Pi Adapter'],
        description:
          '宿主无关的 AI-for-Science 确定性门控中间件：通过 gate / beforeCall / afterCall 显式追踪科研产物状态（如限制必须完成 fpocket 与 PDBQT 电荷准备后方可执行 AutoDock Vina / DiffDock）。',
        links: [
          { label: 'GitHub 仓库', url: 'https://github.com/ArmedHelicopter/ai4s-gate' },
        ],
      },
    ],
  },
  {
    id: 'lingbo',
    index: '04',
    shortLabel: '04 凌波',
    landmarkName: '东湖凌波门',
    sectionTitle: '04 凌波 · 行',
    subtitle: '叙事、审美与未来同行 · Vision & Connect',
    anchor: [14.4, 2.2, -7.8],
    camPos: [31.5, 14.5, 7.5],
    camTarget: [13.5, 1.4, -7.2],
    accentColor: '#2585b8',
    summary:
      '栈桥向澄澈东湖深处延伸。技术之外，以高工艺三维校园沙盘与交互式网页叙事，寻找愿意一起把狂想落地成可触碰作品的同路人。',
    badges: ['Scrollytelling', '3D Architectural Craft', 'Open to Collaborate'],
    items: [
      {
        title: 'Self-study · 《马拉火车》交互研学报告',
        tag: 'HTML · ESSAY',
        stack: ['HTML', 'Scrollytelling', 'Philosophy of Tech'],
        description:
          '从 1881 年唐胥铁路“马拉火车”出发，以滚动叙事网页剖析“中体西用”的妥协接口，并投射到现代 AI Agent 管线设计中的结构性张力。',
        links: [
          { label: '在线体验', url: 'https://armedhelicopter.github.io/Self-study/' },
          { label: '源码仓库', url: 'https://github.com/ArmedHelicopter/Self-study' },
        ],
      },
      {
        title: 'OurSongs / 《收敛》 · 立体视觉叙事实验',
        tag: 'DESIGN · 3D NARRATIVE',
        stack: ['Architectural Diorama', 'Color Arc', 'Procedural Shaders'],
        description:
          '39 镜微缩立体分镜视觉体系：在真实建筑形制、程序化光影与交互镜头语言之间建立情绪张力，亦是本主页的创作脉络之一。',
        links: [],
      },
      {
        title: '下一站 · 合作与联络',
        tag: 'CONNECT',
        stack: ['Deep Learning', 'AI4S', 'BCI', 'WHU'],
        description:
          '欢迎关于科研合作、AI4S / BCI 探索、硬核工程实现或暑研/实习的交流。点击右侧或下方可直接复制邮箱联系。',
        links: [
          { label: 'GitHub', url: 'https://github.com/ArmedHelicopter' },
        ],
        copyEmail: '2025302193007@whu.edu.cn',
      },
    ],
  },
];
