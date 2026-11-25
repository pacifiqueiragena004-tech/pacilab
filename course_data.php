<?php
require_once __DIR__ . '/../db_config.php';

function learnhub_courses() {
    $courses = learnhub_sample_courses();
    foreach (learnhub_load_courses_from_db() as $id => $course) {
        if (!empty($course['units'])) {
            $courses[$id] = $course;
        }
    }
    return $courses;
}

function learnhub_load_courses_from_db() {
    if (!function_exists('learnhub_db_connect')) {
        return [];
    }
    $conn = learnhub_db_connect();
    if (!$conn) {
        return [];
    }

    $courses = [];
    $result = $conn->query('SELECT id, name, short_description, category, difficulty, estimated_time, icon, accent FROM courses');
    if (!$result) {
        return [];
    }
    while ($row = $result->fetch_assoc()) {
        $row['units'] = [];
        $courses[$row['id']] = $row;
    }

    $units = $conn->query('SELECT * FROM units ORDER BY unit_number ASC');
    if ($units) {
        while ($unit = $units->fetch_assoc()) {
            $courseId = $unit['course_id'];
            if (!isset($courses[$courseId])) {
                continue;
            }
            $courses[$courseId]['units'][] = [
                'id' => $unit['id'],
                'number' => (int) $unit['unit_number'],
                'title' => $unit['title'],
                'short_description' => $unit['short_description'],
                'status' => $unit['status'] ?: 'locked',
                'locked_reason' => $unit['locked_reason'],
                'lesson_title' => $unit['lesson_title'],
                'introduction' => $unit['introduction'],
                'explanation' => $unit['explanation'],
                'applications' => json_decode($unit['applications_json'] ?: '[]', true) ?: [],
                'examples' => json_decode($unit['examples_json'] ?: '[]', true) ?: [],
                'exercises' => json_decode($unit['exercises_json'] ?: '[]', true) ?: [],
                'quiz' => json_decode($unit['quiz_json'] ?: 'null', true),
            ];
        }
    }

    return $courses;
}

