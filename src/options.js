/**
 * Options 页面交互逻辑 - 我的词袋
 */

// DOM 元素引用
const elements = {
  totalWords: document.getElementById('totalWords'),
  streakBadge: document.getElementById('streakBadge'),
  streakDays: document.getElementById('streakDays'),
  progressFill: document.getElementById('progressFill'),
  weeklyAdd: document.getElementById('weeklyAdd'),
  addInput: document.getElementById('addInput'),
  addBtn: document.getElementById('addBtn'),
  importFileBtn: document.getElementById('importFileBtn'),
  wordList: document.getElementById('wordList'),
  clearBtn: document.getElementById('clearBtn'),
  backupReminder: document.getElementById('backupReminder'),
  exportBtn: document.getElementById('exportBtn'),
  importModal: document.getElementById('importModal'),
  closeModal: document.getElementById('closeModal'),
  importTextarea: document.getElementById('importTextarea'),
  importTextBtn: document.getElementById('importTextBtn'),
  cancelModal: document.getElementById('cancelModal'),
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
 * 更新统计信息
 */
async function updateStats() {
  const count = await getVocabularyCount();
  elements.totalWords.textContent = count;

  // 进度条（目标 1800 词）
  const progress = Math.min((count / 1800) * 100, 100);
  elements.progressFill.style.width = `${progress}%`;

  // 连续天数
  const streakDays = await getStreakDays();
  if (streakDays > 0) {
    elements.streakBadge.classList.remove('hidden');
    elements.streakDays.textContent = `连续 ${streakDays} 天`;
  } else {
    elements.streakBadge.classList.add('hidden');
  }

  // 备份提醒（超过 100 词）
  if (count >= 100) {
    elements.backupReminder.classList.remove('hidden');
  } else {
    elements.backupReminder.classList.add('hidden');
  }
}

/**
 * 更新词汇列表
 */
async function updateWordList() {
  const words = await exportVocabulary();

  if (words.length === 0) {
    elements.wordList.innerHTML = '<p class="empty-hint">暂无词汇，开始拾词吧 ✨</p>';
    return;
  }

  // 显示最近 100 个
  const recentWords = words.slice(-100).reverse();

  elements.wordList.innerHTML = recentWords
    .map(word => `
      <span class="word-tag">
        ${word}
        <button class="delete-btn" data-word="${word}">×</button>
      </span>
    `)
    .join('');
}

/**
 * 页面初始化
 */
async function initPage() {
  await updateStats();
  await updateWordList();
}

/**
 * 添加单个词汇
 */
async function handleAddWord() {
  const word = elements.addInput.value.trim();

  if (!word) {
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
  showMessage(`"${normalizedWord}" 入袋成功`, 'success');
}

/**
 * 打开导入弹窗
 */
function openImportModal() {
  elements.importModal.classList.remove('hidden');
  elements.importTextarea.value = '';
  elements.importTextarea.focus();
}

/**
 * 关闭导入弹窗
 */
function closeImportModal() {
  elements.importModal.classList.add('hidden');
}

/**
 * 从文本导入
 */
async function handleImportText() {
  const text = elements.importTextarea.value.trim();

  if (!text) {
    showMessage('请输入或粘贴单词列表', 'error');
    return;
  }

  const words = parseWordsFromText(text);

  if (words.length === 0) {
    showMessage('未找到有效单词', 'error');
    return;
  }

  const addedCount = await addWords(words);
  closeImportModal();
  await updateStats();
  await updateWordList();

  if (addedCount > 0) {
    showMessage(`${addedCount} 个词汇入袋成功`, 'success');
  } else {
    showMessage('词汇已存在', 'info');
  }
}

/**
 * 从文件导入
 */
async function handleImportFile(event) {
  const file = event.target.files[0];

  if (!file) return;

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
    showMessage(`${addedCount} 个词汇入袋成功`, 'success');
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
  showMessage(`已移除 "${word}"`, 'success');
}

/**
 * 清空全部词汇
 */
async function handleClear() {
  const count = await getVocabularyCount();

  if (count === 0) {
    showMessage('词袋是空的', 'info');
    return;
  }

  const confirmed = confirm(`确定清空 ${count} 个词汇？此操作不可恢复。`);
  if (!confirmed) return;

  await clearVocabulary();
  await updateStats();
  await updateWordList();
  showMessage('词袋已清空', 'success');
}

/**
 * 导出备份
 */
async function handleExport() {
  const words = await exportVocabulary();

  if (words.length === 0) {
    showMessage('词袋是空的', 'error');
    return;
  }

  const text = words.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `vocab_backup_${date}.txt`;

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

// 绑定事件
elements.addBtn.addEventListener('click', handleAddWord);
elements.addInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleAddWord();
});

// 上传文件按钮打开弹窗（改为打开导入弹窗）
document.querySelector('.file-label').addEventListener('click', (e) => {
  e.preventDefault();
  openImportModal();
});

elements.importFileBtn.addEventListener('change', handleImportFile);
elements.importTextBtn.addEventListener('click', handleImportText);
elements.closeModal.addEventListener('click', closeImportModal);
elements.cancelModal.addEventListener('click', closeImportModal);
elements.importModal.addEventListener('click', (e) => {
  if (e.target === elements.importModal) closeImportModal();
});

elements.wordList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    handleDeleteWord(e.target.dataset.word);
  }
});

elements.clearBtn.addEventListener('click', handleClear);
elements.exportBtn.addEventListener('click', handleExport);

// 页面加载初始化
initPage();