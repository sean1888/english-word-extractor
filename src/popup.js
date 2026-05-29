/**
 * 生词提取器 - Popup Script
 * 负责弹窗交互逻辑
 */

// DOM 元素引用
const elements = {
  extractBtn: document.getElementById('extractBtn'),
  statsSection: document.getElementById('statsSection'),
  newCount: document.getElementById('newCount'),
  filteredCount: document.getElementById('filteredCount'),
  previewSection: document.getElementById('previewSection'),
  wordList: document.getElementById('wordList'),
  actionsSection: document.getElementById('actionsSection'),
  copyBtn: document.getElementById('copyBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  message: document.getElementById('message')
};

// 当前提取的单词列表
let currentWords = [];
let totalExtracted = 0;

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
 * 更新统计信息显示
 */
function updateStats(newCount, filteredCount) {
  elements.newCount.textContent = newCount;
  elements.filteredCount.textContent = filteredCount;
  elements.statsSection.classList.remove('hidden');
}

/**
 * 更新单词预览列表
 */
function updatePreview(words) {
  const displayWords = words.slice(0, 30);

  elements.wordList.innerHTML = displayWords
    .map(word => `<span class="word-chip">${word}</span>`)
    .join('');

  elements.previewSection.classList.remove('hidden');
}

/**
 * 提取单词的核心函数（将注入到页面执行）
 */
function extractWordsInPage() {
  const WORD_PATTERN = /[a-zA-Z]{3,}/g;
  const EXCLUDED_TAGS = ['script', 'style', 'noscript', 'iframe', 'svg', 'path', 'code', 'pre'];

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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    showMessage('无法获取当前标签页', 'error');
    return;
  }

  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
    showMessage('此页面不支持提取', 'error', 3000);
    return;
  }

  elements.extractBtn.classList.add('loading');
  elements.extractBtn.disabled = true;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractWordsInPage
    });

    const response = results[0].result;

    if (response && response.success) {
      // 获取已收录词汇并过滤
      const vocabulary = await getVocabulary();
      const filteredWords = response.words.filter(w => !vocabulary.has(w));
      currentWords = filteredWords;
      totalExtracted = response.count;

      updateStats(filteredWords.length, totalExtracted - filteredWords.length);
      updatePreview(filteredWords);
      elements.actionsSection.classList.remove('hidden');

      if (filteredWords.length === 0) {
        showMessage('当前页面单词均已收录', 'info', 3000);
      } else {
        const filteredCount = totalExtracted - filteredWords.length;
        if (filteredCount > 0) {
          showMessage(`拾起 ${filteredWords.length} 个新词`, 'success');
        } else {
          showMessage(`拾起 ${filteredWords.length} 个单词`, 'success');
        }
      }
    } else {
      showMessage(response?.error || '提取失败', 'error', 3000);
    }
  } catch (error) {
    showMessage('无法连接到页面，请刷新后重试', 'error', 3000);
  } finally {
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

    // 自动将复制的单词加入已收录词汇
    const addedCount = await addWords(currentWords);
    if (addedCount > 0) {
      showMessage(`已复制 ${currentWords.length} 词并入袋`, 'success');
    } else {
      showMessage('已复制到剪贴板', 'success');
    }

    // 更新按钮状态
    elements.copyBtn.innerHTML = '<span class="btn-icon">✓</span><span>已复制</span>';
    setTimeout(() => {
      elements.copyBtn.innerHTML = '<span class="btn-icon">📋</span><span>复制全部</span>';
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

  const date = new Date().toISOString().split('T')[0];
  const filename = `words_${date}.txt`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 自动将下载的单词加入已收录词汇
  addWords(currentWords).then(addedCount => {
    if (addedCount > 0) {
      showMessage(`已下载并入袋 ${currentWords.length} 词`, 'success');
    } else {
      showMessage(`已下载 ${filename}`, 'success');
    }
  });

  // 更新按钮状态
  elements.downloadBtn.innerHTML = '<span class="btn-icon">✓</span><span>已下载</span>';
  setTimeout(() => {
    elements.downloadBtn.innerHTML = '<span class="btn-icon">💾</span><span>下载 TXT</span>';
  }, 1500);
}

// 绑定事件
elements.extractBtn.addEventListener('click', requestExtractWords);
elements.copyBtn.addEventListener('click', copyWords);
elements.downloadBtn.addEventListener('click', downloadWords);