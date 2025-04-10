/**
 * 测试文件 - 模拟大量数据的Excel导入
 */
const fetch = require('node-fetch');

// 生成大量测试数据
function generateTestWords(count) {
    const words = [];
    const grades = ['three', 'four', 'five', 'six'];
    const volumes = ['上册', '下册'];
    const units = ['单元1', '单元2', '单元3', '单元4', '单元5'];
    
    // 英语单词示例和翻译
    const sampleWords = [
        { word: 'apple', translation: '苹果' },
        { word: 'banana', translation: '香蕉' },
        { word: 'orange', translation: '橙子' },
        { word: 'computer', translation: '电脑' },
        { word: 'book', translation: '书' },
        { word: 'pencil', translation: '铅笔' },
        { word: 'chair', translation: '椅子' },
        { word: 'desk', translation: '桌子' },
        { word: 'window', translation: '窗户' },
        { word: 'door', translation: '门' },
    ];
    
    for (let i = 0; i < count; i++) {
        // 选择一个基础单词
        const baseWord = sampleWords[i % sampleWords.length];
        
        // 创建单词记录
        words.push({
            textbook_type: 1,
            grade: grades[Math.floor(Math.random() * grades.length)],
            volume: volumes[Math.floor(Math.random() * volumes.length)],
            unit: units[Math.floor(Math.random() * units.length)],
            word: `${baseWord.word}_${i + 1}`,
            translation: `${baseWord.translation}_${i + 1}`
        });
    }
    
    return words;
}

// 模拟前端saveWordsToDB函数
async function saveWordsToDB(wordPairs, gradeId) {
    console.log(`[测试] 开始存储${wordPairs.length}个单词到年级ID: ${gradeId}`);
    
    // 检查单词数据的有效性
    if (!Array.isArray(wordPairs) || wordPairs.length === 0) {
        console.error('[测试] 单词数据无效:', wordPairs);
        throw new Error('单词数据无效');
    }
    
    // 确保单词对象格式正确
    const validWordPairs = wordPairs.filter(pair => 
        pair && typeof pair === 'object' && pair.word && pair.translation);
        
    if (validWordPairs.length === 0) {
        console.error('[测试] 没有有效的单词数据');
        throw new Error('没有有效的单词数据');
    }
    
    if (validWordPairs.length < wordPairs.length) {
        console.warn(`[测试] 过滤掉了 ${wordPairs.length - validWordPairs.length} 个无效单词`);
    }
    
    // 构建请求数据
    const requestData = {
        gradeId: gradeId,
        words: validWordPairs
    };
    
    console.log(`[测试] 准备发送请求，单词数量: ${validWordPairs.length}`);
    
    try {
        // 发送请求到后端API
        const response = await fetch('http://localhost:3000/api/words', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        console.log(`[测试] 收到响应状态: ${response.status} ${response.statusText}`);
        
        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            
            if (!response.ok) {
                console.error('[测试] 错误详情:', data);
                throw new Error(data.error || '保存失败');
            }
            
            console.log(`[测试] 成功保存${validWordPairs.length}个单词到年级ID: ${gradeId}`);
            return true;
        } catch (parseError) {
            console.error('[测试] 解析响应JSON失败:', parseError);
            console.log('[测试] 原始响应:', responseText);
            throw new Error('解析响应失败');
        }
    } catch (error) {
        console.error('[测试] 请求失败:', error);
        throw error;
    }
}

// 执行测试
async function runTest() {
    try {
        console.log('[测试] 开始测试大量单词导入流程');
        
        // 生成1200个测试单词
        const testWords = generateTestWords(1200);
        console.log(`[测试] 已生成 ${testWords.length} 个测试单词`);
        
        // 使用预设的年级ID 'five'
        const result = await saveWordsToDB(testWords, 'five');
        console.log('[测试] 测试结果:', result ? '成功' : '失败');
        
        // 查询数据库验证结果
        console.log('[测试] 请在MySQL中运行以下命令验证结果:');
        console.log('USE word_pop; SELECT COUNT(*) FROM words WHERE grade="five";');
    } catch (error) {
        console.error('[测试] 测试过程中发生错误:', error);
    }
}

// 运行测试
runTest(); 