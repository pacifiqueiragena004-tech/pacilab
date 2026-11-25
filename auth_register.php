<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
learnhub_ensure_notes_schema($db);
learnhub_ensure_role_schema($db);
$body = learnhub_read_json_body();
$csrf = (string)($body['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
if (!learnhub_verify_csrf($csrf)) {
    // allow first-time registration if session has no token yet? No - auth_me issues token.
    // Be lenient only when no session token exists to avoid breaking old clients.
    if (!empty($_SESSION['csrf_token'])) learnhub_json_response(['ok' => false, 'error' => 'Invalid CSRF token.'], 403);
}
$name = trim((string)($body['name'] ?? ''));
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$role = strtolower(trim((string)($body['role'] ?? 'student')));
if (!in_array($role, ['student', 'teacher'], true)) {
    learnhub_json_response(['ok' => false, 'error' => 'Please select a valid account type.'], 400);
}
if ($name === '' || $email === '' || $password === '') {
    learnhub_json_response(['ok' => false, 'error' => 'Name, email, and password are required.'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    learnhub_json_response(['ok' => false, 'error' => 'Invalid email address.'], 400);
}
if (strlen($password) < 4) {
    learnhub_json_response(['ok' => false, 'error' => 'Password must be at least 4 characters.'], 400);
}
$stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$exists = $stmt->get_result()->fetch_assoc();
$stmt->close();
if ($exists) {
    learnhub_json_response(['ok' => false, 'error' => 'An account with this email already exists.'], 409);
}
$hash = password_hash($password, PASSWORD_DEFAULT);
$teacherApproved = 0;
$isAdmin = 0;
$stmt = $db->prepare('INSERT INTO users (name, email, role, teacher_approved, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->bind_param('sssisi', $name, $email, $role, $teacherApproved, $hash, $isAdmin);
$stmt->execute();
$userId = (int)$db->insert_id;
$stmt->close();
if ($role === 'teacher') {
    $stmt = $db->prepare("INSERT INTO teacher_approvals (user_id, status) VALUES (?, 'pending') ON DUPLICATE KEY UPDATE status='pending', requested_at=CURRENT_TIMESTAMP");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->close();
}
learnhub_ensure_first_course_access($db, $userId);
$_SESSION['user_id'] = $userId;
learnhub_json_response(['ok' => true, 'user' => [
    'id' => $userId, 'name' => $name, 'email' => $email,
    'role' => $role, 'teacher_approved' => 0, 'is_admin' => 0
], 'message' => $role === 'teacher' ? 'Teacher account created. Administrator approval is required before teacher privileges are activated.' : 'Account created successfully.']);
