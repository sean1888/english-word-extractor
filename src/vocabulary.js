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