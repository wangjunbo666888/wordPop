/**
 * 数据库测试文件
 * 用于验证MySQL连接和插入功能
 */

const mysql = require('mysql2');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456mysql@',
  database: 'word_pop'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
pool.getConnection((err, connection) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('数据库连接成功!');
  
  // 测试数据
  const testWord = {
    id: 'test1234',
    grade: 'five',
    word: 'test',
    translation: '测试',
    unit: '1',
    textbook_type: 1,
    volume: '上册'
  };
  
  // 测试插入单个单词
  connection.query(
    'INSERT INTO words (id, grade, word, translation, unit, textbook_type, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [testWord.id, testWord.grade, testWord.word, testWord.translation, testWord.unit, testWord.textbook_type, testWord.volume],
    (err, result) => {
      if (err) {
        console.error('插入单词失败:', err);
        console.error('SQL错误详情:', {
          code: err.code,
          errno: err.errno,
          sqlState: err.sqlState,
          sqlMessage: err.sqlMessage
        });
      } else {
        console.log('插入成功!', result);
        
        // 测试批量插入
        const testWords = [
          ['test1235', 'five', 'apple', '苹果', '1', 1, '上册'],
          ['test1236', 'five', 'banana', '香蕉', '1', 1, '上册']
        ];
        
        connection.query(
          'INSERT INTO words (id, grade, word, translation, unit, textbook_type, volume) VALUES ?',
          [testWords],
          (err, result) => {
            if (err) {
              console.error('批量插入单词失败:', err);
              console.error('SQL错误详情:', {
                code: err.code,
                errno: err.errno,
                sqlState: err.sqlState,
                sqlMessage: err.sqlMessage
              });
            } else {
              console.log('批量插入成功!', result);
            }
            
            // 最后关闭连接
            connection.release();
            console.log('测试完成!');
            process.exit(0);
          }
        );
      }
    }
  );
}); 