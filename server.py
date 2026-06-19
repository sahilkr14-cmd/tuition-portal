# server.py
# Centralized Flask API Server + Static Web Host for Tuition Portal
# Powered by SQLite for robust multi-user database sharing.

import os
import sqlite3
import json
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder='.')
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tuition.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# --- INIT DATABASE ---
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        grade TEXT,
        contact TEXT,
        address TEXT,
        bio TEXT,
        interests TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teachers (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        experience INTEGER,
        contact TEXT,
        address TEXT,
        bio TEXT,
        image TEXT,
        approved INTEGER DEFAULT 0,
        subjects TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS enquiries (
        student_id TEXT,
        teacher_id TEXT,
        status TEXT DEFAULT 'pending',
        PRIMARY KEY (student_id, teacher_id),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    )
    ''')
    
    # Seed Data if Empty
    cursor.execute('SELECT COUNT(*) FROM subjects')
    if cursor.fetchone()[0] == 0:
        subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "English Literature", "Computer Science", "History"]
        for s in subjects:
            cursor.execute('INSERT INTO subjects (name) VALUES (?)', (s,))
            
    # SHA-256 hash of "password123"
    seed_password_hash = "ef92b778bafe4473487009c9b130e5272a5a54db5e6b72d2427a19c5c2d3fb49"
    
    cursor.execute('SELECT COUNT(*) FROM teachers')
    if cursor.fetchone()[0] == 0:
        teachers = [
            ("t_1", "albert", seed_password_hash, "Dr. Albert Einstein", "albert@tuition.com", 45, 20, "+1 (555) 123-4567", "112 Princeton Ave, Mercer, NJ", "Dedicated Physics professor specializing in relativity.", "", 1, json.dumps(["Physics", "Mathematics"])),
            ("t_2", "marie", seed_password_hash, "Marie Curie", "marie@tuition.com", 38, 15, "+1 (555) 987-6543", "74 Boulevard Soufflot, Paris", "Passionate researcher focusing on chemical structures.", "", 1, json.dumps(["Chemistry", "Physics"])),
            ("t_3", "ada", seed_password_hash, "Ada Lovelace", "ada@tuition.com", 30, 8, "+1 (555) 456-7890", "44 Horsley Towers, Surrey, UK", "Algorithm enthusiast and programming tutor.", "", 1, json.dumps(["Computer Science", "Mathematics"])),
            ("t_4", "charles", seed_password_hash, "Charles Darwin", "charles@tuition.com", 50, 25, "+1 (555) 321-7654", "Down House, Kent, UK", "Exploring biology and ecological systems.", "", 0, json.dumps(["Biology"]))
        ]
        cursor.executemany('''
        INSERT INTO teachers (id, username, password, name, email, age, experience, contact, address, bio, image, approved, subjects)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', teachers)
        
    cursor.execute('SELECT COUNT(*) FROM students')
    if cursor.fetchone()[0] == 0:
        students = [
            ("s_1", "alan", seed_password_hash, "Alan Turing", "alan@school.com", 18, "Grade 12", "+1 (555) 000-1111", "Maida Vale, London, UK", "Keen interest in building logical machines.", json.dumps(["Mathematics", "Computer Science"])),
            ("s_2", "rosalind", seed_password_hash, "Rosalind Franklin", "rosalind@school.com", 17, "Grade 11", "+1 (555) 222-3333", "Notting Hill, London, UK", "Fascinated by molecular biology and chemistry.", json.dumps(["Chemistry", "Biology"]))
        ]
        cursor.executemany('''
        INSERT INTO students (id, username, password, name, email, age, grade, contact, address, bio, interests)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', students)
        
    conn.commit()
    conn.close()

# Initialize DB on Startup
init_db()

# --- WEB APP STATIC ROUTES ---
@app.route('/')
def route_index():
    return send_from_directory('.', 'index.html')

@app.route('/admin')
def route_admin_direct():
    return send_from_directory('.', 'admin.html')

@app.route('/<path:path>')
def route_static(path):
    return send_from_directory('.', path)

# --- AUTHENTICATION API ---
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    username = data.get('username', '').lower().strip()
    password = data.get('password', '')
    role = data.get('role', '')
    
    if role == 'admin':
        if username == 'admin' and password == 'admin123':
            return jsonify({'success': True, 'user': {'role': 'admin', 'data': {'name': 'Administrator'}}})
        return jsonify({'success': False, 'message': 'Invalid Admin credentials.'})
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if role == 'teacher':
        row = cursor.execute('SELECT * FROM teachers WHERE LOWER(username) = ? AND password = ?', (username, password)).fetchone()
        if row:
            teacher_data = dict(row)
            teacher_data['subjects'] = json.loads(teacher_data['subjects'])
            conn.close()
            return jsonify({'success': True, 'user': {'role': 'teacher', 'data': teacher_data}})
            
    elif role == 'student':
        row = cursor.execute('SELECT * FROM students WHERE LOWER(username) = ? AND password = ?', (username, password)).fetchone()
        if row:
            student_data = dict(row)
            student_data['interests'] = json.loads(student_data['interests'])
            
            # Fetch requested teachers
            reqs = cursor.execute('SELECT teacher_id FROM enquiries WHERE student_id = ?', (student_data['id'],)).fetchall()
            student_data['requestedTeachers'] = [r['teacher_id'] for r in reqs]
            
            conn.close()
            return jsonify({'success': True, 'user': {'role': 'student', 'data': student_data}})
            
    conn.close()
    return jsonify({'success': False, 'message': f'Invalid {role} username or password.'})

# --- REGISTRATION API ---
@app.route('/api/register/student', methods=['POST'])
def api_register_student():
    data = request.json
    username = data.get('username', '').lower().strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Username collisions
    s_chk = cursor.execute('SELECT id FROM students WHERE LOWER(username) = ?', (username,)).fetchone()
    t_chk = cursor.execute('SELECT id FROM teachers WHERE LOWER(username) = ?', (username,)).fetchone()
    if s_chk or t_chk or username == 'admin':
        conn.close()
        return jsonify({'success': False, 'message': 'Username already exists.'})
        
    new_id = "s_" + str(int(os.urandom(4).hex(), 16))
    cursor.execute('''
    INSERT INTO students (id, username, password, name, email, age, grade, contact, address, bio, interests)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        new_id,
        username,
        data.get('password'),
        data.get('name'),
        data.get('email'),
        data.get('age'),
        data.get('grade'),
        data.get('contact'),
        data.get('address'),
        data.get('bio'),
        json.dumps(data.get('interests', []))
    ))
    
    conn.commit()
    # Fetch inserted record
    row = cursor.execute('SELECT * FROM students WHERE id = ?', (new_id,)).fetchone()
    student_data = dict(row)
    student_data['interests'] = json.loads(student_data['interests'])
    student_data['requestedTeachers'] = []
    
    conn.close()
    return jsonify({'success': True, 'user': student_data})

