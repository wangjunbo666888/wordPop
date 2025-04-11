/**
 * 英语单词匹配游戏后端服务器
 * 提供MySQL数据库连接和API接口
 */

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// JWT密钥
const JWT_SECRET = 'english-game-secret-key-please-change-in-production';

/**
 * 日志记录工具
 * @param {string} category - 日志类别
 * @param {string} message - 日志消息
 * @param {object} [data] - 额外数据，会被JSON序列化
 */
function logInfo(category, message, data) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category}] ${message}`);
  if (data) {
    // 敏感数据处理：隐藏密码和令牌
    if (data.password) {
      data.password = '******';
    }
    if (data.token) {
      data.token = data.token.substring(0, 10) + '...';
    }
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * 错误日志记录工具
 * @param {string} category - 日志类别
 * @param {string} message - 错误消息
 * @param {Error|object} [error] - 错误对象或额外数据
 */
function logError(category, message, error) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${category}] ERROR: ${message}`);
  if (error) {
    if (error instanceof Error) {
      console.error(`Stack: ${error.stack}`);
    } else {
      console.error(JSON.stringify(error, null, 2));
    }
  }
}

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
    logError('DATABASE', '数据库连接失败', err);
    return;
  }
  logInfo('DATABASE', '数据库连接成功!');
  connection.release();
});

/**
 * 获取指定年级的单词列表
 * GET /api/words?gradeId=xxx
 */
app.get('/api/words', (req, res) => {
  const gradeId = req.query.gradeId;
  logInfo('API', '请求获取单词列表', { gradeId });
  
  if (!gradeId) {
    logError('API', '缺少年级ID参数');
    return res.status(400).json({ error: '缺少年级ID参数' });
  }
  
  pool.query(
    'SELECT id, word, translation, unit, textbook_type, volume FROM words WHERE grade = ?',
    [gradeId],
    (err, results) => {
      if (err) {
        logError('DATABASE', '获取单词数据失败', err);
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
      
      logInfo('DATABASE', `成功获取年级${gradeId}的单词列表，共${results.length}条记录`, {
        sampleWords: results.slice(0, 3)
      });
      
      res.json(wordPairs);
    }
  );
});

/**
 * 保存单词到指定年级
 * POST /api/words
 * 请求体: { gradeId: 'xxx', words: [{ textbook_type: '类型', grade: '年级', volume: '上下册', unit: '单元', word: '单词', translation: '翻译' }, ...] }
 */
app.post('/api/words', (req, res) => {
  const { gradeId, words } = req.body;
  
  logInfo('API', '请求保存单词到年级', { 
    gradeId, 
    wordCount: words?.length, 
    contentType: req.headers['content-type'],
    requestBody: req.body ? `${JSON.stringify(req.body).substring(0, 200)}...` : 'empty'
  });
  
  if (!gradeId || !words || !Array.isArray(words)) {
    logError('API', '请求参数错误', { 
      gradeId, 
      wordsType: words ? (Array.isArray(words) ? `Array(${words.length})` : typeof words) : 'undefined'
    });
    return res.status(400).json({ error: '缺少必要参数或格式不正确' });
  }
  
  logInfo('DATABASE', `准备保存${words.length}个单词到年级${gradeId}`, {
    firstWordSample: words.length > 0 ? words[0] : null
  });
  
  // 检查单词数组中是否有无效数据
  const invalidWords = words.filter(word => !word.word || !word.translation);
  if (invalidWords.length > 0) {
    logError('API', `发现${invalidWords.length}个无效单词`, {
      invalidSamples: invalidWords.slice(0, 3)
    });
    return res.status(400).json({ error: '单词数据无效，必须包含word和translation字段' });
  }
  
  // 使用事务确保数据完整性
  pool.getConnection((err, connection) => {
    if (err) {
      logError('DATABASE', '获取数据库连接失败', err);
      return res.status(500).json({ error: '数据库连接失败', details: err.message });
    }
    
    logInfo('DATABASE', '成功获取数据库连接，开始事务');
    
    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        logError('DATABASE', '开始事务失败', err);
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
      
      logInfo('DATABASE', `准备批量插入${values.length}条单词数据`, {
        sampleValues: values.slice(0, 2)
      });
      
      // 检查批量插入参数是否正确
      if (!Array.isArray(values) || values.length === 0) {
        connection.release();
        logError('DATABASE', '批量插入参数格式错误', {
          values: values ? `Type: ${typeof values}, IsArray: ${Array.isArray(values)}, Length: ${Array.isArray(values) ? values.length : 'N/A'}` : 'undefined'
        });
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
              logError('DATABASE', '插入单词失败', {
                error: {
                  code: err.code,
                  errno: err.errno,
                  sqlState: err.sqlState,
                  sqlMessage: err.sqlMessage
                },
                sampleValues: values.slice(0, 2)
              });
              res.status(500).json({ error: '保存单词失败', details: err.message });
            });
          }
          
          logInfo('DATABASE', '单词插入成功', {
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            changedRows: result.changedRows,
            info: result.info
          });
          
          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                logError('DATABASE', '提交事务失败', err);
                res.status(500).json({ error: '保存单词失败', details: err.message });
              });
            }
            
            connection.release();
            logInfo('API', `成功保存${words.length}个单词到年级${gradeId}`);
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

