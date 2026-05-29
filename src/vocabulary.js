/**
 * 词汇存储模块
 * 使用 chrome.storage.local 存储已收录词汇
 */

const STORAGE_KEY = 'collectedVocabulary';
const STREAK_KEY = 'streakData'; // { lastDate: 'YYYY-MM-DD', streakDays: number }
const WEEKLY_KEY = 'weeklyData'; // { weekStart: 'YYYY-MM-DD', weeklyCount: number }

/**
 * 获取本周起始日期（周一）
 * @returns {string} YYYY-MM-DD 格式
 */
function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

/**
 * 获取今日日期字符串
 * @returns {string} YYYY-MM-DD 格式
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * 获取连续天数数据
 * @returns {Promise<{lastDate: string|null, streakDays: number}>}
 */
async function getStreakData() {
  const result = await chrome.storage.local.get(STREAK_KEY);
  return result[STREAK_KEY] || { lastDate: null, streakDays: 0 };
}

/**
 * 更新连续天数（在添加词汇时调用）
 * @returns {Promise<number>} 返回当前连续天数
 */
async function updateStreak() {
  const today = getTodayDate();
  const streakData = await getStreakData();

  let newStreakDays;

  if (streakData.lastDate === null) {
    // 首次使用
    newStreakDays = 1;
  } else if (streakData.lastDate === today) {
    // 今天已记录过，不增加
    newStreakDays = streakData.streakDays;
  } else {
    // 检查是否是昨天
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (streakData.lastDate === yesterdayStr) {
      // 连续使用
      newStreakDays = streakData.streakDays + 1;
    } else {
      // 中断了，重新开始
      newStreakDays = 1;
    }
  }

  await chrome.storage.local.set({
    [STREAK_KEY]: { lastDate: today, streakDays: newStreakDays }
  });

  return newStreakDays;
}

/**
 * 获取连续天数
 * @returns {Promise<number>}
 */
async function getStreakDays() {
  const streakData = await getStreakData();
  const today = getTodayDate();

  // 如果 lastDate 不是今天或昨天，streak 已经中断
  if (streakData.lastDate === null) {
    return 0;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // lastDate 是今天或昨天，streak 有效
  if (streakData.lastDate === today || streakData.lastDate === yesterdayStr) {
    return streakData.streakDays;
  }

  // 中断了
  return 0;
}

/**
 * 获取本周新增数据
 * @returns {Promise<{weekStart: string, weeklyCount: number}>}
 */
async function getWeeklyData() {
  const result = await chrome.storage.local.get(WEEKLY_KEY);
  return result[WEEKLY_KEY] || { weekStart: getWeekStart(), weeklyCount: 0 };
}

/**
 * 更新本周新增数量
 * @param {number} addedCount 新增词汇数量
 * @returns {Promise<number>} 返回本周新增总数
 */
async function updateWeeklyCount(addedCount) {
  const currentWeekStart = getWeekStart();
  const weeklyData = await getWeeklyData();

  let newWeeklyCount;
  if (weeklyData.weekStart === currentWeekStart) {
    // 同一周，累加
    newWeeklyCount = weeklyData.weeklyCount + addedCount;
  } else {
    // 新的一周，重置
    newWeeklyCount = addedCount;
  }

  await chrome.storage.local.set({
    [WEEKLY_KEY]: { weekStart: currentWeekStart, weeklyCount: newWeeklyCount }
  });

  return newWeeklyCount;
}

/**
 * 获取本周新增数量
 * @returns {Promise<number>}
 */
async function getWeeklyCount() {
  const currentWeekStart = getWeekStart();
  const weeklyData = await getWeeklyData();

  // 如果是当前周，返回计数；否则返回 0
  if (weeklyData.weekStart === currentWeekStart) {
    return weeklyData.weeklyCount;
  }
  return 0;
}

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
    // 更新连续天数和本周新增
    await updateStreak();
    await updateWeeklyCount(1);
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
  if (addedCount > 0) {
    await saveVocabulary(vocabulary);
    // 更新连续天数和本周新增
    await updateStreak();
    await updateWeeklyCount(addedCount);
  }
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
 * 支持多种分隔符：换行、空格、逗号、分号、制表符
 * @param {string} text
 * @returns {string[]} 返回有效单词数组
 */
function parseWordsFromText(text) {
  console.log('[parseWordsFromText] 输入文本长度:', text.length);
  console.log('[parseWordsFromText] 输入文本前100字符:', text.substring(0, 100));

  // 支持多种分隔符：换行、空格、逗号、分号、制表符
  const tokens = text.split(/[\r\n\s,;]+/);
  console.log('[parseWordsFromText] 分割后 tokens 数量:', tokens.length);
  console.log('[parseWordsFromText] tokens 前10个:', tokens.slice(0, 10));

  const validWords = [];
  const invalidExamples = [];

  for (const token of tokens) {
    const normalized = normalizeWord(token);
    if (normalized) {
      validWords.push(normalized);
    } else if (token.trim() && invalidExamples.length < 5) {
      invalidExamples.push(token.trim());
    }
  }

  console.log('[parseWordsFromText] 有效单词数量:', validWords.length);
  console.log('[parseWordsFromText] 有效单词前10个:', validWords.slice(0, 10));
  if (invalidExamples.length > 0) {
    console.log('[parseWordsFromText] 无效示例:', invalidExamples);
  }

  return validWords;
}