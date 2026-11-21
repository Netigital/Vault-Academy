require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const crypto = require('crypto');
const { promisify } = require('util');
const { Server } = require('socket.io');
const db = require('./database');
const { startScanner } = require('./scanner');

const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');
const scrypt = promisify(crypto.scrypt);

function getLocalIpAddresses() {
  const ifaces = os.networkInterfaces();
  const addresses = [];
  for (const ifaceName in ifaces) {
    for (const iface of ifaces[ifaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: ifaceName,
          address: iface.address
        });
      }
    }
  }
  return addresses;
}

const configuredFrontendHost = process.env.FRONTEND_HOST?.trim();
const frontendOrigin = configuredFrontendHost
  ? new URL(configuredFrontendHost.includes('://') ? configuredFrontendHost : `https://${configuredFrontendHost}`).origin
  : null;

function allowFrontendOrigin(origin, callback) {
  if (!origin) return callback(null, true);

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return callback(null, false);
  }

  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsedOrigin.hostname);
  const localIp = getLocalIpAddresses().some(({ address }) => address === parsedOrigin.hostname);
  const allowed = parsedOrigin.origin === frontendOrigin || (parsedOrigin.protocol === 'http:' &&
    parsedOrigin.port === '5050' &&
    (localHost || localIp));
  callback(null, allowed);
}

const corsOptions = { origin: allowFrontendOrigin };
const sessions = new Map();
const loginAttempts = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: Date.now()
  });
  return token;
}

function getSession(req) {
  const token = req.headers['x-vault-session'];
  if (typeof token !== 'string') return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > 12 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function getValidSessionToken(token) {
  if (typeof token !== 'string') return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > 12 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireRole(role) {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session || session.role !== role) {
      return res.status(403).json({ error: 'Teacher authorization required.' });
    }
    req.vaultSession = session;
    next();
  };
}

function requireLogin(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Sign in is required.' });
  req.vaultSession = session;
  next();
}

function isRateLimited(ip, limit, windowMs) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.startedAt > windowMs) {
    loginAttempts.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  entry.count += 1;
  if (entry.count > limit) return true;
  return false;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '128kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: http: ws:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:");
  next();
});

const PORT = process.env.PORT || 3001;
const resourcesFolder = path.resolve(process.env.VAULT_ACADEMY_DATA_DIR || __dirname, 'resources_folder');
const allowedGradeLevels = new Set(['All Grades', 'JSS1', 'JSS2', 'JSS3', 'Inter-Class']);

function safeResourceDirectory(grade, department) {
  const gradeName = allowedGradeLevels.has(grade) && grade !== 'All Grades' ? grade : '';
  const departmentName = department && /^[A-Za-z0-9][A-Za-z0-9 _-]{0,49}$/.test(department)
    ? department
    : 'General';
  const candidate = gradeName
    ? path.resolve(resourcesFolder, gradeName, departmentName)
    : path.resolve(resourcesFolder);
  const relative = path.relative(path.resolve(resourcesFolder), candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return path.resolve(resourcesFolder);
  return candidate;
}

// Setup multer storage for uploading resources directly to resources_folder
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const targetDir = safeResourceDirectory(req.body.grade_level, req.body.department);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
    cb(null, safeName || `resource-${Date.now()}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.epub', '.docx', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.svg', '.mp4', '.webm'];
    cb(null, allowed.includes(ext));
  }
});

// 1. Static file serving for zero-bandwidth local asset delivery
app.use('/files', express.static(resourcesFolder));

// 2. API Route: Get filtered resources
app.get('/api/resources', (req, res) => {
  const { grade, category, department, subject, search } = req.query;
  let query = 'SELECT * FROM resources WHERE 1=1';
  const params = [];

  if (grade && grade !== 'All') {
    query += ' AND (grade_level = ? OR grade_level = "All Grades")';
    params.push(grade);
  }
  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (department && department !== 'All') {
    query += ' AND department = ?';
    params.push(department);
  }
  if (subject && subject !== 'All') {
    query += ' AND subject = ?';
    params.push(subject);
  }
  if (search && search.trim() !== '') {
    query += ' AND (title LIKE ? OR filename LIKE ? OR subject LIKE ? OR category LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY date_added DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ resources: rows });
  });
});

// 3. API Route: Metadata facets & summary stats
app.get('/api/resources/meta', (req, res) => {
  db.all('SELECT DISTINCT grade_level FROM resources WHERE grade_level IS NOT NULL', [], (err, grades) => {
    db.all('SELECT DISTINCT category FROM resources WHERE category IS NOT NULL', [], (err, categories) => {
      db.all('SELECT DISTINCT department FROM resources WHERE department IS NOT NULL', [], (err, departments) => {
        db.all('SELECT DISTINCT subject FROM resources WHERE subject IS NOT NULL', [], (err, subjects) => {
          db.get('SELECT COUNT(*) as total_count, COALESCE(SUM(file_size), 0) as total_size_bytes FROM resources', [], (err, stats) => {
            res.json({
              grades: (grades || []).map(g => g.grade_level).filter(Boolean),
              categories: (categories || []).map(c => c.category).filter(Boolean),
              departments: (departments || []).map(d => d.department).filter(Boolean),
              subjects: (subjects || []).map(s => s.subject).filter(Boolean),
              stats: stats || { total_count: 0, total_size_bytes: 0 }
            });
          });
        });
      });
    });
  });
});

// ==========================================================
// CBT EXAMINATION & MATH COMPETITION API ROUTES
// ==========================================================

// 1. List all available CBT exams with participation stats
app.get('/api/cbt/exams', (req, res) => {
  const query = `
    SELECT 
      e.*, 
      (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) as actual_question_count,
      (SELECT COUNT(*) FROM exam_submissions s WHERE s.exam_id = e.id) as total_submissions,
      (SELECT MAX(score) FROM exam_submissions s WHERE s.exam_id = e.id) as high_score
    FROM exams e
    ORDER BY e.id ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ exams: rows });
  });
});