/**
 * 验证JWT中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // 记录请求信息但不记录完整token
  const requestInfo = {
    path: req.path,
    method: req.method,
    hasToken: !!token,
    ip: req.ip || req.connection.remoteAddress
  };
  
  if (token == null) {
    logError('AUTH', '用户未提供Token', requestInfo);
    return res.status(401).json({ error: '未登录或Token已过期' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // 详细记录验证错误，但不暴露敏感信息
      logError('AUTH', 'Token验证失败', {
        ...requestInfo,
        errorName: err.name,
        errorMessage: err.message,
        tokenFirstChars: token.substring(0, 10) + '...'
      });
      return res.status(403).json({ error: 'Token无效' });
    }
    
    logInfo('AUTH', '用户验证成功', {
      userId: user.id,
      nickname: user.nickname,
      path: req.path
    });
    
    req.user = user;
    next();
  });
}

/**
 * 用户注册API
 * POST /api/users/register
 * 请求体: { nickname: '昵称', grade: '年级', textbook_type: '教材版本', phone: '手机号', password: '密码' }
 */
app.post('/api/users/register', async (req, res) => {
  const { nickname, grade, textbook_type, phone, password } = req.body;
  
  logInfo('API', '用户注册请求', { 
    nickname, 
    grade, 
    textbook_type,
    phone: phone ? `${phone.substring(0, 3)}****${phone.substring(7)}` : null,
    passwordLength: password ? password.length : 0
  });
  
  // 验证必要参数
  if (!nickname || !grade || !phone || !password) {
    logError('API', '用户注册参数不完整', { 
      hasNickname: !!nickname, 
      hasGrade: !!grade, 
      hasPhone: !!phone, 
      hasPassword: !!password 
    });
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  // 使用默认教材版本(如果未提供)
  const bookType = textbook_type || '人教版';
  
  try {
    // 检查手机号是否已存在
    pool.query(
      'SELECT * FROM users WHERE phone = ?',
      [phone],
      async (err, results) => {
        if (err) {
          logError('DATABASE', '查询用户失败', err);
          return res.status(500).json({ error: '注册失败', details: err.message });
        }
        
        if (results.length > 0) {
          logInfo('API', '注册失败：手机号已存在', { 
            phone: `${phone.substring(0, 3)}****${phone.substring(7)}`
          });
          return res.status(409).json({ error: '手机号已注册' });
        }
        
        // 生成密码哈希
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 生成用户ID
        const userId = generateRandomId();
        
        logInfo('DATABASE', '准备创建新用户', { 
          userId,
          nickname,
          grade,
          textbook_type: bookType,
          phone: `${phone.substring(0, 3)}****${phone.substring(7)}`
        });
        
        // 插入新用户
        pool.query(
          'INSERT INTO users (id, nickname, grade, textbook_type, phone, password) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, nickname, grade, bookType, phone, hashedPassword],
          (err, result) => {
            if (err) {
              logError('DATABASE', '创建用户失败', err);
              return res.status(500).json({ error: '注册失败', details: err.message });
            }
            
            logInfo('DATABASE', '用户创建成功', { 
              userId,
              affectedRows: result.affectedRows
            });
            
            // 生成JWT令牌
            const token = jwt.sign({ id: userId, nickname, grade, textbook_type: bookType }, JWT_SECRET, { expiresIn: '24h' });
            
            res.status(201).json({
              message: '注册成功',
              user: { id: userId, nickname, grade, textbook_type: bookType, phone },
              token
            });
          }
        );
      }
    );
  } catch (error) {
    logError('API', '注册过程出错', error);
    res.status(500).json({ error: '注册失败', details: error.message });
  }
});

/**
 * 用户登录API
 * POST /api/users/login
 * 请求体: { phone: '手机号', password: '密码' }
 */
app.post('/api/users/login', (req, res) => {
  const { phone, password } = req.body;
  
  logInfo('API', '用户登录请求', {
    phone: phone ? `${phone.substring(0, 3)}****${phone.substring(7)}` : null,
    hasPassword: !!password
  });
  
  // 验证必要参数
  if (!phone || !password) {
    logError('API', '登录参数不完整', {
      hasPhone: !!phone,
      hasPassword: !!password
    });
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  // 查询用户
  pool.query(
    'SELECT * FROM users WHERE phone = ?',
    [phone],
    async (err, results) => {
      if (err) {
        logError('DATABASE', '查询用户失败', err);
        return res.status(500).json({ error: '登录失败', details: err.message });
      }
      
      if (results.length === 0) {
        logInfo('API', '登录失败：用户不存在', {
          phone: `${phone.substring(0, 3)}****${phone.substring(7)}`
        });
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = results[0];
      logInfo('DATABASE', '找到用户', {
        userId: user.id,
        nickname: user.nickname,
        grade: user.grade,
        textbook_type: user.textbook_type
      });
      
      // 验证密码
      try {
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
          logInfo('API', '登录失败：密码错误', {
            userId: user.id
          });
          return res.status(401).json({ error: '密码错误' });
        }
        
        // 更新最后登录时间
        pool.query(
          'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id],
          (err, updateResult) => {
            if (err) {
              logError('DATABASE', '更新最后登录时间失败', err);
              // 继续处理，不返回错误
            } else {
              logInfo('DATABASE', '更新最后登录时间成功', {
                userId: user.id,
                affectedRows: updateResult.affectedRows
              });
            }
          }
        );
        
        // 生成JWT令牌，确保包含textbook_type字段
        const token = jwt.sign(
          { 
            id: user.id, 
            nickname: user.nickname, 
            grade: user.grade,
            textbook_type: user.textbook_type  // 添加教材版本信息到令牌
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        logInfo('API', '用户登录成功', {
          userId: user.id,
          nickname: user.nickname,
          grade: user.grade,
          textbook_type: user.textbook_type
        });
        
        res.json({
          message: '登录成功',
          user: {
            id: user.id,
            nickname: user.nickname,
            grade: user.grade,
            textbook_type: user.textbook_type,  // 在返回给前端的信息中也添加教材版本
            phone: user.phone
          },
          token
        });
      } catch (error) {
        logError('API', '密码验证失败', error);
        res.status(500).json({ error: '登录失败', details: error.message });
      }
    }
  );
});

/**
 * 获取当前用户信息
 * GET /api/users/me
 * 需要认证令牌
 */
app.get('/api/users/me', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  pool.query(
    'SELECT id, nickname, grade, phone, created_at, last_login_at FROM users WHERE id = ?',
    [userId],
    (err, results) => {
      if (err) {
        console.error('获取用户信息失败:', err);
        return res.status(500).json({ error: '获取用户信息失败', details: err.message });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      res.json(results[0]);
    }
  );
});

/**
 * 获取用户的单词本列表
 * GET /api/wordbooks
 * 需要认证令牌
 */
app.get('/api/wordbooks', authenticateToken, (req, res) => {
  const userId = req.user.id;
  
  pool.query(
    'SELECT id, name, description, is_default, created_at, updated_at FROM user_wordbooks WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId],
    (err, results) => {
      if (err) {
        console.error('获取单词本列表失败:', err);
        return res.status(500).json({ error: '获取单词本列表失败', details: err.message });
      }
      
      res.json(results);
    }
  );
});

/**
 * 创建新的单词本
 * POST /api/wordbooks
 * 请求体: { name: '单词本名称', description: '描述', is_default: false }
 * 需要认证令牌
 */
app.post('/api/wordbooks', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { name, description, is_default } = req.body;
  
  // 验证必要参数
  if (!name) {
    return res.status(400).json({ error: '单词本名称不能为空' });
  }
  
  // 生成单词本ID
  const wordbookId = generateRandomId();
  
  // 如果设置为默认单词本，先将其他单词本设置为非默认
  const setDefaultQuery = is_default 
    ? 'UPDATE user_wordbooks SET is_default = FALSE WHERE user_id = ?'
    : null;
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('获取数据库连接失败:', err);
      return res.status(500).json({ error: '创建单词本失败', details: err.message });
    }
    
    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        console.error('开始事务失败:', err);
        return res.status(500).json({ error: '创建单词本失败', details: err.message });
      }
      
      // 如果需要设置默认单词本
      if (setDefaultQuery) {
        connection.query(setDefaultQuery, [userId], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('设置默认单词本失败:', err);
              res.status(500).json({ error: '创建单词本失败', details: err.message });
            });
          }
          
          insertWordbook();
        });
      } else {
        insertWordbook();
      }
      
      // 插入新单词本
      function insertWordbook() {
        connection.query(
          'INSERT INTO user_wordbooks (id, user_id, name, description, is_default) VALUES (?, ?, ?, ?, ?)',
          [wordbookId, userId, name, description || '', !!is_default],
          (err, result) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('插入单词本失败:', err);
                res.status(500).json({ error: '创建单词本失败', details: err.message });
              });
            }
            
            connection.commit(err => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('提交事务失败:', err);
                  res.status(500).json({ error: '创建单词本失败', details: err.message });
                });
              }
              
              connection.release();
              res.status(201).json({
                id: wordbookId,
                name,
                description: description || '',
                is_default: !!is_default,
                created_at: new Date(),
                updated_at: new Date()
              });
            });
          }
        );
      }
    });
  });
});