@app.route('/api/register/teacher', methods=['POST'])
def api_register_teacher():
    data = request.json
    username = data.get('username', '').lower().strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    s_chk = cursor.execute('SELECT id FROM students WHERE LOWER(username) = ?', (username,)).fetchone()
    t_chk = cursor.execute('SELECT id FROM teachers WHERE LOWER(username) = ?', (username,)).fetchone()
    if s_chk or t_chk or username == 'admin':
        conn.close()
        return jsonify({'success': False, 'message': 'Username already exists.'})
        
    new_id = "t_" + str(int(os.urandom(4).hex(), 16))
    cursor.execute('''
    INSERT INTO teachers (id, username, password, name, email, age, experience, contact, address, bio, image, approved, subjects)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ''', (
        new_id,
        username,
        data.get('password'),
        data.get('name'),
        data.get('email'),
        data.get('age'),
        data.get('experience'),
        data.get('contact'),
        data.get('address'),
        data.get('bio'),
        data.get('image', ''),
        json.dumps(data.get('subjects', []))
    ))
    
    conn.commit()
    row = cursor.execute('SELECT * FROM teachers WHERE id = ?', (new_id,)).fetchone()
    teacher_data = dict(row)
    teacher_data['subjects'] = json.loads(teacher_data['subjects'])
    teacher_data['enquiries'] = []
    teacher_data['acceptedStudents'] = []
    
    conn.close()
    return jsonify({'success': True, 'user': teacher_data})

# --- DATA LISTINGS & UPDATES API ---
@app.route('/api/subjects', methods=['GET'])
def api_get_subjects():
    conn = get_db_connection()
    rows = conn.execute('SELECT name FROM subjects ORDER BY name ASC').fetchall()
    conn.close()
    return jsonify([r['name'] for r in rows])

@app.route('/api/subjects/add', methods=['POST'])
def api_add_subject():
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Subject title is required.'})
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO subjects (name) VALUES (?)', (name,))
        conn.commit()
        success = True
        msg = "Subject created successfully."
    except sqlite3.IntegrityError:
        success = False
        msg = "Subject already exists."
    conn.close()
    return jsonify({'success': success, 'message': msg})

@app.route('/api/subjects/remove', methods=['POST'])
def api_remove_subject():
    data = request.json
    name = data.get('name', '')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM subjects WHERE name = ?', (name,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/teachers', methods=['GET'])
def api_get_teachers():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM teachers').fetchall()
    
    teachers = []
    for r in rows:
        t = dict(r)
        t['subjects'] = json.loads(t['subjects'])
        
        # Load associated enquiries and accepted list
        enqs = conn.execute("SELECT student_id, status FROM enquiries WHERE teacher_id = ?", (t['id'],)).fetchall()
        t['enquiries'] = [e['student_id'] for e in enqs if e['status'] == 'pending']
        t['acceptedStudents'] = [e['student_id'] for e in enqs if e['status'] == 'accepted']
        teachers.append(t)
        
    conn.close()
    return jsonify(teachers)

