/**
 * 单词消消乐游戏
 * 功能包括：单词匹配、计时、得分、Excel导入、文本导入、TTS朗读、连击特效、MySQL数据库存储
 */

// 本地存储相关常量
const STORAGE_KEYS = {
    WORD_LIBRARIES: 'englishGame_wordLibraries',
    LAST_SELECTED_GRADE: 'englishGame_lastSelectedGrade'
};

// 数据库连接配置
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '123456mysql@',
    database: 'word_pop'
};

// 游戏数据对象
const gameData = {
    wordPairs: [], // 英文单词和翻译的对组
    currentLevel: 1,
    currentPoints: 0,
    totalLevels: 10,
    pointsToNextLevel: 5,
    matchedPairs: 0,
    selectedWord: null, // 当前选中的单词卡片
    selectedTranslation: null, // 当前选中的释义卡片
    gameActive: false, // 游戏是否进行中
    timer: null, // 计时器引用
    timeLeft: 60, // 倒计时秒数
    initialTime: 60, // 初始时间，用于计算用时
    score: 0, // 当前得分
    comboCount: 0, // 连击次数
    wordClickCount: {}, // 单词点击次数记录，用于双击TTS
    wordCount: 10, // 每次游戏显示的单词数量，默认10个
    difficulty: 'medium', // 游戏难度
    errorRecords: [], // 错误记录，存储用户匹配错误的单词
    currentGradeId: null // 当前选中的年级ID
};

// 默认词库（示例数据）
const defaultWordPairs = [
    { word: "apple", translation: "苹果" },
    { word: "banana", translation: "香蕉" },
    { word: "orange", translation: "橙子" },
    { word: "grape", translation: "葡萄" },
    { word: "peach", translation: "桃子" },
    { word: "watermelon", translation: "西瓜" },
    { word: "strawberry", translation: "草莓" },
    { word: "pineapple", translation: "菠萝" },
    { word: "cherry", translation: "樱桃" },
    { word: "blueberry", translation: "蓝莓" },
    { word: "lemon", translation: "柠檬" },
    { word: "apricot", translation: "杏子" },
    { word: "avocado", translation: "牛油果" },
    { word: "coconut", translation: "椰子" },
    { word: "kiwi", translation: "猕猴桃" },
    { word: "mango", translation: "芒果" },
    { word: "papaya", translation: "木瓜" },
    { word: "plum", translation: "李子" },
    { word: "pomegranate", translation: "石榴" },
    { word: "raspberry", translation: "覆盆子" }
];

// 单词库结构示例 - 初始默认数据
const DEFAULT_LIBRARIES = {
    'grade1': {
        name: '小学一年级',
        words: defaultWordPairs.slice(0, 10)
    },
    'grade2': {
        name: '小学二年级',
        words: defaultWordPairs.slice(5, 15)
    },
    'grade3': {
        name: '小学三年级',
        words: defaultWordPairs.slice(10, 20)
    }
};

// 音效资源
const audioResources = {
    success: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3'),
    fail: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alert-quick-chime-766.mp3'),
    victory: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-animated-small-group-applause-523.mp3')
};

// DOM 元素引用
const elements = {
    wordsContainer: document.getElementById('words-container'),
    translationsContainer: document.getElementById('translations-container'),
    startButton: document.getElementById('start-game'),
    timerValue: document.getElementById('timer-value'),
    scoreValue: document.getElementById('score-value'),
    importFileButton: document.getElementById('import-file'),
    fileInput: document.getElementById('file-input'),
    downloadTemplateButton: document.getElementById('download-template'),
    comboEffect: document.getElementById('combo-effect'),
    flashEffect: document.getElementById('flash-effect'),
    confettiContainer: document.getElementById('confetti-container'),
    wordCountSelect: document.getElementById('word-count'),
    difficultySelect: document.getElementById('difficulty'),
    errorRecordsPanel: document.getElementById('error-records-panel'),
    errorRecordsList: document.getElementById('error-records-list'),
    gradeSelect: document.getElementById('grade-select')
};

/**
 * 初始化所有事件监听器
 */