/**
 * 更新单词本信息
 * PUT /api/wordbooks/:id
 * 请求体: { name: '单词本名称', description: '描述', is_default: false }
 * 需要认证令牌
 */
app.put('/api/wordbooks/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const wordbookId = req.params.id;
  const { name, description, is_default } = req.body;
  
  // 验证必要参数
  if (!name) {
    return res.status(400).json({ error: '单词本名称不能为空' });
  }
  
  // 首先检查单词本是否属于该用户
  pool.query(
    'SELECT id FROM user_wordbooks WHERE id = ? AND user_id = ?',
    [wordbookId, userId],
    (err, results) => {
      if (err) {
        console.error('查询单词本失败:', err);
        return res.status(500).json({ error: '更新单词本失败', details: err.message });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: '单词本不存在或无权访问' });
      }
      
      // 如果设置为默认单词本，先将其他单词本设置为非默认
      const setDefaultQuery = is_default 
        ? 'UPDATE user_wordbooks SET is_default = FALSE WHERE user_id = ? AND id != ?'
        : null;
      
      pool.getConnection((err, connection) => {
        if (err) {
          console.error('获取数据库连接失败:', err);
          return res.status(500).json({ error: '更新单词本失败', details: err.message });
        }
        
        connection.beginTransaction(err => {
          if (err) {
            connection.release();
            console.error('开始事务失败:', err);
            return res.status(500).json({ error: '更新单词本失败', details: err.message });
          }
          
          // 如果需要设置默认单词本
          if (setDefaultQuery) {
            connection.query(setDefaultQuery, [userId, wordbookId], (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('设置默认单词本失败:', err);
                  res.status(500).json({ error: '更新单词本失败', details: err.message });
                });
              }
              
              updateWordbook();
            });
          } else {
            updateWordbook();
          }
          
          // 更新单词本
          function updateWordbook() {
            connection.query(
              'UPDATE user_wordbooks SET name = ?, description = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [name, description || '', !!is_default, wordbookId],
              (err, result) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('更新单词本失败:', err);
                    res.status(500).json({ error: '更新单词本失败', details: err.message });
                  });
                }
                
                connection.commit(err => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error('提交事务失败:', err);
                      res.status(500).json({ error: '更新单词本失败', details: err.message });
                    });
                  }
                  
                  connection.release();
                  res.json({
                    id: wordbookId,
                    name,
                    description: description || '',
                    is_default: !!is_default,
                    updated_at: new Date()
                  });
                });
              }
            );
          }
        });
      });
    }
  );
});