// 2. Get specific exam questions for test session (omits correct_option to prevent cheating)
app.get('/api/cbt/exams/:id', (req, res) => {
  const examId = req.params.id;
  db.get('SELECT * FROM exams WHERE id = ?', [examId], (err, exam) => {
    if (err || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    db.all(
      `SELECT id, exam_id, question_number, question_text, option_a, option_b, option_c, option_d 
       FROM exam_questions 
       WHERE exam_id = ? 
       ORDER BY question_number ASC`,
      [examId],
      (qErr, questions) => {
        if (qErr) {
          return res.status(500).json({ error: qErr.message });
        }
        res.json({
          exam,
          questions
        });
      }
    );
  });
});

// 3. Submit exam answers, compute score, record submission, and return detailed review
app.post('/api/cbt/exams/:id/submit', requireLogin, (req, res) => {
  const examId = req.params.id;
  const { student_name, student_class, answers = {}, time_spent_seconds = 0, anonymous_on_leaderboard = false } = req.body;

  if (!student_name || !student_class) {
    return res.status(400).json({ error: 'Student name and class are required.' });
  }

  // Fetch all questions with correct answers
  db.all(
    `SELECT id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
     FROM exam_questions
     WHERE exam_id = ?
     ORDER BY question_number ASC`,
    [examId],
    (err, questions) => {
      if (err || !questions || questions.length === 0) {
        return res.status(404).json({ error: 'Exam questions not found.' });
      }

      let score = 0;
      const review = questions.map((q) => {
        const studentChoice = answers[q.question_number] || null;
        const isCorrect = studentChoice && studentChoice.toUpperCase() === q.correct_option.toUpperCase();
        if (isCorrect) score += 1;

        return {
          question_number: q.question_number,
          question_text: q.question_text,
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d
          },
          student_choice: studentChoice,
          correct_option: q.correct_option,
          is_correct: !!isCorrect,
          explanation: q.explanation
        };
      });

      const totalQuestions = questions.length;
      const percentage = parseFloat(((score / totalQuestions) * 100).toFixed(1));

      // Grade classification
      let grade = 'Pass';
      if (percentage >= 80) grade = 'Distinction';
      else if (percentage >= 65) grade = 'Credit';
      else if (percentage >= 50) grade = 'Merit';
      else grade = 'Needs Improvement';

      // Insert submission
      const insertQuery = `
        INSERT INTO exam_submissions (exam_id, student_name, student_class, score, total_questions, percentage, time_spent_seconds, answers_json, anonymous_on_leaderboard)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(
        insertQuery,
        [
          examId,
          student_name.trim(),
          student_class.trim().toUpperCase(),
          score,
          totalQuestions,
          percentage,
          time_spent_seconds,
          JSON.stringify(answers),
          anonymous_on_leaderboard ? 1 : 0
        ],
        function (insertErr) {
          if (insertErr) {
            console.error('Error recording submission:', insertErr);
          }

          res.json({
            submission_id: this ? this.lastID : null,
            student_name,
            student_class,
            score,
            total_questions: totalQuestions,
            percentage,
            grade,
            time_spent_seconds,
            review
          });
        }
      );
    }
  );
});

// Helper for NDPA Section 31 Child Privacy on public leaderboards
function pseudonymizeName(fullName) {
  if (!fullName) return "Student";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// 4. Get Leaderboard for a specific exam (with NDPA privacy pseudonymization)
app.get('/api/cbt/exams/:id/leaderboard', (req, res) => {
  const examId = req.params.id;
  const query = `
    SELECT id, student_name, student_class, score, total_questions, percentage, time_spent_seconds, anonymous_on_leaderboard, submitted_at
    FROM exam_submissions
    WHERE exam_id = ?
    ORDER BY score DESC, time_spent_seconds ASC, submitted_at ASC
    LIMIT 25
  `;
  db.all(query, [examId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const sanitizedRows = rows.map((row) => ({
      ...row,
      student_name: row.anonymous_on_leaderboard
        ? `Student (${row.student_class})`
        : pseudonymizeName(row.student_name),
    }));
    res.json({ leaderboard: sanitizedRows });
  });
});

// 5. NDPA Section 34 / Right to Erasure: Passcoded Admin Deletion of Exam Submissions
const ADMIN_PASSCODE = process.env.VAULT_ACADEMY_ADMIN_PASSCODE;

app.post('/api/admin/clear-submissions', requireRole('teacher'), (req, res) => {
  const { passcode, examId } = req.body;

  if (!ADMIN_PASSCODE) {
    return res.status(503).json({
      error: "Admin deletion is disabled. Configure VAULT_ACADEMY_ADMIN_PASSCODE in backend/.env."
    });
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`admin:${ip}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many admin verification attempts.' });
  }

  if (typeof passcode !== 'string' || passcode.length !== ADMIN_PASSCODE.length ||
      !crypto.timingSafeEqual(Buffer.from(passcode), Buffer.from(ADMIN_PASSCODE))) {
    return res.status(403).json({
      error: "Invalid admin passcode. Access denied under school security rules."
    });
  }

  let query = 'DELETE FROM exam_submissions';
  const params = [];

  if (examId && examId !== 'all') {
    query += ' WHERE exam_id = ?';
    params.push(examId);
  }

  db.run(query, params, function (err) {
    if (err) {
      console.error('Error clearing exam submissions:', err);
      return res.status(500).json({ error: err.message });
    }

    console.log(`🛡️ Admin cleared ${this.changes} exam submission records (passcode verified).`);
    res.json({
      success: true,
      message: `Successfully cleared ${this.changes} student exam record(s) under NDPA compliance policy.`,
      recordsCleared: this.changes,
    });
  });
});

// 5. Inter-Class Overall Tournament Leaderboard
app.get('/api/cbt/leaderboard/classes', (req, res) => {
  const query = `
    SELECT 
      student_class, 
      COUNT(*) as total_attempts,
      ROUND(AVG(percentage), 1) as avg_score,
      MAX(percentage) as top_score
    FROM exam_submissions
    GROUP BY student_class
    ORDER BY avg_score DESC, total_attempts DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ class_rankings: rows });
  });
});

// 4. API Route: Inline file preview
app.get('/api/resources/:id/view', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM resources WHERE id = ?', [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    const filePath = path.resolve(resourcesFolder, row.relative_path || row.filename);
    const relative = path.relative(path.resolve(resourcesFolder), filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resource file is missing.' });
    }
    const frontendOrigins = [
      'http://localhost:5050',
      'http://127.0.0.1:5050',
      ...getLocalIpAddresses().map(({ address }) => `http://${address}:5050`)
    ];
    res.removeHeader('X-Frame-Options');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; frame-ancestors 'self' ${frontendOrigins.join(' ')}`
    );
    res.setHeader('Content-Disposition', `inline; filename="${row.filename.replace(/["\r\n]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.sendFile(filePath);
  });
});

