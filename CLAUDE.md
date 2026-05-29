# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Chrome 扩展（Manifest V3），用于一键提取网页中的英文单词，方便导入到「不背单词」等背词 APP。项目无构建系统，源码直接作为扩展运行。

## 开发命令

### 安装扩展
1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `src/` 目录

### 调试
- 修改代码后，在扩展管理页面点击刷新按钮重新加载
- popup.js 的日志可在扩展弹窗打开时，通过右键弹窗 → 检查 查看

## 架构

扩展使用 chrome.scripting API 动态注入脚本到当前页面执行单词提取：

```
popup.js (点击按钮)
  → chrome.scripting.executeScript()
    → extractWordsInPage() (注入到页面执行)
      → 使用 TreeWalker 遍历可见文本节点
      → 正则匹配 3+ 字母的英文单词
      → 去重、转小写、排序
  → 结果返回 popup.js 显示
```

## 核心文件

- `src/manifest.json` - 扩展配置，声明 `activeTab`、`scripting`、`storage` 权限
- `src/popup.js` - UI 逻辑和单词提取函数（`extractWordsInPage`），集成过滤和自动收录逻辑
- `src/popup.html` - 弹窗界面
- `src/popup.css` - 样式
- `src/vocabulary.js` - 词汇存储核心模块，提供 CRUD 操作（getVocabulary, addWords, removeWord 等）
- `src/options.html/js/css` - 已收录词汇管理页面，支持添加、导入、导出、删除、清空

**单词提取逻辑** (`extractWordsInPage` 函数)：
- 使用 TreeWalker 遍历文本节点，排除 script/style/noscript 等标签
- 过滤隐藏元素（display:none / visibility:hidden）
- 正则 `/[a-zA-Z]{3,}/g` 匹配 3 字符以上的英文单词
- Set 去重 → toLowerCase → sort 排序

## 注意事项

- 扩展无法在 `chrome://` 和 `chrome-extension://` 页面运行
- 修改 manifest.json 的 permissions 需要重新加载扩展

## 开发注意事项

- 写代码时遵循单一职责原则：每个函数只做一件清楚的事。多步操作时，主函数只做调度，把每一步拆成独立函数。
- 每个函数尽量短，超 30 行问问自己"是不是混了多件事"。
- 避免"反向依赖"。
- 遵循 YAGNI：用最简单的实现满足当前需求。不要为未来可能的扩展提前设计抽象层。需求出现再重构。
- 遵循 KISS：用最简单、最直观的方式实现功能。能用普通函数解决的，不要用类。能用 if-else 解决的，不要用 Strategy 模式。优先选可读性，而不是'看起来专业'。
- 变量名重命名，要精确说明它装的是什么。不要用 data / temp / helper 这种通用名。如果你想不出精确的名字，说明这个变量本身就有问题——可能根本不该存在。
- 遵循 Fail Fast 原则：不要 catch 你不知道怎么处理的异常。在数据边界(API 输入、DB 输出)校验输入，出错立即抛具体异常。报错信息要包含'是什么值导致的'。绝不允许 silent fail / try： ... except： pass / 静默吞错误。