/**
 * 删除单词本
 * DELETE /api/wordbooks/:id
 * 需要认证令牌
 */
app.delete('/api/wordbooks/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const wordbookId = req.params.id;
  
  // 检查单词本是否属于该用户
  pool.query(
    'SELECT id, is_default FROM user_wordbooks WHERE id = ? AND user_id = ?',
    [wordbookId, userId],
    (err, results) => {
      if (err) {
        console.error('查询单词本失败:', err);
        return res.status(500).json({ error: '删除单词本失败', details: err.message });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ error: '单词本不存在或无权访问' });
      }
      
      const isDefault = results[0].is_default;
      
      // 不允许删除默认单词本
      if (isDefault) {
        return res.status(400).json({ error: '不能删除默认单词本' });
      }
      
      // 删除单词本(由于外键约束，user_words表中相关记录会自动删除)
      pool.query(
        'DELETE FROM user_wordbooks WHERE id = ?',
        [wordbookId],
        (err, result) => {
          if (err) {
            console.error('删除单词本失败:', err);
            return res.status(500).json({ error: '删除单词本失败', details: err.message });
          }
          
          res.json({ message: '单词本已删除' });
        }
      );
    }
  );
});

/**
 * 修改获取单词的接口，支持根据用户年级自动选择
 */