// 5. API Route: Direct file download tracker
app.get('/api/resources/:id/download', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM resources WHERE id = ?', [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    db.run('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [id]);
    const filePath = path.resolve(resourcesFolder, row.relative_path || row.filename);
    const relative = path.relative(path.resolve(resourcesFolder), filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.download(filePath, row.filename);
  });
});

// 5. API Route: Upload resource directly through the app
app.post('/api/resources/upload', requireRole('teacher'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No supported file uploaded. Allowed: PDF, EPUB, DOCX, PPTX, TXT, JPG, PNG, SVG, MP4, or WEBM.' });
  }

  const { title, grade_level, category, department, subject } = req.body;
  const filename = req.file.originalname;
  const relativePath = path.relative(resourcesFolder, req.file.path).replace(/\\/g, '/');
  const ext = path.extname(filename).toLowerCase();

  let type = 'document';
  if (['.mp4', '.mkv', '.avi', '.webm'].includes(ext)) type = 'video';
  else if (ext === '.pdf') type = 'pdf';
  else if (['.epub', '.docx', '.pptx', '.txt'].includes(ext)) type = 'document';
  else if (['.jpg', '.png', '.svg', '.jpeg'].includes(ext)) type = 'image';

  const friendlyTitle = (title && title.trim()) || path.parse(filename).name.replace(/[_-]+/g, ' ').trim();
  const finalGrade = grade_level && grade_level !== 'All' ? grade_level : 'All Grades';
  const finalCategory = category && category !== 'All' ? category : 'General Resource';
  const finalDepartment = department && department !== 'All' ? department : 'General';
  const finalSubject = subject && subject !== 'All' ? subject : 'General Science';
  const fileSize = req.file.size;

  const query = `
    INSERT INTO resources (
      title, filename, type, grade_level, category, department, subject, file_size, relative_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(filename) DO UPDATE SET
      title=excluded.title,
      type=excluded.type,
      grade_level=excluded.grade_level,
      category=excluded.category,
      department=excluded.department,
      subject=excluded.subject,
      file_size=excluded.file_size,
      relative_path=excluded.relative_path
  `;

  db.run(query, [
    friendlyTitle,
    filename,
    type,
    finalGrade,
    finalCategory,
    finalDepartment,
    finalSubject,
    fileSize,
    relativePath
  ], function(err) {
    if (err) {
      console.error('Error adding resource to DB:', err);
      return res.status(500).json({ error: err.message });
    }

    db.get('SELECT * FROM resources WHERE filename = ?', [filename], (fetchErr, row) => {
      res.json({
        success: true,
        message: 'Resource uploaded and indexed successfully!',
        resource: row
      });
    });
  });
});

