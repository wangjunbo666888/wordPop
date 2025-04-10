/**
 * 英语单词匹配游戏后端服务器
 * 提供MySQL数据库连接和API接口
 */

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456mysql@',
  database: 'word_pop'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 中间件配置
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// 测试数据库连接
pool.getConnection((err, connection) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功!');
  connection.release();
});

/**
 * 获取所有年级列表
 * GET /api/grades
 */
app.get('/api/grades', (req, res) => {
  pool.query('SELECT * FROM grades', (err, results) => {
    if (err) {
      console.error('获取年级数据失败:', err);
      return res.status(500).json({ error: '获取年级数据失败' });
    }
    res.json(results);
  });
});

/**
 * 获取指定年级的单词列表
 * GET /api/words?gradeId=xxx
 */
app.get('/api/words', (req, res) => {
  const gradeId = req.query.gradeId;
  
  if (!gradeId) {
    return res.status(400).json({ error: '缺少年级ID参数' });
  }
  
  pool.query(
    'SELECT id, word, translation, unit, textbook_type, volume FROM words WHERE grade = ?',
    [gradeId],
    (err, results) => {
      if (err) {
        console.error('获取单词数据失败:', err);
        return res.status(500).json({ error: '获取单词数据失败' });
      }
      
      // 转换为前端需要的格式
      const wordPairs = results.map(row => ({
        word: row.word,
        translation: row.translation,
        unit: row.unit,
        textbook_type: row.textbook_type,
        volume: row.volume
      }));
      
      res.json(wordPairs);
    }
  );
});

/**
 * 添加新年级
 * POST /api/grades
 * 请求体: { id: 'xxx', name: '年级名称' }
 */
app.post('/api/grades', (req, res) => {
  const { id, name } = req.body;
  
  if (!id || !name) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  pool.query(
    'INSERT INTO grades (id, name) VALUES (?, ?)',
    [id, name],
    (err, result) => {
      if (err) {
        console.error('添加年级失败:', err);
        return res.status(500).json({ error: '添加年级失败' });
      }
      
      res.status(201).json({ id, name });
    }
  );
});

/**
 * 保存单词到指定年级
 * POST /api/words
 * 请求体: { gradeId: 'xxx', words: [{ textbook_type: '类型', grade: '年级', volume: '上下册', unit: '单元', word: '单词', translation: '翻译' }, ...] }
 */
app.post('/api/words', (req, res) => {
  console.log('收到保存单词请求:', { gradeId: req.body.gradeId, wordCount: req.body.words?.length });
  console.log('请求体的内容类型:', req.headers['content-type']);
  console.log('请求体原始内容:', JSON.stringify(req.body).substring(0, 300) + '...');
  
  const { gradeId, words } = req.body;
  
  if (!gradeId || !words || !Array.isArray(words)) {
    console.error('请求参数错误:', { 
      gradeId, 
      words: words ? (Array.isArray(words) ? words.length : typeof words) : null,
      body: JSON.stringify(req.body).substring(0, 200) + '...'
    });
    return res.status(400).json({ error: '缺少必要参数或格式不正确' });
  }
  
  console.log(`准备保存 ${words.length} 个单词到年级 ${gradeId}`);
  console.log('第一个单词样例:', JSON.stringify(words[0]));
  
  // 检查单词数组中是否有无效数据
  const invalidWords = words.filter(word => !word.word || !word.translation);
  if (invalidWords.length > 0) {
    console.error(`发现 ${invalidWords.length} 个无效单词`, invalidWords.slice(0, 3));
    return res.status(400).json({ error: '单词数据无效，必须包含word和translation字段' });
  }
  
  // 使用事务确保数据完整性
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('获取数据库连接失败:', err);
      return res.status(500).json({ error: '数据库连接失败', details: err.message });
    }
    
    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        console.error('开始事务失败:', err);
        return res.status(500).json({ error: '保存失败', details: err.message });
      }
      
      // 生成批量插入的值
      const values = words.map(pair => {
        // 为每个单词生成随机ID
        const id = generateRandomId();
        return [
          id, 
          gradeId, 
          pair.word, 
          pair.translation, 
          pair.unit || '', 
          pair.textbook_type || 1,
          pair.volume || ''
        ];
      });
      
      console.log(`格式化后准备插入 ${values.length} 条数据`);
      console.log('SQL参数样例:', values[0]);
      
      // 检查批量插入参数是否正确
      if (!Array.isArray(values) || values.length === 0) {
        connection.release();
        console.error('批量插入参数格式错误:', values);
        return res.status(500).json({ error: '数据格式错误，无法执行批量插入' });
      }
      
      // 批量插入
      connection.query(
        'INSERT INTO words (id, grade, word, translation, unit, textbook_type, volume) VALUES ?',
        [values],
        (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('插入单词失败:', err);
              console.error('SQL错误详情:', {
                code: err.code,
                errno: err.errno,
                sqlState: err.sqlState,
                sqlMessage: err.sqlMessage
              });
              console.error('SQL参数样例:', values.slice(0, 2));
              res.status(500).json({ error: '保存单词失败', details: err.message });
            });
          }
          
          console.log('插入结果:', {
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            changedRows: result.changedRows,
            info: result.info
          });
          
          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('提交事务失败:', err);
                res.status(500).json({ error: '保存单词失败', details: err.message });
              });
            }
            
            connection.release();
            console.log(`成功保存 ${words.length} 个单词到年级 ${gradeId}`);
            res.status(201).json({ 
              message: '保存成功', 
              count: words.length 
            });
          });
        }
      );
    });
  });
});

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

// 启动服务器
app.listen(port, () => {
  console.log(`服务器已启动，监听端口 ${port}`);
});
