<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
learnhub_ensure_notes_schema($db);
$user = learnhub_require_user($db);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    learnhub_json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
if (!learnhub_is_admin($user)) {
    learnhub_json_response(['ok' => false, 'error' => 'Admin access required.'], 403);
}
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = $_POST;
$id = (int)($input['id'] ?? 0);
$status = trim((string)($input['status'] ?? 'approved'));
if ($id <= 0) learnhub_json_response(['ok' => false, 'error' => 'Invalid note id.'], 422);
if (!in_array($status, ['approved','rejected','pending'], true)) {
    learnhub_json_response(['ok' => false, 'error' => 'Invalid status.'], 422);
}
$stmt = $db->prepare('UPDATE course_notes SET approval_status = ? WHERE id = ?');
$stmt->bind_param('si', $status, $id);
$ok = $stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
if (!$ok) learnhub_json_response(['ok' => false, 'error' => 'Failed to update note.'], 500);

learnhub_json_response(['ok' => true, 'message' => 'Note status updated.', 'status' => $status, 'updated' => $affected > 0]);