// 6. API Route: Delete resource from DB and disk
app.delete('/api/resources/:id', requireRole('teacher'), (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM resources WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Try deleting physical file from disk
    const filePath = path.resolve(resourcesFolder, row.relative_path || row.filename);
    const relative = path.relative(path.resolve(resourcesFolder), filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted file from disk: ${filePath}`);
      }
    } catch (fsErr) {
      console.warn(`Could not delete file from disk: ${fsErr.message}`);
    }

    db.run('DELETE FROM resources WHERE id = ?', [id], function(delErr) {
      if (delErr) {
        return res.status(500).json({ error: delErr.message });
      }
      console.log(`🗑️ Deleted resource record #${id} (${row.filename})`);
      res.json({ success: true, message: 'Resource deleted successfully' });
    });
  });
});

// 7. API Route: Dynamic Local LAN Network Information
app.get('/api/network-info', (req, res) => {
  const addresses = getLocalIpAddresses();
  // Find primary non-internal IPv4 interface (prefer Wi-Fi or Ethernet)
  const primary = addresses.find(a => /wi-?fi|wlan|eth|ethernet/i.test(a.interface)) || addresses[0] || { address: 'localhost' };

  res.json({
    primaryIp: primary.address,
    vaultUrl: `http://${primary.address}:5050`,
    backendUrl: `http://${primary.address}:3001`,
    interfaces: addresses
  });
});

// Simple health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'Vault Academy Backend',
    timestamp: new Date().toISOString() 
  });
});

// Teacher/Admin dashboard overview
app.get('/api/admin/overview', requireRole('teacher'), (req, res) => {
  const queries = [
    ['accounts', 'SELECT COUNT(*) AS count FROM users'],
    ['teachers', "SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'"],
    ['students', "SELECT COUNT(*) AS count FROM users WHERE role = 'student'"],
    ['resources', 'SELECT COUNT(*) AS count FROM resources'],
    ['exams', 'SELECT COUNT(*) AS count FROM exams'],
    ['submissions', 'SELECT COUNT(*) AS count FROM exam_submissions'],
    ['arenaQuestions', 'SELECT COUNT(*) AS count FROM arena_questions'],
  ];

  const overview = {};
  let remaining = queries.length;
  let failed = false;

  queries.forEach(([key, sql]) => {
    db.get(sql, [], (err, row) => {
      if (failed) return;
      if (err) {
        failed = true;
        return res.status(500).json({ error: 'Could not load dashboard statistics.' });
      }
      overview[key] = row.count;
      remaining -= 1;
      if (remaining === 0) {
        db.all(
          'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC LIMIT 25',
          [],
          (usersErr, users) => {
            if (usersErr) {
              return res.status(500).json({ error: 'Could not load account list.' });
            }
            res.json({
              ...overview,
              accountList: users || [],
              security: {
                passwordStorage: 'scrypt',
                sessionLifetimeHours: 12,
                firewallScope: 'Private / LocalSubnet',
                adminPasscodeConfigured: !!process.env.VAULT_ACADEMY_ADMIN_PASSCODE,
                teacherInviteConfigured: !!process.env.VAULT_ACADEMY_TEACHER_INVITE,
              },
            });
          }
        );
      }
    });
  });
});

// ==========================================================
// USER AUTHENTICATION (STUDENT / TEACHER SIMPLE ONBOARDING)
// ==========================================================
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword.startsWith('scrypt$')) {
    const candidate = Buffer.from(password);
    const legacy = Buffer.from(storedPassword);
    const matches = candidate.length === legacy.length &&
      crypto.timingSafeEqual(candidate, legacy);
    return { matches, needsUpgrade: true };
  }

  const parts = storedPassword.split('$');
  if (parts.length !== 3 || !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{128}$/i.test(parts[2])) {
    return { matches: false, needsUpgrade: false };
  }

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return {
    matches: crypto.timingSafeEqual(actual, expected),
    needsUpgrade: false
  };
}

