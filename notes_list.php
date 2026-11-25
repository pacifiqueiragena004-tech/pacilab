<?php
require_once __DIR__ . '/../db_config.php';
$db = learnhub_db_required();
learnhub_ensure_notes_schema($db);
$user = learnhub_require_user($db);

$q = trim((string)($_GET['q'] ?? ''));
$category = trim((string)($_GET['category'] ?? ''));
$status = trim((string)($_GET['status'] ?? ''));
$isAdmin = learnhub_is_admin($user);
$uid = (int)$user['id'];

$where = [];
$params = [];
$types = '';
if ($isAdmin) {
    if ($status !== '' && in_array($status, ['pending','approved','rejected'], true)) {
        $where[] = 'n.approval_status = ?';
        $params[] = $status;
        $types .= 's';
    }
} else {
    $where[] = "(n.approval_status = 'approved' OR n.uploaded_by = ?)";
    $params[] = $uid;
    $types .= 'i';
}
if ($category !== '' && $category !== 'all') {
    $where[] = 'n.course_category = ?';
    $params[] = $category;
    $types .= 's';
}
if ($q !== '') {
    $where[] = '(n.title LIKE ? OR n.original_file_name LIKE ? OR n.course_category LIKE ? OR u.name LIKE ?)';
    $like = '%' . $q . '%';
    array_push($params, $like, $like, $like, $like);
    $types .= 'ssss';
}

$sql = "SELECT n.id, n.title, n.original_file_name, n.file_type, n.file_size, n.course_category, n.uploaded_by, n.upload_date, n.approval_status, u.name AS uploader_name
        FROM course_notes n
        JOIN users u ON u.id = n.uploaded_by";
if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
$sql .= ' ORDER BY n.upload_date DESC, n.id DESC LIMIT 200';

$stmt = $db->prepare($sql);
if ($types !== '') $stmt->bind_param($types, ...$params);
$stmt->execute();
$res = $stmt->get_result();
$notes = [];
while ($row = $res->fetch_assoc()) {
    $row['id'] = (int)$row['id'];
    $row['file_size'] = (int)$row['file_size'];
    $row['file_size_label'] = learnhub_notes_format_size($row['file_size']);
    $row['uploaded_by'] = (int)$row['uploaded_by'];
    $row['is_owner'] = $row['uploaded_by'] === $uid;
    $row['view_url'] = 'api/notes_file.php?id=' . $row['id'] . '&mode=view';
    $row['download_url'] = 'api/notes_file.php?id=' . $row['id'] . '&mode=download';
    $notes[] = $row;
}
$stmt->close();

learnhub_json_response(['ok' => true, 'notes' => $notes, 'is_admin' => $isAdmin]);