function initEventListeners() {
    // 游戏控制按钮事件
    if (elements.startButton) {
        elements.startButton.addEventListener('click', startGame);
    }
    
    if (elements.importFileButton) {
        // 确保只绑定一次事件，先移除可能存在的事件监听器
        elements.importFileButton.removeEventListener('click', function() {
            elements.fileInput.click();
        });
        
        // 使用命名函数以便于移除
        elements.importFileButton.importFileHandler = function() {
            // 防止重复点击导致多次触发
            if (elements.importFileButton.dataset.processing === 'true') {
                return;
            }
            elements.importFileButton.dataset.processing = 'true';
            
            // 延迟一点时间再清除标记，防止快速点击
            setTimeout(() => {
                elements.importFileButton.dataset.processing = 'false';
            }, 1000);
            
            elements.fileInput.click();
        };
        
        // 重新绑定事件
        elements.importFileButton.addEventListener('click', elements.importFileButton.importFileHandler);
    }
    
    if (elements.fileInput) {
        elements.fileInput.removeEventListener('change', handleFileImport);
        elements.fileInput.addEventListener('change', handleFileImport);
    }
    
    if (elements.downloadTemplateButton) {
        // 先移除可能存在的事件处理程序
        elements.downloadTemplateButton.removeEventListener('click', downloadImportTemplate);
        
        // 使用命名函数以便于移除
        elements.downloadTemplateButton.templateHandler = function() {
            // 防止重复点击导致多次触发
            if (elements.downloadTemplateButton.dataset.processing === 'true') {
                return;
            }
            elements.downloadTemplateButton.dataset.processing = 'true';
            
            // 下载模板
            downloadImportTemplate();
            
            // 延迟一点时间再清除标记，防止快速点击
            setTimeout(() => {
                elements.downloadTemplateButton.dataset.processing = 'false';
            }, 1000);
        };
        
        // 重新绑定事件
        elements.downloadTemplateButton.addEventListener('click', elements.downloadTemplateButton.templateHandler);
    }
    
    // 添加单词卡片和释义卡片的点击事件，在游戏启动时会重新绑定
    addEventListeners();
    
    // 处理单词朗读
    document.addEventListener('click', handleWordTTS);
    
    // 难度和单词数量变更
    if (elements.wordCountSelect) {
        elements.wordCountSelect.addEventListener('change', handleWordCountChange);
    }
    
    if (elements.difficultySelect) {
        elements.difficultySelect.addEventListener('change', handleDifficultyChange);
    }
}

/**
 * 初始化游戏
 */