app.post('/api/auth/register', (req, res) => {
  const { username, password, role, teacher_invite } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`register:${ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many account registrations. Try again later.' });
  }
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.trim();
  const teacherInvite = process.env.VAULT_ACADEMY_TEACHER_INVITE;
  const cleanRole = role === 'teacher' && teacherInvite && teacher_invite === teacherInvite
    ? 'teacher'
    : 'student';

  db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) {
      return res.status(400).json({ error: 'Username already taken. Please choose another or sign in.' });
    }

    hashPassword(password).then((passwordHash) => {
      db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [cleanUsername, passwordHash, cleanRole],
        function (insErr) {
          if (insErr) return res.status(500).json({ error: insErr.message });
          res.json({
            success: true,
            user: {
              id: this.lastID,
              username: cleanUsername,
              role: cleanRole
            },
            session_token: createSession({ id: this.lastID, username: cleanUsername, role: cleanRole })
          });
        }
      );
    }).catch((hashErr) => {
      console.error('Error hashing account password:', hashErr);
      res.status(500).json({ error: 'Unable to create account.' });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' });
  }

  db.get(
    'SELECT id, username, password, role FROM users WHERE LOWER(username) = LOWER(?)',
    [username.trim()],
    async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      try {
        const verification = await verifyPassword(password, user.password);
        if (!verification.matches) {
          return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const respondWithUser = () => res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          },
          session_token: createSession(user)
        });

        if (!verification.needsUpgrade) return respondWithUser();

        const upgradedHash = await hashPassword(password);
        db.run('UPDATE users SET password = ? WHERE id = ?', [upgradedHash, user.id], (updateErr) => {
          if (updateErr) {
            console.error('Error upgrading legacy account password:', updateErr);
            return res.status(500).json({ error: 'Unable to securely sign in.' });
          }
          respondWithUser();
        });
      } catch (verificationErr) {
        console.error('Error verifying account password:', verificationErr);
        res.status(500).json({ error: 'Unable to sign in.' });
      }
    }
  );
});

app.post('/api/auth/logout', requireLogin, (req, res) => {
  const token = req.headers['x-vault-session'];
  if (typeof token === 'string') sessions.delete(token);
  res.json({ success: true });
});

// ==========================================================
// STUDY AGENT (OLLAMA INTEGRATION)
// ==========================================================
const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

// Check Ollama connection status & available local models
app.get("/api/study-agent/status", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map(m => m.name);
      return res.json({
        online: true,
        host: OLLAMA_BASE_URL,
        models,
        activeModel: models[0] || "llama3.2",
        message: "Ollama local AI engine is connected and ready!"
      });
    } else {
      return res.json({
        online: false,
        host: OLLAMA_BASE_URL,
        models: [],
        message: "Ollama responded with HTTP status " + response.status
      });
    }
  } catch (err) {
    return res.json({
      online: false,
      host: OLLAMA_BASE_URL,
      models: [],
      message: "Ollama is offline. Start Ollama on the server machine to enable the Study Agent."
    });
  }
});

// Chat with the Study Agent
app.post("/api/study-agent/chat", async (req, res) => {
  const { message, history = [], subject = "General", classLevel = "Secondary", model } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  const systemPrompt = `You are the Vault Academy Study Agent, an intelligent offline AI tutor for students and teachers.
Subject focus: ${subject}
Academic level: ${classLevel}

Guidelines:
1. Provide encouraging, step-by-step explanations adapted to the Nigerian curriculum (WAEC, NECO, BECE, JSS1-SS3).
2. For mathematics and science, demonstrate calculations clearly with intermediate steps.
3. Keep definitions simple, accurate, and easy to memorize.
4. When relevant, give practical everyday Nigerian examples.
5. Keep your tone supportive, patient, and scholarly.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map(h => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.text || h.content || ""
    })),
    { role: "user", content: message.trim() }
  ];

  try {
    let targetModel = model;
    if (!targetModel) {
      try {
        const tagRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (tagRes.ok) {
          const tagData = await tagRes.json();
          if (tagData.models && tagData.models.length > 0) {
            targetModel = tagData.models[0].name;
          }
        }
      } catch (e) {
        // Ignore tag fetch error
      }
    }
    if (!targetModel) targetModel = "llama3.2";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: false,
        options: { temperature: 0.7, num_predict: 800 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      return res.json({
        success: true,
        response: data.message?.content || "No response generated.",
        model: targetModel,
        ollamaOnline: true
      });
    } else {
      const errorText = await ollamaRes.text();
      return res.json({
        success: false,
        response: "Ollama error (" + ollamaRes.status + "): " + errorText + ". Please make sure model " + targetModel + " is installed.",
        ollamaOnline: true
      });
    }
  } catch (err) {
    return res.json({
      success: true,
      ollamaOnline: false,
      response: "👋 Hello! I am your Vault Academy Study Agent.\n\nCurrently, the local Ollama AI engine is **offline** on this host laptop. The Library, CBT Exams, and Math Arena are still available.\n\n### To launch the Study Agent:\n1. Open PowerShell or Command Prompt on this host PC.\n2. Run: `ollama run llama3.2` (or `ollama run qwen2.5:0.5b`)\n3. Once running, refresh this page and ask away!"
    });
  }
});

