<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
learnhub_ensure_role_schema($db);
$body = learnhub_read_json_body();
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
if ($email === '' || $password === '') {
    learnhub_json_response(['ok' => false, 'error' => 'Email and password are required.'], 400);
}
$stmt = $db->prepare('SELECT id, name, email, password_hash, role, is_admin, teacher_approved FROM users WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$user || !password_verify($password, $user['password_hash'])) {
    learnhub_json_response(['ok' => false, 'error' => 'Invalid email or password.'], 401);
}
learnhub_ensure_first_course_access($db, (int)$user['id']);
$_SESSION['user_id'] = (int)$user['id'];
$sessionUser = learnhub_get_user_by_id($db, (int)$user['id']);
learnhub_json_response([
    'ok' => true,
    'csrf_token' => learnhub_csrf_token(),
    'user' => $sessionUser ?: [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'] ?: ((int)$user['is_admin'] === 1 ? 'admin' : 'student'),
        'is_admin' => (int)($user['is_admin'] ?? 0),
        'teacher_approved' => (int)($user['teacher_approved'] ?? 0),
    ],
]);
