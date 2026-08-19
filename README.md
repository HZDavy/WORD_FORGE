<div align="center">

# 🔥 词炼 Word Forge

**智能词汇锻造工坊 — 用科学方法锻造你的词汇量**

A smart vocabulary learning app built with React + TypeScript. Forge your vocabulary through flashcards, quizzes, matching games, and multi-format file import.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Android-green)](#download)

</div>

---

## ✨ 功能 Features

| 模式 | 描述 |
|------|------|
| 📖 **闪卡模式 Flashcard** | 滑动卡片，高效记忆词汇 |
| 🧠 **测验模式 Quiz** | 多选测试，检验学习成果 |
| 🎮 **配对游戏 Matching** | 拖拽连线，趣味记忆 |
| 📋 **单词列表 Word List** | 浏览、搜索、标记所有词汇 |
| 📎 **多格式导入 Import** | 从 PDF、DOCX、TXT 文件导入词汇表 |
| 💾 **进度同步 Progress Sync** | 自动保存学习进度，随时继续 |
| 🎚️ **等级过滤 Level Filter** | 按难度等级筛选词汇 |
| ⏱️ **计时器 Timer** | 内置学习计时工具 |
| ⌨️ **键盘导航 Keyboard** | 全键盘操作支持 |

## 🛠️ 技术栈 Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **UI Icons**: Lucide React
- **Mobile**: Capacitor (Android)
- **File Parsing**: pdf.js (PDF), mammoth.js (DOCX), 原生 (TXT)

## 📦 下载 Download

### Android

从 [Releases](https://github.com/HZDavy/WORD_FORGE/releases) 下载 APK 文件，安装后直接使用。

### 从源码运行

**前提条件 Prerequisites:** Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 开发模式
npm run dev

# 3. 生产构建
npm run build

# 4. 预览构建
npm run preview
```

## 🏗️ 构建 Build

### Android 应用 (Capacitor)

```bash
npm run build              # 构建 Web 资源
npx cap sync android       # 同步到 Android 项目
```

然后用 Android Studio 打开 `android/` 目录，构建 APK：

```bash
cd android
./gradlew assembleDebug    # 生成 debug APK
# 或
./gradlew assembleRelease  # 生成 release APK
```

APK 输出位于 `android/app/build/outputs/apk/`。

## 🌐 在线体验 Online Preview

访问 [GitHub Pages](https://hzdavy.github.io/WORD_FORGE/) 在线体验所有功能。

## 📁 项目结构 Project Structure

```
WORD_FORGE/
├── components/          # React 组件
│   ├── FlashcardMode.tsx    # 闪卡模式
│   ├── QuizMode.tsx         # 测验模式
│   ├── MatchingMode.tsx     # 配对游戏
│   ├── WordListMode.tsx     # 单词列表
│   ├── MatrixRain.tsx       # 矩阵雨背景
│   └── TimerWidget.tsx      # 计时器
├── services/            # 文件解析服务
│   └── pdfProcessor.ts      # PDF/DOCX/TXT 解析
├── android/             # Capacitor Android 项目
├── site/               # 官方网站
│   └── index.html
├── App.tsx              # 主应用入口
├── types.ts             # 类型定义
├── index.tsx            # React 渲染入口
└── vite.config.ts       # Vite 配置
```

## 📄 License

[MIT License](LICENSE) — 开源免费

## 👤 Author

**HZDavy** — [GitHub](https://github.com/HZDavy)

---

<div align="center">

**词炼 Word Forge** — 锻造词汇，从今天开始。

</div>