// ==========================================================
// MATH ARENA QUESTIONS & STATE ENGINE
// ==========================================================
app.get('/api/arena/questions', (req, res) => {
  db.all('SELECT * FROM arena_questions ORDER BY id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ questions: rows });
  });
});

// Active Math Arena Game Session State
let arenaRoom = {
  status: 'lobby', // 'lobby' | 'in_progress' | 'ended'
  roomCode: 'MATH-101',
  teacherSocketId: null,
  teacherName: 'Teacher',
  matchTitle: 'Vault Academy Math Arena',
  participants: {}, // socketId -> { name, classGroup, score, streak, lastAnswerCorrect, answeredThisRound }
  questions: [],
  currentQuestionIndex: 0,
  questionTimerSeconds: 30,
  timerRemaining: 30,
  timerInterval: null
};

// Helper: load random set of questions for match
function loadMatchQuestions(count, callback) {
  const targetCount = parseInt(count, 10) || 12;
  db.all('SELECT * FROM arena_questions ORDER BY RANDOM() LIMIT ?', [targetCount], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      db.all('SELECT * FROM arena_questions LIMIT ?', [targetCount], (err2, rows2) => {
        callback(rows2 || []);
      });
    } else {
      callback(rows);
    }
  });
}

function broadcastArenaState() {
  const safeParticipants = Object.values(arenaRoom.participants).map(p => ({
    socketId: p.socketId,
    name: p.name,
    classGroup: p.classGroup,
    score: p.score,
    streak: p.streak,
    answeredThisRound: p.answeredThisRound,
    hasAnswered: !!p.currentChoice
  })).sort((a, b) => b.score - a.score);

  const currentQ = arenaRoom.questions[arenaRoom.currentQuestionIndex];
  const safeQuestion = currentQ ? {
    id: currentQ.id,
    questionNumber: arenaRoom.currentQuestionIndex + 1,
    totalQuestions: arenaRoom.questions.length,
    topic: currentQ.topic,
    difficulty: currentQ.difficulty,
    text: currentQ.question_text,
    question_text: currentQ.question_text,
    option_a: currentQ.option_a,
    option_b: currentQ.option_b,
    option_c: currentQ.option_c,
    option_d: currentQ.option_d,
    // Note: correct_option is withheld from broadcast so students cannot inspect payload
  } : null;

  io.emit('arena_state_update', {
    status: arenaRoom.status,
    roomCode: arenaRoom.roomCode,
    matchTitle: arenaRoom.matchTitle,
    teacherName: arenaRoom.teacherName,
    participants: safeParticipants,
    currentQuestion: safeQuestion,
    timerRemaining: arenaRoom.timerRemaining,
    currentQuestionIndex: arenaRoom.currentQuestionIndex,
    totalQuestions: arenaRoom.questions.length
  });
}

function stopArenaTimer() {
  if (arenaRoom.timerInterval) {
    clearInterval(arenaRoom.timerInterval);
    arenaRoom.timerInterval = null;
  }
}

// Evaluate all submitted choices at round completion
function evaluateRoundAnswers() {
  const currentQ = arenaRoom.questions[arenaRoom.currentQuestionIndex];
  if (!currentQ) return;

  const correctOpt = currentQ.correct_option ? currentQ.correct_option.trim().toUpperCase() : 'A';

  Object.keys(arenaRoom.participants).forEach(sid => {
    const p = arenaRoom.participants[sid];
    if (!p) return;

    const studentChoice = p.currentChoice ? p.currentChoice.trim().toUpperCase() : null;
    const isCorrect = studentChoice === correctOpt;

    if (isCorrect) {
      // Speed bonus: up to 50 points based on remaining time when chosen
      const speedBonus = Math.round((Math.max(1, p.choiceTimeRemaining || 0) / (arenaRoom.questionTimerSeconds || 30)) * 50);
      p.streak = (p.streak || 0) + 1;
      const streakBonus = p.streak >= 3 ? 25 : 0;
      const roundPoints = 100 + speedBonus + streakBonus;
      p.score = (p.score || 0) + roundPoints;

      io.to(sid).emit('answer_feedback', {
        isCorrect: true,
        pointsEarned: roundPoints,
        streak: p.streak,
        chosen: studentChoice,
        correct_option: correctOpt,
        explanation: currentQ.explanation
      });
    } else {
      p.streak = 0;
      io.to(sid).emit('answer_feedback', {
        isCorrect: false,
        pointsEarned: 0,
        streak: 0,
        chosen: studentChoice || 'None',
        correct_option: correctOpt,
        explanation: currentQ.explanation
      });
    }
  });

  io.emit('arena_round_result', {
    correct_option: currentQ.correct_option,
    explanation: currentQ.explanation
  });

  broadcastArenaState();
}