@app.route('/api/students', methods=['GET'])
def api_get_students():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM students').fetchall()
    
    students = []
    for r in rows:
        s = dict(r)
        s['interests'] = json.loads(s['interests'])
        
        # Load requested list
        reqs = conn.execute("SELECT teacher_id FROM enquiries WHERE student_id = ?", (s['id'],)).fetchall()
        s['requestedTeachers'] = [rq['teacher_id'] for rq in reqs]
        students.append(s)
        
    conn.close()
    return jsonify(students)

@app.route('/api/student/update', methods=['POST'])
def api_update_student():
    data = request.json
    student_id = data.get('id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE students
    SET name=?, email=?, age=?, grade=?, contact=?, address=?, bio=?, interests=?
    WHERE id=?
    ''', (
        data.get('name'),
        data.get('email'),
        data.get('age'),
        data.get('grade'),
        data.get('contact'),
        data.get('address'),
        data.get('bio'),
        json.dumps(data.get('interests', [])),
        student_id
    ))
    conn.commit()
    row = cursor.execute('SELECT * FROM students WHERE id = ?', (student_id,)).fetchone()
    student_data = dict(row)
    student_data['interests'] = json.loads(student_data['interests'])
    
    reqs = cursor.execute('SELECT teacher_id FROM enquiries WHERE student_id = ?', (student_id,)).fetchall()
    student_data['requestedTeachers'] = [r['teacher_id'] for r in reqs]
    
    conn.close()
    return jsonify({'success': True, 'data': student_data})

@app.route('/api/teacher/update', methods=['POST'])
def api_update_teacher():
    data = request.json
    teacher_id = data.get('id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    UPDATE teachers
    SET name=?, email=?, age=?, experience=?, contact=?, address=?, bio=?, subjects=?, image=?
    WHERE id=?
    ''', (
        data.get('name'),
        data.get('email'),
        data.get('age'),
        data.get('experience'),
        data.get('contact'),
        data.get('address'),
        data.get('bio'),
        json.dumps(data.get('subjects', [])),
        data.get('image', ''),
        teacher_id
    ))
    conn.commit()
    row = cursor.execute('SELECT * FROM teachers WHERE id = ?', (teacher_id,)).fetchone()
    teacher_data = dict(row)
    teacher_data['subjects'] = json.loads(teacher_data['subjects'])
    
    conn.close()
    return jsonify({'success': True, 'data': teacher_data})

# --- MODERATION & RELATION API ---
@app.route('/api/teacher/approve', methods=['POST'])
def api_approve_teacher():
    data = request.json
    teacher_id = data.get('id')
    approved = 1 if data.get('approved') else 0
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE teachers SET approved = ? WHERE id = ?', (approved, teacher_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/teacher/<teacher_id>', methods=['DELETE'])
def api_delete_teacher(teacher_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM teachers WHERE id = ?', (teacher_id,))
    cursor.execute('DELETE FROM enquiries WHERE teacher_id = ?', (teacher_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/student/<student_id>', methods=['DELETE'])
def api_delete_student(student_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM students WHERE id = ?', (student_id,))
    cursor.execute('DELETE FROM enquiries WHERE student_id = ?', (student_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# --- STUDENT TUTOR ENQUIRY RELATIONS ---
@app.route('/api/tutor/request', methods=['POST'])
def api_tutor_request():
    data = request.json
    student_id = data.get('student_id')
    teacher_id = data.get('teacher_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('INSERT INTO enquiries (student_id, teacher_id, status) VALUES (?, ?, ?)', 
                       (student_id, teacher_id, 'pending'))
        conn.commit()
        success = True
        msg = "Request sent."
    except sqlite3.IntegrityError:
        success = False
        msg = "Request already sent."
    conn.close()
    return jsonify({'success': success, 'message': msg})

@app.route('/api/tutor/respond', methods=['POST'])
def api_tutor_respond():
    data = request.json
    student_id = data.get('student_id')
    teacher_id = data.get('teacher_id')
    action = data.get('action') # 'accept' or 'decline'
    
    conn = get_db_connection()
    cursor = conn.cursor()
    if action == 'accept':
        cursor.execute('UPDATE enquiries SET status = ? WHERE student_id = ? AND teacher_id = ?', 
                       ('accepted', student_id, teacher_id))
    else:
        cursor.execute('DELETE FROM enquiries WHERE student_id = ? AND teacher_id = ?', 
                       (student_id, teacher_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/stats', methods=['GET'])
def api_get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    teachers_count = cursor.execute('SELECT COUNT(*) FROM teachers').fetchone()[0]
    students_count = cursor.execute('SELECT COUNT(*) FROM students').fetchone()[0]
    pending_count = cursor.execute('SELECT COUNT(*) FROM teachers WHERE approved = 0').fetchone()[0]
    subjects_count = cursor.execute('SELECT COUNT(*) FROM subjects').fetchone()[0]
    
    conn.close()
    return jsonify({
        'teachers': teachers_count,
        'students': students_count,
        'pending': pending_count,
        'subjects': subjects_count
    })

if __name__ == '__main__':
    print("Initializing EliteTutors Flask API Server on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