app.get('/api/words/random', authenticateToken, (req, res) => {
  const { count = 10 } = req.query;
  const { grade } = req.user;
  
  // 从指定年级中随机选择单词
  pool.query(
    'SELECT id, word, translation, unit, textbook_type, volume FROM words WHERE grade = ? ORDER BY RAND() LIMIT ?',
    [grade, parseInt(count)],
    (err, results) => {
      if (err) {
        console.error('获取随机单词失败:', err);
        return res.status(500).json({ error: '获取单词失败', details: err.message });
      }
      
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
 * 获取默认单词列表(无需登录)
 * GET /api/words/default
 */
app.get('/api/words/default', (req, res) => {
  const count = 20; // 固定返回20个单词
  
  // 从所有年级中随机选择单词
  pool.query(
    'SELECT id, word, translation FROM system_words ORDER BY RAND() LIMIT ?',
    [count],
    (err, results) => {
      if (err) {
        console.error('获取默认单词失败:', err);
        return res.status(500).json({ error: '获取单词失败', details: err.message });
      }
      
      const wordPairs = results.map(row => ({
        word: row.word,
        translation: row.translation
      }));
      
      res.json(wordPairs);
    }
  );
});

/**
 * 获取系统单词库(根据用户年级和教材版本)
 * POST /api/words/system
 * 请求体: { limit: 10 }
 * 需要认证令牌
 */
app.post('/api/words/system', authenticateToken, (req, res) => {
  const { limit = 10 } = req.body;
  const { grade, textbook_type } = req.user;
  
  pool.query(
    'SELECT id, word, translation, unit, volume FROM system_words WHERE grade = ? AND textbook_type = ? ORDER BY RAND() LIMIT ?',
    [grade, textbook_type, parseInt(limit)],
    (err, results) => {
      if (err) {
        console.error('获取系统单词失败:', err);
        return res.status(500).json({ error: '获取单词失败', details: err.message });
      }
      
      const wordPairs = results.map(row => ({
        word: row.word,
        translation: row.translation,
        unit: row.unit,
        volume: row.volume
      }));
      logInfo('API', '获取系统单词成功', {
        wordCount: wordPairs.length,
        grade,
        textbook_type
      });
      res.json(wordPairs);
    }
  );
});

/**
 * 获取用户单词本中的单词
 * GET /api/wordbooks/:wordbookId/words
 * 需要认证令牌
 */
app.get('/api/wordbooks/:wordbookId/words', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const wordbookId = req.params.wordbookId;
  
  // 验证单词本所有权
  pool.query(
    'SELECT id FROM user_wordbooks WHERE id = ? AND user_id = ?',
    [wordbookId, userId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(403).json({ error: '无权访问此单词本' });
      }
      
      // 获取单词本中的单词
      pool.query(
        'SELECT id, word, translation, unit, notes, created_at FROM user_words WHERE wordbook_id = ?',
        [wordbookId],
        (err, words) => {
          if (err) {
            console.error('获取单词失败:', err);
            return res.status(500).json({ error: '获取单词失败', details: err.message });
          }
          
          res.json(words);
        }
      );
    }
  );
});

/**
 * 添加单词到用户单词本
 * POST /api/wordbooks/:wordbookId/words
 * 请求体: { words: [{ word: '单词', translation: '翻译', unit: '单元', notes: '笔记' }, ...] }
 * 需要认证令牌
 */
app.post('/api/wordbooks/:wordbookId/words', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const wordbookId = req.params.wordbookId;
  const { words } = req.body;
  
  logInfo('API', '请求添加单词到用户单词本', {
    userId,
    wordbookId,
    wordCount: words?.length
  });
  
  // 验证请求
  if (!words || !Array.isArray(words) || words.length === 0) {
    logError('API', '无效的单词数据', {
      wordsType: words ? (Array.isArray(words) ? `Array(${words.length})` : typeof words) : 'undefined'
    });
    return res.status(400).json({ error: '无效的单词数据' });
  }
  
  // 验证单词本所有权
  pool.query(
    'SELECT id FROM user_wordbooks WHERE id = ? AND user_id = ?',
    [wordbookId, userId],
    (err, results) => {
      if (err) {
        logError('DATABASE', '验证单词本所有权失败', err);
        return res.status(500).json({ error: '添加单词失败', details: err.message });
      }
      
      if (results.length === 0) {
        logError('API', '无权访问单词本', { userId, wordbookId });
        return res.status(403).json({ error: '无权访问此单词本' });
      }
      
      logInfo('DATABASE', '验证单词本所有权成功', { userId, wordbookId });
      
      // 处理单词添加
      processWordAddition(wordbookId, words, res);
    }
  );
});

/**
 * 处理单词添加，包括检查重复和合并释义
 */
function processWordAddition(wordbookId, newWords, res) {
  logInfo('DATABASE', '开始处理单词添加流程', { 
    wordbookId, 
    wordCount: newWords.length 
  });
  
  // 获取现有单词，用于检查重复
  pool.query(
    'SELECT id, word, translation FROM user_words WHERE wordbook_id = ?',
    [wordbookId],
    (err, existingWords) => {
      if (err) {
        logError('DATABASE', '获取现有单词失败', err);
        return res.status(500).json({ error: '添加单词失败', details: err.message });
      }
      
      logInfo('DATABASE', `单词本中已有${existingWords.length}个单词`, {
        wordbookId,
        sampleExistingWords: existingWords.slice(0, 3).map(w => ({ id: w.id, word: w.word }))
      });
      
      // 将现有单词转换为Map，便于查找
      const existingWordsMap = new Map();
      existingWords.forEach(word => {
        existingWordsMap.set(word.word, { id: word.id, translation: word.translation });
      });
      
      // 准备添加和更新的单词
      const wordsToAdd = [];
      const duplicateWordsToUpdate = [];
      
      newWords.forEach(newWord => {
        // 验证单词数据
        if (!newWord.word || !newWord.translation) {
          return; // 跳过无效单词
        }
        
        // 检查是否重复
        if (existingWordsMap.has(newWord.word)) {
          const existingWord = existingWordsMap.get(newWord.word);
          
          // 如果有不同的释义，合并释义
          if (existingWord.translation !== newWord.translation) {
            duplicateWordsToUpdate.push({
              id: existingWord.id,
              word: newWord.word,
              oldTranslation: existingWord.translation,
              newTranslation: `${existingWord.translation}；${newWord.translation}`
            });
          }
          // 如果释义相同，跳过
        } else {
          // 非重复单词，准备添加
          wordsToAdd.push([
            generateRandomId(),
            wordbookId,
            newWord.word,
            newWord.translation,
            newWord.unit || '',
            newWord.notes || ''
          ]);
        }
      });
      
      logInfo('DATABASE', '单词分析结果', {
        totalNewWords: newWords.length,
        wordsToAdd: wordsToAdd.length,
        duplicatesToUpdate: duplicateWordsToUpdate.length,
        duplicatesToSkip: newWords.length - wordsToAdd.length - duplicateWordsToUpdate.length
      });
      
      // 使用事务处理所有操作
      pool.getConnection((err, connection) => {
        if (err) {
          logError('DATABASE', '获取数据库连接失败', err);
          return res.status(500).json({ error: '添加单词失败', details: err.message });
        }
        
        connection.beginTransaction(err => {
          if (err) {
            connection.release();
            logError('DATABASE', '开始事务失败', err);
            return res.status(500).json({ error: '添加单词失败', details: err.message });
          }
          
          logInfo('DATABASE', '开始事务处理单词添加更新操作');
          
          // 处理需要合并释义的单词
          const updatePromises = duplicateWordsToUpdate.map(word => {
            return new Promise((resolve, reject) => {
              logInfo('DATABASE', `更新单词释义: ${word.word}`, {
                wordId: word.id,
                oldTranslation: word.oldTranslation,
                newTranslation: word.newTranslation
              });
              
              connection.query(
                'UPDATE user_words SET translation = ? WHERE id = ?',
                [word.newTranslation, word.id],
                (err) => {
                  if (err) {
                    logError('DATABASE', `更新单词释义失败: ${word.word}`, err);
                    reject(err);
                  } else {
                    resolve();
                  }
                }
              );
            });
          });
          
          // 执行更新
          Promise.all(updatePromises)
            .then(() => {
              logInfo('DATABASE', `完成${duplicateWordsToUpdate.length}个单词释义更新`);
              
              // 如果有新单词需要添加
              if (wordsToAdd.length > 0) {
                logInfo('DATABASE', `准备添加${wordsToAdd.length}个新单词`, {
                  sampleWords: wordsToAdd.slice(0, 2).map(w => ({ word: w[2], translation: w[3] }))
                });
                
                connection.query(
                  'INSERT INTO user_words (id, wordbook_id, word, translation, unit, notes) VALUES ?',
                  [wordsToAdd],
                  (err) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        logError('DATABASE', '添加新单词失败', err);
                        res.status(500).json({ error: '添加单词失败', details: err.message });
                      });
                    }
                    
                    logInfo('DATABASE', `成功添加${wordsToAdd.length}个新单词`);
                    commitTransaction();
                  }
                );
              } else {
                logInfo('DATABASE', '没有新单词需要添加，只有更新操作');
                commitTransaction();
              }
            })
            .catch(err => {
              connection.rollback(() => {
                connection.release();
                logError('DATABASE', '更新单词释义失败', err);
                res.status(500).json({ error: '添加单词失败', details: err.message });
              });
            });
          
          // 提交事务
          function commitTransaction() {
            connection.commit(err => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  logError('DATABASE', '提交事务失败', err);
                  res.status(500).json({ error: '添加单词失败', details: err.message });
                });
              }
              
              connection.release();
              logInfo('API', '单词添加成功', { 
                added: wordsToAdd.length,
                merged: duplicateWordsToUpdate.length
              });
              
              res.status(201).json({ 
                message: '单词添加成功', 
                added: wordsToAdd.length,
                merged: duplicateWordsToUpdate.length
              });
            });
          }
        });
      });
    }
  );
}