function startQuestionTimer() {
  stopArenaTimer();
  arenaRoom.timerRemaining = arenaRoom.questionTimerSeconds;
  broadcastArenaState();

  arenaRoom.timerInterval = setInterval(() => {
    arenaRoom.timerRemaining -= 1;
    if (arenaRoom.timerRemaining <= 0) {
      stopArenaTimer();
      // Round ended: evaluate all submitted choices and broadcast answers
      evaluateRoundAnswers();

      // Advance after 4 seconds pause so students see explanations
      setTimeout(() => {
        if (arenaRoom.status !== 'in_progress') return;
        if (arenaRoom.currentQuestionIndex + 1 < arenaRoom.questions.length) {
          arenaRoom.currentQuestionIndex += 1;
          // reset round choices for next question
          Object.keys(arenaRoom.participants).forEach(sid => {
            arenaRoom.participants[sid].currentChoice = null;
            arenaRoom.participants[sid].choiceTimeRemaining = 0;
            arenaRoom.participants[sid].answeredThisRound = false;
          });
          startQuestionTimer();
        } else {
          arenaRoom.status = 'ended';
          broadcastArenaState();
        }
      }, 4000);
    } else {
      io.emit('arena_timer_tick', { timerRemaining: arenaRoom.timerRemaining });
    }
  }, 1000);
}

