<?php
require_once __DIR__ . '/../db_config.php';
$courseSlug = strtolower(trim((string)($_GET['course'] ?? 'html')));
$courseSlug = preg_replace('/[^a-z0-9-]/', '', $courseSlug);
if ($courseSlug === '') { $courseSlug = 'html'; }
$currentUser = null;
$initialCourse = null;
$db = learnhub_db_connect();
if ($db) {
    $uid = learnhub_current_user_id();
    if ($uid) {
        $stmt = $db->prepare('SELECT id, name, email FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $currentUser = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($currentUser) { learnhub_ensure_first_course_access($db, (int)$currentUser['id']); }
    }
    $stmt = $db->prepare('SELECT name, short_description, icon, accent FROM courses WHERE slug = ? LIMIT 1');
    $stmt->bind_param('s', $courseSlug);
    $stmt->execute();
    $initialCourse = $stmt->get_result()->fetch_assoc();
    $stmt->close();
}
$pageTitle = $initialCourse ? ($initialCourse['name'] . ' Course - LEARNHUB') : 'Course Dashboard - LEARNHUB';
$pageDesc = $initialCourse ? $initialCourse['short_description'] : 'Dynamic LEARNHUB course dashboard.';
$accent = $initialCourse['accent'] ?? '#0d8bf2';
$icon = $initialCourse['icon'] ?? 'LH';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8'); ?></title>
  <meta name="description" content="<?php echo htmlspecialchars($pageDesc, ENT_QUOTES, 'UTF-8'); ?>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="course.css">
</head>
<body class="course-body" style="--course-accent: <?php echo htmlspecialchars($accent, ENT_QUOTES, 'UTF-8'); ?>;">
  <div class="course-app" id="course-app" data-course-slug="<?php echo htmlspecialchars($courseSlug, ENT_QUOTES, 'UTF-8'); ?>">
    <aside class="course-sidebar" aria-label="Dashboard sidebar">
      <a class="course-brand" href="../index.html" aria-label="LEARNHUB home">
        <span class="logo-mark small"><span class="logo-book"></span><span class="logo-dot"></span></span>
        <span class="logo-text">LEARN<span class="logo-hub">HUB</span></span>
      </a>
      <nav class="sidebar-nav" aria-label="Dashboard navigation">
        <a href="../index.html" class="sidebar-link"><span class="sidebar-icon">⌂</span><span>Dashboard</span></a>
        <a href="courses.html" class="sidebar-link active"><span class="sidebar-icon">▣</span><span>My Courses</span></a>
        <a href="#progress" class="sidebar-link" data-sidebar-scroll="progress"><span class="sidebar-icon">◔</span><span>My Progress</span></a>
        <a href="#lessons" class="sidebar-link" data-sidebar-scroll="lessons"><span class="sidebar-icon">?</span><span>Quizzes</span></a>
        <a href="#progress" class="sidebar-link" data-sidebar-scroll="progress"><span class="sidebar-icon">✓</span><span>Certificates</span></a>
        <a href="../about.html" class="sidebar-link"><span class="sidebar-icon">☺</span><span>Community</span></a>
        <a href="../contact.html" class="sidebar-link"><span class="sidebar-icon">◉</span><span>Profile</span></a>
        <a href="../resources.html" class="sidebar-link"><span class="sidebar-icon">⚙</span><span>Settings</span></a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user">
          <span class="sidebar-user-name"><?php echo htmlspecialchars($currentUser['name'] ?? 'Guest Student', ENT_QUOTES, 'UTF-8'); ?></span>
          <span class="sidebar-user-email"><?php echo htmlspecialchars($currentUser['email'] ?? 'Log in to save progress', ENT_QUOTES, 'UTF-8'); ?></span>
        </div>
        <a href="../index.html" class="sidebar-logout" id="sidebar-auth-action"><?php echo $currentUser ? 'Logout' : 'Login / Sign Up'; ?></a>
      </div>
    </aside>

    <div class="course-main">
      <header class="course-topbar">
        <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Open menu"><span></span><span></span><span></span></button>
        <form class="course-search" role="search" id="course-search-form">
          <label class="sr-only" for="course-search-input">Search courses</label>
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input id="course-search-input" type="search" placeholder="Search courses, lessons, topics...">
        </form>
        <div class="topbar-actions">
          <button type="button" class="icon-btn" id="notification-btn" aria-label="Notifications">🔔<span class="notify-dot"></span></button>
          <div class="topbar-profile" id="topbar-profile">
            <div class="profile-avatar" id="topbar-avatar"><?php echo htmlspecialchars(strtoupper(substr($currentUser['name'] ?? 'G', 0, 1)), ENT_QUOTES, 'UTF-8'); ?></div>
            <div class="profile-meta">
              <strong id="topbar-name"><?php echo htmlspecialchars($currentUser['name'] ?? 'Guest', ENT_QUOTES, 'UTF-8'); ?></strong>
              <span id="topbar-role"><?php echo $currentUser ? 'Student' : 'Not signed in'; ?></span>
            </div>
          </div>
        </div>
      </header>

      <main class="course-content">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="../index.html">Home</a><span aria-hidden="true">/</span>
          <a href="courses.html">Courses</a><span aria-hidden="true">/</span>
          <span id="breadcrumb-course"><?php echo htmlspecialchars($initialCourse['name'] ?? 'Course', ENT_QUOTES, 'UTF-8'); ?></span>
        </nav>

        <section class="course-hero card-surface" id="overview">
          <div class="course-hero-main">
            <div class="course-badge" id="course-badge" style="--course-accent: <?php echo htmlspecialchars($accent, ENT_QUOTES, 'UTF-8'); ?>;">
              <span class="course-badge-icon"><?php echo htmlspecialchars($icon, ENT_QUOTES, 'UTF-8'); ?></span>
            </div>
            <div class="course-hero-copy">
              <p class="eyebrow" id="course-category">Course</p>
              <h1 id="course-title"><?php echo htmlspecialchars($initialCourse['name'] ?? 'Loading course...', ENT_QUOTES, 'UTF-8'); ?></h1>
              <p class="course-description" id="course-description"><?php echo htmlspecialchars($initialCourse['short_description'] ?? 'Loading course details from the database.', ENT_QUOTES, 'UTF-8'); ?></p>
              <div class="course-meta-row">
                <span class="meta-pill" id="course-difficulty">Difficulty: -</span>
                <span class="meta-pill" id="course-time">Estimated time: -</span>
                <span class="meta-pill" id="course-access">Access: -</span>
              </div>
            </div>
          </div>
          <div class="course-hero-side" id="progress">
            <div class="progress-panel">
              <div class="progress-panel-head">
                <span>Course Progress</span>
                <strong id="progress-percent">0%</strong>
              </div>
              <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Course completion">
                <div class="progress-fill" id="progress-fill" style="width:0%"></div>
              </div>
              <p class="progress-caption" id="progress-caption">0 of 0 lessons completed</p>
            </div>
          </div>
        </section>

        <section class="course-stats" aria-label="Course statistics">
          <article class="stat-card card-surface"><span class="stat-label">Completed lessons</span><strong class="stat-value" id="stat-completed">0</strong><span class="stat-detail" id="stat-completed-detail">Keep learning</span></article>
          <article class="stat-card card-surface"><span class="stat-label">Total lessons</span><strong class="stat-value" id="stat-total">0</strong><span class="stat-detail">Course modules</span></article>
          <article class="stat-card card-surface"><span class="stat-label">Completion</span><strong class="stat-value" id="stat-percent">0%</strong><span class="stat-detail" id="stat-percent-detail">In progress</span></article>
        </section>

        <section class="card-surface curriculum-section" id="lessons">
          <div class="section-head">
            <div>
              <p class="eyebrow">Course Modules</p>
              <h2 id="curriculum-title">Course Lessons</h2>
            </div>
            <p class="section-note" id="curriculum-note">All lessons are available. You can study in any order and track your progress.</p>
          </div>
          <div class="lesson-list" id="lesson-list" aria-live="polite"></div>
        </section>

        <section class="card-surface next-course-section" id="next-course-section" hidden>
          <div class="section-head">
            <div>
              <p class="eyebrow">Next Course</p>
              <h2 id="next-course-title">Continue to your next course</h2>
            </div>
            <span class="status-pill available" id="next-course-status">Available</span>
          </div>
          <div class="next-course-card">
            <div class="next-course-info">
              <div class="next-course-badge" id="next-course-badge">NEXT</div>
              <div>
                <h3 id="next-course-name"></h3>
                <p id="next-course-description"></p>
                <div class="course-meta-row">
                  <span class="meta-pill" id="next-course-category"></span>
                  <span class="meta-pill" id="next-course-difficulty"></span>
                  <span class="meta-pill" id="next-course-price"></span>
                </div>
              </div>
            </div>
            <div class="next-course-action">
              <p id="next-course-message">This course is available. You can open it anytime.</p>
              <button type="button" class="btn btn-primary" id="next-course-pay-btn" hidden>Pay Now to Unlock Next Course</button>
              <a href="#" class="btn btn-primary" id="next-course-open-btn">Open Next Course</a>
            </div>
          </div>
        </section>

        <div class="dashboard-status" id="dashboard-status" role="status" aria-live="polite"></div>
      </main>
    </div>
  </div>

  <div class="lesson-modal" id="lesson-modal" hidden>
    <div class="lesson-modal-backdrop" data-close-modal></div>
    <div class="lesson-modal-dialog card-surface" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-title">
      <button type="button" class="modal-close" id="lesson-modal-close" aria-label="Close lesson">×</button>
      <p class="eyebrow" id="lesson-modal-kicker">Lesson</p>
      <h2 id="lesson-modal-title"></h2>
      <p class="lesson-modal-desc" id="lesson-modal-desc"></p>
      <div class="lesson-content" id="lesson-modal-content"></div>
    </div>
  </div>

  <script>window.LEARNHUB_COURSE_SLUG = <?php echo json_encode($courseSlug); ?>;</script>
  <script src="course.js"></script>
</body>
</html>
