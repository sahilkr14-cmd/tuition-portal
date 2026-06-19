// database.js
// Communication layer between frontend and centralized Flask backend API.
// Replaces localStorage database with real-time HTTP API calls.

class TuitionDatabase {
  constructor() {
    this.apiBase = "/api";
  }

  // --- CRYPTO PASSWORD HASHING (SHA-256) ---
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // Escape HTML helper
  escapeHTML(str) {
    if (typeof str !== "string") return str;
    return str.replace(/[&<>"']/g, function(m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#039;';
        default: return m;
      }
    });
  }

  // --- API DATA GETTERS ---
  async getTeachers() {
    try {
      const res = await fetch(`${this.apiBase}/teachers`);
      return await res.json();
    } catch (e) {
      console.error("Error fetching teachers:", e);
      return [];
    }
  }

  async getStudents() {
    try {
      const res = await fetch(`${this.apiBase}/students`);
      return await res.json();
    } catch (e) {
      console.error("Error fetching students:", e);
      return [];
    }
  }

  async getSubjects() {
    try {
      const res = await fetch(`${this.apiBase}/subjects`);
      return await res.json();
    } catch (e) {
      console.error("Error fetching subjects:", e);
      return [];
    }
  }

  // --- AUTHENTICATION ---
  async authenticate(username, password, role) {
    const hashedPassword = role === "admin" ? password : await this.hashPassword(password);
    
    try {
      const res = await fetch(`${this.apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: hashedPassword, role })
      });
      return await res.json();
    } catch (e) {
      console.error("Error during authentication:", e);
      return { success: false, message: "Server connection failed." };
    }
  }

  // --- REGISTRATION ---
  async registerTeacher(teacherData) {
    try {
      const res = await fetch(`${this.apiBase}/register/teacher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherData)
      });
      return await res.json();
    } catch (e) {
      console.error("Error registering teacher:", e);
      return { success: false, message: "Teacher registration failed." };
    }
  }

  async registerStudent(studentData) {
    try {
      const res = await fetch(`${this.apiBase}/register/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentData)
      });
      return await res.json();
    } catch (e) {
      console.error("Error registering student:", e);
      return { success: false, message: "Student registration failed." };
    }
  }

  // --- UPDATES ---
  async updateTeacherProfile(teacherId, updatedData) {
    try {
      const res = await fetch(`${this.apiBase}/teacher/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teacherId, ...updatedData })
      });
      return await res.json();
    } catch (e) {
      console.error("Error updating teacher profile:", e);
      return { success: false, message: "Profile update failed." };
    }
  }

  async updateStudentProfile(studentId, updatedData) {
    try {
      const res = await fetch(`${this.apiBase}/student/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId, ...updatedData })
      });
      return await res.json();
    } catch (e) {
      console.error("Error updating student profile:", e);
      return { success: false, message: "Profile update failed." };
    }
  }

  // --- ADMIN SETTINGS & MODERATION ---
  async setTeacherApproval(teacherId, approved) {
    try {
      const res = await fetch(`${this.apiBase}/teacher/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teacherId, approved })
      });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error("Error setting approval:", e);
      return false;
    }
  }

  async deleteTeacher(teacherId) {
    try {
      const res = await fetch(`${this.apiBase}/teacher/${teacherId}`, { method: "DELETE" });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error("Error deleting teacher:", e);
      return false;
    }
  }

  async deleteStudent(studentId) {
    try {
      const res = await fetch(`${this.apiBase}/student/${studentId}`, { method: "DELETE" });
      const data = await res.json();
      return data.success;
    } catch (e) {
      console.error("Error deleting student:", e);
      return false;
    }
  }

  // --- ACTIONS & CONNECTIONS ---
  async requestTutor(studentId, teacherId) {
    try {
      const res = await fetch(`${this.apiBase}/tutor/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, teacher_id: teacherId })
      });
      return await res.json();
    } catch (e) {
      console.error("Error requesting tutor:", e);
      return { success: false, message: "Request failed." };
    }
  }

  async respondToRequest(teacherId, studentId, action) {
    try {
      const res = await fetch(`${this.apiBase}/tutor/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacherId, student_id: studentId, action })
      });
      return await res.json();
    } catch (e) {
      console.error("Error responding to request:", e);
      return { success: false, message: "Response update failed." };
    }
  }

  // --- SUBJECT MANAGEMENT ---
  async addSubject(subjectName) {
    try {
      const res = await fetch(`${this.apiBase}/subjects/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subjectName })
      });
      return await res.json();
    } catch (e) {
      console.error("Error creating subject:", e);
      return { success: false, message: "Subject creation failed." };
    }
  }

  async removeSubject(subjectName) {
    try {
      const res = await fetch(`${this.apiBase}/subjects/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subjectName })
      });
      return await res.json();
    } catch (e) {
      console.error("Error deleting subject:", e);
      return { success: false, message: "Subject removal failed." };
    }
  }

  async getAdminStats() {
    try {
      const res = await fetch(`${this.apiBase}/stats`);
      return await res.json();
    } catch (e) {
      console.error("Error loading stats:", e);
      return { teachers: 0, students: 0, pending: 0, subjects: 0 };
    }
  }
}

// Export database interface to global scope for SPA app
window.db = new TuitionDatabase();
