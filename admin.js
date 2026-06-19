// admin.js
// Centralized administrative dashboard script query database endpoints asynchronously.

class TuitionAdminApp {
  constructor() {
    this.adminUser = null;
    this.init();
  }

  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.checkAdminSession();
    this.registerServiceWorker();
  }

  // --- THEME MANAGEMENT ---
  setupTheme() {
    const savedTheme = localStorage.getItem("tuition_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    this.toggleThemeIcons(savedTheme);

    document.getElementById("theme-toggle").addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("tuition_theme", newTheme);
      this.toggleThemeIcons(newTheme);
    });
  }

  toggleThemeIcons(theme) {
    const sun = document.querySelector(".sun-icon");
    const moon = document.querySelector(".moon-icon");
    if (theme === "dark") {
      sun.style.display = "none";
      moon.style.display = "block";
    } else {
      sun.style.display = "block";
      moon.style.display = "none";
    }
  }

  // --- EVENT LISTENERS ---
  setupEventListeners() {
    document.getElementById("admin-login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAdminLogin();
    });

    document.getElementById("admin-add-subject-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddSubject();
    });
  }

  // --- SESSION CHECKING ---
  checkAdminSession() {
    const session = sessionStorage.getItem("tuition_admin_session");
    if (session) {
      this.adminUser = JSON.parse(session);
      this.showDashboard();
    } else {
      this.showLogin();
    }
  }

  async handleAdminLogin() {
    const userVal = document.getElementById("login-username").value.trim();
    const passVal = document.getElementById("login-password").value;

    const authRes = await window.db.authenticate(userVal, passVal, "admin");
    if (authRes.success) {
      this.adminUser = authRes.user;
      sessionStorage.setItem("tuition_admin_session", JSON.stringify(this.adminUser));
      this.showToast("Administrative access granted.", "success");
      this.showDashboard();
    } else {
      this.showToast(authRes.message, "error");
    }
  }

  logout() {
    sessionStorage.clear();
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }

    this.adminUser = null;
    this.showToast("Logged out from admin panel.", "success");

    setTimeout(() => {
      window.location.href = "admin.html";
    }, 800);
  }

  // --- TOGGLE VIEWS ---
  showLogin() {
    document.getElementById("admin-login-view").style.display = "flex";
    document.getElementById("admin-dashboard-view").style.display = "none";
    this.updateNavbar(false);
  }

  showDashboard() {
    document.getElementById("admin-login-view").style.display = "none";
    document.getElementById("admin-dashboard-view").style.display = "block";
    this.updateNavbar(true);
    this.renderDashboardData();
    this.switchTab("overview");
  }

  updateNavbar(isLoggedIn) {
    const container = document.getElementById("nav-auth-section");
    if (!container) return;

    if (isLoggedIn) {
      container.innerHTML = `
        <div style="display:flex; align-items:center; gap: 1rem;">
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 0.9rem;">Administrator</div>
            <span style="font-size:0.75rem; color:var(--admin-color); font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">Superuser</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-admin-logout">Log Out</button>
        </div>
      `;
      document.getElementById("btn-admin-logout").addEventListener("click", () => this.logout());
    } else {
      container.innerHTML = `
        <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Secure Node Portal</span>
      `;
    }
  }

  // --- TAB NAVIGATION ---
  switchTab(tabName) {
    const sideMenu = document.querySelector("#admin-dashboard-view .dashboard-sidebar");
    if (sideMenu) {
      sideMenu.querySelectorAll(".sidebar-menu-item").forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-tab") === `admin-${tabName}`) {
          item.classList.add("active");
        }
      });
    }

    const mainPanel = document.querySelector("#admin-dashboard-view .dashboard-main");
    if (mainPanel) {
      mainPanel.querySelectorAll(".dashboard-tab-content").forEach(content => {
        content.classList.remove("active");
      });
      const targetContent = document.getElementById(`tab-admin-${tabName}`);
      if (targetContent) targetContent.classList.add("active");
    }
  }

  // --- RENDER STATISTICS & TABLES ---
  async renderDashboardData() {
    // Load admin stats from sqlite API
    const stats = await window.db.getAdminStats();

    document.getElementById("admin-stat-teachers").innerText = stats.teachers;
    document.getElementById("admin-stat-students").innerText = stats.students;
    document.getElementById("admin-stat-pending").innerText = stats.pending;
    document.getElementById("admin-stat-subjects").innerText = stats.subjects;

    await this.renderTeachersTable();
    await this.renderStudentsTable();
    await this.renderSubjectsPills();
  }

  async renderTeachersTable() {
    const tbody = document.getElementById("admin-teachers-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    const teachers = await window.db.getTeachers();

    if (teachers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 2rem;">No teachers registered yet.</td></tr>`;
      return;
    }

    teachers.forEach(t => {
      const row = document.createElement("tr");
      const subjectBadges = t.subjects.map(s => `<span class="subject-badge">${window.db.escapeHTML(s)}</span>`).join(" ");

      let imgHtml = "";
      if (t.image) {
        imgHtml = `<img src="${t.image}" alt="${window.db.escapeHTML(t.name)}" class="table-avatar">`;
      } else {
        const initials = t.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        imgHtml = `<div class="table-avatar avatar-placeholder" style="width:40px; height:40px; border-radius:50%; font-size:0.8rem; background: linear-gradient(135deg, var(--teacher-color), var(--primary));">${initials}</div>`;
      }

      row.innerHTML = `
        <td>
          <div class="table-user">
            ${imgHtml}
            <div>
              <div style="font-weight:700;">${window.db.escapeHTML(t.name)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">@${window.db.escapeHTML(t.username)}</div>
            </div>
          </div>
        </td>
        <td>
          <strong>${t.experience} Yrs</strong> Exp<br>
          <span style="font-size:0.8rem; color:var(--text-muted);">${t.age} Years Old</span>
        </td>
        <td style="max-width: 200px; overflow-wrap: break-word;">${subjectBadges}</td>
        <td>
          📧 ${window.db.escapeHTML(t.email)}<br>
          📞 ${window.db.escapeHTML(t.contact)}
        </td>
        <td>
          ${t.approved ? 
            `<span class="badge badge-success">Approved</span>` : 
            `<span class="badge badge-pending">Pending</span>`
          }
        </td>
        <td>
          <div class="table-actions">
            <button class="btn ${t.approved ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="adminApp.toggleTeacherApproval('${t.id}', ${!t.approved})">
              ${t.approved ? 'Revoke' : 'Approve'}
            </button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="adminApp.deleteTeacher('${t.id}')">
              Delete
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  async toggleTeacherApproval(teacherId, status) {
    const success = await window.db.setTeacherApproval(teacherId, status);
    if (success) {
      this.showToast(status ? "Teacher account approved!" : "Teacher approval status revoked.", "success");
      await this.renderDashboardData();
    } else {
      this.showToast("Failed to alter teacher status.", "error");
    }
  }

  async deleteTeacher(teacherId) {
    if (confirm("Are you sure you want to permanently delete this teacher account? This will also remove their student enquiries.")) {
      const success = await window.db.deleteTeacher(teacherId);
      if (success) {
        this.showToast("Teacher profile deleted successfully.", "success");
        await this.renderDashboardData();
      } else {
        this.showToast("Failed to delete teacher account.", "error");
      }
    }
  }

  async renderStudentsTable() {
    const tbody = document.getElementById("admin-students-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    const students = await window.db.getStudents();

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 2rem;">No students registered yet.</td></tr>`;
      return;
    }

    students.forEach(s => {
      const row = document.createElement("tr");
      const interestBadges = s.interests.map(i => `<span class="subject-badge" style="background:rgba(59,130,246,0.1); color:var(--student-color);">${window.db.escapeHTML(i)}</span>`).join(" ");

      row.innerHTML = `
        <td>
          <div style="font-weight:700;">${window.db.escapeHTML(s.name)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">@${window.db.escapeHTML(s.username)} (Age: ${s.age})</div>
        </td>
        <td><span class="badge badge-success" style="background:rgba(59,130,246,0.1); color:var(--student-color);">${window.db.escapeHTML(s.grade)}</span></td>
        <td>
          📧 ${window.db.escapeHTML(s.email)}<br>
          📞 ${window.db.escapeHTML(s.contact)}
        </td>
        <td style="max-width: 200px; overflow-wrap: break-word;">${interestBadges}</td>
        <td style="font-size:0.85rem;">${window.db.escapeHTML(s.address)}</td>
        <td>
          <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="adminApp.deleteStudent('${s.id}')">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  async deleteStudent(studentId) {
    if (confirm("Are you sure you want to permanently delete this student account?")) {
      const success = await window.db.deleteStudent(studentId);
      if (success) {
        this.showToast("Student profile deleted successfully.", "success");
        await this.renderDashboardData();
      } else {
        this.showToast("Failed to delete student account.", "error");
      }
    }
  }

  async renderSubjectsPills() {
    const list = document.getElementById("admin-subject-pills-list");
    if (!list) return;

    list.innerHTML = "";
    const subjects = await window.db.getSubjects();

    subjects.forEach(subject => {
      const pill = document.createElement("div");
      pill.className = "subject-pill";
      pill.innerHTML = `
        <span>${window.db.escapeHTML(subject)}</span>
        <span class="remove-sub" onclick="adminApp.removeSubject('${window.db.escapeHTML(subject)}')">&times;</span>
      `;
      list.appendChild(pill);
    });
  }

  async handleAddSubject() {
    const form = document.getElementById("admin-add-subject-form");
    const input = form.querySelector("[name='subject_title']");
    const title = input.value.trim();

    if (!title) return;

    if (!/^[a-zA-Z\s\-']{2,50}$/.test(title)) {
      this.showToast("Subject title must only contain letters and be between 2-50 chars.", "error");
      return;
    }

    const res = await window.db.addSubject(title);
    if (res.success) {
      this.showToast(`Subject "${window.db.escapeHTML(title)}" created!`, "success");
      input.value = "";
      await this.renderDashboardData();
    } else {
      this.showToast(res.message, "error");
    }
  }

  async removeSubject(subject) {
    if (confirm(`Are you sure you want to remove the subject "${subject}"?`)) {
      const res = await window.db.removeSubject(subject);
      if (res.success) {
        this.showToast(`Subject "${subject}" has been deleted.`, "success");
        await this.renderDashboardData();
      } else {
        this.showToast(res.message, "error");
      }
    }
  }

  // --- TOASTS ---
  showToast(message, type = "success") {
    const holder = document.getElementById("toast-holder");
    if (!holder) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "🔑";
    if (type === "success") icon = "✨";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "💥";

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    holder.appendChild(toast);

    setTimeout(() => toast.classList.add("active"), 10);

    setTimeout(() => {
      toast.classList.remove("active");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("Service Worker registered on admin page successfully:", reg.scope))
          .catch((err) => console.error("Service Worker registration failed:", err));
      });
    }
  }
}

// Instantiate admin app
window.adminApp = new TuitionAdminApp();
