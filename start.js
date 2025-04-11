/**
 * 单词消消乐应用启动脚本
 * 按顺序执行数据库升级和服务器启动
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 检查数据库配置
const dbConfigPath = './server.js';
if (!fs.existsSync(dbConfigPath)) {
  console.error('❌ 未找到服务器配置文件，请确保server.js文件存在');
  process.exit(1);
}

// 检查数据库升级脚本
const updateScriptPath = './update-database.js';
if (!fs.existsSync(updateScriptPath)) {
  console.error('❌ 未找到数据库升级脚本，请确保update-database.js文件存在');
  process.exit(1);
}

// 检查数据库结构文件
const schemaPath = './database_schema.sql';
if (!fs.existsSync(schemaPath)) {
  console.error('❌ 未找到数据库结构文件，请确保database_schema.sql文件存在');
  process.exit(1);
}

// 步骤1：更新数据库结构
console.log('🔄 步骤1：更新数据库结构...');
try {
  execSync('node update-database.js', { stdio: 'inherit' });
  console.log('✅ 数据库结构更新成功');
} catch (error) {
  console.error('❌ 数据库结构更新失败，终止启动过程');
  process.exit(1);
}

// 步骤2：启动服务器
console.log('🔄 步骤2：启动服务器...');
const server = spawn('node', ['server.js'], { stdio: 'inherit' });

// 处理服务器进程事件
server.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ 服务器进程以代码 ${code} 退出`);
  }
});

// 处理Ctrl+C等终止信号
process.on('SIGINT', () => {
  console.log('👋 收到终止信号，关闭服务器...');
  server.kill('SIGINT');
});

console.log('✅ 应用启动完成，按Ctrl+C停止服务器'); 