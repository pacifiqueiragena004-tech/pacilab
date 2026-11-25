<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
$user = learnhub_require_user($db);
$body = learnhub_read_json_body();
$lessonId = (int)($body['lesson_id'] ?? 0);
$courseSlug = strtolower(trim((string)($body['course_slug'] ?? '')));
$selected = isset($body['selected_answer']) ? (int)$body['selected_answer'] : -1;
if ($lessonId <= 0 || $courseSlug === '' || $selected < 0) {
    learnhub_json_response(['ok' => false, 'error' => 'lesson_id, course_slug, and selected_answer are required.'], 400);
}
$stmt = $db->prepare('SELECT l.id, l.course_id, l.quiz_json, c.slug FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? AND c.slug = ? LIMIT 1');
$stmt->bind_param('is', $lessonId, $courseSlug);
$stmt->execute();
$lesson = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$lesson) learnhub_json_response(['ok' => false, 'error' => 'Lesson not found.'], 404);

$uid = (int)$user['id'];
// Lessons/quizzes are freely accessible; keep quiz result tracking.

$quiz = json_decode($lesson['quiz_json'] ?: '{}', true) ?: [];
$answer = isset($quiz['answer']) ? (int)$quiz['answer'] : -1;
$correct = ($selected === $answer);
$score = $correct ? 100 : 0;
$stmt = $db->prepare('INSERT INTO quiz_results (user_id, lesson_id, selected_answer, is_correct, score) VALUES (?, ?, ?, ?, ?)');
$isCorrectInt = $correct ? 1 : 0;
$stmt->bind_param('iiiii', $uid, $lessonId, $selected, $isCorrectInt, $score);
$stmt->execute();
$stmt->close();

learnhub_json_response([
    'ok' => true,
    'correct' => $correct,
    'score' => $score,
    'correct_answer' => $answer,
    'explanation' => $quiz['explanation'] ?? ''
]);