// Socket.io for Real-time Math Competitions
io.on('connection', (socket) => {
  console.log('⚡ Math Arena connection:', socket.id);
  const sessionToken = socket.handshake.auth && socket.handshake.auth.sessionToken;
  socket.data.session = getValidSessionToken(sessionToken);
  if (socket.data.session) {
    const sessionLifetimeMs = 12 * 60 * 60 * 1000;
    socket.data.sessionTimer = setInterval(() => {
      const valid = getValidSessionToken(sessionToken);
      if (valid) {
        socket.data.session = valid;
      } else {
        socket.data.session = null;
        if (arenaRoom.teacherSocketId === socket.id) arenaRoom.teacherSocketId = null;
        socket.emit('error_message', 'Your session expired. Please sign in again.');
        socket.disconnect(true);
      }
    }, 60 * 1000);
  }

  const hasValidRole = (role) => {
    socket.data.session = getValidSessionToken(sessionToken);
    return !!socket.data.session && socket.data.session.role === role;
  };

  // Send current state upon connect
  socket.emit('arena_state_update', {
    status: arenaRoom.status,
    roomCode: arenaRoom.roomCode,
    matchTitle: arenaRoom.matchTitle,
    teacherName: arenaRoom.teacherName,
    participants: Object.values(arenaRoom.participants).sort((a, b) => b.score - a.score),
    timerRemaining: arenaRoom.timerRemaining,
    currentQuestionIndex: arenaRoom.currentQuestionIndex,
    totalQuestions: arenaRoom.questions.length
  });

  // 1. Teacher initializes or monitors room
  socket.on('teacher_claim_control', (data) => {
    if (!hasValidRole('teacher')) {
      socket.emit('error_message', 'Teacher authorization required.');
      return;
    }
    if (arenaRoom.teacherSocketId && arenaRoom.teacherSocketId !== socket.id) {
      socket.emit('error_message', 'Another teacher currently controls this match.');
      return;
    }
    arenaRoom.teacherSocketId = socket.id;
    if (data && data.teacherName) arenaRoom.teacherName = data.teacherName;
    if (data && data.matchTitle) arenaRoom.matchTitle = data.matchTitle;
    if (data && data.timerSeconds) arenaRoom.questionTimerSeconds = parseInt(data.timerSeconds, 10) || 30;
    socket.emit('teacher_control_confirmed', { isTeacher: true });
    broadcastArenaState();
  });

  // 2. Student joins room (Provides Name & Class right before entering arena match)
  socket.on('student_join_arena', (data) => {
    if (!hasValidRole('student')) {
      socket.emit('error_message', 'Sign in with a student account to join.');
      return;
    }
    if (!arenaRoom.participants[socket.id] && Object.keys(arenaRoom.participants).length >= 100) {
      socket.emit('error_message', 'The Arena is full. Maximum 100 participants.');
      return;
    }
    const studentName = (data.name && data.name.trim()) || `Student-${socket.id.slice(0, 4)}`;
    const studentClass = (data.classGroup && data.classGroup.trim().toUpperCase()) || 'JSS1';

    arenaRoom.participants[socket.id] = {
      socketId: socket.id,
      name: studentName,
      classGroup: studentClass,
      score: 0,
      streak: 0,
      currentChoice: null,
      choiceTimeRemaining: 0,
      answeredThisRound: false
    };

    socket.emit('student_joined_success', {
      name: studentName,
      classGroup: studentClass,
      roomCode: arenaRoom.roomCode
    });

    broadcastArenaState();
  });

  // 3. Teacher starts the competition
  socket.on('teacher_start_match', (config) => {
    if (!hasValidRole('teacher') || arenaRoom.teacherSocketId !== socket.id) {
      socket.emit('error_message', 'Teacher control required.');
      return;
    }
    const questionCount = (config && config.questionCount) || 12;
    if (config && config.timerSeconds) arenaRoom.questionTimerSeconds = parseInt(config.timerSeconds, 10);
    if (config && config.matchTitle) arenaRoom.matchTitle = config.matchTitle;

    loadMatchQuestions(questionCount, (loadedQs) => {
      arenaRoom.questions = loadedQs;
      arenaRoom.currentQuestionIndex = 0;
      arenaRoom.status = 'in_progress';
      // reset participant scores for clean match
      Object.keys(arenaRoom.participants).forEach(sid => {
        arenaRoom.participants[sid].score = 0;
        arenaRoom.participants[sid].streak = 0;
        arenaRoom.participants[sid].currentChoice = null;
        arenaRoom.participants[sid].choiceTimeRemaining = 0;
        arenaRoom.participants[sid].answeredThisRound = false;
      });

      broadcastArenaState();
      startQuestionTimer();
    });
  });

  // 4. Student submits or changes answer for the current question
  socket.on('student_submit_answer', (data) => {
    const participant = arenaRoom.participants[socket.id];
    if (!participant || arenaRoom.status !== 'in_progress' || arenaRoom.timerRemaining <= 0) {
      return;
    }

    const currentQ = arenaRoom.questions[arenaRoom.currentQuestionIndex];
    if (!currentQ) return;

    const submittedChoice = (data.choice || data.answer || "").toString().trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(submittedChoice)) return;

    // Students can change their answer as many times as they like before the timer runs out
    participant.currentChoice = submittedChoice;
    participant.choiceTimeRemaining = arenaRoom.timerRemaining;
    participant.answeredThisRound = true;

    socket.emit('answer_registered', {
      choice: submittedChoice,
      message: `Option ${submittedChoice} recorded.`
    });

    broadcastArenaState();
  });

  // 5. Teacher manual controls: Next question, End match, Reset lobby
  socket.on('teacher_next_question', () => {
    if (!hasValidRole('teacher') || arenaRoom.teacherSocketId !== socket.id) return;
    if (arenaRoom.status !== 'in_progress') return;
    stopArenaTimer();
    evaluateRoundAnswers();
    setTimeout(() => {
      if (arenaRoom.status !== 'in_progress') return;
      if (arenaRoom.currentQuestionIndex + 1 < arenaRoom.questions.length) {
        arenaRoom.currentQuestionIndex += 1;
        Object.keys(arenaRoom.participants).forEach(sid => {
          arenaRoom.participants[sid].currentChoice = null;
          arenaRoom.participants[sid].choiceTimeRemaining = 0;
          arenaRoom.participants[sid].answeredThisRound = false;
        });
        startQuestionTimer();
      } else {
        arenaRoom.status = 'ended';
        broadcastArenaState();
      }
    }, 2500);
  });

  socket.on('teacher_end_match', () => {
    if (!hasValidRole('teacher') || arenaRoom.teacherSocketId !== socket.id) return;
    stopArenaTimer();
    evaluateRoundAnswers();
    arenaRoom.status = 'ended';
    broadcastArenaState();
  });

  socket.on('teacher_reset_lobby', () => {
    if (!hasValidRole('teacher') || arenaRoom.teacherSocketId !== socket.id) return;
    stopArenaTimer();
    arenaRoom.status = 'lobby';
    arenaRoom.currentQuestionIndex = 0;
    arenaRoom.questions = [];
    Object.keys(arenaRoom.participants).forEach(sid => {
      arenaRoom.participants[sid].score = 0;
      arenaRoom.participants[sid].streak = 0;
      arenaRoom.participants[sid].currentChoice = null;
      arenaRoom.participants[sid].choiceTimeRemaining = 0;
      arenaRoom.participants[sid].answeredThisRound = false;
    });
    broadcastArenaState();
  });

  socket.on('disconnect', () => {
    if (socket.data.sessionTimer) clearInterval(socket.data.sessionTimer);
    if (arenaRoom.teacherSocketId === socket.id) {
      arenaRoom.teacherSocketId = null;
    }
    if (arenaRoom.participants[socket.id]) {
      delete arenaRoom.participants[socket.id];
      broadcastArenaState();
    }
  });
});

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large. Maximum upload size is 100 MB.' });
  }
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Upload one supported file at a time.' });
  }
  if (err) {
    console.error('Library request error:', err.message);
    return res.status(400).json({ error: err.message || 'Could not process the library file.' });
  }
  next();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vault Academy Backend listening on port ${PORT}`);
  const addresses = getLocalIpAddresses();
  console.log(`🌐 Local Area Network (LAN) Access URL(s):`);
  addresses.forEach(a => {
    console.log(` - http://${a.address}:5050 (${a.interface})`);
  });
  
  // Start the background file scanner
  startScanner();
});
