-- LEARNHUB role-based learning, notes organization, lesson pagination migration
USE learnhub;

-- Users role/approval columns
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE users ADD COLUMN role ENUM(''student'',''teacher'',''admin'') NOT NULL DEFAULT ''student'' AFTER email','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE users ADD COLUMN teacher_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER role','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='teacher_approved');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE users SET role='admin', teacher_approved=1 WHERE is_admin=1;

CREATE TABLE IF NOT EXISTS teacher_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  notes VARCHAR(255) NULL,
  UNIQUE KEY uniq_teacher_approval_user (user_id),
  CONSTRAINT fk_teacher_approval_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_approval_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO teacher_approvals (user_id,status,reviewed_at)
SELECT id,'approved',NOW() FROM users WHERE role='teacher' AND teacher_approved=1
ON DUPLICATE KEY UPDATE status=VALUES(status);

CREATE TABLE IF NOT EXISTS lesson_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  page_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_html MEDIUMTEXT NULL,
  source_note_id INT NULL,
  pdf_start_page INT NULL,
  pdf_end_page INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lesson_page (lesson_id, page_number),
  INDEX idx_lesson_pages_note (source_note_id),
  CONSTRAINT fk_lesson_pages_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  CONSTRAINT fk_lesson_pages_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  lesson_id INT NOT NULL,
  page_id INT NULL,
  current_page_number INT NOT NULL DEFAULT 1,
  total_pages INT NOT NULL DEFAULT 4,
  completed_pages INT NOT NULL DEFAULT 0,
  completion_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_progress_lesson (user_id, lesson_id),
  INDEX idx_student_progress_user (user_id),
  INDEX idx_student_progress_course (course_id),
  CONSTRAINT fk_student_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_progress_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_progress_page FOREIGN KEY (page_id) REFERENCES lesson_pages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extend course_notes for organization
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD COLUMN description TEXT NULL AFTER title','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND COLUMN_NAME='description');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD COLUMN course_id INT NULL AFTER course_category','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND COLUMN_NAME='course_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD COLUMN lesson_id INT NULL AFTER course_id','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND COLUMN_NAME='lesson_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD COLUMN page_count INT NOT NULL DEFAULT 0 AFTER file_size','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND COLUMN_NAME='page_count');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 1 AFTER approval_status','SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND COLUMN_NAME='is_published');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FKs for course_notes if missing (best-effort)
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD CONSTRAINT fk_course_notes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL','SELECT 1') FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND CONSTRAINT_NAME='fk_course_notes_course');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD CONSTRAINT fk_course_notes_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL','SELECT 1') FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='course_notes' AND CONSTRAINT_NAME='fk_course_notes_lesson');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,'ALTER TABLE course_notes ADD CONSTRAINT fk_lesson_pages_note FOREIGN KEY (source_note_id) REFERENCES course_notes(id) ON DELETE SET NULL','SELECT 1') FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='lesson_pages' AND CONSTRAINT_NAME='fk_lesson_pages_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
