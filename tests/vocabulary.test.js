/**
 * vocabulary.js 单元测试
 * 使用 Node.js 运行: node tests/vocabulary.test.js
 */

// 模拟 normalizeWord 和 parseWordsFromText 函数（从 vocabulary.js 提取）

function normalizeWord(word) {
  const trimmed = word.trim().toLowerCase();
  if (/^[a-z]{3,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function parseWordsFromText(text) {
  const tokens = text.split(/[\r\n\s,;]+/);
  const validWords = [];
  for (const token of tokens) {
    const normalized = normalizeWord(token);
    if (normalized) {
      validWords.push(normalized);
    }
  }
  return validWords;
}

// 测试用例
const tests = [
  {
    name: '换行分隔的单词',
    input: 'apple\nbanana\ncomputer',
    expected: ['apple', 'banana', 'computer']
  },
  {
    name: '空格分隔的单词',
    input: 'apple banana computer',
    expected: ['apple', 'banana', 'computer']
  },
  {
    name: '逗号分隔的单词',
    input: 'apple, banana, computer',
    expected: ['apple', 'banana', 'computer']
  },
  {
    name: '混合分隔符',
    input: 'apple\nbanana, computer; desk',
    expected: ['apple', 'banana', 'computer', 'desk']
  },
  {
    name: '包含无效单词（少于3字母）',
    input: 'apple an to banana',
    expected: ['apple', 'banana']
  },
  {
    name: '包含数字和特殊字符',
    input: 'apple 123 test-word banana',
    expected: ['apple', 'banana']
  },
  {
    name: '空输入',
    input: '',
    expected: []
  },
  {
    name: '只有无效单词',
    input: 'an it to',
    expected: []
  },
  {
    name: '大写单词',
    input: 'APPLE BANANA Computer',
    expected: ['apple', 'banana', 'computer']
  },
  {
    name: '多余空格和换行',
    input: '  apple  \n\n  banana  \n  computer  ',
    expected: ['apple', 'banana', 'computer']
  }
];

// 运行测试
console.log('=== vocabulary.js 单元测试 ===\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = parseWordsFromText(test.input);
  const isEqual = JSON.stringify(result) === JSON.stringify(test.expected);

  if (isEqual) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   输入: "${test.input}"`);
    console.log(`   期望: ${JSON.stringify(test.expected)}`);
    console.log(`   实际: ${JSON.stringify(result)}`);
    failed++;
  }
}

console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passed}/${tests.length}`);
console.log(`失败: ${failed}/${tests.length}`);

if (failed > 0) {
  process.exit(1);
}