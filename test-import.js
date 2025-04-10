/**
 * 测试文件 - 模拟前端导入Excel并保存单词到数据库
 */
const fetch = require('node-fetch');

// 模拟Excel导入的数据
const mockExcelData = [
    {
        textbook_type: 1,
        grade: '五年级',
        volume: '上册',
        unit: '单元1',
        word: 'hello',
        translation: '你好'
    },
    {
        textbook_type: 1,
        grade: '五年级',
        volume: '上册',
        unit: '单元1',
        word: 'world',
        translation: '世界'
    },
    {
        textbook_type: 1,
        grade: '五年级',
        volume: '上册',
        unit: '单元1',
        word: 'computer',
        translation: '电脑'
    },
    {
        textbook_type: 1,
        grade: '五年级',
        volume: '上册',
        unit: '单元1',
        word: 'book',
        translation: '书'
    },
    {
        textbook_type: 1,
        grade: '五年级',
        volume: '上册',
        unit: '单元1',
        word: 'pencil',
        translation: '铅笔'
    }
];

// 模拟前端saveWordsToDB函数
async function saveWordsToDB(wordPairs, gradeId) {
    console.log(`[测试] 开始存储${wordPairs.length}个单词到年级ID: ${gradeId}`);
    console.log('[测试] 单词数据示例:', JSON.stringify(wordPairs.slice(0, 2)));
    
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
    console.log('[测试] 请求体:', JSON.stringify(requestData));
    
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
            console.log('[测试] 响应数据:', data);
            
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
        console.log('[测试] 开始测试导入单词流程');
        // 使用预设的年级ID 'five'
        const result = await saveWordsToDB(mockExcelData, 'five');
        console.log('[测试] 测试结果:', result ? '成功' : '失败');
    } catch (error) {
        console.error('[测试] 测试过程中发生错误:', error);
    }
}

// 运行测试
runTest(); 