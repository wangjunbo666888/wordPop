-- 系统单词库表
CREATE TABLE IF NOT EXISTS system_words (
  id VARCHAR(36) PRIMARY KEY,
  word VARCHAR(100) NOT NULL,
  translation VARCHAR(255) NOT NULL,
  grade VARCHAR(20) NOT NULL,         -- 适用年级
  textbook_type VARCHAR(50) NOT NULL, -- 教材版本
  unit VARCHAR(20) NOT NULL,          -- 单元
  volume VARCHAR(20),                 -- 上下册
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户自定义单词本表
CREATE TABLE IF NOT EXISTS user_wordbooks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,         -- 单词本名称
  description TEXT,                   -- 描述
  is_default BOOLEAN DEFAULT FALSE,   -- 是否默认使用
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户单词表
CREATE TABLE IF NOT EXISTS user_words (
  id VARCHAR(36) PRIMARY KEY,
  wordbook_id VARCHAR(36) NOT NULL,   -- 关联到用户词书
  word VARCHAR(100) NOT NULL,
  translation VARCHAR(255) NOT NULL,
  unit VARCHAR(20),                   -- 可选单元标识
  notes TEXT,                         -- 笔记
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wordbook_id) REFERENCES user_wordbooks(id) ON DELETE CASCADE,
  INDEX idx_user_words_word (wordbook_id, word)   -- 添加索引提高查询性能
);

-- 将现有的words表复制到system_words表
INSERT INTO system_words (id, word, translation, grade, textbook_type, unit, volume)
SELECT id, word, translation, grade, textbook_type, unit, volume FROM words;

-- 为每个用户创建默认单词本
INSERT INTO user_wordbooks (id, user_id, name, description, is_default)
SELECT CONCAT('wb_', id), id, '我的单词本', '默认单词本', TRUE
FROM users; 