function initGame() {
    // 如果没有自定义词库，使用默认词库
    if (gameData.wordPairs.length === 0) {
        gameData.wordPairs = [...defaultWordPairs];
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 初始创建卡片 - 首次加载时显示的卡片
    createCards();
    
    // 添加事件监听器
    addEventListeners();
    
    // 预加载音效
    preloadAudio();
    
    // 初始化错误记录面板引用
    updateErrorRecordsPanelReferences();
}

/**
 * 预加载音效资源
 */
function preloadAudio() {
    // 设置音量
    audioResources.success.volume = 0.6;
    audioResources.fail.volume = 0.5;
    audioResources.victory.volume = 0.7;
    
    // 预加载
    Object.values(audioResources).forEach(audio => {
        audio.load();
    });
}

/**
 * 更新错误记录面板DOM引用
 */
function updateErrorRecordsPanelReferences() {
    // 更新错误记录面板的DOM引用
    elements.errorRecordsPanel = document.getElementById('error-records-panel');
    elements.errorRecordsList = document.getElementById('error-records-list');
}

/**
 * 重置游戏状态
 */
function resetGameState() {
    gameData.selectedWord = null;
    gameData.selectedTranslation = null;
    gameData.timeLeft = 60;
    gameData.score = 0;
    gameData.comboCount = 0;
    gameData.wordClickCount = {};
    gameData.errorRecords = [];
    
    clearInterval(gameData.timer);
    gameData.gameActive = false;
    
    elements.timerValue.textContent = gameData.timeLeft;
    elements.scoreValue.textContent = gameData.score;
    elements.startButton.textContent = '开始游戏';
    
    // 清除可能的撒花效果
    if (elements.confettiContainer) {
        elements.confettiContainer.innerHTML = '';
    }
    
    // 清空并隐藏错误记录面板
    if (elements.errorRecordsList) {
        elements.errorRecordsList.innerHTML = '';
    }
    
    // 隐藏错误记录面板
    if (elements.errorRecordsPanel) {
        elements.errorRecordsPanel.style.display = 'none';
    }
}

/**
 * 创建单词和释义卡片
 */
function createCards() {
    // 清空容器
    elements.wordsContainer.innerHTML = '';
    elements.translationsContainer.innerHTML = '';
    
    // 获取当前设置的单词数量
    const wordCount = gameData.wordCount;
    
    // 检查是否使用系统单词库（从localStorage获取设置）
    let useSystemWords = false;
    try {
        const savedSource = localStorage.getItem('word_source');
        if (savedSource) {
            const parsed = JSON.parse(savedSource);
            useSystemWords = parsed.useSystemWords;
        }
    } catch (error) {
        console.error('解析单词源设置出错:', error);
    }
    
    // 如果使用系统单词且词库中的单词多于需要的数量，则限制数量
    // 否则使用所有可用单词
    let selectedPairs;
    if (useSystemWords && gameData.wordPairs.length > wordCount) {
        // 随机选择指定数量的单词
        selectedPairs = [...gameData.wordPairs]
            .sort(() => Math.random() - 0.5)
            .slice(0, wordCount);
        
        console.log(`使用系统单词库，限制数量为${wordCount}个`);
    } else {
        // 使用所有可用单词
        selectedPairs = [...gameData.wordPairs];
        console.log(`不使用系统单词库或单词不足，使用全部${selectedPairs.length}个单词`);
    }
    
    // 复制并打乱选定的单词
    const shuffledWords = [...selectedPairs].sort(() => Math.random() - 0.5);
    const shuffledTranslations = [...selectedPairs].sort(() => Math.random() - 0.5);
    
    // 创建单词卡片
    shuffledWords.forEach((pair, index) => {
        const card = document.createElement('div');
        card.className = 'card word-card';
        card.dataset.index = index;
        card.dataset.word = pair.word;
        card.dataset.translation = pair.translation;
        card.textContent = pair.word;
        
        // 添加鼠标离开事件，清除悬停计时器
        card.addEventListener('mouseout', () => {
            if (card.dataset.hoverTimer) {
                clearTimeout(parseInt(card.dataset.hoverTimer));
                delete card.dataset.hoverTimer;
            }
        });
        
        elements.wordsContainer.appendChild(card);
    });
    
    // 创建释义卡片
    shuffledTranslations.forEach((pair, index) => {
        const card = document.createElement('div');
        card.className = 'card translation-card';
        card.dataset.index = index;
        card.dataset.word = pair.word;
        card.dataset.translation = pair.translation;
        card.textContent = pair.translation;
        
        elements.translationsContainer.appendChild(card);
    });
}

/**
 * 添加事件监听器
 */
function addEventListeners() {
    // 开始游戏按钮 - 使用命名函数以便于精确移除
    elements.startButton.gameStartHandler = elements.startButton.gameStartHandler || startGame;
    elements.startButton.removeEventListener('click', elements.startButton.gameStartHandler);
    elements.startButton.addEventListener('click', elements.startButton.gameStartHandler);
    
    // 单词卡片点击
    elements.wordsContainer.removeEventListener('click', handleWordCardClick);
    elements.wordsContainer.addEventListener('click', handleWordCardClick);
    
    // 单词卡片双击（TTS朗读）
    elements.wordsContainer.addEventListener('dblclick', handleWordTTS);
    
    // 单词卡片单击朗读
    elements.wordsContainer.addEventListener('click', handleWordClick);
    
    // 单词数量选择变化
    if (elements.wordCountSelect) {
        elements.wordCountSelect.addEventListener('change', handleWordCountChange);
    }
    
    // 难度选择变化
    if (elements.difficultySelect) {
        elements.difficultySelect.addEventListener('change', handleDifficultyChange);
    }
}

/**
 * 处理单词数量选择变化
 */
function handleWordCountChange() {
    const newCount = parseInt(elements.wordCountSelect.value);
    if (!isNaN(newCount) && newCount > 0) {
        gameData.wordCount = newCount;
        
        // 如果游戏没有进行中，立即更新卡片
        if (!gameData.gameActive) {
            createCards();
        }
    }
}

/**
 * 处理难度选择变化
 */
function handleDifficultyChange() {
    const newDifficulty = elements.difficultySelect.value;
    gameData.difficulty = newDifficulty;
    
    // 根据难度调整游戏参数
    switch (newDifficulty) {
        case 'easy':
            gameData.timeLeft = 90; // 简单模式给更多时间
            gameData.initialTime = 90; // 记录初始时间
            break;
        case 'medium':
            gameData.timeLeft = 60; // 中等难度
            gameData.initialTime = 60; // 记录初始时间
            break;
        case 'hard':
            gameData.timeLeft = 45; // 困难模式时间更短
            gameData.initialTime = 45; // 记录初始时间
            break;
    }
    
    // 更新显示的时间
    elements.timerValue.textContent = gameData.timeLeft;
}

/**
 * 开始游戏
 */
function startGame() {
    // 检查是否是重新开始游戏
    const isRestart = elements.startButton.textContent === '重新开始';
    
    // 重置状态
    resetGameState();
    
    // 根据当前难度设置时间
    handleDifficultyChange();
    
    // 只有在重新开始游戏时，才重新创建卡片
    if (isRestart) {
        createCards();
    }
    
    // 开始计时
    gameData.gameActive = true;
    elements.startButton.textContent = '重新开始';
    
    // 设置计时器
    gameData.timer = setInterval(() => {
        gameData.timeLeft--;
        elements.timerValue.textContent = gameData.timeLeft;
        
        if (gameData.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/**
 * 结束游戏
 */
function endGame() {
    clearInterval(gameData.timer);
    gameData.gameActive = false;
    
    // 显示结束提示
    showCustomAlert(`游戏结束！您的最终得分是：${gameData.score}`, 3000);
    
    // 调用游戏结束处理函数（如果存在）
    if (typeof window.gameEndHandler === 'function') {
        window.gameEndHandler();
    }
}

/**
 * 处理单词卡片点击
 * @param {Event} e - 点击事件
 */
function handleWordCardClick(e) {
    if (!gameData.gameActive) return;
    
    const card = e.target.closest('.card');
    if (!card) return;
    
    // 记录点击次数（用于TTS双击检测）
    const word = card.dataset.word;
    gameData.wordClickCount[word] = (gameData.wordClickCount[word] || 0) + 1;
    
    // 如果该卡片已匹配，不执行操作
    if (card.classList.contains('matched')) return;
    
    // 清除之前所有结果图标
    clearAllResultIcons();
    
    // 取消选中之前的单词卡片
    const prevSelectedWord = document.querySelector('.word-card.selected');
    if (prevSelectedWord) {
        prevSelectedWord.classList.remove('selected');
    }
    
    // 选中当前卡片
    card.classList.add('selected');
    gameData.selectedWord = card;
    
    // 在真实用户点击事件时朗读单词(isTrusted标识用户触发的事件)
    if (e.isTrusted) {
        speakWord(word);
    }
    
    // 如果有释义卡片已选中，检查匹配
    if (gameData.selectedTranslation) {
        checkMatch();
    }
}

/**
 * 处理释义卡片点击
 * @param {Event} e - 点击事件
 */
function handleTranslationCardClick(e) {
    if (!gameData.gameActive) return;
    
    const card = e.target.closest('.card');
    if (!card) return;
    
    // 如果该卡片已匹配，不执行操作
    if (card.classList.contains('matched')) return;
    
    // 清除之前所有结果图标
    clearAllResultIcons();
    
    // 取消选中之前的释义卡片
    const prevSelectedTranslation = document.querySelector('.translation-card.selected');
    if (prevSelectedTranslation) {
        prevSelectedTranslation.classList.remove('selected');
    }
    
    // 选中当前卡片
    card.classList.add('selected');
    gameData.selectedTranslation = card;
    
    // 如果有单词卡片已选中，检查匹配
    if (gameData.selectedWord) {
        checkMatch();
    }
}

/**
 * 清除所有卡片上的错误结果图标
 */
function clearAllResultIcons() {
    // 只清除错误匹配的图标（X号），保留正确匹配的图标（✓号）
    const incorrectIcons = document.querySelectorAll('.result-icon.incorrect');
    incorrectIcons.forEach(icon => {
        // 添加淡出动画
        icon.classList.add('fade-out');
        
        // 动画结束后移除元素
        setTimeout(() => {
            if (icon.parentNode) {
                icon.parentNode.removeChild(icon);
            }
        }, 300);
    });
}

/**
 * 检查所选卡片是否匹配
 */
function checkMatch() {
    const wordCard = gameData.selectedWord;
    const translationCard = gameData.selectedTranslation;
    
    // 检查是否匹配
    const isMatch = wordCard.dataset.word === translationCard.dataset.word;
    
    if (isMatch) {
        // 匹配成功
        handleMatchSuccess(wordCard, translationCard);
    } else {
        // 匹配失败
        handleMatchFail(wordCard, translationCard);
    }
    
    // 重置选中状态
    gameData.selectedWord = null;
    gameData.selectedTranslation = null;
}

/**
 * 处理匹配成功
 * @param {HTMLElement} wordCard - 单词卡片
 * @param {HTMLElement} translationCard - 释义卡片
 */
function handleMatchSuccess(wordCard, translationCard) {
    // 增加分数
    gameData.score += 5;
    elements.scoreValue.textContent = gameData.score;
    
    // 增加连击计数
    gameData.comboCount++;
    
    // 显示正确图标
    showResultIcon(wordCard, true);
    showResultIcon(translationCard, true);
    
    // 创建连接线
    createConnectionLine(wordCard, translationCard);
    
    // 播放成功音效
    playAudio('success');
    
    // 标记卡片为已匹配
    setTimeout(() => {
        wordCard.classList.add('matched');
        translationCard.classList.add('matched');
        wordCard.classList.remove('selected');
        translationCard.classList.remove('selected');
        
        // 检查是否所有卡片都已匹配
        checkAllMatched();
    }, 1000);
    
    // 连击特效
    if (gameData.comboCount >= 3) {
        showComboEffect();
    }
}

/**
 * 创建连接两个卡片的线
 * @param {HTMLElement} fromCard - 起始卡片
 * @param {HTMLElement} toCard - 目标卡片
 */
function createConnectionLine(fromCard, toCard) {
    // 获取游戏板元素
    const gameBoard = document.querySelector('.game-board');
    
    // 获取两个卡片的位置
    const fromRect = fromCard.getBoundingClientRect();
    const toRect = toCard.getBoundingClientRect();
    const boardRect = gameBoard.getBoundingClientRect();
    
    // 计算线的起点和终点（相对于游戏板）
    const fromX = fromRect.left + fromRect.width / 2 - boardRect.left;
    const fromY = fromRect.top + fromRect.height / 2 - boardRect.top;
    const toX = toRect.left + toRect.width / 2 - boardRect.left;
    const toY = toRect.top + toRect.height / 2 - boardRect.top;
    
    // 清除已有的连接线
    const oldLines = document.querySelectorAll('.connection-line');
    oldLines.forEach(line => line.remove());
    
    // 计算线的长度和角度
    const length = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
    const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
    
    // 创建连接线元素
    const line = document.createElement('div');
    line.className = 'connection-line';
    
    // 设置线条样式
    line.style.cssText = `
        width: ${length}px;
        left: ${fromX}px;
        top: ${fromY}px;
        transform: rotate(${angle}deg);
    `;
    
    // 添加到游戏板
    gameBoard.appendChild(line);
    
    // 创建淡出动画
    setTimeout(() => {
        line.style.animation = 'fadeOutLine 0.5s forwards';
        
        // 动画结束后移除线条
        setTimeout(() => {
            line.remove();
        }, 500);
    }, 700);
}

/**
 * 处理匹配失败
 * @param {HTMLElement} wordCard - 单词卡片
 * @param {HTMLElement} translationCard - 释义卡片
 */
function handleMatchFail(wordCard, translationCard) {
    // 重置连击计数
    gameData.comboCount = 0;
    
    // 显示错误图标
    showResultIcon(wordCard, false);
    showResultIcon(translationCard, false);
    
    // 播放失败鼓励音效
    playAudio('fail');
    
    // 添加抖动动画
    wordCard.classList.add('error');
    translationCard.classList.add('error');
    
    // 记录错误匹配
    const word = wordCard.dataset.word;
    const translation = wordCard.dataset.translation;
    
    // 检查是否已记录过该单词的错误
    const existingError = gameData.errorRecords.find(record => record.word === word);
    if (!existingError) {
        gameData.errorRecords.push({ word, translation, count: 1 });
    } else {
        existingError.count += 1;
    }
    
    // 更新错误记录面板
    updateErrorRecordsPanel();
    
    // 移除选中和抖动类
    setTimeout(() => {
        wordCard.classList.remove('selected', 'error');
        translationCard.classList.remove('selected', 'error');
    }, 500);
}

/**
 * 播放音效
 * @param {string} type - 音效类型: 'success', 'fail', 'victory'
 */
function playAudio(type) {
    if (audioResources[type]) {
        // 重置音频以确保能够重复播放
        audioResources[type].pause();
        audioResources[type].currentTime = 0;
        
        // 播放音效
        audioResources[type].play().catch(err => {
            console.log('音频播放失败:', err);
        });
    }
}

/**
 * 显示结果图标（对勾或叉号）
 * @param {HTMLElement} card - 卡片元素
 * @param {boolean} isCorrect - 是否正确匹配
 */
function showResultIcon(card, isCorrect) {
    // 先移除已有的图标
    const existingIcon = card.querySelector('.result-icon');
    if (existingIcon) {
        existingIcon.remove();
    }
    
    // 创建新图标
    const icon = document.createElement('div');
    icon.className = `result-icon ${isCorrect ? 'correct' : 'incorrect'}`;
    icon.textContent = isCorrect ? '✓' : '✗';
    
    card.appendChild(icon);
    
    // 对于正确匹配的卡片，图标会保留到卡片消失
    // 对于错误匹配的卡片，图标会在下一次选择时淡出消失
}

/**
 * 显示连击特效
 */
function showComboEffect() {
    // 显示连击文字
    elements.comboEffect.textContent = `连击 x${gameData.comboCount}`;
    elements.comboEffect.style.animation = 'comboEffect 1s';
    
    // 闪光特效
    elements.flashEffect.style.animation = 'flashBorder 1s';
    
    // 重置动画
    setTimeout(() => {
        elements.comboEffect.style.animation = 'none';
        elements.flashEffect.style.animation = 'none';
        void elements.comboEffect.offsetWidth; // 触发重排以重置动画
        void elements.flashEffect.offsetWidth;
    }, 1000);
}

/**
 * 检查是否所有卡片都已匹配
 */
function checkAllMatched() {
    const allMatched = document.querySelectorAll('.card:not(.matched)').length === 0;
    
    if (allMatched && gameData.gameActive) {
        clearInterval(gameData.timer);
        gameData.gameActive = false;
        
        // 播放胜利音效
        playAudio('victory');
        
        // 显示撒花特效
        showConfetti();
        
        // 计算用时（使用初始时间减去剩余时间）
        const timeUsed = gameData.initialTime - gameData.timeLeft;
        
        // 显示胜利提示
        setTimeout(() => {
            showCustomAlert(`恭喜你赢了！用时${timeUsed}秒，得分${gameData.score}`, 3000);
        }, 1000);
    }
}

/**
 * 显示撒花特效
 */
function showConfetti() {
    // 确保存在撒花容器
    if (!elements.confettiContainer) {
        const container = document.createElement('div');
        container.id = 'confetti-container';
        document.body.appendChild(container);
        elements.confettiContainer = container;
    }
    
    // 清空容器
    elements.confettiContainer.innerHTML = '';
    
    // 创建彩花
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
    
    // 生成多个彩花元素
    for (let i = 0; i < 150; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's'; // 2-5秒
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        elements.confettiContainer.appendChild(confetti);
    }
}

/**
 * 处理Excel文件导入
 * @param {Event} e - 文件输入事件
 */
function handleFileImport(e) {
    // 防止重复处理
    if (e.target.dataset.processing === 'true') {
        console.log('[Excel导入] 文件已在处理中，忽略重复事件');
        return;
    }
    
    // 标记正在处理
    e.target.dataset.processing = 'true';
    
    const file = e.target.files[0];
    if (!file) {
        e.target.dataset.processing = 'false';
        return;
    }
    
    console.log(`[Excel导入] 开始导入文件: ${file.name}, 大小: ${(file.size/1024).toFixed(2)}KB`);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        console.log('[Excel导入] 文件读取完成，开始解析Excel');
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 获取第一个工作表
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            console.log(`[Excel导入] 解析工作表: ${workbook.SheetNames[0]}`);
            
            // 转换为JSON
            let rawData = XLSX.utils.sheet_to_json(firstSheet);
            console.log(`[Excel导入] Excel转换完成，共${rawData.length}行数据`);
            
            // 检查并处理数据格式
            if (rawData.length > 0) {
                // 检查是否是新的模板格式（含有"教材类型","年级","上下册","单元","单词","中文翻译"字段）
                if (rawData[0].hasOwnProperty('教材类型') && 
                    rawData[0].hasOwnProperty('年级') && 
                    rawData[0].hasOwnProperty('上下册') && 
                    rawData[0].hasOwnProperty('单元') && 
                    rawData[0].hasOwnProperty('单词') && 
                    rawData[0].hasOwnProperty('中文翻译')) {
                    
                    console.log('[Excel导入] 检测到新模板格式');
                    
                    // 过滤掉空行或必要列不完整的行
                    const validData = rawData.filter(item => {
                        return item.单词 && item.中文翻译 && 
                               typeof item.单词 === 'string' && typeof item.中文翻译 === 'string' &&
                               item.单词.trim() !== '' && item.中文翻译.trim() !== '';
                    });
                    
                    if (validData.length === 0) {
                        console.warn('[Excel导入] 导入失败：未找到有效单词数据');
                        showCustomAlert('导入失败，没有找到有效的单词数据。请确保至少有一行包含完整的单词和翻译。', 5000);
                        return;
                    }
                    
                    console.log(`[Excel导入] 筛选后有效数据${validData.length}行`);
                    
                    // 转换格式为数据库需要的格式
                    const formattedData = validData.map(item => ({
                        textbook_type: item.教材类型,
                        grade: item.年级,
                        volume: item.上下册,
                        unit: item.单元,
                        word: item.单词,
                        translation: item.中文翻译
                    }));
                    
                    // 显示跳过的行数
                    const skippedCount = rawData.length - validData.length;
                    if (skippedCount > 0) {
                        console.log(`[Excel导入] 已跳过${skippedCount}行无效数据`);
                    }
                    
                    // 使用有效数据继续处理
                    handleImportComplete(formattedData, skippedCount);
                    
                    console.log(`[Excel导入] 成功完成导入：${formattedData.length}个单词`);
                }
                // 兼容旧格式（含有"word"和"translation"字段）
                else if (rawData[0].hasOwnProperty('word') && rawData[0].hasOwnProperty('translation')) {
                    console.log('[Excel导入] 检测到旧模板格式');
                    
                    // 过滤掉空行或列不完整的行
                    const validData = rawData.filter(item => {
                        return item.word && item.translation && 
                               typeof item.word === 'string' && typeof item.translation === 'string' &&
                               item.word.trim() !== '' && item.translation.trim() !== '';
                    });
                    
                    if (validData.length === 0) {
                        console.warn('[Excel导入] 导入失败：未找到有效单词数据');
                        showCustomAlert('导入失败，没有找到有效的单词数据。请确保至少有一行包含完整的单词和翻译。', 5000);
                        return;
                    }
                    
                    console.log(`[Excel导入] 筛选后有效数据${validData.length}行`);
                    
                    // 显示跳过的行数
                    const skippedCount = rawData.length - validData.length;
                    if (skippedCount > 0) {
                        console.log(`[Excel导入] 已跳过${skippedCount}行无效数据`);
                    }
                    
                    // 使用有效数据继续处理，但需要添加默认值
                    const formattedData = validData.map(item => ({
                        textbook_type: 1, // 默认值
                        grade: '未知', // 默认值
                        volume: '未知', // 默认值
                        unit: '未知', // 默认值
                        word: item.word,
                        translation: item.translation
                    }));
                    
                    handleImportComplete(formattedData, skippedCount);
                    
                    console.log(`[Excel导入] 成功完成导入：${formattedData.length}个单词`);
                }
                else {
                    console.error('[Excel导入] 导入失败：文件格式不正确', rawData[0]);
                    showCustomAlert('导入失败，文件格式不正确。请使用下载的模板或确保Excel文件包含正确的列。', 5000);
                }
            } else {
                console.warn('[Excel导入] 导入失败：文件中没有数据');
                showCustomAlert('导入失败，文件中没有数据。', 3000);
            }
        } catch (error) {
            console.error('[Excel导入] 解析错误:', error);
            showCustomAlert('导入失败，Excel文件解析错误。', 3000);
            e.target.dataset.processing = 'false'; // 重置处理状态
        }
    };
    
    // 添加错误处理
    reader.onerror = function(error) {
        console.error('[Excel导入] 文件读取错误:', error);
        showCustomAlert('导入失败，文件读取错误。', 3000);
        e.target.dataset.processing = 'false'; // 重置处理状态
    };
    
    reader.readAsArrayBuffer(file);
    
    // 重置文件输入
    e.target.value = '';
    
    // 添加全局错误处理，确保处理状态被重置
    setTimeout(() => {
        e.target.dataset.processing = 'false';
        console.log('[Excel导入] 重置处理状态');
    }, 2000); // 设置一个合理的超时时间，确保其他异步操作完成
}

/**
 * 下载导入模板
 */
function downloadImportTemplate() {
    console.log('[模板下载] 开始生成模板文件');
    
    try {
        // 创建一个简单的Excel模板
        const template = [
            { word: 'apple', translation: '苹果', unit: '1' },
            { word: 'banana', translation: '香蕉', unit: '1' }
        ];
        
        // 使用XLSX.js创建Excel工作表
        const worksheet = XLSX.utils.json_to_sheet(template);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "单词模板");
        
        // 生成带时间戳的文件名，确保每次下载的文件名不同
        const timestamp = new Date().getTime();
        const fileName = `单词导入模板_${timestamp}.xlsx`;
        
        // 使用XLSX.js生成并下载文件
        XLSX.writeFile(workbook, fileName);
        
        console.log('[模板下载] 模板文件生成完成:', fileName);
    } catch (error) {
        console.error('[模板下载] 生成模板文件失败:', error);
        showCustomAlert('下载模板失败，请稍后重试。', 3000);
    }
}

/**
 * 使用TTS朗读单词（美式发音）
 * @param {string} word - 要朗读的单词
 */
function speakWord(word) {
    // 使用浏览器内置TTS
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US'; // 美式英语
    utterance.rate = 0.9; // 稍微放慢语速以便清晰听到
    
    // 尝试设置为女声（在大多数浏览器中效果更好）
    const voices = speechSynthesis.getVoices();
    const usVoices = voices.filter(voice => voice.lang.includes('en-US'));
    
    // 优先使用美式女声
    const femaleVoice = usVoices.find(voice => voice.name.includes('female') || voice.name.includes('Female'));
    if (femaleVoice) {
        utterance.voice = femaleVoice;
    } else if (usVoices.length > 0) {
        // 否则使用任何可用的美式语音
        utterance.voice = usVoices[0];
    }
    
    speechSynthesis.speak(utterance);
}

/**
 * 处理单词TTS朗读
 * @param {Event} e - 双击事件
 */
function handleWordTTS(e) {
    const card = e.target.closest('.card');
    if (!card) return;
    
    const word = card.dataset.word;
    speakWord(word);
}

/**
 * 处理单词卡片单击事件
 * @param {Event} e - 点击事件
 */
function handleWordClick(e) {
    if (!gameData.gameActive) return;
    
    const card = e.target.closest('.card');
    if (!card) return;
    
    // 如果该卡片已匹配，不执行操作
    if (card.classList.contains('matched')) return;
    
    // 仅在真实用户点击时朗读单词（isTrusted标识用户触发的事件）
    if (e.isTrusted) {
        const word = card.dataset.word;
        
        // 初始化单词点击计数
        if (!gameData.wordClickCount[word]) {
            gameData.wordClickCount[word] = 0;
        }
        
        // 只朗读2遍
        if (gameData.wordClickCount[word] < 2) {
            speakWord(word);
            gameData.wordClickCount[word]++;
        }
    }
}

/**
 * 更新错误记录面板
 */
function updateErrorRecordsPanel() {
    // 确保错误记录面板存在
    if (!elements.errorRecordsList || !elements.errorRecordsPanel) {
        updateErrorRecordsPanelReferences();
        if (!elements.errorRecordsList || !elements.errorRecordsPanel) return;
    }
    
    // 清空当前内容
    elements.errorRecordsList.innerHTML = '';
    
    // 按错误次数排序
    const sortedRecords = [...gameData.errorRecords].sort((a, b) => b.count - a.count);
    
    // 如果有错误记录，显示面板
    if (sortedRecords.length > 0) {
        elements.errorRecordsPanel.style.display = 'block';
        
        // 显示错误记录
        sortedRecords.forEach(record => {
            const recordItem = document.createElement('div');
            recordItem.className = 'error-record-item';
            recordItem.innerHTML = `
                <span class="error-word">${record.word}</span>
                <span class="error-translation">${record.translation}</span>
                <span class="error-count">${record.count}次</span>
            `;
            
            // 添加点击朗读功能
            recordItem.addEventListener('click', () => {
                speakWord(record.word);
            });
            
            elements.errorRecordsList.appendChild(recordItem);
        });
    } else {
        // 如果没有错误记录，隐藏面板
        elements.errorRecordsPanel.style.display = 'none';
    }
}

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化游戏
    gameData.wordPairs = [...defaultWordPairs];
    console.log('使用默认词库初始化游戏');
    initGame();
    
    // 初始化事件监听器
    initEventListeners();
});

