# 单词消消乐游戏

一个帮助用户记忆英语单词的交互式匹配游戏。

## 功能特点

- 单词与释义匹配
- 计时挑战
- 得分系统
- Excel导入功能
- 文本导入功能
- 单词发音（TTS）
- 连击特效
- MySQL数据库存储

## 安装说明

1. 克隆项目到本地
   ```
   git clone <项目地址>
   cd englishGame
   ```

2. 安装依赖
   ```
   npm install
   ```

3. 数据库配置
   - 确保已安装MySQL数据库
   - 创建名为`word_pop`的数据库
   - 创建数据表:

   ```sql
   -- 创建年级表
   CREATE TABLE grades (
     id varchar(8) NOT NULL,
     name varchar(32),
     PRIMARY KEY (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

   -- 创建单词表
   CREATE TABLE words (
     id varchar(8) NOT NULL,
     grade_id varchar(8),
     word varchar(32),
     translation varchar(32),
     PRIMARY KEY (id),
     FOREIGN KEY (grade_id) REFERENCES grades(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
   ```

4. 启动应用
   ```
   npm start
   ```

5. 在浏览器中访问
   ```
   http://localhost:3000
   ```

## 使用说明

### 基本操作

1. 选择年级：从下拉菜单中选择要学习的年级。
2. 选择单词数量：设置每次游戏显示的单词卡片数量。
3. 选择难度：调整游戏难度。
4. 点击"开始游戏"按钮开始匹配。
5. 点击左侧英文单词卡片，再点击右侧对应的中文释义卡片进行匹配。

### 导入单词

1. Excel导入：点击"导入Excel"按钮，选择Excel文件。
2. 文本导入：点击"粘贴文本"按钮，输入单词/释义对。

### 数据存储

- 所有单词数据存储在MySQL数据库中
- 按年级分类存储
- 支持创建新年级并保存单词

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js, Express
- 数据库：MySQL

## 开发者说明

如果需要修改数据库连接配置，请编辑`server.js`文件中的以下部分：

```javascript
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456mysql@',
  database: 'word_pop'
};
```

## 扩展功能

- **音频反馈**：
  - 匹配成功：播放胜利音效
  - 匹配失败：播放鼓励音效
  - 游戏胜利：播放欢呼声和撒花特效

- **TTS语音朗读**：
  - 双击任意英文单词卡片，将会朗读该单词
  - 匹配成功时自动用美式发音朗读单词
  
- **视觉反馈**：
  - 连击特效：连续匹配正确3次以上会触发屏幕边缘闪光特效
  - 胜利撒花：成功匹配所有单词后，屏幕会出现彩色撒花庆祝动画

## 单词库系统

### 概述

单词库系统分为以下两部分：

1. **系统单词库（system_words）**：包含由管理员维护的基础单词，按照年级和教材版本组织
2. **用户单词库（user_wordbooks 和 user_words）**：用户可创建自己的单词本，并添加自定义单词

### 功能特点

- **多单词本管理**：用户可以创建多个单词本，分类管理不同类型的单词
- **默认单词本**：用户可以设置一个默认单词本，导入单词时会自动选择该单词本
- **单词源选择**：开始游戏前，用户可以选择使用系统单词库、个人单词本或两者结合
- **重复单词处理**：当导入包含重复单词但释义不同的数据时，系统会自动合并释义

### 数据表结构

#### 系统单词库表（system_words）
```sql
CREATE TABLE system_words (
  id VARCHAR(36) PRIMARY KEY,
  word VARCHAR(100) NOT NULL,
  translation VARCHAR(255) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  textbook_type VARCHAR(50) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  volume VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 用户单词本表（user_wordbooks）
```sql
CREATE TABLE user_wordbooks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 用户单词表（user_words）
```sql
CREATE TABLE user_words (
  id VARCHAR(36) PRIMARY KEY,
  wordbook_id VARCHAR(36) NOT NULL,
  word VARCHAR(100) NOT NULL,
  translation VARCHAR(255) NOT NULL,
  unit VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wordbook_id) REFERENCES user_wordbooks(id) ON DELETE CASCADE,
  INDEX idx_user_words_word (wordbook_id, word)
);
```

### 使用方法

#### 创建单词本
1. 点击"个人中心"链接，显示单词本管理界面
2. 点击"创建单词本"按钮
3. 填写单词本名称、描述，可选择是否设为默认
4. 点击"保存"按钮

#### 导入单词
1. 点击"导入Excel"按钮
2. 如果未创建单词本，系统会提示先创建
3. 选择Excel文件（必须包含word和translation列）
4. 系统会自动处理重复单词，合并不同释义

#### 开始游戏
1. 点击"开始游戏"按钮
2. 在单词源选择对话框中，选择要使用的单词源
   - 系统单词库（根据用户年级和教材版本）
   - 个人单词本（可多选）
3. 点击"开始游戏"按钮，系统会随机选择单词开始游戏

### 重复单词处理

当导入的Excel文件中包含与单词本已有单词重复但释义不同的数据时：

1. 系统会自动将新释义合并到现有释义中，用分号分隔
2. 如果释义完全相同，则会跳过重复单词
3. 导入完成后，系统会显示添加和合并的单词数量