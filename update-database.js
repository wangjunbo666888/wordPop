/**
 * 数据库结构升级脚本
 * 用于更新数据库结构以支持新的单词库系统
 */

const mysql = require('mysql2/promise');
const fs = require('fs');

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456mysql@',
  database: 'word_pop'
};

// SQL脚本路径
const schemaPath = './database_schema.sql';

// 主函数
async function updateDatabase() {
  let connection;
  try {
    console.log('🔄 开始数据库结构升级...');
    
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 读取SQL脚本
    const sqlScript = fs.readFileSync(schemaPath, 'utf8');
    const statements = sqlScript
      .split(';')
      .filter(stmt => stmt.trim() !== '')
      .map(stmt => stmt + ';');
    
    console.log(`📝 从 ${schemaPath} 读取了 ${statements.length} 条SQL语句`);
    
    // 检查是否已存在新表
    const [tables] = await connection.query('SHOW TABLES LIKE "system_words"');
    
    if (tables.length > 0) {
      console.log('⚠️ system_words表已存在，跳过结构升级');
      return;
    }
    
    // 创建新表
    for (const stmt of statements) {
      if (stmt.trim().length > 0) {
        console.log(`🔧 执行: ${stmt.substring(0, 60)}...`);
        await connection.query(stmt);
      }
    }
    
    console.log('🎉 数据库结构升级成功!');
    
  } catch (error) {
    console.error('❌ 数据库结构升级失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('👋 数据库连接已关闭');
    }
  }
}

// 执行升级
updateDatabase(); 