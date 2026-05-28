/**
 * 生词提取器 - Popup Script
 * 负责弹窗交互逻辑
 */

// DOM 元素引用
const elements = {
  extractBtn: document.getElementById('extractBtn'),
  stats: document.getElementById('stats'),
  totalCount: document.getElementById('totalCount'),
  preview: document.getElementById('preview'),
  wordList: document.getElementById('wordList'),
  exportActions: document.getElementById('exportActions'),
  copyBtn: document.getElementById('copyBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  message: document.getElementById('message')
};

// 当前提取的单词列表
let currentWords = [];

/**
 * 显示消息提示
 * @param {string} text - 消息文本
 * @param {string} type - 消息类型 (success/error/info)
 * @param {number} duration - 显示时长（毫秒）
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
 * 更新统计信息显示
 * @param {number} count - 单词数量
 */
function updateStats(count) {
  elements.totalCount.innerHTML = `共 <strong>${count}</strong> 个单词`;
  elements.stats.classList.remove('hidden');
}

/**
 * 更新单词预览列表
 * @param {string[]} words - 单词数组
 */
function updatePreview(words) {
  // 只显示前 100 个单词
  const displayWords = words.slice(0, 100);

  elements.wordList.innerHTML = displayWords
    .map(word => `<span class="word-item">${word}</span>`)
    .join('');

  elements.preview.classList.remove('hidden');
}

/**
 * 提取单词的核心函数（将注入到页面执行）
 */
function extractWordsInPage() {
  // 单词匹配模式：长度 >= 3 的英文字母组合
  const WORD_PATTERN = /[a-zA-Z]{3,}/g;

  // 需要排除的标签
  const EXCLUDED_TAGS = ['script', 'style', 'noscript', 'iframe', 'svg', 'path', 'code', 'pre'];

  // 从页面中提取可见文本
  function extractPageText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent && EXCLUDED_TAGS.includes(parent.tagName.toLowerCase())) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent) {
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textParts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join(' ');
  }

  // 从文本中提取并处理单词
  function extractWords(text) {
    const matches = text.match(WORD_PATTERN) || [];
    const uniqueWords = [...new Set(matches.map(w => w.toLowerCase()))];
    uniqueWords.sort();
    return uniqueWords;
  }

  try {
    const pageText = extractPageText();
    const words = extractWords(pageText);
    return { success: true, words: words, count: words.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 发送消息到 content script 提取单词
 */
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
      currentWords = response.words;
      updateStats(response.count);
      updatePreview(response.words);
      elements.exportActions.classList.remove('hidden');

      if (response.count === 0) {
        showMessage('当前页面未找到英文单词', 'info', 3000);
      } else {
        showMessage(`成功提取 ${response.count} 个单词`, 'success');
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

/**
 * 复制单词到剪贴板
 */
async function copyWords() {
  if (currentWords.length === 0) {
    showMessage('没有可复制的单词', 'error');
    return;
  }

  const text = currentWords.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    showMessage('已复制到剪贴板', 'success');

    // 按钮反馈
    elements.copyBtn.textContent = '已复制 ✓';
    setTimeout(() => {
      elements.copyBtn.innerHTML = '<span class="btn-icon">📋</span> 复制全部';
    }, 1500);
  } catch (error) {
    showMessage('复制失败，请重试', 'error');
  }
}

/**
 * 下载单词为 TXT 文件
 */
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

  showMessage(`已下载 ${filename}`, 'success');

  // 按钮反馈
  elements.downloadBtn.textContent = '已下载 ✓';
  setTimeout(() => {
    elements.downloadBtn.innerHTML = '<span class="btn-icon">💾</span> 下载 TXT';
  }, 1500);
}

// 绑定事件
elements.extractBtn.addEventListener('click', requestExtractWords);
elements.copyBtn.addEventListener('click', copyWords);
elements.downloadBtn.addEventListener('click', downloadWords);