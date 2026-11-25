<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
learnhub_ensure_notes_schema($db);
$user = learnhub_require_user($db);

$id = (int)($_GET['id'] ?? 0);
$mode = ($_GET['mode'] ?? 'view') === 'download' ? 'download' : 'view';
if ($id <= 0) {
    http_response_code(400);
    echo 'Invalid note id.';
    exit;
}

$stmt = $db->prepare('SELECT n.*, u.name AS uploader_name FROM course_notes n JOIN users u ON u.id = n.uploaded_by WHERE n.id = ? LIMIT 1');
$stmt->bind_param('i', $id);
$stmt->execute();
$note = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$note) {
    http_response_code(404);
    echo 'Note not found.';
    exit;
}

$isAdmin = learnhub_is_admin($user);
$isOwner = (int)$note['uploaded_by'] === (int)$user['id'];
$approved = $note['approval_status'] === 'approved';
if (!$approved && !$isAdmin && !$isOwner) {
    http_response_code(403);
    echo 'You do not have access to this note.';
    exit;
}

$stored = basename((string)$note['stored_file_name']);
$baseDir = realpath(LEARNHUB_NOTES_UPLOAD_DIR);
$fullPath = realpath(LEARNHUB_NOTES_UPLOAD_DIR . DIRECTORY_SEPARATOR . $stored);
if (!$baseDir || !$fullPath || strpos($fullPath, $baseDir) !== 0 || !is_file($fullPath)) {
    http_response_code(404);
    echo 'File not found.';
    exit;
}

$ext = strtolower((string)$note['file_type']);
$mimeMap = [
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt' => 'application/vnd.ms-powerpoint',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt' => 'text/plain; charset=UTF-8',
    'jpg' => 'image/jpeg',
    'png' => 'image/png',
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';
$downloadName = preg_replace('/[^A-Za-z0-9._ -]/', '_', (string)$note['original_file_name']);
if ($downloadName === '') $downloadName = 'note.' . $ext;

header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . filesize($fullPath));
$disposition = $mode === 'download' ? 'attachment' : 'inline';
header('Content-Disposition: ' . $disposition . '; filename="' . str_replace('"', '', $downloadName) . '"');
if ($ext === 'txt') {
    header('Content-Security-Policy: default-src \'none\'; style-src \'unsafe-inline\'');
}
readfile($fullPath);
exit;
