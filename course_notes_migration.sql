-- LEARNHUB course notes migration
-- Run this on an existing database: mysql -u root -p learnhub < database/course_notes_migration.sql

USE learnhub;

CREATE TABLE IF NOT EXISTS course_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  course_category VARCHAR(120) NOT NULL,
  uploaded_by INT NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  INDEX idx_notes_category (course_category),
  INDEX idx_notes_status (approval_status),
  INDEX idx_notes_uploader (uploaded_by),
  CONSTRAINT fk_notes_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
