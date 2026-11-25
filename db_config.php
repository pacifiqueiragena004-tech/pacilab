<?php
// LEARNHUB MySQL configuration for XAMPP local development.
declare(strict_types=1);

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'learnhub');

define('LEARNHUB_NOTES_UPLOAD_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'notes');
define('LEARNHUB_NOTES_MAX_BYTES', 10 * 1024 * 1024); // 10 MB
define('LEARNHUB_NOTES_APPROVAL_REQUIRED', true);
define('LEARNHUB_NOTES_ALLOWED', [
    'pdf'  => ['application/pdf'],
    'doc'  => ['application/msword'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
    'ppt'  => ['application/vnd.ms-powerpoint'],
    'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
    'txt'  => ['text/plain'],
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png'  => ['image/png'],
]);

define('LEARNHUB_VIDEOS_UPLOAD_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'videos');
define('LEARNHUB_VIDEOS_THUMB_DIR', LEARNHUB_VIDEOS_UPLOAD_DIR . DIRECTORY_SEPARATOR . 'thumbnails');
define('LEARNHUB_VIDEOS_MAX_BYTES', 100 * 1024 * 1024); // 100 MB
define('LEARNHUB_VIDEOS_ALLOWED', [
    'mp4'  => ['video/mp4'],
    'webm' => ['video/webm'],
    'ogg'  => ['video/ogg', 'application/ogg'],
    'mov'  => ['video/quicktime'],
    'm4v'  => ['video/x-m4v', 'video/mp4'],
]);
define('LEARNHUB_VIDEO_THUMBS_ALLOWED', [
    'jpg'  => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png'  => ['image/png'],
    'webp' => ['image/webp'],
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function learnhub_db_connect(): ?mysqli {
    static $conn = null;
    if ($conn instanceof mysqli) {
        return $conn;
    }
    mysqli_report(MYSQLI_REPORT_OFF);
    $conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_errno) {
        $conn = null;
        return null;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

function learnhub_db_required(): mysqli {
    $conn = learnhub_db_connect();
    if (!$conn) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Database connection failed. Import database/learnhub.sql and check db_config.php.']);
        exit;
    }
    return $conn;
}

function learnhub_json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function learnhub_read_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function learnhub_current_user_id(): ?int {
    return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
}

function learnhub_require_user(mysqli $db): array {
    $uid = learnhub_current_user_id();
    if (!$uid) {
        learnhub_json_response(['ok' => false, 'error' => 'Authentication required.', 'auth' => false], 401);
    }
    learnhub_ensure_notes_schema($db);
    learnhub_ensure_role_schema($db);
    learnhub_ensure_videos_schema($db);
    $stmt = $db->prepare('SELECT id, name, email, role, teacher_approved, is_admin, created_at FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$user) {
        $_SESSION = [];
        learnhub_json_response(['ok' => false, 'error' => 'Session invalid.', 'auth' => false], 401);
    }
    $user['is_admin'] = (int)($user['is_admin'] ?? 0);
    $user['teacher_approved'] = (int)($user['teacher_approved'] ?? 0);
    $user['role'] = learnhub_role($db, $user);
    return $user;
}

function learnhub_ensure_first_course_access(mysqli $db, int $userId): void {
    $sql = 'INSERT IGNORE INTO student_course_access (user_id, course_id, unlock_source, granted_at)
            SELECT ?, c.id, "free", NOW()
            FROM courses c
            WHERE c.sequence_order = (SELECT MIN(sequence_order) FROM courses)';
    $stmt = $db->prepare($sql);
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->close();
}

function learnhub_ensure_notes_schema(mysqli $db): void {
    static $done = false;
    if ($done) return;
    $db->query("CREATE TABLE IF NOT EXISTS course_notes (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $col = $db->query("SHOW COLUMNS FROM users LIKE 'is_admin'");
    if ($col && $col->num_rows === 0) {
        $db->query("ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash");
    }
    $done = true;
}

function learnhub_is_admin(array $user): bool {
    return !empty($user['is_admin']);
}

function learnhub_require_admin(mysqli $db): array {
    $user = learnhub_require_user($db);
    // refresh admin flag
    $stmt = $db->prepare('SELECT is_admin FROM users WHERE id = ? LIMIT 1');
    $uid = (int)$user['id'];
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $user['is_admin'] = (int)($row['is_admin'] ?? 0);
    if (!$user['is_admin']) {
        learnhub_json_response(['ok' => false, 'error' => 'Administrator access required.'], 403);
    }
    return $user;
}

function learnhub_notes_format_size(int $bytes): string {
    if ($bytes >= 1048576) return round($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024) return round($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}

function learnhub_ensure_videos_schema(mysqli $db): void {
    static $done = false;
    if ($done) return;
    $db->query("CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        video_type ENUM('upload','external') NOT NULL DEFAULT 'upload',
        video_path VARCHAR(500) NULL,
        external_url VARCHAR(500) NULL,
        thumbnail_path VARCHAR(500) NULL,
        category_id INT NOT NULL,
        course_id INT NOT NULL,
        teacher_id INT NOT NULL,
        duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
        view_count INT UNSIGNED NOT NULL DEFAULT 0,
        publication_status ENUM('draft','published') NOT NULL DEFAULT 'published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_videos_category (category_id),
        INDEX idx_videos_course (course_id),
        INDEX idx_videos_teacher (teacher_id),
        INDEX idx_videos_publication (publication_status),
        INDEX idx_videos_created (created_at),
        CONSTRAINT fk_videos_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        CONSTRAINT fk_videos_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        CONSTRAINT fk_videos_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $done = true;
}

function learnhub_ensure_role_schema(mysqli $db): void {
    static $done = false;
    if ($done) return;
    $db->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('student','teacher','admin') NOT NULL DEFAULT 'student' AFTER email");
    // MariaDB/MySQL compatibility: ADD COLUMN IF NOT EXISTS may not be supported in old MySQL; fallback checks
    $res = $db->query("SHOW COLUMNS FROM users LIKE 'role'");
    if ($res && $res->num_rows === 0) { $db->query("ALTER TABLE users ADD COLUMN role ENUM('student','teacher','admin') NOT NULL DEFAULT 'student' AFTER email"); }
    if ($res) $res->close();
    $res = $db->query("SHOW COLUMNS FROM users LIKE 'teacher_approved'");
    if ($res && $res->num_rows === 0) { $db->query("ALTER TABLE users ADD COLUMN teacher_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER role"); }
    if ($res) $res->close();
    $db->query("UPDATE users SET role='admin', teacher_approved=1 WHERE is_admin=1 AND (role IS NULL OR role='' OR role='student')");

    $db->query("CREATE TABLE IF NOT EXISTS teacher_approvals (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->query("CREATE TABLE IF NOT EXISTS lesson_pages (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->query("CREATE TABLE IF NOT EXISTS student_progress (
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
        CONSTRAINT fk_student_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Extend course_notes
    foreach ([
        'description' => "ALTER TABLE course_notes ADD COLUMN description TEXT NULL AFTER title",
        'course_id' => "ALTER TABLE course_notes ADD COLUMN course_id INT NULL AFTER course_category",
        'lesson_id' => "ALTER TABLE course_notes ADD COLUMN lesson_id INT NULL AFTER course_id",
        'page_count' => "ALTER TABLE course_notes ADD COLUMN page_count INT NOT NULL DEFAULT 0 AFTER file_size",
        'is_published' => "ALTER TABLE course_notes ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 1 AFTER approval_status",
    ] as $col => $sql) {
        $r = $db->query("SHOW COLUMNS FROM course_notes LIKE '$col'");
        if ($r && $r->num_rows === 0) { $db->query($sql); }
        if ($r) $r->close();
    }
    $done = true;
}

function learnhub_csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function learnhub_verify_csrf(?string $token): bool {
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    return is_string($token) && $token !== '' && $sessionToken !== '' && hash_equals($sessionToken, $token);
}

function learnhub_require_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($token === '') {
        $body = learnhub_read_json_body();
        $token = (string)($body['csrf_token'] ?? $_POST['csrf_token'] ?? '');
    }
    if (!learnhub_verify_csrf($token)) {
        learnhub_json_response(['ok' => false, 'error' => 'Invalid CSRF token.'], 403);
    }
}

function learnhub_role(mysqli $db, array $user): string {
    $role = $user['role'] ?? 'student';
    if (($user['is_admin'] ?? 0) == 1) return 'admin';
    return in_array($role, ['student','teacher','admin'], true) ? $role : 'student';
}

function learnhub_is_teacher_approved(array $user): bool {
    if (learnhub_is_admin($user)) return true;
    return (($user['role'] ?? '') === 'teacher') && ((int)($user['teacher_approved'] ?? 0) === 1);
}

function learnhub_require_role(mysqli $db, array $roles): array {
    $user = learnhub_require_user($db);
    $role = learnhub_role($db, $user);
    if (!in_array($role, $roles, true)) {
        learnhub_json_response(['ok' => false, 'error' => 'Forbidden.'], 403);
    }
    if ($role === 'teacher' && !((int)($user['teacher_approved'] ?? 0) === 1)) {
        learnhub_json_response(['ok' => false, 'error' => 'Teacher account pending administrator approval.', 'teacher_pending' => true], 403);
    }
    return $user;
}

