<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
$user = learnhub_require_user($db);
$body = learnhub_read_json_body();
$reference = trim((string)($body['reference'] ?? ''));
$clientToken = (string)($body['client_token'] ?? '');
if ($reference === '' || $clientToken === '') {
    learnhub_json_response(['ok' => false, 'error' => 'reference and client_token are required.'], 400);
}
$uid = (int)$user['id'];

$db->begin_transaction();
try {
    $stmt = $db->prepare('SELECT * FROM payments WHERE provider_reference = ? AND user_id = ? FOR UPDATE');
    $stmt->bind_param('si', $reference, $uid);
    $stmt->execute();
    $payment = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$payment) { throw new RuntimeException('Payment not found.'); }
    if ($payment['status'] === 'confirmed') {
        $db->commit();
        learnhub_json_response(['ok' => true, 'status' => 'confirmed', 'already_confirmed' => true, 'course_id' => (int)$payment['course_id']]);
    }
    if ($payment['status'] !== 'pending') { throw new RuntimeException('Payment is not pending.'); }

    $payload = json_decode($payment['verification_payload'] ?: '{}', true) ?: [];
    $tokenHash = $payload['token_hash'] ?? '';
    if (!$tokenHash || !password_verify($clientToken, $tokenHash)) {
        throw new RuntimeException('Payment verification failed.');
    }

    $courseId = (int)$payment['course_id'];
    $amount = (float)$payment['amount'];

    // Server-side verification: ensure course exists and amount matches expected price
    $stmt = $db->prepare('SELECT id, slug, price_usd, sequence_order FROM courses WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $courseId);
    $stmt->execute();
    $course = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$course) { throw new RuntimeException('Course not found.'); }
    if ((float)$course['price_usd'] != $amount) { throw new RuntimeException('Payment amount mismatch.'); }

    // Ensure current course in sequence is completed
    $stmt = $db->prepare('SELECT id FROM courses WHERE sequence_order < ? ORDER BY sequence_order DESC LIMIT 1');
    $seq = (int)$course['sequence_order'];
    $stmt->bind_param('i', $seq);
    $stmt->execute();
    $prevCourse = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($prevCourse) {
        $prevId = (int)$prevCourse['id'];
        $stmt = $db->prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN lp.is_completed=1 THEN 1 ELSE 0 END) AS done FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=? WHERE l.course_id=?');
        $stmt->bind_param('ii', $uid, $prevId);
        $stmt->execute();
        $prog = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $total = (int)($prog['total'] ?? 0);
        $done = (int)($prog['done'] ?? 0);
        if ($total <= 0 || $done < $total) {
            throw new RuntimeException('Current course must be completed before unlocking this course.');
        }
    }

    // Simulated gateway verification point: in production, call gateway API/webhook signature here.
    $verifiedAt = date('Y-m-d H:i:s');
    $stmt = $db->prepare('UPDATE payments SET status="confirmed", verified_at=? WHERE id=? AND status="pending"');
    $pid = (int)$payment['id'];
    $stmt->bind_param('si', $verifiedAt, $pid);
    $stmt->execute();
    $updated = $stmt->affected_rows;
    $stmt->close();
    if ($updated < 1) { throw new RuntimeException('Payment could not be confirmed.'); }

    $stmt = $db->prepare('INSERT INTO student_course_access (user_id, course_id, unlock_source, payment_id, granted_at) VALUES (?, ?, "payment", ?, NOW()) ON DUPLICATE KEY UPDATE unlock_source=VALUES(unlock_source), payment_id=VALUES(payment_id)');
    $pid = (int)$payment['id'];
    $stmt->bind_param('iii', $uid, $courseId, $pid);
    $stmt->execute();
    $stmt->close();

    $db->commit();
    learnhub_json_response(['ok' => true, 'status' => 'confirmed', 'course_slug' => $course['slug'], 'course_id' => $courseId]);
} catch (Throwable $e) {
    $db->rollback();
    $msg = $e->getMessage();
    if ($msg === 'Payment not found.') learnhub_json_response(['ok' => false, 'error' => $msg], 404);
    if ($msg === 'Payment verification failed.' || $msg === 'Current course must be completed before unlocking this course.') {
        learnhub_json_response(['ok' => false, 'error' => $msg], 403);
    }
    learnhub_json_response(['ok' => false, 'error' => $msg], 400);
}
