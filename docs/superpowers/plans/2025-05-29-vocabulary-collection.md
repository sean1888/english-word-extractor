# 已收录词汇功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「已收录词汇」功能，统一管理已掌握和已提取过的单词，后续提取时自动过滤。

**Architecture:** 创建独立 options 页面管理词汇，共享 vocabulary.js 模块处理存储逻辑，popup 页面集成过滤和自动收录功能。

**Tech Stack:** Chrome Extension Manifest V3, chrome.storage.local API, 原生 JavaScript

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/vocabulary.js` | 创建 | 词汇存储核心逻辑（CRUD 操作） |
| `src/options.html` | 创建 | 管理页面 UI |
| `src/options.css` | 创建 | 管理页面样式 |
| `src/options.js` | 创建 | 管理页面交互逻辑 |
| `src/manifest.json` | 修改 | 添加 options_page 配置 |
| `src/popup.html` | 修改 | 添加「管理词汇」链接 |
| `src/popup.css` | 修改 | 添加链接样式 |
| `src/popup.js` | 修改 | 添加过滤和自动收录逻辑 |

---

### Task 1: 创建词汇存储核心模块

**Files:**
- Create: `src/vocabulary.js`

- [ ] **Step 1: 创建 vocabulary.js 文件**

创建词汇存储的核心模块，提供 CRUD 操作。

```javascript
/**
 * 词汇存储模块
 * 使用 chrome.storage.local 存储已收录词汇
 */

const STORAGE_KEY = 'collectedVocabulary';

/**
 * 获取已收录词汇（返回 Set）
 * @returns {Promise<Set<string>>}
 */
async function getVocabulary() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const words = result[STORAGE_KEY] || [];
  return new Set(words);
}

/**
 * 保存词汇到存储（接收 Set 或数组）
 * @param {Set<string>|string[]} vocabulary
 * @returns {Promise<void>}
 */
async function saveVocabulary(vocabulary) {
  const words = Array.from(vocabulary);
  await chrome.storage.local.set({ [STORAGE_KEY]: words });
}

/**
 * 添加单个词汇
 * @param {string} word
 * @returns {Promise<number>} 返回当前词汇总数
 */
async function addWord(word) {
  const vocabulary = await getVocabulary();
  const normalizedWord = normalizeWord(word);
  if (normalizedWord && !vocabulary.has(normalizedWord)) {
    vocabulary.add(normalizedWord);
    await saveVocabulary(vocabulary);
  }
  return vocabulary.size;
}

/**
 * 批量添加词汇
 * @param {string[]} words
 * @returns {Promise<number>} 返回新增词汇数量
 */
async function addWords(words) {
  const vocabulary = await getVocabulary();
  let addedCount = 0;
  for (const word of words) {
    const normalizedWord = normalizeWord(word);
    if (normalizedWord && !vocabulary.has(normalizedWord)) {
      vocabulary.add(normalizedWord);
      addedCount++;
    }
  }
  await saveVocabulary(vocabulary);
  return addedCount;
}

/**
 * 删除单个词汇
 * @param {string} word
 * @returns {Promise<number>} 返回当前词汇总数
 */
async function removeWord(word) {
  const vocabulary = await getVocabulary();
  vocabulary.delete(word.toLowerCase());
  await saveVocabulary(vocabulary);
  return vocabulary.size;
}

/**
 * 清空所有词汇
 * @returns {Promise<void>}
 */
async function clearVocabulary() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}

/**
 * 获取词汇总数
 * @returns {Promise<number>}
 */
async function getVocabularyCount() {
  const vocabulary = await getVocabulary();
  return vocabulary.size;
}

/**
 * 导出词汇为数组（用于下载）
 * @returns {Promise<string[]>}
 */
async function exportVocabulary() {
  const vocabulary = await getVocabulary();
  return Array.from(vocabulary).sort();
}

/**
 * 标准化单词：校验格式并转小写
 * @param {string} word
 * @returns {string|null} 返回标准化后的单词，或 null（无效）
 */