function learnhub_sample_courses() {
    return [
        'html' => [
            'id' => 'html',
            'name' => 'HTML - Web Development',
            'short_description' => 'Learn HTML from beginner to advanced level. Build modern web pages and websites.',
            'category' => 'Programming',
            'difficulty' => 'Beginner',
            'estimated_time' => '8 Hours',
            'icon' => 'HTML5',
            'accent' => '#e44d26',
            'units' => [
                [
                    'id' => 'html-1',
                    'number' => 1,
                    'title' => 'Introduction to HTML',
                    'short_description' => 'What is HTML and why it is important?',
                    'status' => 'available',
                    'lesson_title' => 'Introduction to HTML',
                    'introduction' => 'HTML (HyperText Markup Language) is the standard language for creating web pages. It helps you structure content on the web using tags and elements.',
                    'explanation' => 'HTML describes the structure of a web page through elements such as headings, paragraphs, links, images, lists, and tables. Browsers read HTML documents and render them as visible web pages. An HTML document usually starts with a doctype, followed by html, head, and body sections.',
                    'applications' => [
                        'Creating website pages and layouts',
                        'Building forms for user input',
                        'Structuring articles, blogs, and documentation',
                        'Providing the foundation for CSS and JavaScript'
                    ],
                    'examples' => [
                        ['title' => 'Basic HTML Page', 'code' => "<!DOCTYPE html>\n<html>\n  <head>\n    <title>My First Page</title>\n  </head>\n  <body>\n    <h1>Hello, LEARNHUB!</h1>\n    <p>This is my first HTML page.</p>\n  </body>\n</html>"]
                    ],
                    'exercises' => [
                        'Create an HTML file with a heading and two paragraphs.',
                        'Add a title in the head section and display your name in the body.',
                        'Explain the difference between the head and body sections.'
                    ],
                    'quiz' => [
                        'question' => 'What does HTML stand for?',
                        'options' => ['HyperText Markup Language', 'HighText Machine Language', 'Hyperlink and Text Markup Language', 'Home Tool Markup Language'],
                        'answer' => 0,
                        'explanation' => 'HTML stands for HyperText Markup Language.'
                    ]
                ],
                [
                    'id' => 'html-2',
                    'number' => 2,
                    'title' => 'HTML Structure',
                    'short_description' => 'The basic structure of an HTML document',
                    'status' => 'available',
                    'lesson_title' => 'HTML Structure',
                    'introduction' => 'Every HTML document follows a basic structure that helps browsers understand and display content correctly.',
                    'explanation' => 'The <!DOCTYPE html> declaration defines the document type. The <html> element wraps the whole page. The <head> contains metadata like title and character encoding, while the <body> contains visible content such as text, images, and links.',
                    'applications' => [
                        'Setting up any new web page correctly',
                        'Adding metadata for browsers and search engines',
                        'Organizing content into head and body sections'
                    ],
                    'examples' => [
                        ['title' => 'Document Structure', 'code' => "<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Page Structure</title>\n  </head>\n  <body>\n    <h1>Welcome</h1>\n  </body>\n</html>"]
                    ],
                    'exercises' => [
                        'Write the minimum structure of an HTML5 document.',
                        'Add a meta charset tag to your page.',
                        'Identify which elements belong in the head and which belong in the body.'
                    ],
                    'quiz' => [
                        'question' => 'Which element contains the visible content of a web page?',
                        'options' => ['<head>', '<meta>', '<body>', '<title>'],
                        'answer' => 2,
                        'explanation' => 'The <body> element contains the visible content displayed in the browser.'
                    ]
                ],
                [
                    'id' => 'html-3',
                    'number' => 3,
                    'title' => 'HTML Elements and Tags',
                    'short_description' => 'Common HTML elements and their usage',
                    'status' => 'available',
                    'lesson_title' => 'HTML Elements and Tags',
                    'introduction' => 'HTML elements and tags are the building blocks used to create content and structure on web pages.',
                    'explanation' => 'Most HTML elements have an opening tag, content, and a closing tag, such as <p>Hello</p>. Some elements are empty, like <img> and <br>. Elements can be nested to create meaningful document structures.',
                    'applications' => [
                        'Displaying headings and paragraphs',
                        'Adding emphasis, line breaks, and containers',
                        'Combining elements to build page sections'
                    ],
                    'examples' => [
                        ['title' => 'Common Elements', 'code' => "<h1>Main Heading</h1>\n<p>This is a <strong>paragraph</strong> with <em>emphasis</em>.</p>\n<br>\n<div>Grouped content</div>"]
                    ],
                    'exercises' => [
                        'Create a page using h1, h2, p, and strong tags.',
                        'Use a div to group two related paragraphs.',
                        'Find and correct mistakes in a sample HTML snippet with missing closing tags.'
                    ],
                    'quiz' => [
                        'question' => 'Which of these is an empty (void) HTML element?',
                        'options' => ['<p>', '<div>', '<img>', '<h1>'],
                        'answer' => 2,
                        'explanation' => '<img> is a void element and does not have a closing tag in HTML5 syntax.'
                    ]
                ],
                [
                    'id' => 'html-4',
                    'number' => 4,
                    'title' => 'HTML Attributes',
                    'short_description' => 'Adding attributes to HTML elements',
                    'status' => 'available',
                    'locked_reason' => '',
                    'lesson_title' => 'HTML Attributes',
                    'introduction' => 'Attributes provide additional information about HTML elements and control their behavior or appearance.',
                    'explanation' => 'Attributes are written inside the opening tag as name/value pairs, such as href, src, alt, class, and id. They help identify elements, connect resources, and improve accessibility.',
                    'applications' => [
                        'Linking to pages with href',
                        'Displaying images with src and alt',
                        'Targeting elements with id and class for CSS/JS'
                    ],
                    'examples' => [
                        ['title' => 'Using Attributes', 'code' => "<a href=\"https://example.com\" target=\"_blank\">Visit Example</a>\n<img src=\"photo.jpg\" alt=\"A sample photo\" width=\"300\">"]
                    ],
                    'exercises' => [
                        'Add alt text to three images.',
                        'Create links that open in a new tab.',
                        'Use id and class attributes on different elements.'
                    ],
                    'quiz' => [
                        'question' => 'Which attribute provides alternative text for an image?',
                        'options' => ['src', 'title', 'alt', 'href'],
                        'answer' => 2,
                        'explanation' => 'The alt attribute provides alternative text for accessibility and when images cannot load.'
                    ]
                ],
                [
                    'id' => 'html-5',
                    'number' => 5,
                    'title' => 'Links and Images',
                    'short_description' => 'Working with links and images',
                    'status' => 'available',
                    'locked_reason' => '',
                    'lesson_title' => 'Links and Images',
                    'introduction' => 'Links and images make web pages connected and visually engaging.',
                    'explanation' => 'The <a> element creates hyperlinks using the href attribute, while the <img> element embeds images using src and alt. Correct paths and accessible text are essential for good web pages.',
                    'applications' => [
                        'Navigating between pages and websites',
                        'Displaying product photos, diagrams, and banners',
                        'Creating menus and image galleries'
                    ],
                    'examples' => [
                        ['title' => 'Links and Images', 'code' => "<a href=\"about.html\">About Us</a>\n<img src=\"images/logo.png\" alt=\"LEARNHUB logo\">"]
                    ],
                    'exercises' => [
                        'Create a navigation menu with three links.',
                        'Insert an image with descriptive alt text.',
                        'Combine an image and a link to make a clickable image.'
                    ],
                    'quiz' => [
                        'question' => 'Which tag is used to create a hyperlink?',
                        'options' => ['<link>', '<a>', '<href>', '<url>'],
                        'answer' => 1,
                        'explanation' => 'The <a> (anchor) tag creates hyperlinks.'
                    ]
                ],
                [
                    'id' => 'html-6',
                    'number' => 6,
                    'title' => 'Tables and Lists',
                    'short_description' => 'Creating tables and lists',
                    'status' => 'available',
                    'locked_reason' => '',
                    'lesson_title' => 'Tables and Lists',
                    'introduction' => 'Tables and lists help organize information clearly on a web page.',
                    'explanation' => 'Lists can be ordered (<ol>), unordered (<ul>), or descriptive (<dl>). Tables use <table>, <tr>, <th>, and <td> to present structured data in rows and columns.',
                    'applications' => [
                        'Displaying schedules and comparison data',
                        'Creating navigation lists and feature lists',
                        'Presenting structured records clearly'
                    ],
                    'examples' => [
                        ['title' => 'List and Table', 'code' => "<ul>\n  <li>HTML</li>\n  <li>CSS</li>\n</ul>\n<table>\n  <tr><th>Course</th><th>Hours</th></tr>\n  <tr><td>HTML</td><td>8</td></tr>\n</table>"]
                    ],
                    'exercises' => [
                        'Create an unordered list of your favorite subjects.',
                        'Build a table showing three courses and their durations.',
                        'Convert a paragraph of items into an ordered list.'
                    ],
                    'quiz' => [
                        'question' => 'Which tag defines a row in an HTML table?',
                        'options' => ['<td>', '<th>', '<tr>', '<table>'],
                        'answer' => 2,
                        'explanation' => '<tr> defines a table row.'
                    ]
                ],
                [
                    'id' => 'html-7',
                    'number' => 7,
                    'title' => 'HTML Forms',
                    'short_description' => 'Collecting user input with forms',
                    'status' => 'available',
                    'locked_reason' => '',
                    'lesson_title' => 'HTML Forms',
                    'introduction' => 'Forms allow users to send data to a website, such as login details, messages, or survey responses.',
                    'explanation' => 'HTML forms use the <form> element with inputs, labels, textareas, selects, and buttons. Attributes like type, name, and required help control and validate user input.',
                    'applications' => [
                        'Login and registration pages',
                        'Contact and feedback forms',
                        'Search bars and checkout forms'
                    ],
                    'examples' => [
                        ['title' => 'Simple Form', 'code' => "<form>\n  <label for=\"email\">Email</label>\n  <input id=\"email\" type=\"email\" name=\"email\" required>\n  <button type=\"submit\">Submit</button>\n</form>"]
                    ],
                    'exercises' => [
                        'Create a contact form with name, email, and message fields.',
                        'Add labels to all inputs for accessibility.',
                        'Use different input types such as email, password, and number.'
                    ],
                    'quiz' => [
                        'question' => 'Which element groups form controls for submission?',
                        'options' => ['<input>', '<label>', '<form>', '<button>'],
                        'answer' => 2,
                        'explanation' => 'The <form> element groups and submits user input controls.'
                    ]
                ],
                [
                    'id' => 'html-8',
                    'number' => 8,
                    'title' => 'Semantic HTML',
                    'short_description' => 'Using semantic tags for better web pages',
                    'status' => 'available',
                    'locked_reason' => '',
                    'lesson_title' => 'Semantic HTML',
                    'introduction' => 'Semantic HTML uses meaningful tags that describe the purpose of content.',
                    'explanation' => 'Elements like <header>, <nav>, <main>, <section>, <article>, and <footer> improve readability, accessibility, and SEO by clearly defining page regions.',
                    'applications' => [
                        'Building accessible and well-structured pages',
                        'Improving search engine understanding',
                        'Creating maintainable layouts for teams'
                    ],
                    'examples' => [
                        ['title' => 'Semantic Layout', 'code' => "<header>Site Header</header>\n<nav>Main Menu</nav>\n<main>\n  <article>Lesson content</article>\n</main>\n<footer>Copyright</footer>"]
                    ],
                    'exercises' => [
                        'Convert a div-based layout into semantic elements.',
                        'Identify appropriate semantic tags for a blog page.',
                        'Build a simple page using header, main, section, and footer.'
                    ],
                    'quiz' => [
                        'question' => 'Which semantic element is best for the main content of a page?',
                        'options' => ['<section>', '<main>', '<div>', '<aside>'],
                        'answer' => 1,
                        'explanation' => '<main> represents the dominant/main content of the document.'
                    ]
                ],
            ],
        ],
        'python' => [
            'id' => 'python',
            'name' => 'Python Programming',
            'short_description' => 'Learn Python fundamentals, problem solving, and practical scripting.',
            'category' => 'Programming',
            'difficulty' => 'Beginner',
            'estimated_time' => '10 Hours',
            'icon' => 'PY',
            'accent' => '#3776ab',
            'units' => [
                ['id' => 'py-1', 'number' => 1, 'title' => 'Introduction to Python', 'short_description' => 'What Python is and where it is used', 'status' => 'available', 'lesson_title' => 'Introduction to Python', 'introduction' => 'Python is a readable, versatile programming language used across many fields.', 'explanation' => 'Python focuses on simplicity and productivity. Its syntax is close to plain language, which makes it beginner-friendly while still powerful for advanced applications.', 'applications' => ['Automation scripts', 'Web development', 'Data analysis and AI'], 'examples' => [['title' => 'Hello Python', 'code' => "print('Hello, LEARNHUB!')"]], 'exercises' => ['Install Python and run a hello world program.', 'Use print() to display three lines of text.'], 'quiz' => ['question' => 'Which function prints output in Python?', 'options' => ['echo()', 'print()', 'write()', 'show()'], 'answer' => 1, 'explanation' => 'print() outputs text to the console.']],
                ['id' => 'py-2', 'number' => 2, 'title' => 'Variables and Data Types', 'short_description' => 'Store and work with data', 'status' => 'available', 'locked_reason' => '', 'lesson_title' => 'Variables and Data Types', 'introduction' => 'Variables store values that your programs can use and change.', 'explanation' => 'Python supports types such as integers, floats, strings, booleans, lists, and dictionaries. Variables are created by assignment.', 'applications' => ['Storing user input', 'Calculations', 'Managing collections of data'], 'examples' => [['title' => 'Variables', 'code' => "name = 'Amina'\nage = 20\nprint(name, age)"]], 'exercises' => ['Create variables for name, age, and school.', 'Practice converting between strings and numbers.'], 'quiz' => ['question' => 'Which symbol assigns a value to a variable in Python?', 'options' => ['==', '=', ':=', '->'], 'answer' => 1, 'explanation' => 'The = operator assigns values in Python.']],
            ],
        ],
        'mathematics' => [
            'id' => 'mathematics',
            'name' => 'Mathematics Foundations',
            'short_description' => 'Build strong skills in core mathematical concepts and problem solving.',
            'category' => 'General Studies',
            'difficulty' => 'Beginner',
            'estimated_time' => '12 Hours',
            'icon' => 'MATH',
            'accent' => '#2563eb',
            'units' => [
                ['id' => 'math-1', 'number' => 1, 'title' => 'Numbers and Operations', 'short_description' => 'Understand numbers and basic operations', 'status' => 'available', 'lesson_title' => 'Numbers and Operations', 'introduction' => 'Numbers and operations are the foundation of mathematics.', 'explanation' => 'This unit covers whole numbers, integers, fractions, decimals, and the four basic operations: addition, subtraction, multiplication, and division.', 'applications' => ['Everyday calculations', 'Measurements', 'Problem solving'], 'examples' => [['title' => 'Basic Operations', 'code' => "25 + 17 = 42\n48 - 19 = 29\n6 × 7 = 42\n56 ÷ 8 = 7"]], 'exercises' => ['Solve mixed addition and subtraction problems.', 'Practice multiplication and division facts.'], 'quiz' => ['question' => 'What is 56 ÷ 8?', 'options' => ['6', '7', '8', '9'], 'answer' => 1, 'explanation' => '56 divided by 8 equals 7.']],
                ['id' => 'math-2', 'number' => 2, 'title' => 'Fractions and Decimals', 'short_description' => 'Work with parts of a whole', 'status' => 'available', 'locked_reason' => '', 'lesson_title' => 'Fractions and Decimals', 'introduction' => 'Fractions and decimals represent parts of a whole.', 'explanation' => 'You can compare, convert, add, subtract, multiply, and divide fractions and decimals by understanding place value and equivalent forms.', 'applications' => ['Money calculations', 'Measurements', 'Sharing quantities'], 'examples' => [['title' => 'Conversion', 'code' => "1/2 = 0.5\n3/4 = 0.75"]], 'exercises' => ['Convert fractions to decimals.', 'Add and subtract simple fractions.'], 'quiz' => ['question' => 'Which decimal is equal to 1/2?', 'options' => ['0.25', '0.4', '0.5', '0.75'], 'answer' => 2, 'explanation' => '1/2 is equal to 0.5.']],
            ],
        ],
        'physics' => [
            'id' => 'physics',
            'name' => 'Physics Essentials',
            'short_description' => 'Explore motion, forces, and energy with practical explanations.',
            'category' => 'Science',
            'difficulty' => 'Intermediate',
            'estimated_time' => '9 Hours',
            'icon' => 'PHY',
            'accent' => '#7c3aed',
            'units' => [
                ['id' => 'phy-1', 'number' => 1, 'title' => 'Introduction to Physics', 'short_description' => 'What physics studies and why it matters', 'status' => 'available', 'lesson_title' => 'Introduction to Physics', 'introduction' => 'Physics studies matter, energy, motion, and the forces that shape the universe.', 'explanation' => 'Physics helps explain natural phenomena from falling objects to electricity and waves. It uses observation, measurement, and mathematical models.', 'applications' => ['Engineering and technology', 'Transportation', 'Energy systems'], 'examples' => [['title' => 'Everyday Physics', 'code' => "Gravity pulls objects toward Earth.\nElectric circuits power devices.\nMotion can be described by speed and direction."]], 'exercises' => ['List three examples of physics in daily life.', 'Define matter and energy in your own words.'], 'quiz' => ['question' => 'Physics mainly studies:', 'options' => ['Only living things', 'Matter, energy, and their interactions', 'Only chemical reactions', 'Historical events'], 'answer' => 1, 'explanation' => 'Physics focuses on matter, energy, and interactions.']],
                ['id' => 'phy-2', 'number' => 2, 'title' => 'Motion and Speed', 'short_description' => 'Describe how objects move', 'status' => 'available', 'locked_reason' => '', 'lesson_title' => 'Motion and Speed', 'introduction' => 'Motion describes a change in position over time.', 'explanation' => 'Speed, velocity, and acceleration help us measure and compare motion. Graphs and formulas are used to represent movement clearly.', 'applications' => ['Vehicle travel', 'Sports analysis', 'Machine movement'], 'examples' => [['title' => 'Speed Formula', 'code' => "speed = distance / time\nIf distance = 100 m and time = 20 s, speed = 5 m/s"]], 'exercises' => ['Calculate speed for different distances and times.', 'Explain the difference between speed and velocity.'], 'quiz' => ['question' => 'Speed is calculated as:', 'options' => ['time/distance', 'distance/time', 'distance×time', 'time-distance'], 'answer' => 1, 'explanation' => 'Speed equals distance divided by time.']],
            ],
        ],
    ];
}

function learnhub_get_course($id) {
    $courses = learnhub_courses();
    return $courses[$id] ?? null;
}
?>