<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
$slug = strtolower(trim((string)($_GET['course'] ?? 'html')));
$user = null;
$uid = learnhub_current_user_id();
if ($uid) {
    $stmt = $db->prepare('SELECT id, name, email FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($user) learnhub_ensure_first_course_access($db, (int)$user['id']);
}

$stmt = $db->prepare('SELECT c.*, cat.name AS category_name, cat.slug AS category_slug FROM courses c JOIN categories cat ON cat.id = c.category_id WHERE c.slug = ? LIMIT 1');
$stmt->bind_param('s', $slug);
$stmt->execute();
$course = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$course) {
    learnhub_json_response(['ok' => false, 'error' => 'Course not found.'], 404);
}
$courseId = (int)$course['id'];

$stmt = $db->prepare('SELECT id, lesson_number, title, short_description, introduction, explanation, applications_json, examples_json, exercises_json, quiz_json FROM lessons WHERE course_id = ? ORDER BY lesson_number ASC');
$stmt->bind_param('i', $courseId);
$stmt->execute();
$res = $stmt->get_result();
$lessons = [];
while ($row = $res->fetch_assoc()) { $lessons[] = $row; }
$stmt->close();

// All lessons are freely accessible to authenticated students.
$hasAccess = true;
$accessSource = 'open';

$completedIds = [];
if ($user) {
    $stmt = $db->prepare('SELECT lp.lesson_id FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.course_id = ? AND lp.is_completed = 1');
    $uid2 = (int)$user['id'];
    $stmt->bind_param('ii', $uid2, $courseId);
    $stmt->execute();
    $r = $stmt->get_result();
    while ($row = $r->fetch_assoc()) { $completedIds[] = (int)$row['lesson_id']; }
    $stmt->close();
}

$lessonPayload = [];
$completedCount = 0;
foreach ($lessons as $l) {
    $lid = (int)$l['id'];
    $isCompleted = in_array($lid, $completedIds, true);
    if ($isCompleted) $completedCount++;
    $status = $isCompleted ? 'completed' : 'available';
    $lessonPayload[] = [
        'id' => $lid,
        'number' => (int)$l['lesson_number'],
        'title' => $l['title'],
        'short_description' => $l['short_description'],
        'introduction' => $l['introduction'],
        'explanation' => $l['explanation'],
        'applications' => json_decode($l['applications_json'] ?: '[]', true) ?: [],
        'examples' => json_decode($l['examples_json'] ?: '[]', true) ?: [],
        'exercises' => json_decode($l['exercises_json'] ?: '[]', true) ?: [],
        'quiz' => json_decode($l['quiz_json'] ?: '{}', true) ?: (object)[],
        'status' => $status,
        'locked_reason' => ''
    ];
}

$totalLessons = count($lessonPayload);
$completionPercent = $totalLessons > 0 ? round(($completedCount / $totalLessons) * 100) : 0;
$courseCompleted = $totalLessons > 0 && $completedCount === $totalLessons;

if ($user) {
    $uid2 = (int)$user['id'];
    $completedAt = $courseCompleted ? date('Y-m-d H:i:s') : null;
    $stmt = $db->prepare('INSERT INTO course_completions (user_id, course_id, completion_percent, completed_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE completion_percent=VALUES(completion_percent), completed_at=IF(VALUES(completion_percent)>=100, COALESCE(course_completions.completed_at, VALUES(completed_at)), NULL), updated_at=CURRENT_TIMESTAMP');
    $stmt->bind_param('iids', $uid2, $courseId, $completionPercent, $completedAt);
    $stmt->execute();
    $stmt->close();
}

// Next course in sequence
$nextCourse = null;
$stmt = $db->prepare('SELECT id, slug, name, short_description, price_usd, icon, accent, category_label, difficulty, estimated_time, sequence_order FROM courses WHERE sequence_order > ? ORDER BY sequence_order ASC LIMIT 1');
$seq = (int)$course['sequence_order'];
$stmt->bind_param('i', $seq);
$stmt->execute();
$next = $stmt->get_result()->fetch_assoc();
$stmt->close();
if ($next) {
    $nextCourse = [
        'id' => (int)$next['id'],
        'slug' => $next['slug'],
        'name' => $next['name'],
        'short_description' => $next['short_description'],
        'price_usd' => (float)$next['price_usd'],
        'icon' => $next['icon'],
        'accent' => $next['accent'],
        'category' => $next['category_label'],
        'difficulty' => $next['difficulty'],
        'estimated_time' => $next['estimated_time'],
        'unlocked' => true,
    ];
}

learnhub_json_response([
    'ok' => true,
    'authenticated' => (bool)$user,
    'user' => $user ? ['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email']] : null,
    'course' => [
        'id' => $courseId,
        'slug' => $course['slug'],
        'name' => $course['name'],
        'short_description' => $course['short_description'],
        'category' => $course['category_label'],
        'difficulty' => $course['difficulty'],
        'estimated_time' => $course['estimated_time'],
        'icon' => $course['icon'],
        'accent' => $course['accent'],
        'price_usd' => (float)$course['price_usd'],
        'sequence_order' => (int)$course['sequence_order'],
        'has_access' => $hasAccess,
        'access_source' => $accessSource,
    ],
    'lessons' => $lessonPayload,
    'progress' => [
        'completed_count' => $completedCount,
        'total_lessons' => $totalLessons,
        'completion_percent' => $completionPercent,
        'course_completed' => $courseCompleted,
    ],
    'next_course' => $nextCourse,
]);
