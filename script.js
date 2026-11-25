document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let csrfToken = '';

  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (url, opts = {}) => {
    const method = String(opts.method || 'GET').toUpperCase();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrfToken;
    const res = await fetch(url, { headers, credentials: 'same-origin', ...opts });
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid server response.' }));
    if (data && data.csrf_token) csrfToken = data.csrf_token;
    if (!res.ok || data.ok === false) throw Object.assign(new Error(data.error || 'Request failed.'), { data, status: res.status });
    return data;
  };

  const getCurrentUser = () => currentUser;
  const setCurrentUser = (user) => { currentUser = user ? { id: user.id, name: user.name, email: user.email, role: user.role || 'student', teacher_approved: Number(user.teacher_approved || 0), is_admin: Number(user.is_admin || 0) } : null; };
  const getCsrfToken = () => csrfToken;
  window.learnhubGetCsrfToken = getCsrfToken;
  const refreshSession = async () => {
    try {
      const data = await api('api/auth_me.php');
      if (data.csrf_token) csrfToken = data.csrf_token;
      setCurrentUser(data.authenticated ? data.user : null);
    } catch {
      setCurrentUser(null);
    }
    renderAuthUI();
    return currentUser;
  };

  // Account dropdown menus
  const accountMenus = document.querySelectorAll('[data-account-menu]');
  accountMenus.forEach((menu) => {
    const toggle = menu.querySelector('[data-account-toggle]');
    const panel = menu.querySelector('.account-panel');
    const closeBtn = menu.querySelector('[data-account-close]');
    if (!toggle || !panel) return;
    const closeMenu = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
    const openMenu = () => { menu.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); };
    toggle.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (menu.classList.contains('open')) { closeMenu(); }
      else {
        document.querySelectorAll('[data-account-menu].open').forEach((m) => { if (m !== menu) { m.classList.remove('open'); const t = m.querySelector('[data-account-toggle]'); if (t) t.setAttribute('aria-expanded', 'false'); } });
        openMenu();
      }
    });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeMenu(); });
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  });

  // Auth modal
  const authModal = document.querySelector('[data-auth-modal]');
  const authForms = document.querySelectorAll('[data-auth-form]');
  const authTabs = document.querySelectorAll('[data-auth-tab]');
  const authMessage = document.querySelector('[data-auth-message]');

  const setAuthMode = (mode) => {
    authTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.authTab === mode));
    authForms.forEach((form) => form.classList.toggle('active', form.dataset.authForm === mode));
    if (authMessage) { authMessage.textContent = ''; authMessage.className = 'auth-message'; }
  };
  const openAuthModal = (mode = 'login') => {
    if (!authModal) return;
    setAuthMode(mode);
    authModal.classList.add('open');
    authModal.setAttribute('aria-hidden', 'false');
  };
  const closeAuthModal = () => {
    if (!authModal) return;
    authModal.classList.remove('open');
    authModal.setAttribute('aria-hidden', 'true');
  };
  document.querySelectorAll('[data-open-auth]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.preventDefault(); openAuthModal(btn.dataset.openAuth || 'login'); });
  });
  document.querySelectorAll('[data-close-auth]').forEach((btn) => { btn.addEventListener('click', closeAuthModal); });
  if (authModal) authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAuthModal(); });
  authTabs.forEach((tab) => { tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab)); });
  const showAuthMessage = (text, type = 'info') => {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
  };

  const renderAuthUI = () => {
    const user = getCurrentUser();
    document.querySelectorAll('[data-auth-show="logged-in"]').forEach((el) => { el.hidden = !user; });
    document.querySelectorAll('[data-auth-show="logged-out"]').forEach((el) => { el.hidden = !!user; });
    document.querySelectorAll('[data-auth-user-name]').forEach((el) => { el.textContent = user ? (user.name || user.email) : 'Guest'; });
    document.querySelectorAll('[data-auth-user-email]').forEach((el) => { el.textContent = user ? user.email : 'Not signed in'; });
    document.querySelectorAll('[data-auth-user-label]').forEach((el) => { el.textContent = user ? (user.name || 'Account') : 'Account'; });
    document.querySelectorAll('[data-protected-task]').forEach((el) => {
      const locked = !user;
      el.classList.toggle('locked', locked);
      if (locked) el.setAttribute('data-locked', 'true'); else el.removeAttribute('data-locked');
    });
    const status = document.querySelector('[data-auth-status]');
    if (status) {
      status.textContent = user ? `Logged in as ${user.name || user.email}. You can upload and download notes.` : 'Log in or sign up to upload and download notes.';
      status.className = `auth-status ${user ? 'ok' : 'warn'}`;
    }
  };

  const signupForm = document.querySelector('[data-auth-form="signup"]');
  if (signupForm) {
    signupForm.querySelectorAll('[data-role-select]').forEach((card) => {
      card.addEventListener('click', () => {
        signupForm.querySelectorAll('[data-role-select]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const input = signupForm.querySelector('[name="role"]');
        if (input) input.value = card.dataset.roleSelect || 'student';
      });
    });
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = signupForm.querySelector('[name="name"]').value.trim();
      const email = signupForm.querySelector('[name="email"]').value.trim().toLowerCase();
      const password = signupForm.querySelector('[name="password"]').value;
      const role = (signupForm.querySelector('[name="role"]')?.value || 'student').toLowerCase();
      if (!name || !email || !password) { showAuthMessage('Please fill in all fields.', 'error'); return; }
      if (!['student', 'teacher'].includes(role)) { showAuthMessage('Please select a Teacher or Student account type.', 'error'); return; }
      if (password.length < 4) { showAuthMessage('Password must be at least 4 characters.', 'error'); return; }
      try {
        const data = await api('api/auth_register.php', { method: 'POST', body: JSON.stringify({ name, email, password, role, csrf_token: csrfToken }) });
        setCurrentUser(data.user);
        showAuthMessage(data.message || 'Account created successfully. You are now logged in.', 'success');
        renderAuthUI();
        setTimeout(closeAuthModal, role === 'teacher' ? 1800 : 700);
      } catch (err) {
        showAuthMessage(err.message || 'Registration failed.', 'error');
        if (err.status === 409) setAuthMode('login');
      }
    });
  }

  const loginForm = document.querySelector('[data-auth-form="login"]');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.querySelector('[name="email"]').value.trim().toLowerCase();
      const password = loginForm.querySelector('[name="password"]').value;
      try {
        const data = await api('api/auth_login.php', { method: 'POST', body: JSON.stringify({ email, password }) });
        setCurrentUser(data.user);
        showAuthMessage('Logged in successfully.', 'success');
        renderAuthUI();
        setTimeout(closeAuthModal, 500);
      } catch (err) {
        showAuthMessage(err.message || 'Invalid email or password.', 'error');
      }
    });
  }

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await api('api/auth_logout.php', { method: 'POST', body: '{}' }); } catch {}
      setCurrentUser(null);
      renderAuthUI();
    });
  });

  const requireAuth = () => {
    const user = getCurrentUser();
    if (!user) {
      openAuthModal('login');
      showAuthMessage('Please log in or sign up to use this feature.', 'error');
      return null;
    }
    return user;
  };
  window.requireAuth = requireAuth;
  window.learnhubGetCurrentUser = getCurrentUser;
  window.learnhubRefreshSession = refreshSession;

  refreshSession();
  document.querySelectorAll('[data-download-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const user = requireAuth();
      if (!user) return;
      const noteName = btn.dataset.downloadNote || 'LearnHub Note';
      const content = `${noteName}\n\nPrepared for: ${user.name || user.email}\n\nThis is a sample downloadable note from LearnHub. Log in to access and manage your learning resources.\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${noteName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-notes.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  });

  const uploadsList = document.querySelector('[data-upload-list]');
  document.querySelectorAll('[data-upload-input]').forEach((input) => {
    input.addEventListener('change', () => {
      const user = requireAuth();
      if (!user) { input.value = ''; return; }
      const files = Array.from(input.files || []);
      if (!files.length) return;
      if (uploadsList) {
        files.forEach((file) => {
          const li = document.createElement('li');
          li.innerHTML = `<span>${escapeHtml(file.name)}</span><small>Uploaded by ${escapeHtml(user.name || user.email)}</small>`;
          uploadsList.prepend(li);
        });
      }
      const status = document.querySelector('[data-upload-status]');
      if (status) {
        status.textContent = `${files.length} note file(s) uploaded successfully.`;
        status.className = 'upload-status success';
      }
      input.value = '';
    });
    input.addEventListener('click', (e) => {
      if (!getCurrentUser()) {
        e.preventDefault();
        requireAuth();
      }
    });
  });

  renderAuthUI();
});

  // Course directory: list all available courses and show Introduction, Explanation, Applications
  const COURSE_CATALOG = [
    { id: 'html', name: 'HTML', category: 'Programming', introduction: 'HTML (HyperText Markup Language) is the standard language for creating and structuring content on the web.', explanation: 'HTML uses elements and tags such as headings, paragraphs, links, images, lists, and tables to define the structure and meaning of a web page. Browsers read HTML to display content in an organized way.', applications: 'HTML is used to build websites, web applications, landing pages, online forms, documentation pages, and the structural foundation of almost every page on the internet.' },
    { id: 'css', name: 'CSS', category: 'Programming', introduction: 'CSS (Cascading Style Sheets) is the language used to style and visually design HTML content.', explanation: 'CSS controls layout, colors, fonts, spacing, responsiveness, and visual effects. It works through selectors, properties, and rules that can be applied consistently across multiple pages.', applications: 'CSS is used to design websites, create responsive layouts, build user interfaces, style web apps, and improve accessibility and user experience.' },
    { id: 'javascript', name: 'JavaScript', category: 'Programming', introduction: 'JavaScript is a programming language that adds interactivity and dynamic behavior to web pages.', explanation: 'JavaScript can manipulate HTML and CSS, respond to user actions, validate forms, fetch data, and run logic in the browser or on servers with environments like Node.js.', applications: 'JavaScript is used in interactive websites, web applications, mobile and desktop apps, games, APIs, and real-time features such as chat and dashboards.' },
    { id: 'python', name: 'Python', category: 'Programming', introduction: 'Python is a high-level, readable programming language used for many kinds of software development.', explanation: 'Python emphasizes simple syntax and powerful libraries. It supports multiple programming styles and is widely used for scripting, automation, data work, and application backends.', applications: 'Python is applied in web development, data analysis, artificial intelligence, automation, scientific computing, cybersecurity tools, and education.' },
    { id: 'php', name: 'PHP', category: 'Programming', introduction: 'PHP is a server-side scripting language designed for building dynamic web pages and applications.', explanation: 'PHP runs on the server to generate HTML, handle forms, manage sessions, and interact with databases before content is sent to the browser.', applications: 'PHP is used in content management systems, e-commerce sites, login systems, APIs, and many database-driven websites.' },
    { id: 'java', name: 'Java', category: 'Programming', introduction: 'Java is an object-oriented programming language known for portability, reliability, and strong performance.', explanation: 'Java programs run on the Java Virtual Machine (JVM), enabling the “write once, run anywhere” approach. It uses classes, objects, and robust libraries for large-scale development.', applications: 'Java is used in enterprise systems, Android apps, banking software, web backends, desktop applications, and large distributed systems.' },
    { id: 'cpp', name: 'C++', category: 'Programming', introduction: 'C++ is a powerful general-purpose programming language that extends C with object-oriented and generic programming features.', explanation: 'C++ provides fine control over memory and system resources while supporting high-level abstractions, making it suitable for performance-critical software.', applications: 'C++ is used in game engines, operating systems, embedded systems, simulations, high-performance applications, and system software.' },
    { id: 'sql', name: 'SQL', category: 'Programming', introduction: 'SQL (Structured Query Language) is the standard language for managing and querying relational databases.', explanation: 'SQL allows users to create tables, insert, update, delete, and retrieve data using queries. It supports filtering, joining, grouping, and organizing structured information.', applications: 'SQL is used in business systems, websites, analytics, reporting, inventory management, and any application that stores data in relational databases.' },
    { id: 'lan', name: 'LAN', category: 'Networking', introduction: 'A LAN (Local Area Network) connects computers and devices within a limited area such as a home, school, or office.', explanation: 'LANs use switches, cables, Wi-Fi access points, and network protocols to enable fast communication and resource sharing among nearby devices.', applications: 'LANs are used for file sharing, printers, office networks, computer labs, school networks, and local multiplayer or internal services.' },
    { id: 'wan', name: 'WAN', category: 'Networking', introduction: 'A WAN (Wide Area Network) connects networks across large geographic areas.', explanation: 'WANs link multiple LANs using routers, service providers, leased lines, or internet connections, enabling communication between distant locations.', applications: 'WANs are used by businesses with multiple branches, banks, government networks, telecommunications, and the global internet.' },
    { id: 'vlan', name: 'VLAN', category: 'Networking', introduction: 'A VLAN (Virtual Local Area Network) logically separates devices within the same physical network.', explanation: 'VLANs group devices by function, department, or security needs without requiring separate physical switches, improving organization and traffic control.', applications: 'VLANs are used in enterprise networks to separate staff and guest traffic, improve security, reduce broadcast traffic, and manage network segments.' },
    { id: 'routing', name: 'Routing', category: 'Networking', introduction: 'Routing is the process of selecting paths for data to travel between networks.', explanation: 'Routers use routing tables and protocols to determine the best path for packets based on destination addresses, network conditions, and policies.', applications: 'Routing is essential for internet communication, connecting branch offices, directing traffic in data centers, and enabling access between different networks.' },
    { id: 'switching', name: 'Switching', category: 'Networking', introduction: 'Switching is the method of forwarding data within a local network to the correct destination device.', explanation: 'Network switches use MAC addresses to send frames efficiently to specific ports, reducing unnecessary traffic and improving LAN performance.', applications: 'Switching is used in office and campus networks, server rooms, computer labs, and any environment where multiple wired devices communicate locally.' },
    { id: 'dhcp', name: 'DHCP', category: 'Networking', introduction: 'DHCP (Dynamic Host Configuration Protocol) automatically assigns IP addresses and network settings to devices.', explanation: 'A DHCP server provides configuration details such as IP address, subnet mask, gateway, and DNS servers, reducing manual setup and address conflicts.', applications: 'DHCP is used in home routers, corporate networks, schools, Wi-Fi hotspots, and any network that needs automatic device configuration.' },
    { id: 'dns', name: 'DNS', category: 'Networking', introduction: 'DNS (Domain Name System) translates human-readable domain names into IP addresses.', explanation: 'When a user enters a website name, DNS servers resolve it to the corresponding IP address so browsers can locate and connect to the correct server.', applications: 'DNS is used for web browsing, email delivery, cloud services, internal company networks, and internet service discovery.' },
    { id: 'cybersecurity', name: 'Cybersecurity', category: 'Networking', introduction: 'Cybersecurity focuses on protecting systems, networks, and data from digital threats and unauthorized access.', explanation: 'It involves practices such as risk assessment, access control, encryption, monitoring, secure configuration, and incident response to reduce vulnerabilities.', applications: 'Cybersecurity is applied in protecting websites, corporate networks, personal devices, financial systems, healthcare data, and critical infrastructure.' },
    { id: 'software-development', name: 'Software development', category: 'Software', introduction: 'Software development is the process of designing, building, testing, and maintaining software applications.', explanation: 'It includes planning requirements, writing code, debugging, testing, deploying, and improving software through structured methods and collaboration.', applications: 'Software development is used to create mobile apps, websites, business systems, games, automation tools, and digital services.' },
    { id: 'databases', name: 'Databases', category: 'Software', introduction: 'Databases are organized systems for storing, managing, and retrieving data efficiently.', explanation: 'Databases use structures such as tables or documents and provide tools for querying, updating, securing, and maintaining data integrity.', applications: 'Databases are used in banking, e-commerce, school systems, healthcare records, inventory systems, and most modern applications.' },
    { id: 'operating-systems', name: 'Operating systems', category: 'Software', introduction: 'An operating system (OS) is system software that manages computer hardware and provides services for applications.', explanation: 'The OS handles processes, memory, files, devices, security, and user interfaces, acting as a bridge between hardware and software.', applications: 'Operating systems are used in desktops, laptops, servers, smartphones, embedded devices, and cloud infrastructure.' },
    { id: 'application-development', name: 'Application development', category: 'Software', introduction: 'Application development is the creation of software programs designed to perform specific tasks for users.', explanation: 'It involves user requirements, interface design, coding, integration with data/services, testing, and deployment across platforms.', applications: 'Application development is used for mobile apps, web apps, desktop tools, business software, educational platforms, and productivity solutions.' },
    { id: 'computer-hardware', name: 'Computer hardware', category: 'Computer System', introduction: 'Computer hardware refers to the physical components that make up a computer system.', explanation: 'Key components include the CPU, memory, storage, motherboard, power supply, input/output devices, and peripherals that work together to run software.', applications: 'Understanding hardware is used in building PCs, upgrading systems, diagnosing faults, maintaining labs, and selecting equipment for specific tasks.' },
    { id: 'maintenance', name: 'Maintenance', category: 'Computer System', introduction: 'Computer maintenance involves routine activities that keep systems running reliably and efficiently.', explanation: 'Maintenance includes cleaning, updates, backups, disk checks, monitoring performance, replacing worn parts, and preventing common failures.', applications: 'Maintenance is applied in homes, offices, schools, and IT environments to extend device lifespan, improve performance, and reduce downtime.' },
    { id: 'troubleshooting', name: 'Troubleshooting', category: 'Computer System', introduction: 'Troubleshooting is the process of identifying, diagnosing, and resolving computer or system problems.', explanation: 'It uses systematic steps such as observing symptoms, testing hypotheses, isolating causes, applying fixes, and verifying that the issue is resolved.', applications: 'Troubleshooting is used to fix startup issues, software errors, connectivity problems, hardware failures, and performance slowdowns.' },
    { id: 'computer-systems-os', name: 'Operating systems (Computer System)', category: 'Computer System', introduction: 'Operating systems in computer systems manage resources and enable users and programs to interact with hardware.', explanation: 'This includes installation, configuration, user management, file systems, drivers, and system tools that keep computers operational and secure.', applications: 'OS knowledge is applied in setting up computers, managing users and permissions, supporting software, maintaining labs, and resolving system issues.' },
    { id: 'arduino', name: 'Arduino', category: 'IoT', introduction: 'Arduino is an open-source electronics platform based on easy-to-use hardware boards and software.', explanation: 'Arduino boards read inputs from sensors and control outputs like LEDs, motors, and displays through programmable microcontroller code.', applications: 'Arduino is used in prototypes, robotics, home automation, educational projects, environmental monitoring, and DIY electronics.' },
    { id: 'esp32', name: 'ESP32', category: 'IoT', introduction: 'ESP32 is a low-cost, low-power microcontroller with built-in Wi-Fi and Bluetooth capabilities.', explanation: 'It can collect sensor data, process signals, and communicate wirelessly with other devices or cloud services, making it ideal for connected projects.', applications: 'ESP32 is used in smart home devices, IoT sensors, wearable prototypes, remote monitoring, and wireless control systems.' },
    { id: 'sensors', name: 'Sensors', category: 'IoT', introduction: 'Sensors are devices that detect and measure physical properties from the environment.', explanation: 'They convert inputs such as temperature, light, motion, humidity, or pressure into electrical signals that systems can read and process.', applications: 'Sensors are used in weather stations, security systems, industrial automation, health devices, vehicles, and smart homes.' },
    { id: 'electronics', name: 'Electronics', category: 'IoT', introduction: 'Electronics is the field that deals with circuits and components that control electrical signals.', explanation: 'It covers components like resistors, capacitors, transistors, and integrated circuits, and how they are combined to build functional systems.', applications: 'Electronics is applied in computers, communication devices, appliances, embedded systems, instrumentation, and IoT hardware.' },
    { id: 'embedded-systems', name: 'Embedded systems', category: 'IoT', introduction: 'Embedded systems are specialized computing systems designed to perform dedicated functions within larger devices.', explanation: 'They combine hardware and software optimized for specific tasks, often with constraints on power, size, cost, and real-time performance.', applications: 'Embedded systems are used in cars, medical devices, consumer electronics, industrial machines, routers, and smart appliances.' },
    { id: 'smart-home', name: 'Smart home', category: 'IoT', introduction: 'A smart home uses connected devices and automation to improve comfort, security, and energy efficiency.', explanation: 'Smart home systems integrate sensors, controllers, networks, and apps so devices like lights, locks, cameras, and thermostats can be monitored and controlled.', applications: 'Smart home technology is used for automated lighting, climate control, security monitoring, energy management, voice assistants, and remote device control.' }
  ];

  const courseList = document.querySelector('[data-course-list]');
  const courseDetail = document.querySelector('[data-course-detail]');
  const courseEmpty = document.querySelector('[data-course-empty]');

  const showCourseDetail = (courseId) => {
    if (!courseList || !courseDetail || !courseEmpty) return;
    const course = COURSE_CATALOG.find((c) => c.id === courseId);
    if (!course) {
      courseDetail.hidden = true;
      courseEmpty.hidden = false;
      courseList.querySelectorAll('[data-course-id]').forEach((btn) => btn.classList.remove('active'));
      return;
    }
    document.querySelector('[data-course-category]').textContent = course.category;
    document.querySelector('[data-course-title]').textContent = course.name;
    document.querySelector('[data-course-introduction]').textContent = course.introduction;
    document.querySelector('[data-course-explanation]').textContent = course.explanation;
    document.querySelector('[data-course-applications]').textContent = course.applications;
    courseEmpty.hidden = true;
    courseDetail.hidden = false;
    courseList.querySelectorAll('[data-course-id]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-course-id') === course.id);
      btn.setAttribute('aria-current', btn.getAttribute('data-course-id') === course.id ? 'true' : 'false');
    });
    const newHash = `#course-${course.id}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
  };

  if (courseList) {
    const groups = COURSE_CATALOG.reduce((acc, course) => {
      if (!acc[course.category]) acc[course.category] = [];
      acc[course.category].push(course);
      return acc;
    }, {});
    Object.entries(groups).forEach(([category, courses]) => {
      const group = document.createElement('div');
      group.className = 'course-group';
      const heading = document.createElement('h3');
      heading.className = 'course-group-title';
      heading.textContent = category;
      const list = document.createElement('ul');
      list.className = 'course-items';
      courses.forEach((course) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'course-item';
        btn.setAttribute('data-course-id', course.id);
        btn.setAttribute('aria-current', 'false');
        btn.innerHTML = `<span>${course.name}</span><span class="course-item-arrow" aria-hidden="true">›</span>`;
        btn.addEventListener('click', () => showCourseDetail(course.id));
        li.appendChild(btn);
        list.appendChild(li);
      });
      group.appendChild(heading);
      group.appendChild(list);
      courseList.appendChild(group);
    });

    const hash = window.location.hash || '';
    const match = hash.match(/^#course-(.+)$/);
    if (match) {
      showCourseDetail(match[1]);
    }
    window.addEventListener('hashchange', () => {
      const m = (window.location.hash || '').match(/^#course-(.+)$/);
      if (m) showCourseDetail(m[1]);
    });
  }
  // Enhanced course detail view (opened from topic chips/language buttons)
  (function initCourseDetailView() {
    const detailView = document.querySelector('[data-course-view]');
    if (!detailView) return;

    const COURSE_DETAILS = {
      'html': { name: 'HTML', category: 'Programming', intro: 'HTML ni ururimi shingiro rukoreshwa mu kubaka imiterere ya paji za web.', introduction: 'HTML (HyperText Markup Language) itanga urufatiro rw\'ibirimo bya web.', explanation: 'Ikoresha tags na elements nka headings, paragraphs, links, images, lists, na forms kugira ngo itegure no gusobanura ibirimo.', application: 'HTML ikoreshwa mu gukora websites, landing pages, forms, blogs, na porogaramu za web.', units: [['Introduction to HTML', false], ['Elements and Tags', false], ['Links, Images and Media', false], ['Forms and Tables', true], ['Semantic HTML & Project', true]] },
      'css': { name: 'CSS', category: 'Programming', intro: 'CSS ikoreshwa mu gutunganya isura n\'imiterere y\'ibirimo bya HTML.', introduction: 'CSS (Cascading Style Sheets) ituma paji za web zigaragara neza kandi ziteguye.', explanation: 'Igenzura amabara, fonts, spacing, layout, animations, na responsive design hifashishijwe selectors na properties.', application: 'CSS ikoreshwa mu gushushanya websites, dashboards, apps, na interfaces zikora neza kuri telefone na mudasobwa.', units: [['CSS Basics & Selectors', false], ['Box Model and Typography', false], ['Flexbox and Grid', false], ['Responsive Design', true], ['Animations & Advanced Styling', true]] },
      'javascript': { name: 'JavaScript', category: 'Programming', intro: 'JavaScript ituma websites na applications bigira imikoranire n\'ibikorwa byihuse.', introduction: 'JavaScript ni ururimi rwa programming rukoreshwa cyane kuri web.', explanation: 'Rushobora guhindura HTML/CSS, kwakira ibikorwa by\'abakoresha, gukora validation, no kuvugana na APIs.', application: 'JavaScript ikoreshwa mu interactive websites, web apps, games, dashboards, na backend (Node.js).', units: [['JavaScript Basics', false], ['Variables, Functions & Events', false], ['DOM Manipulation', false], ['APIs and Async JavaScript', true], ['Projects & Advanced Concepts', true]] },
      'python': { name: 'Python', category: 'Programming', intro: 'Python ni ururimi rworoshye kwiga kandi rukomeye mu bikorwa byinshi bya software.', introduction: 'Python izwiho syntax isomeka neza n\'amasomero menshi.', explanation: 'Rukoreshwa mu scripting, automation, web development, data, na AI binyuze mu buryo butandukanye bwo gutangiza porogaramu.', application: 'Python ikoreshwa mu web apps, data analysis, machine learning, automation, na cybersecurity.', units: [['Python Basics', false], ['Data Types and Control Flow', false], ['Functions and Modules', false], ['Files, APIs and Libraries', true], ['Projects and Advanced Python', true]] },
      'php': { name: 'PHP', category: 'Programming', intro: 'PHP ni ururimi rwa server-side rukoreshwa mu gukora web pages zihinduka.', introduction: 'PHP ikorera kuri server kugira ngo itegure ibisubizo bigenerwa umukoresha.', explanation: 'Ifasha gukora forms, sessions, authentication, no kuvugana na databases mbere y\'uko paji igerera kuri browser.', application: 'PHP ikoreshwa muri CMS, e-commerce, login systems, APIs, na websites zishingiye kuri database.', units: [['PHP Basics', false], ['Forms and Server Logic', false], ['Working with Databases', false], ['Sessions and Authentication', true], ['Advanced PHP Projects', true]] },
      'java': { name: 'Java', category: 'Programming', intro: 'Java ni ururimi rukomeye rwa object-oriented rukoreshwa mu systems nini.', introduction: 'Java izwiho kuba portable kandi yizewe.', explanation: 'Porogaramu za Java zikoresha JVM, classes, objects, n\'amasomero atuma hubakwa software ihamye.', application: 'Java ikoreshwa muri enterprise systems, Android apps, banking software, na web backends.', units: [['Java Basics', false], ['OOP in Java', false], ['Collections and Exceptions', false], ['Databases and APIs', true], ['Advanced Java Projects', true]] },
      'cpp': { name: 'C++', category: 'Programming', intro: 'C++ ni ururimi rukora cyane rukoreshwa ahakenewe imikorere yihuse.', introduction: 'C++ rwubakiye kuri C rukanongeraho object-oriented features.', explanation: 'Rutanga igenzura ryimbitse rya memory n\'ibikoresho bya system, rukaba rwiza mu software ikenera performance.', application: 'C++ ikoreshwa muri game engines, operating systems, embedded systems, na simulations.', units: [['C++ Basics', false], ['Control Flow and Functions', false], ['OOP and Memory Basics', false], ['STL and File Handling', true], ['Advanced C++ Projects', true]] },
      'sql': { name: 'SQL', category: 'Programming', intro: 'SQL ni ururimi rwo kubika, gushaka no gucunga amakuru muri relational databases.', introduction: 'SQL (Structured Query Language) ni igikoresho cy\'ingenzi mu micungire y\'amakuru.', explanation: 'Ikoreshwa mu gukora tables, kwinjiza, kuvugurura, gusiba no gusoma data hifashishijwe queries.', application: 'SQL ikoreshwa muri business systems, analytics, websites, inventory, na applications z\'amakuru.', units: [['SQL Basics', false], ['SELECT Queries and Filtering', false], ['Joins and Relationships', false], ['Aggregation and Subqueries', true], ['Database Design & Practice', true]] },
      'lan': { name: 'LAN', category: 'Networking', intro: 'LAN ni umuyoboro uhuza ibikoresho mu gace gato nko mu rugo, ishuri, cyangwa ibiro.', introduction: 'Local Area Network ituma ibikoresho byegeranye bisangira amakuru n\'ibikoresho.', explanation: 'LAN ikoresha switches, cables, Wi-Fi access points, na protocols kugira ngo itange itumanaho ryihuse.', application: 'LAN ikoreshwa mu labs za mudasobwa, ibiro, gusangira printer, files, na serivisi z\'imbere.', units: [['LAN Fundamentals', false], ['LAN Devices and Cabling', false], ['IP Addressing Basics', false], ['LAN Configuration', true], ['LAN Troubleshooting', true]] },
      'wan': { name: 'WAN', category: 'Networking', intro: 'WAN ni umuyoboro uhuza imiyoboro iri ahantu hatandukanye kure.', introduction: 'Wide Area Network ihuza LAN nyinshi mu turere dutandukanye.', explanation: 'WAN ikoresha routers, service providers, internet, na connections zihariye mu gutwara data intera ndende.', application: 'WAN ikoreshwa n\'ibigo bifite amashami menshi, banks, guverinoma, na internet.', units: [['WAN Fundamentals', false], ['WAN Technologies', false], ['Connecting Remote Networks', false], ['WAN Security', true], ['WAN Design & Case Studies', true]] },
      'vlan': { name: 'VLAN', category: 'Networking', intro: 'VLAN itandukanya ibikoresho mu matsinda y\'umuyoboro mu buryo bwa logical.', introduction: 'Virtual LAN ifasha gutunganya no kurinda network.', explanation: 'VLAN ishobora gushyira hamwe cyangwa gutandukanya devices nubwo zaba ziri kuri switch imwe, bigabanya broadcast no kongera umutekano.', application: 'VLAN ikoreshwa mu bigo gutandukanya abakozi, abashyitsi, na serivisi zitandukanye.', units: [['VLAN Basics', false], ['VLAN Configuration Concepts', false], ['Trunking and Segmentation', false], ['Inter-VLAN Routing', true], ['VLAN Security & Labs', true]] },
      'routing': { name: 'Routing', category: 'Networking', intro: 'Routing ni uburyo bwo guhitamo inzira data inyuramo hagati y\'imiyoboro.', introduction: 'Routing ituma packets zigerera aho zijya neza.', explanation: 'Routers zikoresha routing tables na protocols kugira ngo zimenye inzira nziza yo kohereza amakuru.', application: 'Routing ikoreshwa kuri internet, mu guhuza amashami, data centers, na networks zitandukanye.', units: [['Routing Basics', false], ['Static and Dynamic Routing', false], ['Routing Tables and Metrics', false], ['Routing Protocols', true], ['Advanced Routing Labs', true]] },
      'switching': { name: 'Switching', category: 'Networking', intro: 'Switching ni uburyo bwo kohereza data ku gikoresho gikwiye muri LAN.', introduction: 'Switches zituma itumanaho ryo mu muyoboro w\'imbere rikora neza.', explanation: 'Switch ikoresha MAC addresses kugira ngo yohereze frames ku port ibereye, igabanya traffic itari ngombwa.', application: 'Switching ikoreshwa mu biro, schools, server rooms, na networks zifite ibikoresho byinshi.', units: [['Switching Basics', false], ['MAC Addressing and Frames', false], ['Switch Configuration', false], ['VLANs on Switches', true], ['Switch Troubleshooting', true]] },
      'dhcp': { name: 'DHCP', category: 'Networking', intro: 'DHCP itanga IP addresses n\'igenamiterere rya network ku bikoresho mu buryo bwikora.', introduction: 'Dynamic Host Configuration Protocol yoroshya guhuza ibikoresho kuri network.', explanation: 'DHCP server itanga IP address, subnet mask, gateway, na DNS kugira ngo devices zibone configuration zidakeneye intoki.', application: 'DHCP ikoreshwa muri routers zo mu rugo, networks z\'ibigo, Wi-Fi hotspots, na schools.', units: [['DHCP Basics', false], ['DHCP Process (DORA)', false], ['Configuring DHCP', false], ['DHCP Reservations & Options', true], ['DHCP Troubleshooting', true]] },
      'dns': { name: 'DNS', category: 'Networking', intro: 'DNS ihindura amazina ya domains mo IP addresses zikoreshwa na network.', introduction: 'Domain Name System yorohereza abantu kubona websites batibuka imibare.', explanation: 'Iyo wanditse domain, DNS isubiza IP address ya server ibitse urubuga kugira ngo browser ihuzeho.', application: 'DNS ikoreshwa mu web browsing, email, cloud services, na internal networks.', units: [['DNS Basics', false], ['Domain Names and Records', false], ['How DNS Resolution Works', false], ['DNS Configuration', true], ['DNS Security & Troubleshooting', true]] },
      'cybersecurity': { name: 'Cybersecurity', category: 'Networking', intro: 'Cybersecurity irinda systems, networks, n\'amakuru ibitero n\'ibyago byo kuri internet.', introduction: 'Ni urwego rwibanda ku mutekano w\'ikoranabuhanga.', explanation: 'Ikubiyemo access control, encryption, monitoring, backup, no gukumira no gusubiza ibibazo by\'umutekano.', application: 'Cybersecurity ikoreshwa mu kurinda websites, networks, konti, financial systems, na data y\'ibigo.', units: [['Cybersecurity Basics', false], ['Threats and Vulnerabilities', false], ['Security Controls', false], ['Network and System Protection', true], ['Incident Response & Practice', true]] },
      'software-development': { name: 'Software development', category: 'Software', intro: 'Software development ni uburyo bwo gutegura, kubaka, no kunoza porogaramu.', introduction: 'Ihuza ibisabwa, design, coding, testing, na maintenance.', explanation: 'Abakora software bakurikiza intambwe zo gusobanukirwa ikibazo, gukora solution, kuyigerageza, no kuyitangiza.', application: 'Ikoreshwa mu gukora apps, websites, systems z\'ubucuruzi, imikino, na serivisi za digitale.', units: [['SDLC Basics', false], ['Requirements and Design', false], ['Coding and Testing', false], ['Deployment and Maintenance', true], ['Software Project Practice', true]] },
      'databases': { name: 'Databases', category: 'Software', intro: 'Databases zibika kandi zitunganya amakuru mu buryo bworoshye kuyakoresha.', introduction: 'Database ni sisitemu yo gucunga data neza.', explanation: 'Zikoresha tables/documents, queries, constraints, na security kugira ngo amakuru aboneke kandi arindwe.', application: 'Databases zikoreshwa muri schools, banks, e-commerce, hospitals, na apps zitandukanye.', units: [['Database Basics', false], ['Tables and Relationships', false], ['CRUD Operations', false], ['Database Design', true], ['Administration & Optimization', true]] },
      'operating-systems': { name: 'Operating systems', category: 'Software', intro: 'Operating system ni software igenzura hardware n\'imikorere ya mudasobwa.', introduction: 'OS ituma user na programs bikorana na hardware.', explanation: 'Icunga processes, memory, files, devices, users, na security kugira ngo system ikore neza.', application: 'OS ikoreshwa kuri computers, phones, servers, na embedded devices.', units: [['OS Basics', false], ['Processes and Memory', false], ['Files and Users', false], ['System Configuration', true], ['OS Security & Administration', true]] },
      'application-development': { name: 'Application development', category: 'Software', intro: 'Application development ni ugukora porogaramu zigenewe gukora imirimo yihariye.', introduction: 'Yibanda ku gukemura ibibazo by\'abakoresha binyuze muri software.', explanation: 'Harimo UI/UX design, coding, integration, testing, no deployment kuri platform zitandukanye.', application: 'Ikoreshwa mu mobile apps, web apps, desktop apps, n\'ibikoresho by\'ubucuruzi.', units: [['App Development Basics', false], ['UI and User Requirements', false], ['Building Core Features', false], ['Testing and Deployment', true], ['Advanced App Projects', true]] },
      'computer-hardware': { name: 'Computer hardware', category: 'Computer System', intro: 'Computer hardware ni ibice bifatika bigize mudasobwa.', introduction: 'Byumvikanisha uburyo mudasobwa ikora imbere n\'inyuma.', explanation: 'Harimo CPU, RAM, storage, motherboard, power supply, n\'ibindi bikoresho byinjiza/bisohora.', application: 'Ubumenyi bwa hardware bukoreshwa mu guteranya, kuvugurura, no gusuzuma mudasobwa.', units: [['Hardware Basics', false], ['Internal Components', false], ['Peripheral Devices', false], ['Assembly and Upgrades', true], ['Hardware Diagnostics', true]] },
      'maintenance': { name: 'Maintenance', category: 'Computer System', intro: 'Maintenance ni ibikorwa bigamije gutuma mudasobwa ikomeza gukora neza.', introduction: 'Ifasha kwirinda no kugabanya ibibazo bya system.', explanation: 'Harimo isuku, updates, backups, antivirus, no kugenzura imikorere y\'ibikoresho na software.', application: 'Ikoreshwa mu rugo, schools, offices, na labs kugira ngo ibikoresho bimare igihe kinini.', units: [['Maintenance Basics', false], ['Preventive Maintenance', false], ['Updates and Backups', false], ['Performance Optimization', true], ['Maintenance Planning', true]] },
      'troubleshooting': { name: 'Troubleshooting', category: 'Computer System', intro: 'Troubleshooting ni uburyo bwo gushakisha no gukemura ibibazo bya mudasobwa.', introduction: 'Bifasha kumenya impamvu y\'ikibazo no kugikemura neza.', explanation: 'Hakurikizwa intambwe zo kureba ibimenyetso, gupima, gutandukanya impamvu, no kugenzura igisubizo.', application: 'Ikoreshwa mu gukemura ibibazo bya boot, network, software, n\'ibikoresho.', units: [['Troubleshooting Basics', false], ['Common Hardware Issues', false], ['Common Software Issues', false], ['Network Troubleshooting', true], ['Advanced Diagnostics', true]] },
      'computer-systems-os': { name: 'Operating systems (Computer System)', category: 'Computer System', intro: 'Operating systems mu computer systems zifasha gucunga no gukoresha mudasobwa neza.', introduction: 'Iyi course yibanda ku kuyishyiraho no kuyikoresha.', explanation: 'Irimo installation, configuration, users, drivers, file systems, n\'ibikoresho byo gufasha system.', application: 'Ikoreshwa mu gushyiraho computers, gufasha abakoresha, no gukemura ibibazo bya system.', units: [['OS Installation Basics', false], ['Users and Permissions', false], ['Files and Drivers', false], ['System Tools and Settings', true], ['OS Support & Recovery', true]] },
      'arduino': { name: 'Arduino', category: 'IoT', intro: 'Arduino ni urubuga rworoshye rwo kwiga no gukora imishinga ya electronics na IoT.', introduction: 'Ruhuza hardware boards na software yo kuyandika porogaramu.', explanation: 'Arduino isoma ibiva kuri sensors ikanagenzura outputs nka LEDs, motors, na displays.', application: 'Ikoreshwa muri robotics, automation, prototyping, school projects, na smart devices.', units: [['Arduino Basics', false], ['Sensors and Inputs', false], ['Outputs and Actuators', false], ['Serial Communication', true], ['Arduino IoT Projects', true]] },
    'esp32': { name: 'ESP32', category: 'IoT', intro: 'ESP32 ni microcontroller ifite Wi-Fi na Bluetooth ikoreshwa cyane muri IoT.', introduction: 'Ifasha guhuza ibikoresho ku miyoboro idafite umugozi.', explanation: 'ESP32 ishobora gusoma sensor data, kuyitunganya, no kuyohereza kuri devices cyangwa cloud.', application: 'Ikoreshwa muri smart home, remote monitoring, wireless sensors, na IoT prototypes.', units: [['ESP32 Basics', false], ['Wi-Fi Connectivity', false], ['Bluetooth and Sensors', false], ['IoT Data Communication', true], ['Advanced ESP32 Projects', true]] },
      'sensors': { name: 'Sensors', category: 'IoT', intro: 'Sensors ni ibikoresho bipima impinduka ziri mu bidukikije.', introduction: 'Bifasha systems kumenya no kwakira amakuru y\'isi nyayo.', explanation: 'Sensors zihindura ubushyuhe, urumuri, urusaku, umuvuduko cyangwa pressure mo signals zikoreshwa na controllers.', application: 'Zikoreshwa muri security, automation, weather stations, health devices, na smart homes.', units: [['Sensor Basics', false], ['Common Sensor Types', false], ['Reading Sensor Data', false], ['Calibration and Integration', true], ['Sensor-based Projects', true]] },
      'electronics': { name: 'Electronics', category: 'IoT', intro: 'Electronics yiga ibice n\'imiyoboro igenzura amashanyarazi na signals.', introduction: 'Ni ishingiro ry\'ibikoresho byinshi bya kijyambere.', explanation: 'Ikubiyemo components nka resistors, capacitors, diodes, transistors, n\'uburyo zikora circuits.', application: 'Ikoreshwa mu computers, communication devices, embedded systems, n\'ibikoresho bya IoT.', units: [['Electronics Basics', false], ['Components and Circuits', false], ['Measurements and Tools', false], ['Circuit Design', true], ['Electronics Projects', true]] },
      'embedded-systems': { name: 'Embedded systems', category: 'IoT', intro: 'Embedded systems ni systems zikoreshwa gukora umurimo runaka mu gikoresho.', introduction: 'Zihuza hardware na software mu buryo bwihariye.', explanation: 'Ziba zateguwe gukora neza ku mirimo yihariye, akenshi zifite imbogamizi za power, memory, n\'igihe.', application: 'Zikoreshwa mu modoka, medical devices, routers, appliances, na industrial machines.', units: [['Embedded Systems Basics', false], ['Microcontrollers and Firmware', false], ['Interfaces and Peripherals', false], ['Real-time Concepts', true], ['Embedded Projects', true]] },
      'smart-home': { name: 'Smart home', category: 'IoT', intro: 'Smart home ni uburyo bwo gukoresha ibikoresho bihujwe mu gutunganya no kurinda inzu.', introduction: 'Ihuriza hamwe automation, sensing, na remote control.', explanation: 'Ibikoresho nka lights, locks, cameras, na thermostats bishobora kugenzurwa no gukorana hifashishijwe network na apps.', application: 'Ikoreshwa mu mutekano, kugabanya ingufu, automation y\'amatara, no kugenzura ibikoresho uri kure.', units: [['Smart Home Basics', false], ['Devices and Connectivity', false], ['Automation Scenarios', false], ['Security and Privacy', true], ['Smart Home Project', true]] }
    };

    const byId = (s) => detailView.querySelector(s);
    const unitsEl = byId('[data-course-units]');
    const statusEl = byId('[data-course-action-status]');

    const renderUnits = (units) => {
      unitsEl.innerHTML = '';
      units.forEach(([title, locked], i) => {
        const li = document.createElement('li');
        li.className = 'unit-item' + (locked ? ' locked' : ' free');
        li.innerHTML = `<span class="unit-index">${i + 1}</span><span class="unit-title">${title}</span><span class="unit-state">${locked ? '🔒 Locked (kwishyura)' : 'Open'}</span>`;
        unitsEl.appendChild(li);
      });
    };

    const openCourse = (id, updateHash = true) => {
      const course = COURSE_DETAILS[id];
      if (!course) return;
      byId('[data-course-view-category]').textContent = course.category;
      byId('[data-course-view-name]').textContent = course.name;
      byId('[data-course-view-title]').textContent = course.name;
      byId('[data-course-view-intro]').textContent = course.intro;
      byId('[data-course-view-introduction]').textContent = course.introduction;
      byId('[data-course-view-explanation]').textContent = course.explanation;
      byId('[data-course-view-application]').textContent = course.application;
      renderUnits(course.units);
      statusEl.textContent = '';
      statusEl.className = 'course-action-status';
      detailView.hidden = false;
      detailView.setAttribute('data-active-course', id);
      document.querySelectorAll('[data-open-course]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-open-course') === id));
      if (updateHash) history.replaceState(null, '', `#course-${id}`);
      detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const closeCourse = () => {
      detailView.hidden = true;
      detailView.removeAttribute('data-active-course');
      document.querySelectorAll('[data-open-course]').forEach((b) => b.classList.remove('active'));
      if (location.hash.startsWith('#course-')) history.replaceState(null, '', '#courses-top');
    };

    document.querySelectorAll('[data-open-course]').forEach((btn) => {
      btn.addEventListener('click', () => openCourse(btn.getAttribute('data-open-course')));
    });
    byId('[data-course-back]').addEventListener('click', closeCourse);

    byId('[data-start-lesson]').addEventListener('click', () => {
      const id = detailView.getAttribute('data-active-course');
      const course = COURSE_DETAILS[id];
      if (!course) return;
      const first = course.units.find((u) => !u[1]);
      statusEl.textContent = first ? `Start Lesson: ${first[0]} (${course.name})` : 'Nta unit ifunguye irahari.';
      statusEl.className = 'course-action-status success';
    });

    byId('[data-download-course-notes]').addEventListener('click', () => {
      const id = detailView.getAttribute('data-active-course');
      const course = COURSE_DETAILS[id];
      if (!course) return;
      const authed = typeof window.requireAuth === 'function'
        ? window.requireAuth()
        : (window.learnhubGetCurrentUser && window.learnhubGetCurrentUser());
      if (!authed) {
        statusEl.textContent = 'Please login or sign up to download notes.';
        statusEl.className = 'course-action-status error';
        return;
      }
      const unitLines = course.units.map((u, i) => `${i + 1}. ${u[0]} - ${u[1] ? 'Locked (kwishyura)' : 'Open'}`).join('\n');
      const content = `${course.name} (${course.category})\n\nCourse Introduction\n${course.intro}\n\nIntroduction\n${course.introduction}\n\nExplanation\n${course.explanation}\n\nApplication\n${course.application}\n\nTopics / Units\n${unitLines}\n`;
      const blob = new Blob([content], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${course.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-notes.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      statusEl.textContent = `Notes for ${course.name} prepared for download.`;
      statusEl.className = 'course-action-status success';
    });

    const fromHash = () => {
      const m = (location.hash || '').match(/^#course-(.+)$/);
      if (m && COURSE_DETAILS[m[1]]) openCourse(m[1], false);
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  })();
