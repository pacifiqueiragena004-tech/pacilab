<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
$user = learnhub_require_user($db);
$body = learnhub_read_json_body();
$lessonId = (int)($body['lesson_id'] ?? 0);
$courseSlug = strtolower(trim((string)($body['course_slug'] ?? '')));
if ($lessonId <= 0 || $courseSlug === '') {
    learnhub_json_response(['ok' => false, 'error' => 'lesson_id and course_slug are required.'], 400);
}
$stmt = $db->prepare('SELECT l.id, l.course_id, l.lesson_number, c.slug FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? AND c.slug = ? LIMIT 1');
$stmt->bind_param('is', $lessonId, $courseSlug);
$stmt->execute();
$lesson = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$lesson) learnhub_json_response(['ok' => false, 'error' => 'Lesson not found.'], 404);

$uid = (int)$user['id'];
// Lessons are freely accessible; keep completion tracking without lock/prerequisite/payment checks.

$stmt = $db->prepare('INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at) VALUES (?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE is_completed=1, completed_at=COALESCE(completed_at, NOW())');
$stmt->bind_param('ii', $uid, $lessonId);
$stmt->execute();
$stmt->close();

learnhub_json_response(['ok' => true]);