/**
 * 显示自定义提示框
 * @param {string} message - 提示信息
 * @param {number} [duration] - 自动关闭时间(毫秒)，如果提供则自动关闭
 * @param {Function} [callback] - 关闭后的回调函数
 */
function showCustomAlert(message, duration, callback) {
    // 检查是否已有提示框
    let alertBox = document.getElementById('custom-alert-box');
    
    if (!alertBox) {
        // 创建提示框容器
        alertBox = document.createElement('div');
        alertBox.id = 'custom-alert-box';
        alertBox.className = 'custom-alert-box';
        
        // 创建提示框内容
        const alertContent = document.createElement('div');
        alertContent.className = 'custom-alert-content';
        
        // 提示框文本
        const alertMessage = document.createElement('p');
        alertMessage.className = 'custom-alert-message';
        alertContent.appendChild(alertMessage);
        
        // 确认按钮
        const confirmButton = document.createElement('button');
        confirmButton.className = 'custom-alert-button';
        confirmButton.textContent = '确定';
        alertContent.appendChild(confirmButton);
        
        // 组合提示框
        alertBox.appendChild(alertContent);
        document.body.appendChild(alertBox);
        
        // 点击确认按钮关闭提示框
        confirmButton.addEventListener('click', function() {
            closeAlert();
        });
    }
    
    // 设置提示信息
    const messageElement = alertBox.querySelector('.custom-alert-message');
    messageElement.textContent = message;
    
    // 显示提示框
    alertBox.style.display = 'flex';
    setTimeout(() => {
        alertBox.classList.add('show');
    }, 10);
    
    // 如果提供了持续时间，自动关闭
    if (duration && duration > 0) {
        setTimeout(closeAlert, duration);
    }
    
    // 关闭提示框的函数
    function closeAlert() {
        alertBox.classList.remove('show');
        setTimeout(() => {
            alertBox.style.display = 'none';
            if (callback) callback();
        }, 300);
    }
}

