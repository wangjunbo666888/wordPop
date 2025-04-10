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