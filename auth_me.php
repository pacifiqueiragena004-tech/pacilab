<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_connect();
if (!$db) {
    learnhub_json_response(['ok' => true, 'authenticated' => false, 'user' => null, 'db' => false, 'csrf_token' => learnhub_csrf_token()]);
}
learnhub_ensure_notes_schema($db);
learnhub_ensure_role_schema($db);
$uid = learnhub_current_user_id();
$csrf = learnhub_csrf_token();
if (!$uid) {
    learnhub_json_response(['ok' => true, 'authenticated' => false, 'user' => null, 'csrf_token' => $csrf]);
}
$stmt = $db->prepare('SELECT id, name, email, role, teacher_approved, is_admin FROM users WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $uid);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$user) {
    $_SESSION = [];
    learnhub_json_response(['ok' => true, 'authenticated' => false, 'user' => null, 'csrf_token' => learnhub_csrf_token()]);
}
learnhub_ensure_first_course_access($db, (int)$user['id']);
learnhub_json_response(['ok' => true, 'authenticated' => true, 'csrf_token' => $csrf, 'user' => [
    'id' => (int)$user['id'],
    'name' => $user['name'],
    'email' => $user['email'],
    'role' => learnhub_role($db, $user),
    'teacher_approved' => (int)($user['teacher_approved'] ?? 0),
    'is_admin' => (int)($user['is_admin'] ?? 0),
]]);