/**
 * 生成随机8位字符串ID
 * @returns {string} 8位随机ID
 */
function generateRandomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/**
 * 处理完成导入时的操作
 * @param {Array} wordPairs 导入的单词对
 * @param {number} [skippedCount] 跳过的行数
 */
function handleImportComplete(wordPairs, skippedCount = 0) {
    if (!wordPairs || wordPairs.length === 0) {
        console.warn('[导入处理] 未导入任何单词');
        showCustomAlert('未导入任何单词！', 3000);
        return;
    }
    
    console.log(`[导入处理] 开始处理${wordPairs.length}个单词的保存流程`);
    
    // 显示导入信息，包括跳过的行数（如果有）
    if (skippedCount > 0) {
        showCustomAlert(`数据导入成功`, 3000);
    }
    
    // 按年级分组单词
    const wordsByGrade = {};
    
    // 收集所有单词的年级
    wordPairs.forEach(word => {
        // 确保年级是字符串并且非空
        const grade = (word.grade || '').toString().trim();
        if (!grade) {
            console.warn('[导入处理] 发现没有年级信息的单词:', word.word);
            return;
        }
        
        // 首次出现该年级时初始化数组
        if (!wordsByGrade[grade]) {
            wordsByGrade[grade] = [];
        }
        
        // 添加单词到对应年级分组
        wordsByGrade[grade].push(word);
    });
    
    // 获取所有年级
    const grades = Object.keys(wordsByGrade);
    
    if (grades.length === 0) {
        console.warn('[导入处理] 所有单词都没有年级信息');
        showCustomAlert('导入失败，所有单词都缺少年级信息。', 3000);
        return;
    }
    
    console.log(`[导入处理] 共有${grades.length}个不同年级的单词需要保存`);
    
    console.log('[导入处理] 现在使用单词本系统，不再需要年级处理');
    showCustomAlert('请使用单词本功能管理单词', 3000);
}