/**
 * 获取用户自定义单词库中的单词用于游戏
 * POST /api/words/user
 * 请求体: { wordbookIds: ['id1', 'id2'], limit: 10 }
 * 需要认证令牌
 */
app.post('/api/words/user', authenticateToken, (req, res) => {
  const { wordbookIds, limit = 10 } = req.body;
  const userId = req.user.id;
  
  if (!wordbookIds || !Array.isArray(wordbookIds) || wordbookIds.length === 0) {
    return res.status(400).json({ error: '请提供有效的单词本ID' });
  }
  
  // 先验证单词本是否属于该用户
  const placeholders = wordbookIds.map(() => '?').join(',');
  const query = `SELECT id FROM user_wordbooks WHERE id IN (${placeholders}) AND user_id = ?`;
  const params = [...wordbookIds, userId];
  
  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('验证单词本失败:', err);
      return res.status(500).json({ error: '获取单词失败', details: err.message });
    }
    
    if (results.length !== wordbookIds.length) {
      return res.status(403).json({ error: '无权访问指定的单词本' });
    }
    
    // 获取用户单词
    const wordQuery = `
      SELECT id, word, translation, unit, notes 
      FROM user_words 
      WHERE wordbook_id IN (${placeholders})
      ORDER BY RAND() 
      LIMIT ?
    `;
    const wordParams = [...wordbookIds, parseInt(limit)];
    
    pool.query(wordQuery, wordParams, (err, words) => {
      if (err) {
        console.error('获取用户单词失败:', err);
        return res.status(500).json({ error: '获取单词失败', details: err.message });
      }
      
      const wordPairs = words.map(row => ({
        word: row.word,
        translation: row.translation,
        unit: row.unit || ''
      }));
      
      res.json(wordPairs);
    });
  });
});

