<?php
$qs = $_SERVER['QUERY_STRING'] ?? '';
$target = 'course/course.php' . ($qs !== '' ? '?' . $qs : '');
header('Location: ' . $target, true, 302);
exit;