// 使用saveToLocalStorage仍保留但不再是主要存储方式
function saveToLocalStorage(wordPairs) {
    localStorage.setItem(STORAGE_KEYS.WORD_LIBRARIES, JSON.stringify(wordPairs));
}

// 从本地存储加载函数仍保留但不再是主要加载方式
function loadFromLocalStorage() {
    const savedData = localStorage.getItem(STORAGE_KEYS.WORD_LIBRARIES);
    return savedData ? JSON.parse(savedData) : null;
}

/**
 * 使用指定单词列表初始化游戏
 * @param {Array} wordPairs 单词和翻译对
 * @param {string} difficulty 游戏难度
 */
function startGameWithWords(wordPairs, difficulty) {
    // 设置游戏难度
    gameData.difficulty = difficulty || 'medium';
    document.getElementById('difficulty').value = gameData.difficulty;
    
    // 保存单词对
    gameData.wordPairs = [...wordPairs];
    
    // 根据当前选择获取单词数量
    const wordCountSelect = document.getElementById('word-count');
    if (wordCountSelect) {
        gameData.wordCount = parseInt(wordCountSelect.value) || 10;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 清空容器
    elements.wordsContainer.innerHTML = '';
    elements.translationsContainer.innerHTML = '';
    
    // 创建卡片
    createCards();
    
    // 开始游戏计时
    startGame();
}

/**
 * 从登录状态获取用户信息
 * @returns {Object|null} 用户信息对象，未登录时返回null
 */
function getCurrentUser() {
    try {
        const userString = localStorage.getItem('user');
        if (!userString) return null;
        
        const user = JSON.parse(userString);
        // 检查用户数据有效性
        if (!user || !user.id) return null;
        
        return user;
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return null;
    }
}

/**
 * 获取认证Token
 * @returns {string|null} JWT令牌，未登录时返回null
 */
function getAuthToken() {
    return localStorage.getItem('token');
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
function isUserLoggedIn() {
    return !!getAuthToken() && !!getCurrentUser();
}

/**
 * 退出登录
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

/**
 * 重定向到适当的页面
 * 根据登录状态重定向到首页或仪表盘
 */
function redirectToAppropriateScreen() {
    const isLoggedIn = isUserLoggedIn();
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (isLoggedIn) {
        // 已登录，但在登录/注册页面或首页，跳转到仪表盘
        if (['index.html', 'login.html', 'register.html', ''].includes(currentPage)) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // 未登录，但访问需要登录的页面，跳转到登录页
        if (currentPage === 'dashboard.html') {
            window.location.href = 'login.html';
        }
    }
}

// 添加登录状态检查
document.addEventListener('DOMContentLoaded', function() {
    // 自动重定向到适当的页面
    redirectToAppropriateScreen();
    
    // 在页面加载时执行登出功能绑定
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});

// 导出游戏初始化函数到全局作用域
window.startGameWithWords = startGameWithWords;
window.startGame = startGame;