<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
$user = learnhub_require_user($db);
$body = learnhub_read_json_body();
$currentSlug = strtolower(trim((string)($body['current_course_slug'] ?? '')));
$nextSlug = strtolower(trim((string)($body['next_course_slug'] ?? '')));
if ($currentSlug === '' || $nextSlug === '') {
    learnhub_json_response(['ok' => false, 'error' => 'current_course_slug and next_course_slug are required.'], 400);
}
$uid = (int)$user['id'];

$stmt = $db->prepare('SELECT id, sequence_order FROM courses WHERE slug = ? LIMIT 1');
$stmt->bind_param('s', $currentSlug);
$stmt->execute();
$current = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$current) learnhub_json_response(['ok' => false, 'error' => 'Current course not found.'], 404);

$stmt = $db->prepare('SELECT id, slug, name, price_usd, sequence_order FROM courses WHERE slug = ? LIMIT 1');
$stmt->bind_param('s', $nextSlug);
$stmt->execute();
$next = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$next) learnhub_json_response(['ok' => false, 'error' => 'Next course not found.'], 404);

if ((int)$next['sequence_order'] <= (int)$current['sequence_order']) {
    learnhub_json_response(['ok' => false, 'error' => 'Invalid next course.'], 400);
}

// Verify current course completed
$stmt = $db->prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN lp.is_completed=1 THEN 1 ELSE 0 END) AS done FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=? WHERE l.course_id=?');
$currentId = (int)$current['id'];
$stmt->bind_param('ii', $uid, $currentId);
$stmt->execute();
$prog = $stmt->get_result()->fetch_assoc();
$stmt->close();
$total = (int)($prog['total'] ?? 0);
$done = (int)($prog['done'] ?? 0);
if ($total <= 0 || $done < $total) {
    learnhub_json_response(['ok' => false, 'error' => 'Complete all lessons in the current course before unlocking the next course.'], 403);
}

// Check if already unlocked
$nextId = (int)$next['id'];
$stmt = $db->prepare('SELECT id FROM student_course_access WHERE user_id=? AND course_id=? LIMIT 1');
$stmt->bind_param('ii', $uid, $nextId);
$stmt->execute();
$already = $stmt->get_result()->fetch_assoc();
$stmt->close();
if ($already) {
    learnhub_json_response(['ok' => true, 'already_unlocked' => true, 'course_slug' => $next['slug']]);
}

$amount = (float)$next['price_usd'];
$currency = 'USD';
$provider = 'simulated_gateway';
$reference = 'PAY-' . strtoupper(bin2hex(random_bytes(8)));
$clientToken = bin2hex(random_bytes(24));
$tokenHash = password_hash($clientToken, PASSWORD_DEFAULT);
$payload = json_encode(['token_hash' => $tokenHash, 'current_course_id' => $currentId, 'next_course_id' => $nextId, 'amount' => $amount, 'currency' => $currency]);

$stmt = $db->prepare('INSERT INTO payments (user_id, course_id, amount, currency, status, provider, provider_reference, verification_payload) VALUES (?, ?, ?, ?, "pending", ?, ?, ?)');
$stmt->bind_param('iidssss', $uid, $nextId, $amount, $currency, $provider, $reference, $payload);
$stmt->execute();
$paymentId = (int)$db->insert_id;
$stmt->close();

learnhub_json_response([
    'ok' => true,
    'payment' => [
        'id' => $paymentId,
        'reference' => $reference,
        'client_token' => $clientToken,
        'amount' => $amount,
        'currency' => $currency,
        'course_slug' => $next['slug'],
        'course_name' => $next['name'],
        'status' => 'pending'
    ]
]);
