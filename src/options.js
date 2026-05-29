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

  event.target.value = '';
}

/**
 * 删除单个词汇
 */
async function handleDeleteWord(word) {
  await removeWord(word);
  await updateStats();
  await updateWordList();
  showMessage(`已删除 "${word}"`, 'success');
}

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

/**
 * 清空所有词汇
 */
async function handleClear() {
  const count = await getVocabularyCount();

  if (count === 0) {
    showMessage('暂无词汇', 'info');
    return;
  }

  const confirmed = confirm(`确定清空所有 ${count} 个已收录词汇？此操作不可恢复。`);

  if (!confirmed) {
    return;
  }

  await clearVocabulary();
  await updateStats();
  await updateWordList();
  showMessage('已清空所有词汇', 'success');
}

// 绑定事件
elements.addBtn.addEventListener('click', handleAddWord);
elements.addInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleAddWord();
  }
});
elements.importTextBtn.addEventListener('click', handleImportText);
elements.importFileBtn.addEventListener('change', handleImportFile);
elements.wordList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const word = e.target.dataset.word;
    handleDeleteWord(word);
  }
});
elements.exportBtn.addEventListener('click', handleExport);
elements.clearBtn.addEventListener('click', handleClear);

// 页面加载时初始化
initPage();