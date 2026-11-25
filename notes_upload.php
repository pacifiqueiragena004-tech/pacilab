<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
learnhub_ensure_notes_schema($db);
$user = learnhub_require_user($db);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    learnhub_json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

$title = trim((string)($_POST['title'] ?? ''));
$category = trim((string)($_POST['course_category'] ?? ''));
$allowedCategories = ['Programming', 'Networking', 'Software', 'Computer System', 'IoT', 'Rwanda School Notes', 'Other'];
if ($title === '') {
    // Default to original filename without extension
    $title = '';
}
if ($category === '' || !in_array($category, $allowedCategories, true)) {
    learnhub_json_response(['ok' => false, 'error' => 'Please select a valid course category.'], 422);
}

if (!isset($_FILES['note_file']) || !is_array($_FILES['note_file'])) {
    learnhub_json_response(['ok' => false, 'error' => 'No file uploaded.'], 422);
}
$file = $_FILES['note_file'];
if ((int)$file['error'] !== UPLOAD_ERR_OK) {
    $msg = 'File upload failed.';
    if ((int)$file['error'] === UPLOAD_ERR_INI_SIZE || (int)$file['error'] === UPLOAD_ERR_FORM_SIZE) $msg = 'File is too large.';
    learnhub_json_response(['ok' => false, 'error' => $msg], 422);
}

$maxBytes = (int)LEARNHUB_NOTES_MAX_BYTES;
$size = (int)$file['size'];
if ($size <= 0 || $size > $maxBytes) {
    learnhub_json_response(['ok' => false, 'error' => 'File size must be between 1 byte and ' . learnhub_notes_format_size($maxBytes) . '.'], 422);
}

$originalName = basename((string)$file['name']);
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowed = LEARNHUB_NOTES_ALLOWED;
if (!isset($allowed[$ext])) {
    learnhub_json_response(['ok' => false, 'error' => 'File type not allowed. Allowed: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG.'], 422);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : '';
if ($finfo) finfo_close($finfo);
$mime = strtolower(trim((string)$mime));
$allowedMimes = $allowed[$ext];
if ($mime === '' || !in_array($mime, $allowedMimes, true)) {
    // Some servers report docx/pptx as zip or octet-stream; also allow jpg/jpeg variations
    $softOk = in_array($mime, ['application/octet-stream', 'application/zip'], true) && in_array($ext, ['docx','pptx'], true);
    if (!$softOk) {
        learnhub_json_response(['ok' => false, 'error' => 'File content type does not match the file extension.'], 422);
    }
}

// Extra guard: reject PHP/script content in text-like uploads
if (in_array($ext, ['txt'], true)) {
    $snippet = file_get_contents($file['tmp_name'], false, null, 0, 4096);
    if ($snippet !== false && preg_match('/<\?php|<script\b/i', $snippet)) {
        learnhub_json_response(['ok' => false, 'error' => 'File content is not allowed.'], 422);
    }
}

if ($title === '') {
    $title = pathinfo($originalName, PATHINFO_FILENAME);
    $title = preg_replace('/[_\-]+/', ' ', $title);
    $title = trim(preg_replace('/\s+/', ' ', $title));
}
$title = mb_substr($title, 0, 200);
if ($title === '') $title = 'Course Note';

$uploadDir = LEARNHUB_NOTES_UPLOAD_DIR;
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}
$storedName = bin2hex(random_bytes(16)) . '_' . time() . '.' . $ext;
$destPath = $uploadDir . DIRECTORY_SEPARATOR . $storedName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    learnhub_json_response(['ok' => false, 'error' => 'Failed to save uploaded file.'], 500);
}
@chmod($destPath, 0640);

$isAdmin = learnhub_is_admin($user);
$approvalRequired = (bool)LEARNHUB_NOTES_APPROVAL_REQUIRED;
$status = ($approvalRequired && !$isAdmin) ? 'pending' : 'approved';

$relativePath = 'uploads/notes/' . $storedName;
$stmt = $db->prepare('INSERT INTO course_notes (title, original_file_name, stored_file_name, file_path, file_type, file_size, course_category, uploaded_by, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$uid = (int)$user['id'];
$extDb = $ext === 'jpeg' ? 'jpg' : $ext;
$stmt->bind_param('sssssisis', $title, $originalName, $storedName, $relativePath, $extDb, $size, $category, $uid, $status);
if (!$stmt->execute()) {
    @unlink($destPath);
    $stmt->close();
    learnhub_json_response(['ok' => false, 'error' => 'Failed to save note record.'], 500);
}
$id = (int)$stmt->insert_id;
$stmt->close();

learnhub_json_response([
    'ok' => true,
    'message' => $status === 'approved' ? 'Notes uploaded successfully.' : 'Notes uploaded successfully and are pending admin approval.',
    'note' => [
        'id' => $id,
        'title' => $title,
        'original_file_name' => $originalName,
        'file_type' => $extDb,
        'file_size' => $size,
        'file_size_label' => learnhub_notes_format_size($size),
        'course_category' => $category,
        'uploaded_by' => $user['name'],
        'upload_date' => date('Y-m-d H:i:s'),
        'approval_status' => $status,
    ]
]);