/**
 * 获取游戏单词，可以从系统词库和用户词库中选择
 * POST /api/words/game
 * 请求体: { useSystemWords: true, selectedWordbooks: ['id1', 'id2'], limit: 10 }
 * 需要认证令牌
 */
app.post('/api/words/game', authenticateToken, async (req, res) => {
  const { useSystemWords, selectedWordbooks, limit = 10 } = req.body;
  const userId = req.user.id;
  
  // 从req.user中获取grade和textbook_type，提供默认值以防止undefined
  const grade = req.user.grade || 'grade4';  // 默认小学四年级
  const textbook_type = req.user.textbook_type || '人教版';  // 默认人教版
  
  logInfo('API', '请求获取游戏单词', { 
    userId,
    useSystemWords, 
    selectedWordbooks, 
    limit,
    grade,
    textbook_type
  });
  
  try {
    let words = [];
    
    // 如果选择了系统单词库
    if (useSystemWords) {
      logInfo('DATABASE', '从系统单词库中检索单词', { 
        grade, 
        textbook_type, 
        limit,
        sql: 'SELECT id, word, translation, unit, volume FROM system_words WHERE grade = ? AND textbook_type = ? ORDER BY RAND() LIMIT ?'
      });
      
      const [systemWords] = await pool.promise().query(
        'SELECT id, word, translation, unit, volume FROM system_words WHERE grade = ? AND textbook_type = ? ORDER BY RAND() LIMIT ?',
        [grade, textbook_type, parseInt(limit)]
      );
      
      logInfo('DATABASE', `从系统单词库获取了${systemWords.length}个单词`, { 
        grade,
        textbook_type,
        count: systemWords.length,
        sampleWords: systemWords.slice(0, 2).map(w => ({ word: w.word, translation: w.translation }))
      });
      
      words = [...words, ...systemWords.map(row => ({
        word: row.word,
        translation: row.translation,
        unit: row.unit,
        volume: row.volume,
        source: 'system'
      }))];
    }
    
    // 如果选择了用户单词本
    if (selectedWordbooks && selectedWordbooks.length > 0) {
      logInfo('DATABASE', '验证用户单词本权限', { selectedWordbooks });
      
      // 验证单词本所有权
      const placeholders = selectedWordbooks.map(() => '?').join(',');
      const [validWordbooks] = await pool.promise().query(
        `SELECT id FROM user_wordbooks WHERE id IN (${placeholders}) AND user_id = ?`,
        [...selectedWordbooks, userId]
      );
      
      logInfo('DATABASE', `验证结果: ${validWordbooks.length}/${selectedWordbooks.length}个单词本有效`);
      
      if (validWordbooks.length > 0) {
        const validWordbookIds = validWordbooks.map(wb => wb.id);
        const wordPlaceholders = validWordbookIds.map(() => '?').join(',');
        
        logInfo('DATABASE', '从用户单词本中检索单词', { validWordbookIds });
        
        const [userWords] = await pool.promise().query(
          `SELECT id, word, translation, unit FROM user_words WHERE wordbook_id IN (${wordPlaceholders}) ORDER BY RAND() LIMIT ?`,
          [...validWordbookIds, parseInt(limit)]
        );
        
        logInfo('DATABASE', `从用户单词本获取了${userWords.length}个单词`, {
          sampleWords: userWords.slice(0, 2).map(w => ({ word: w.word, translation: w.translation }))
        });
        
        words = [...words, ...userWords.map(row => ({
          word: row.word,
          translation: row.translation,
          unit: row.unit || '',
          source: 'user'
        }))];
      }
    }
    
    // 处理可能的单词不足情况
    if (words.length === 0) {
      logInfo('DATABASE', '未找到符合条件的单词，尝试获取默认单词');
      
      // 尝试从系统单词库中获取默认单词
      const [defaultWords] = await pool.promise().query(
        'SELECT id, word, translation FROM system_words ORDER BY RAND() LIMIT ?',
        [parseInt(limit)]
      );
      
      words = [...words, ...defaultWords.map(row => ({
        word: row.word,
        translation: row.translation,
        source: 'default'
      }))];
      
      logInfo('DATABASE', `已获取${defaultWords.length}个默认单词作为备选`);
    }
    
    // 混合并限制单词数量
    words = shuffleArray(words).slice(0, parseInt(limit));
    logInfo('API', `返回${words.length}个混合单词`, {
      sources: words.reduce((acc, word) => {
        acc[word.source] = (acc[word.source] || 0) + 1;
        return acc;
      }, {})
    });
    
    res.json(words);
  } catch (error) {
    logError('API', '获取游戏单词失败', error);
    res.status(500).json({ error: '获取游戏单词失败', details: error.message });
  }
});

/**
 * 随机打乱数组
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 启动服务器
app.listen(port, () => {
  // 打印服务器和数据库配置信息（不包含敏感信息）
  const serverInfo = {
    timestamp: new Date().toISOString(),
    serverVersion: '1.0.0',
    node: process.version,
    platform: process.platform,
    port: port,
    environment: process.env.NODE_ENV || 'development',
    database: {
      host: dbConfig.host,
      database: dbConfig.database,
      // 不记录用户名密码
    }
  };
  
  console.log('------------------------------------------------------');
  console.log(`🚀 英语单词匹配游戏服务器已启动 [端口: ${port}]`);
  console.log('------------------------------------------------------');
  logInfo('SERVER', '服务器配置信息', serverInfo);
  console.log('可用的API端点:');
  console.log('📚 /api/grades - 获取年级列表');
  console.log('📝 /api/words - 获取/保存单词');
  console.log('👤 /api/users/register - 用户注册');
  console.log('👤 /api/users/login - 用户登录');
  console.log('📘 /api/wordbooks - 管理单词本');
  console.log('🎮 /api/words/game - 获取游戏单词');
  console.log('------------------------------------------------------');
});
