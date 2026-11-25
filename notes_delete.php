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
if ($id <= 0) learnhub_json_response(['ok' => false, 'error' => 'Invalid note id.'], 422);

$stmt = $db->prepare('SELECT id, stored_file_name FROM course_notes WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $id);
$stmt->execute();
$note = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$note) learnhub_json_response(['ok' => false, 'error' => 'Note not found.'], 404);

$del = $db->prepare('DELETE FROM course_notes WHERE id = ?');
$del->bind_param('i', $id);
$ok = $del->execute();
$del->close();
if (!$ok) learnhub_json_response(['ok' => false, 'error' => 'Failed to delete note.'], 500);

$stored = basename((string)$note['stored_file_name']);
$baseDir = realpath(LEARNHUB_NOTES_UPLOAD_DIR);
$fullPath = realpath(LEARNHUB_NOTES_UPLOAD_DIR . DIRECTORY_SEPARATOR . $stored);
if ($baseDir && $fullPath && strpos($fullPath, $baseDir) === 0 && is_file($fullPath)) {
    @unlink($fullPath);
}

learnhub_json_response(['ok' => true, 'message' => 'Note deleted.']);