function normalizeWord(word) {
  const trimmed = word.trim().toLowerCase();
  if (/^[a-z]{3,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * 从文本解析单词列表
 * @param {string} text
 * @returns {string[]} 返回有效单词数组
 */
function parseWordsFromText(text) {
  const lines = text.split(/\r?\n/);
  const validWords = [];
  for (const line of lines) {
    const normalized = normalizeWord(line);
    if (normalized) {
      validWords.push(normalized);
    }
  }
  return validWords;
}
```

- [ ] **Step 2: 验证模块可加载**

在 Chrome 中重新加载扩展，确认无语法错误（扩展管理页面应无错误提示）。

---

### Task 2: 创建 Options 页面 UI

**Files:**
- Create: `src/options.html`
- Create: `src/options.css`

- [ ] **Step 1: 创建 options.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>已收录词汇 - 生词提取器</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>已收录词汇</h1>
      <p class="subtitle">提取时自动排除这些词</p>
    </header>

    <main>
      <!-- 统计信息 -->
      <div class="stats">
        <span id="totalCount">共 <strong>0</strong> 个词汇</span>
      </div>

      <!-- 备份提醒 -->
      <div id="backupReminder" class="reminder hidden">
        <span class="reminder-icon">⚠️</span>
        <span>建议定期导出备份，卸载扩展后数据将丢失</span>
      </div>

      <!-- 添加单个词汇 -->
      <section class="section">
        <h2>添加词汇</h2>
        <div class="add-form">
          <input type="text" id="addInput" class="input" placeholder="输入单词...">
          <button id="addBtn" class="btn btn-primary">添加</button>
        </div>
      </section>

      <!-- 导入词汇 -->
      <section class="section">
        <h2>导入词汇</h2>
        <textarea id="importTextarea" class="textarea" placeholder="粘贴单词列表，每行一个单词..."></textarea>
        <div class="import-actions">
          <button id="importTextBtn" class="btn btn-secondary">导入文本</button>
          <label class="btn btn-secondary file-label">
            上传文件
            <input type="file" id="importFileBtn" accept=".txt" hidden>
          </label>
        </div>
      </section>

      <!-- 词汇列表 -->
      <section class="section">
        <h2>词汇列表</h2>
        <div id="wordList" class="word-list">
          <p class="empty-hint">暂无词汇，请添加或导入</p>
        </div>
      </section>

      <!-- 导出和清空 -->
      <section class="section actions-footer">
        <button id="exportBtn" class="btn btn-secondary">
          <span class="btn-icon">💾</span> 导出备份
        </button>
        <button id="clearBtn" class="btn btn-danger">
          <span class="btn-icon">🗑️</span> 清空全部
        </button>
      </section>
    </main>

    <!-- 提示信息 -->
    <div id="message" class="message hidden"></div>
  </div>

  <script src="vocabulary.js"></script>
  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 options.css**

```css
/* Options 页面样式 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #f5f5f5;
  min-width: 400px;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.container {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Header */
header {
  text-align: center;
  margin-bottom: 24px;
}

header h1 {
  font-size: 24px;
  color: #333;
  margin-bottom: 8px;
}

header .subtitle {
  font-size: 14px;
  color: #666;
}

/* Stats */
.stats {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 16px;
}

.stats strong {
  font-size: 20px;
  color: #ffd700;
}

/* Reminder */
.reminder {
  background: #fff3cd;
  border: 1px solid #ffc107;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #856404;
}

.reminder-icon {
  font-size: 16px;
}

/* Section */
.section {
  margin-bottom: 24px;
}

.section h2 {
  font-size: 16px;
  color: #333;
  margin-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

/* Add Form */
.add-form {
  display: flex;
  gap: 8px;
}

.input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.input:focus {
  border-color: #667eea;
}

/* Textarea */
.textarea {
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  outline: none;
}

.textarea:focus {
  border-color: #667eea;
}

/* Import Actions */
.import-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.file-label {
  cursor: pointer;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon {
  font-size: 16px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.btn-danger {
  background: #ff5252;
  color: #fff;
}

.btn-danger:hover {
  background: #ff3333;
}

/* Word List */
.word-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
}

.word-list::-webkit-scrollbar {
  width: 6px;
}

.word-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.word-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.word-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #667eea;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 4px;
  font-size: 13px;
}

.word-item .delete-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0;
  font-size: 14px;
}

.word-item .delete-btn:hover {
  color: #fff;
}

.empty-hint {
  color: #999;
  text-align: center;
  font-size: 14px;
}

/* Actions Footer */
.actions-footer {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

/* Message */
.message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 100;
}

.message.success {
  background: #4caf50;
  color: #fff;
}

.message.error {
  background: #ff5252;
  color: #fff;
}

.message.info {
  background: #2196f3;
  color: #fff;
}

.hidden {
  display: none !important;
}
```

- [ ] **Step 3: 验证页面可加载**

创建一个空的 options.js 文件先，确保页面可加载无报错：

```javascript
// options.js - 待实现
```

---

### Task 3: 实现 Options 页面交互逻辑

**Files:**
- Modify: `src/options.js`

- [ ] **Step 1: 实现页面初始化和消息提示**

```javascript
/**
 * Options 页面交互逻辑
 */

// DOM 元素引用
const elements = {
  totalCount: document.getElementById('totalCount'),
  backupReminder: document.getElementById('backupReminder'),
  addInput: document.getElementById('addInput'),
  addBtn: document.getElementById('addBtn'),
  importTextarea: document.getElementById('importTextarea'),
  importTextBtn: document.getElementById('importTextBtn'),
  importFileBtn: document.getElementById('importFileBtn'),
  wordList: document.getElementById('wordList'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  message: document.getElementById('message')
};

/**
 * 显示消息提示
 */
function showMessage(text, type = 'info', duration = 2000) {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`;
  elements.message.classList.remove('hidden');

  if (duration > 0) {
    setTimeout(() => {
      elements.message.classList.add('hidden');
    }, duration);
  }
}

/**
 * 更新统计信息和备份提醒
 */
async function updateStats() {
  const count = await getVocabularyCount();
  elements.totalCount.innerHTML = `共 <strong>${count}</strong> 个词汇`;

  // 超过 100 个时显示备份提醒
  if (count >= 100) {
    elements.backupReminder.classList.remove('hidden');
  } else {
    elements.backupReminder.classList.add('hidden');
  }
}

/**
 * 更新词汇列表显示
 */
async function updateWordList() {
  const words = await exportVocabulary();

  if (words.length === 0) {
    elements.wordList.innerHTML = '<p class="empty-hint">暂无词汇，请添加或导入</p>';
    return;
  }

  elements.wordList.innerHTML = words
    .map(word => `
      <span class="word-item">
        ${word}
        <button class="delete-btn" data-word="${word}">×</button>
      </span>
    `)
    .join('');
}

/**
 * 初始化页面
 */
async function initPage() {
  await updateStats();
  await updateWordList();
}

// 页面加载时初始化
initPage();
```

- [ ] **Step 2: 实现添加单个词汇功能**

```javascript
/**
 * 添加单个词汇
 */
async function handleAddWord() {
  const word = elements.addInput.value;

  if (!word.trim()) {
    showMessage('请输入单词', 'error');
    return;
  }

  const normalizedWord = normalizeWord(word);
  if (!normalizedWord) {
    showMessage('单词格式无效（需 3+ 字母英文）', 'error');
    return;
  }

  const count = await addWord(word);
  elements.addInput.value = '';
  await updateStats();
  await updateWordList();
  showMessage(`已添加 "${normalizedWord}"`, 'success');
}

// 绑定添加按钮事件
elements.addBtn.addEventListener('click', handleAddWord);
elements.addInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleAddWord();
  }
});
```

- [ ] **Step 3: 实现导入文本功能**

```javascript
/**
 * 从文本导入词汇
 */
async function handleImportText() {
  const text = elements.importTextarea.value;

  if (!text.trim()) {
    showMessage('请输入或粘贴单词列表', 'error');
    return;
  }

  const words = parseWordsFromText(text);

  if (words.length === 0) {
    showMessage('未找到有效单词', 'error');
    return;
  }

  const addedCount = await addWords(words);
  elements.importTextarea.value = '';
  await updateStats();
  await updateWordList();
  showMessage(`成功导入 ${addedCount} 个新词汇`, 'success');
}

// 绑定导入按钮事件
elements.importTextBtn.addEventListener('click', handleImportText);
```

- [ ] **Step 4: 实现文件导入功能**

```javascript
/**
 * 从文件导入词汇
 */
async function handleImportFile(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const words = parseWordsFromText(text);

    if (words.length === 0) {
      showMessage('文件中未找到有效单词', 'error');
      return;
    }

    const addedCount = await addWords(words);
    await updateStats();
    await updateWordList();
    showMessage(`成功导入 ${addedCount} 个新词汇`, 'success');
  } catch (error) {
    showMessage('文件读取失败', 'error');
  }

  // 清空文件选择，允许重复选择同一文件
  event.target.value = '';
}

// 绑定文件导入事件
elements.importFileBtn.addEventListener('change', handleImportFile);
```

- [ ] **Step 5: 实现删除单个词汇功能**

```javascript
/**
 * 删除单个词汇
 */
async function handleDeleteWord(word) {
  await removeWord(word);
  await updateStats();
  await updateWordList();
  showMessage(`已删除 "${word}"`, 'success');
}

// 绑定删除按钮事件（使用事件委托）
elements.wordList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const word = e.target.dataset.word;
    handleDeleteWord(word);
  }
});
```

- [ ] **Step 6: 实现导出备份功能**

```javascript
/**
 * 导出词汇备份
 */
async function handleExport() {
  const words = await exportVocabulary();

  if (words.length === 0) {
    showMessage('暂无词汇可导出', 'error');
    return;
  }

  const text = words.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `collected_vocabulary_${date}.txt`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showMessage(`已导出 ${filename}`, 'success');
}

// 绑定导出按钮事件
elements.exportBtn.addEventListener('click', handleExport);
```

- [ ] **Step 7: 实现清空全部功能**

```javascript
/**
 * 清空所有词汇
 */
async function handleClear() {
  const count = await getVocabularyCount();

  if (count === 0) {
    showMessage('暂无词汇', 'info');
    return;
  }

  // 二次确认
  const confirmed = confirm(`确定清空所有 ${count} 个已收录词汇？此操作不可恢复。`);

  if (!confirmed) {
    return;
  }

  await clearVocabulary();
  await updateStats();
  await updateWordList();
  showMessage('已清空所有词汇', 'success');
}

// 绑定清空按钮事件
elements.clearBtn.addEventListener('click', handleClear);
```

- [ ] **Step 8: 合并完整 options.js**

将所有步骤的代码合并到 `src/options.js` 文件。

- [ ] **Step 9: 验证 Options 页面功能**

在 Chrome 中重新加载扩展：
1. 进入扩展管理页面，点击扩展详情
2. 找到「扩展程序选项」链接，点击打开 options 页面
3. 测试添加词汇、导入文本、删除词汇、导出备份功能

---

### Task 4: 配置 manifest.json

**Files:**
- Modify: `src/manifest.json`

- [ ] **Step 1: 添加 options_page 配置**

在 manifest.json 中添加 options_page 配置：

```json
{
  "manifest_version": 3,
  "name": "生词提取器",
  "version": "1.0.0",
  "description": "一键提取网页英文单词，用于词汇背诵",
  "permissions": ["activeTab", "scripting", "storage"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "生词提取器"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "options_page": "options.html"
}
```

注意：同时添加了 `"storage"` 权限。

- [ ] **Step 2: 验证配置生效**

重新加载扩展，确认：
1. 扩展详情页显示「扩展程序选项」链接
2. 点击链接能打开 options 页面

---

### Task 5: 修改 Popup 页面

**Files:**
- Modify: `src/popup.html`
- Modify: `src/popup.css`
- Modify: `src/popup.js`

- [ ] **Step 1: 在 popup.html 中添加管理链接**

在 footer 中添加链接：

```html
<footer>
  <p class="footer-text">用于「不背单词」APP 导入</p>
  <a href="options.html" class="manage-link">管理已收录词汇</a>
</footer>
```

同时添加 vocabulary.js 引用：

```html
<script src="vocabulary.js"></script>
<script src="popup.js"></script>
```

完整 popup.html：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>生词提取器</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>生词提取器</h1>
      <p class="subtitle">一键提取网页英文单词</p>
    </header>

    <main>
      <!-- 操作按钮 -->
      <div class="actions">
        <button id="extractBtn" class="btn btn-primary">
          <span class="btn-icon">📖</span>
          提取单词
        </button>
      </div>

      <!-- 统计信息 -->
      <div id="stats" class="stats hidden">
        <span id="totalCount">共 <strong>0</strong> 个单词</span>
      </div>

      <!-- 预览区域 -->
      <div id="preview" class="preview hidden">
        <div class="preview-header">
          <span>单词预览（显示前 100 个）</span>
        </div>
        <div id="wordList" class="word-list"></div>
      </div>

      <!-- 导出操作 -->
      <div id="exportActions" class="export-actions hidden">
        <button id="copyBtn" class="btn btn-secondary">
          <span class="btn-icon">📋</span>
          复制全部
        </button>
        <button id="downloadBtn" class="btn btn-secondary">
          <span class="btn-icon">💾</span>
          下载 TXT
        </button>
      </div>

      <!-- 提示信息 -->
      <div id="message" class="message hidden"></div>
    </main>

    <footer>
      <p class="footer-text">用于「不背单词」APP 导入</p>
      <a href="options.html" class="manage-link">管理已收录词汇</a>
    </footer>
  </div>

  <script src="vocabulary.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: 在 popup.css 中添加链接样式**

```css
/* Footer */
footer {
  text-align: center;
  margin-top: 16px;
}

.footer-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.manage-link {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.manage-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}
```

- [ ] **Step 3: 修改 popup.js 添加过滤逻辑**

在 `requestExtractWords` 函数中，获取返回结果后添加过滤逻辑：

找到原来代码：
```javascript
if (response && response.success) {
  currentWords = response.words;
  updateStats(response.count);
```

改为：
```javascript
if (response && response.success) {
  // 获取已收录词汇并过滤
  const vocabulary = await getVocabulary();
  const filteredWords = response.words.filter(w => !vocabulary.has(w));
  currentWords = filteredWords;
  updateStats(filteredWords.length);
```

完整修改后的 requestExtractWords 函数：

```javascript
async function requestExtractWords() {
  // 获取当前活动标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    showMessage('无法获取当前标签页', 'error');
    return;
  }

  // 检查是否是特殊页面（chrome:// 等）
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
    showMessage('此页面不支持提取', 'error', 3000);
    return;
  }

  // 设置加载状态
  elements.extractBtn.classList.add('loading');
  elements.extractBtn.disabled = true;

  try {
    // 动态注入脚本并执行
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractWordsInPage
    });

    // 获取执行结果
    const response = results[0].result;

    if (response && response.success) {
      // 获取已收录词汇并过滤
      const vocabulary = await getVocabulary();
      const filteredWords = response.words.filter(w => !vocabulary.has(w));
      currentWords = filteredWords;

      updateStats(filteredWords.length);
      updatePreview(filteredWords);
      elements.exportActions.classList.remove('hidden');

      if (filteredWords.length === 0) {
        showMessage('当前页面单词均已收录', 'info', 3000);
      } else {
        const filteredCount = response.count - filteredWords.length;
        if (filteredCount > 0) {
          showMessage(`成功提取 ${filteredWords.length} 个新词（已过滤 ${filteredCount} 个）`, 'success');
        } else {
          showMessage(`成功提取 ${filteredWords.length} 个单词`, 'success');
        }
      }
    } else {
      showMessage(response?.error || '提取失败', 'error', 3000);
    }
  } catch (error) {
    showMessage('无法连接到页面，请刷新后重试', 'error', 3000);
  } finally {
    // 移除加载状态
    elements.extractBtn.classList.remove('loading');
    elements.extractBtn.disabled = false;
  }
}
```

- [ ] **Step 4: 修改下载功能添加自动收录**

修改 `downloadWords` 函数，下载后自动将单词加入已收录词汇：

```javascript
function downloadWords() {
  if (currentWords.length === 0) {
    showMessage('没有可下载的单词', 'error');
    return;
  }

  const text = currentWords.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // 生成文件名：words_日期.txt
  const date = new Date().toISOString().split('T')[0];
  const filename = `words_${date}.txt`;

  // 创建下载链接
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // 清理
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 自动将下载的单词加入已收录词汇
  addWords(currentWords).then(addedCount => {
    if (addedCount > 0) {
      showMessage(`已下载 ${filename}，并收录 ${addedCount} 个新词`, 'success');
    } else {
      showMessage(`已下载 ${filename}`, 'success');
    }
  });

  // 按钮反馈
  elements.downloadBtn.textContent = '已下载 ✓';
  setTimeout(() => {
    elements.downloadBtn.innerHTML = '<span class="btn-icon">💾</span> 下载 TXT';
  }, 1500);
}
```

- [ ] **Step 5: 同样修改复制功能添加自动收录**

```javascript
async function copyWords() {
  if (currentWords.length === 0) {
    showMessage('没有可复制的单词', 'error');
    return;
  }

  const text = currentWords.join('\n');

  try {
    await navigator.clipboard.writeText(text);

    // 自动将复制的单词加入已收录词汇
    const addedCount = await addWords(currentWords);
    if (addedCount > 0) {
      showMessage(`已复制到剪贴板，并收录 ${addedCount} 个新词`, 'success');
    } else {
      showMessage('已复制到剪贴板', 'success');
    }

    // 按钮反馈
    elements.copyBtn.textContent = '已复制 ✓';
    setTimeout(() => {
      elements.copyBtn.innerHTML = '<span class="btn-icon">📋</span> 复制全部';
    }, 1500);
  } catch (error) {
    showMessage('复制失败，请重试', 'error');
  }
}
```

- [ ] **Step 6: 验证 Popup 功能**

重新加载扩展，测试：
1. popup 底部显示「管理已收录词汇」链接
2. 点击链接打开 options 页面
3. 在 options 添加几个词汇
4. 回到 popup 提取单词，验证已收录词汇被过滤
5. 下载单词后，验证自动加入已收录

---

### Task 6: 最终测试与清理

- [ ] **Step 1: 完整功能测试**

按用户流程测试完整链路：
1. 首次使用，添加一些已掌握的词汇
2. 打开英文网页，点击提取
3. 验证已掌握词汇被过滤
4. 下载单词
5. 再次提取同一页面，验证下载的单词不再出现
6. 导出备份词汇
7. 清空词汇
8. 导入备份文件恢复

- [ ] **Step 2: 更新 CLAUDE.md**

更新项目文档，添加新文件说明：

```markdown
## 核心文件

- `src/vocabulary.js` - 词汇存储核心模块，提供 CRUD 操作
- `src/options.html/js/css` - 已收录词汇管理页面
- `src/popup.js` - 提取逻辑，集成过滤和自动收录
```

- [ ] **Step 3: 提交代码**

```bash
git add src/
git commit -m "feat: 添加已收录词汇功能

- 新增 vocabulary.js 词汇存储模块
- 新增 options 页面管理已收录词汇
- popup 集成过滤和自动收录逻辑
- 支持导入、添加、导出、清空词汇"
```

---

## Self-Review 检查清单

**Spec Coverage:**
- ✅ F1 存储方案 - Task 1
- ✅ F2 Options 页面 - Task 2, 3, 4
- ✅ F3 词汇管理功能 - Task 3
- ✅ F4 提取流程改动 - Task 5
- ✅ F5 备份提醒 - Task 3

**Placeholder Scan:**
- 无 TBD/TODO 占位符
- 所有代码步骤都有完整代码块
- 所有测试步骤都有具体验证方法

**Type Consistency:**
- vocabulary.js 导出的函数名在 options.js 和 popup.js 中保持一致
- normalizeWord、parseWordsFromText 等函数名统一