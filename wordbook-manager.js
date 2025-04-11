/**
 * 单词库管理模块
 * 包含用于管理用户单词本和单词的函数
 */

/**
 * 使用传入的单词列表开始游戏
 * @param {Array} wordsList 单词列表
 * @param {String} difficulty 难度级别
 */
window.startGameWithWords = function(wordsList, difficulty) {
    if (!wordsList || wordsList.length === 0) {
        alert('没有可用的单词');
        return;
    }
    
    console.log(`使用 ${wordsList.length} 个单词开始游戏，难度: ${difficulty}`);
    
    // 清理现有单词对
    window.wordPairs = [];
    
    // 将单词列表转换为游戏单词对
    wordsList.forEach(item => {
        window.wordPairs.push({
            word: item.word,
            translation: item.translation,
            matched: false
        });
    });
    
    // 设置难度级别
    window.gameDifficulty = difficulty || 'medium';
    
    // 重置游戏状态
    window.gameState = {
        started: false,
        timeRemaining: window.difficultySettings[window.gameDifficulty].time,
        score: 0,
        selectedWord: null,
        selectedTranslation: null,
        matchedPairs: 0,
        wordElements: [],
        translationElements: [],
        errorRecords: {},
        comboCount: 0
    };
    
    // 更新界面
    window.updateTimerDisplay();
    window.updateScoreDisplay();
    
    // 创建卡片
    window.createCards();
    
    // 开始游戏
    window.startGame();
};

/**
 * 合并重复单词的释义
 * @param {Array} wordsList 单词列表
 * @returns {Array} 合并后的单词列表
 */
function mergeWordTranslations(wordsList) {
    const wordMap = new Map();
    
    // 遍历单词列表，合并相同单词的释义
    wordsList.forEach(word => {
        if (wordMap.has(word.word)) {
            const existingWord = wordMap.get(word.word);
            // 如果释义不同，合并释义
            if (existingWord.translation !== word.translation) {
                existingWord.translation = `${existingWord.translation}；${word.translation}`;
            }
        } else {
            wordMap.set(word.word, { ...word });
        }
    });
    
    // 返回合并后的单词列表
    return Array.from(wordMap.values());
}

/**
 * 保存当前单词源选择
 * @param {Object} settings 单词源设置
 */
function saveWordSourceSettings(settings) {
    localStorage.setItem('word_source_settings', JSON.stringify(settings));
}

/**
 * 获取保存的单词源设置
 * @returns {Object} 单词源设置
 */
function getWordSourceSettings() {
    const settings = localStorage.getItem('word_source_settings');
    return settings ? JSON.parse(settings) : {
        useSystemWords: true,
        selectedWordbooks: []
    };
}

/**
 * 随机打乱数组
 * @param {Array} array 要打乱的数组
 * @returns {Array} 打乱后的数组
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
} 