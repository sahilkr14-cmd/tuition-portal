// app.js
// Front-end controller handling UI rendering, forms, login sessions, and event interactions.
// Connected to the centralized Python+SQLite Flask Backend API.

class TuitionApp {
  constructor() {
    this.currentUser = null; // { role: 'student'|'teacher', data: object }
    this.authModalRole = 'student';
    this.registerModalRole = 'student';
    this.teacherBase64Image = ""; // Holds base64 upload image temporarily

    this.init();
  }

  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.checkSession();
    this.updateLandingStats();
    this.setupInputRestrictionFilters();
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
    // Logo redirect to landing/dashboard
    document.getElementById("nav-logo").addEventListener("click", (e) => {
      e.preventDefault();
      if (this.currentUser) {
        this.navigateToDashboard(this.currentUser.role);
      } else {
        this.showView("view-landing");
      }
    });

    // Landing browse button
    document.getElementById("btn-browse-landing").addEventListener("click", () => {
      this.showAuthModal("student");
      this.showToast("Please log in as a student to search and view tutors.", "warning");
    });

    // Login Form Submit
    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Student Reg Form Submit
    document.getElementById("register-student-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleStudentRegistration();
    });

    // Teacher Reg Form Submit
    document.getElementById("register-teacher-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleTeacherRegistration();
    });

    // Student Profile Save
    document.getElementById("student-profile-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveStudentProfile();
    });

    // Teacher Profile Save
    document.getElementById("teacher-profile-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveTeacherProfile();
    });

    // Setup Drag-and-Drop Image Handlers
    this.setupImageUpload("register-teacher-image-drag-area", "register-teacher-image-file-input", "register-teacher-image-preview");
    this.setupImageUpload("teacher-image-drag-area", "teacher-image-file-input", "teacher-image-preview");
  }

  // --- IMAGE UPLOAD HELPER (BASE64) ---
  setupImageUpload(dragAreaId, fileInputId, previewId) {
    const dragArea = document.getElementById(dragAreaId);
    const fileInput = document.getElementById(fileInputId);
    const preview = document.getElementById(previewId);

    if (!dragArea || !fileInput || !preview) return;

    dragArea.addEventListener("click", () => fileInput.click());

    ["dragenter", "dragover"].forEach(eventName => {
      dragArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dragArea.style.borderColor = "var(--primary)";
        dragArea.style.background = "var(--primary-glow)";
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      dragArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        dragArea.style.borderColor = "var(--border-color)";
        dragArea.style.background = "none";
      }, false);
    });

    dragArea.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        this.processImageFile(files[0], preview);
      }
    });

    fileInput.addEventListener("change", (e) => {
      const files = e.target.files;
      if (files.length) {
        this.processImageFile(files[0], preview);
      }
    });
  }

  processImageFile(file, previewElement) {
    if (!file.type.startsWith("image/")) {
      this.showToast("Only image files are allowed.", "error");
      return;
    }
    if (file.size > 500 * 1024) {
      this.showToast("Image size must be smaller than 500KB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      this.teacherBase64Image = reader.result;
      previewElement.src = reader.result;
      previewElement.style.display = "block";
      this.showToast("Profile image loaded successfully.", "success");
    };
  }

  // --- VIEW ROUTING ---
  showView(viewId) {
    document.querySelectorAll(".view-section").forEach(view => {
      view.classList.remove("active");
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add("active");
      window.scrollTo(0, 0);
    }
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = "success") {
    const holder = document.getElementById("toast-holder");
    if (!holder) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "🔔";
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

  // --- MODAL UTILITIES ---
  showAuthModal(role = "student") {
    this.closeModals();
    this.setAuthModalRole(role);
    document.getElementById("modal-auth").classList.add("active");
  }

  setAuthModalRole(role) {
    this.authModalRole = role;
    
    const tabs = document.querySelectorAll("#auth-role-tabs .auth-tab");
    tabs.forEach(tab => {
      tab.classList.remove("active");
      if (tab.classList.contains(role)) tab.classList.add("active");
    });

    const signupLink = document.getElementById("login-signup-link-container");
    if (role === "admin") {
      signupLink.style.display = "none";
      document.getElementById("auth-modal-title").innerText = "Sign In as Admin";
    } else {
      signupLink.style.display = "block";
      document.getElementById("auth-modal-title").innerText = `Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    }
    
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
  }

  switchToRegisterModal() {
    this.closeModals();
    this.setRegisterModalRole(this.authModalRole === "admin" ? "student" : this.authModalRole);
    document.getElementById("modal-register").classList.add("active");
  }

  switchToLoginModal() {
    this.closeModals();
    this.showAuthModal(this.registerModalRole);
  }

  async setRegisterModalRole(role) {
    this.registerModalRole = role;
    this.teacherBase64Image = ""; // Reset temporary image
    
    const rTabStudent = document.getElementById("register-tab-student");
    const rTabTeacher = document.getElementById("register-tab-teacher");
    const formStudent = document.getElementById("register-student-form");
    const formTeacher = document.getElementById("register-teacher-form");

    if (role === "student") {
      rTabStudent.classList.add("active");
      rTabTeacher.classList.remove("active");
      formStudent.style.display = "block";
      formTeacher.style.display = "none";
      formStudent.reset();
      await this.populateSubjectsCheckboxList("register-student-subjects-container", []);
    } else {
      rTabStudent.classList.remove("active");
      rTabTeacher.classList.add("active");
      formStudent.style.display = "none";
      formTeacher.style.display = "block";
      formTeacher.reset();
      document.getElementById("register-teacher-image-preview").style.display = "none";
      await this.populateSubjectsCheckboxList("register-teacher-subjects-container", []);
    }
  }

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach(modal => {
      modal.classList.remove("active");
    });
  }

  // --- DYNAMIC CHECKBOX LIST FOR SUBJECTS ---
  async populateSubjectsCheckboxList(containerId, checkedSubjects = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const subjects = await window.db.getSubjects();
    container.innerHTML = "";

    subjects.forEach((subject) => {
      const isChecked = checkedSubjects.includes(subject);
      const label = document.createElement("label");
      label.className = `checkbox-label ${isChecked ? 'checked' : ''}`;
      
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = subject;
      input.checked = isChecked;
      
      input.addEventListener("change", () => {
        if (input.checked) {
          label.classList.add("checked");
        } else {
          label.classList.remove("checked");
        }
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(subject));
      container.appendChild(label);
    });
  }

  getSelectedCheckboxValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checkedInputs = container.querySelectorAll("input[type='checkbox']:checked");
    return Array.from(checkedInputs).map(input => input.value);
  }

  // --- SESSION MANAGEMENT ---
  checkSession() {
    const session = sessionStorage.getItem("tuition_session");
    if (session) {
      this.currentUser = JSON.parse(session);
      this.updateNavbarAuth();
      this.navigateToDashboard(this.currentUser.role);
    } else {
      this.updateNavbarAuth();
      this.showView("view-landing");
    }
  }

  async handleLogin() {
    const userVal = document.getElementById("login-username").value.trim();
    const passVal = document.getElementById("login-password").value;

    const authRes = await window.db.authenticate(userVal, passVal, this.authModalRole);
    if (authRes.success) {
      this.currentUser = authRes.user;
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
      
      this.showToast(`Logged in successfully as ${this.currentUser.data.name}!`, "success");
      this.updateNavbarAuth();
      this.closeModals();
      this.navigateToDashboard(this.currentUser.role);
      this.updateLandingStats();
    } else {
      this.showToast(authRes.message, "error");
    }
  }

  async handleStudentRegistration() {
    const form = document.getElementById("register-student-form");
    const formData = new FormData(form);
    
    const interests = this.getSelectedCheckboxValues("register-student-subjects-container");
    if (interests.length === 0) {
      this.showToast("Please select at least one subject of interest.", "warning");
      return;
    }

    const studentData = {
      username: formData.get("username").trim(),
      password: formData.get("password"),
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      age: parseInt(formData.get("age")),
      grade: formData.get("grade").trim(),
      contact: formData.get("contact").trim(),
      address: formData.get("address").trim(),
      bio: formData.get("bio").trim(),
      interests: interests
    };

    const regRes = await window.db.registerStudent(studentData);
    if (regRes.success) {
      this.showToast("Account created successfully! You are now logged in.", "success");
      
      this.currentUser = { role: "student", data: regRes.user };
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
      
      this.updateNavbarAuth();
      this.closeModals();
      this.navigateToDashboard("student");
      this.updateLandingStats();
    } else {
      this.showToast(regRes.message, "error");
    }
  }

  async handleTeacherRegistration() {
    const form = document.getElementById("register-teacher-form");
    const formData = new FormData(form);

    const subjects = this.getSelectedCheckboxValues("register-teacher-subjects-container");
    if (subjects.length === 0) {
      this.showToast("Please select at least one subject you can teach.", "warning");
      return;
    }

    const teacherData = {
      username: formData.get("username").trim(),
      password: formData.get("password"),
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      age: parseInt(formData.get("age")),
      experience: parseInt(formData.get("experience")),
      contact: formData.get("contact").trim(),
      address: formData.get("address").trim(),
      bio: formData.get("bio").trim(),
      subjects: subjects,
      image: this.teacherBase64Image
    };

    const regRes = await window.db.registerTeacher(teacherData);
    if (regRes.success) {
      this.showToast("Registration completed! Profile is pending administrator approval.", "success");
      
      this.currentUser = { role: "teacher", data: regRes.user };
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
      
      this.updateNavbarAuth();
      this.closeModals();
      this.navigateToDashboard("teacher");
      this.updateLandingStats();
    } else {
      this.showToast(regRes.message, "error");
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

    this.currentUser = null;
    this.teacherBase64Image = "";
    this.showToast("Logged out successfully.", "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  }

  // --- NAVBAR UPDATE ---
  updateNavbarAuth() {
    const section = document.getElementById("nav-auth-section");
    if (!section) return;

    if (this.currentUser) {
      let roleBadgeColor = "var(--primary)";
      if (this.currentUser.role === "student") roleBadgeColor = "var(--student-color)";
      if (this.currentUser.role === "teacher") roleBadgeColor = "var(--teacher-color)";

      section.innerHTML = `
        <div style="display:flex; align-items:center; gap: 1rem;">
          <div style="text-align: right; display:none; display:sm-block;">
            <div style="font-weight: 700; font-size: 0.9rem;">${this.currentUser.data.name}</div>
            <span style="font-size:0.75rem; color:${roleBadgeColor}; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">
              ${this.currentUser.role}
            </span>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-logout-navbar">Log Out</button>
        </div>
      `;
      document.getElementById("btn-logout-navbar").addEventListener("click", () => this.logout());
    } else {
      section.innerHTML = `
        <button class="btn btn-primary" onclick="app.showAuthModal('student')">Sign In</button>
      `;
    }
  }

  // --- DASHBOARD ROUTING AND TAB SWITCHING ---
  navigateToDashboard(role) {
    if (role === "admin") {
      window.location.href = "admin.html";
    } else if (role === "student") {
      this.showView("view-student");
      this.renderStudentDashboard();
      this.switchTab('student', 'browse');
    } else if (role === "teacher") {
      this.showView("view-teacher");
      this.renderTeacherDashboard();
      this.switchTab('teacher', 'enquiries');
    }
  }

  switchTab(role, tabName) {
    const sideMenu = document.querySelector(`#view-${role} .dashboard-sidebar`);
    if (sideMenu) {
      sideMenu.querySelectorAll(".sidebar-menu-item").forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-tab") === `${role}-${tabName}`) {
          item.classList.add("active");
        }
      });
    }

    const mainPanel = document.querySelector(`#view-${role} .dashboard-main`);
    if (mainPanel) {
      mainPanel.querySelectorAll(".dashboard-tab-content").forEach(content => {
        content.classList.remove("active");
      });
      const targetContent = document.getElementById(`tab-${role}-${tabName}`);
      if (targetContent) targetContent.classList.add("active");
    }
  }

  async updateLandingStats() {
    const teachers = await window.db.getTeachers();
    const approvedTeachers = teachers.filter(t => t.approved);
    const students = await window.db.getStudents();
    
    const teachersElem = document.getElementById("stat-teachers-count");
    const studentsElem = document.getElementById("stat-students-count");

    if (teachersElem) teachersElem.innerText = `${approvedTeachers.length}+`;
    if (studentsElem) studentsElem.innerText = `${students.length}+`;
  }

  // ==============================================
  // STUDENT DASHBOARD CONTROLLER
  // ==============================================
  async renderStudentDashboard() {
    if (this.currentUser.role !== "student") return;
    
    // Fetch latest student details from API to maintain sync
    const students = await window.db.getStudents();
    const freshData = students.find(s => s.id === this.currentUser.data.id);
    if (freshData) {
      this.currentUser.data = freshData;
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
    }

    const student = this.currentUser.data;

    document.getElementById("student-welcome-title").innerText = `Welcome back, ${student.name}!`;
    document.getElementById("student-sidebar-name").innerText = student.name;
    document.getElementById("student-sidebar-grade").innerText = student.grade;
    
    const avatar = document.getElementById("student-sidebar-avatar");
    avatar.innerText = student.name.charAt(0).toUpperCase();

    // Setup filter options dynamically
    const subjectFilter = document.getElementById("filter-tutor-subject");
    subjectFilter.innerHTML = '<option value="">All Subjects</option>';
    const subjects = await window.db.getSubjects();
    subjects.forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.innerText = sub;
      subjectFilter.appendChild(opt);
    });

    const searchName = document.getElementById("search-tutor-name");
    const searchSubject = document.getElementById("filter-tutor-subject");
    const searchExp = document.getElementById("filter-tutor-experience");

    searchName.value = "";
    searchSubject.value = "";
    searchExp.value = "";

    const filterHandler = async () => {
      await this.filterAndRenderTutors(
        searchName.value.trim(),
        searchSubject.value,
        searchExp.value
      );
    };

    searchName.oninput = filterHandler;
    searchSubject.onchange = filterHandler;
    searchExp.onchange = filterHandler;

    await this.filterAndRenderTutors("", "", "");
    await this.renderStudentRequestsTable();
    await this.populateStudentProfileForm();
  }

  async filterAndRenderTutors(query, subject, minExp) {
    const listContainer = document.getElementById("tutors-list-container");
    if (!listContainer) return;

    let teachers = await window.db.getTeachers();
    teachers = teachers.filter(t => t.approved); // Only approved tutors shown!
    const student = this.currentUser.data;

    if (query) {
      const q = query.toLowerCase();
      teachers = teachers.filter(t => t.name.toLowerCase().includes(q) || t.bio.toLowerCase().includes(q));
    }
    if (subject) {
      teachers = teachers.filter(t => t.subjects.includes(subject));
    }
    if (minExp) {
      teachers = teachers.filter(t => t.experience >= parseInt(minExp));
    }

    listContainer.innerHTML = "";

    if (teachers.length === 0) {
      listContainer.innerHTML = `
        <div class="no-tutors-found card">
          <div style="font-size:3rem;">🔍</div>
          <h3 style="margin-top:1rem;">No matching tutors found</h3>
          <p style="color:var(--text-muted); font-size:0.9rem;">Try adjusting your subject filters or typing a different search term.</p>
        </div>
      `;
      return;
    }

    teachers.forEach(t => {
      const hasRequested = student.requestedTeachers.includes(t.id);
      const isAccepted = t.acceptedStudents.includes(student.id);

      const card = document.createElement("div");
      card.className = "card tutor-card";

      const subBadges = t.subjects.map(s => `<span class="subject-badge">${window.db.escapeHTML(s)}</span>`).join("");

      let imgTag = "";
      if (t.image) {
        imgTag = `<img src="${t.image}" alt="${window.db.escapeHTML(t.name)}" class="tutor-avatar">`;
      } else {
        const initials = t.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        imgTag = `<div class="tutor-avatar avatar-placeholder" style="background: linear-gradient(135deg, var(--teacher-color), var(--primary))">${initials}</div>`;
      }

      let contactDetailHtml = "";
      if (isAccepted) {
        contactDetailHtml = `
          <div class="tutor-contact-info">
            <div style="font-weight:700; color:var(--success); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.25rem;">
              <span>✅</span> Connected
            </div>
            <div class="tutor-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>${window.db.escapeHTML(t.contact)}</span>
            </div>
            <div class="tutor-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span>${window.db.escapeHTML(t.email)}</span>
            </div>
            <div class="tutor-contact-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${window.db.escapeHTML(t.address)}</span>
            </div>
          </div>
        `;
      } else {
        contactDetailHtml = `
          <div class="tutor-contact-info" style="filter: blur(0.5px); opacity:0.8;">
            <div class="tutor-contact-item">
              <span>📍 Address:</span> <span style="font-style:italic;">Request tuition to unlock details</span>
            </div>
            <div class="tutor-contact-item">
              <span>📞 Contact:</span> <span style="font-style:italic;">Request tuition to unlock details</span>
            </div>
          </div>
        `;
      }

      let actionBtn = "";
      if (isAccepted) {
        actionBtn = `<button class="btn btn-outline" style="width:100%; border-color:var(--success); color:var(--success);" disabled>Active Tuition</button>`;
      } else if (hasRequested) {
        actionBtn = `<button class="btn btn-secondary" style="width:100%;" disabled>⏳ Pending Tutor Response</button>`;
      } else {
        actionBtn = `<button class="btn btn-student" style="width:100%;" onclick="app.requestTutorConnection('${t.id}')">Request Tuition</button>`;
      }

      card.innerHTML = `
        <div>
          <div class="tutor-header">
            ${imgTag}
            <div class="tutor-meta">
              <h3>${window.db.escapeHTML(t.name)}</h3>
              <p>Experience: <strong>${t.experience} Years</strong></p>
              <p>Age: <strong>${t.age} Y/O</strong></p>
            </div>
          </div>
          <div class="subject-badge-list">
            ${subBadges}
          </div>
          <p class="tutor-bio" title="${window.db.escapeHTML(t.bio)}">${window.db.escapeHTML(t.bio)}</p>
          ${contactDetailHtml}
        </div>
        <div>
          ${actionBtn}
        </div>
      `;

      listContainer.appendChild(card);
    });
  }

  async requestTutorConnection(teacherId) {
    const student = this.currentUser.data;
    const reqRes = await window.db.requestTutor(student.id, teacherId);

    if (reqRes.success) {
      this.showToast("Tuition enquiry sent successfully!", "success");
      await this.renderStudentDashboard();
    } else {
      this.showToast(reqRes.message, "error");
    }
  }

  async renderStudentRequestsTable() {
    const tbody = document.getElementById("student-requests-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    const student = this.currentUser.data;
    const teachers = await window.db.getTeachers();

    const myRequestedTeachers = teachers.filter(t => student.requestedTeachers.includes(t.id));

    if (myRequestedTeachers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">You have not sent any tuition requests yet.</td></tr>`;
      return;
    }

    myRequestedTeachers.forEach(t => {
      const isAccepted = t.acceptedStudents.includes(student.id);
      const row = document.createElement("tr");
      
      let imgHtml = "";
      if (t.image) {
        imgHtml = `<img src="${t.image}" alt="${window.db.escapeHTML(t.name)}" class="table-avatar">`;
      } else {
        const initials = t.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        imgHtml = `<div class="table-avatar avatar-placeholder" style="width:40px; height:40px; border-radius:50%; font-size:0.8rem; background: linear-gradient(135deg, var(--teacher-color), var(--primary));">${initials}</div>`;
      }

      const subjectsBadges = t.subjects.map(s => `<span class="subject-badge">${window.db.escapeHTML(s)}</span>`).join(" ");

      row.innerHTML = `
        <td>
          <div class="table-user">
            ${imgHtml}
            <div>
              <div style="font-weight:700;">${window.db.escapeHTML(t.name)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${t.experience} Years Exp</div>
            </div>
          </div>
        </td>
        <td>${subjectsBadges}</td>
        <td>
          ${isAccepted ? `
            <div style="font-size:0.9rem;">
              📞 <strong>${window.db.escapeHTML(t.contact)}</strong><br>
              ✉️ <strong>${window.db.escapeHTML(t.email)}</strong><br>
              📍 <span style="font-size:0.8rem; color:var(--text-muted);">${window.db.escapeHTML(t.address)}</span>
            </div>
          ` : `
            <span style="font-style:italic; font-size:0.85rem; color:var(--text-muted);">Locked (Requires Approval)</span>
          `}
        </td>
        <td>
          ${isAccepted ? 
            `<span class="badge badge-success">Connected</span>` : 
            `<span class="badge badge-pending">Pending Response</span>`
          }
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  async populateStudentProfileForm() {
    const form = document.getElementById("student-profile-form");
    if (!form) return;

    const student = this.currentUser.data;
    form.querySelector("[name='name']").value = student.name;
    form.querySelector("[name='email']").value = student.email;
    form.querySelector("[name='age']").value = student.age;
    form.querySelector("[name='grade']").value = student.grade;
    form.querySelector("[name='contact']").value = student.contact;
    form.querySelector("[name='address']").value = student.address;
    form.querySelector("[name='bio']").value = student.bio;

    await this.populateSubjectsCheckboxList("student-interest-subjects-container", student.interests);
  }

  async saveStudentProfile() {
    const form = document.getElementById("student-profile-form");
    const formData = new FormData(form);
    const interests = this.getSelectedCheckboxValues("student-interest-subjects-container");

    if (interests.length === 0) {
      this.showToast("Please choose at least one interest subject.", "warning");
      return;
    }

    const updatedData = {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      age: parseInt(formData.get("age")),
      grade: formData.get("grade").trim(),
      contact: formData.get("contact").trim(),
      address: formData.get("address").trim(),
      bio: formData.get("bio").trim(),
      interests: interests
    };

    const res = await window.db.updateStudentProfile(this.currentUser.data.id, updatedData);
    if (res.success) {
      this.currentUser.data = res.data;
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
      this.showToast("Profile settings updated successfully!", "success");
      await this.renderStudentDashboard();
      this.updateNavbarAuth();
    } else {
      this.showToast(res.message, "error");
    }
  }


  // ==============================================
  // TEACHER DASHBOARD CONTROLLER
  // ==============================================
  async renderTeacherDashboard() {
    if (this.currentUser.role !== "teacher") return;
    
    // Fetch latest record from DB
    const teachers = await window.db.getTeachers();
    const freshData = teachers.find(t => t.id === this.currentUser.data.id);
    if (freshData) {
      this.currentUser.data = freshData;
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
    }

    const t = this.currentUser.data;

    document.getElementById("teacher-welcome-title").innerText = `Welcome back, ${t.name}!`;
    document.getElementById("teacher-sidebar-name").innerText = t.name;
    document.getElementById("teacher-sidebar-experience").innerText = `${t.experience} Years Experience`;

    const badgeContainer = document.getElementById("teacher-approval-badge-container");
    if (t.approved) {
      badgeContainer.innerHTML = `<span class="badge badge-success">Approved Profile</span>`;
    } else {
      badgeContainer.innerHTML = `<span class="badge badge-pending">Pending Admin Approval</span>`;
    }

    const avatar = document.getElementById("teacher-sidebar-avatar");
    const sidebarPic = document.getElementById("teacher-sidebar-pic");

    if (t.image) {
      sidebarPic.src = t.image;
      sidebarPic.style.display = "block";
      avatar.style.display = "none";
    } else {
      sidebarPic.style.display = "none";
      avatar.style.display = "flex";
      avatar.innerText = t.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    }

    await this.renderTeacherEnquiries();
    await this.renderTeacherStudentsTable();
    await this.populateTeacherProfileForm();
  }

  async renderTeacherEnquiries() {
    const list = document.getElementById("teacher-enquiries-list");
    if (!list) return;

    list.innerHTML = "";
    const teacher = this.currentUser.data;
    const students = await window.db.getStudents();

    const enquiries = students.filter(s => teacher.enquiries.includes(s.id));

    if (enquiries.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding: 2rem; color:var(--text-muted); font-size:0.95rem;">
          📭 No new tuition enquiries at the moment.
        </div>
      `;
      return;
    }

    enquiries.forEach(s => {
      const card = document.createElement("div");
      card.className = "card enquiry-card";
      
      const interestPills = s.interests.map(i => `<span class="subject-badge">${window.db.escapeHTML(i)}</span>`).join(" ");

      card.innerHTML = `
        <div class="enquiry-details">
          <span class="grade-tag">${window.db.escapeHTML(s.grade)}</span>
          <h3>${window.db.escapeHTML(s.name)} (Age: ${s.age})</h3>
          <div class="enquiry-info-row">
            <div>📍 ${window.db.escapeHTML(s.address)}</div>
            <div>📧 ${window.db.escapeHTML(s.email)}</div>
          </div>
          <div style="margin-top:0.5rem; font-size:0.85rem; color:var(--text-muted);">
            Interests: ${interestPills}
          </div>
          <p class="enquiry-bio">"${window.db.escapeHTML(s.bio)}"</p>
        </div>
        <div class="table-actions">
          <button class="btn btn-primary btn-sm" onclick="app.respondToEnquiry('${s.id}', 'accept')">Accept</button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="app.respondToEnquiry('${s.id}', 'decline')">Decline</button>
        </div>
      `;

      list.appendChild(card);
    });
  }

  async respondToEnquiry(studentId, action) {
    const teacher = this.currentUser.data;
    const res = await window.db.respondToRequest(teacher.id, studentId, action);

    if (res.success) {
      this.showToast(`Request ${action === "accept" ? "accepted!" : "declined."}`, action === "accept" ? "success" : "warning");
      await this.renderTeacherDashboard();
    } else {
      this.showToast(res.message, "error");
    }
  }

  async renderTeacherStudentsTable() {
    const tbody = document.getElementById("teacher-students-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    const teacher = this.currentUser.data;
    const students = await window.db.getStudents();

    const myStudents = students.filter(s => teacher.acceptedStudents.includes(s.id));

    if (myStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding: 1.5rem;">You don't have any connected students yet. Accept incoming requests to establish a connection.</td></tr>`;
      return;
    }

    myStudents.forEach(s => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>
          <div style="font-weight:700;">${window.db.escapeHTML(s.name)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">Age: ${s.age}</div>
        </td>
        <td><span class="badge badge-success" style="background:rgba(59, 130, 246, 0.1); color:var(--student-color);">${window.db.escapeHTML(s.grade)}</span></td>
        <td>
          📞 ${window.db.escapeHTML(s.contact)}<br>
          ✉️ ${window.db.escapeHTML(s.email)}
        </td>
        <td>${window.db.escapeHTML(s.address)}</td>
        <td style="font-size:0.85rem; font-style:italic; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.db.escapeHTML(s.bio)}">
          "${window.db.escapeHTML(s.bio)}"
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  async populateTeacherProfileForm() {
    const form = document.getElementById("teacher-profile-form");
    if (!form) return;

    const teacher = this.currentUser.data;
    form.querySelector("[name='name']").value = teacher.name;
    form.querySelector("[name='email']").value = teacher.email;
    form.querySelector("[name='age']").value = teacher.age;
    form.querySelector("[name='experience']").value = teacher.experience;
    form.querySelector("[name='contact']").value = teacher.contact;
    form.querySelector("[name='address']").value = teacher.address;
    form.querySelector("[name='bio']").value = teacher.bio;

    const preview = document.getElementById("teacher-image-preview");
    if (teacher.image) {
      preview.src = teacher.image;
      preview.style.display = "block";
      this.teacherBase64Image = teacher.image;
    } else {
      preview.style.display = "none";
      this.teacherBase64Image = "";
    }

    await this.populateSubjectsCheckboxList("teacher-specialty-subjects-container", teacher.subjects);
  }

  async saveTeacherProfile() {
    const form = document.getElementById("teacher-profile-form");
    const formData = new FormData(form);
    const subjects = this.getSelectedCheckboxValues("teacher-specialty-subjects-container");

    if (subjects.length === 0) {
      this.showToast("Please choose at least one teaching specialty.", "warning");
      return;
    }

    const updatedData = {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      age: parseInt(formData.get("age")),
      experience: parseInt(formData.get("experience")),
      contact: formData.get("contact").trim(),
      address: formData.get("address").trim(),
      bio: formData.get("bio").trim(),
      subjects: subjects,
      image: this.teacherBase64Image
    };

    const res = await window.db.updateTeacherProfile(this.currentUser.data.id, updatedData);
    if (res.success) {
      this.currentUser.data = res.data;
      sessionStorage.setItem("tuition_session", JSON.stringify(this.currentUser));
      this.showToast("Profile settings updated successfully!", "success");
      await this.renderTeacherDashboard();
      this.updateNavbarAuth();
    } else {
      this.showToast(res.message, "error");
    }
  }

  // --- KEYSTROKE / VALUE RESTRICTION FILTERS ---
  setupInputRestrictionFilters() {
    document.querySelectorAll("input[name='contact']").forEach(input => {
      input.addEventListener("input", () => {
        let val = input.value;
        const hasPlus = val.startsWith("+");
        val = val.replace(/[^0-9\s\-()]/g, "");
        if (hasPlus) {
          val = "+" + val;
        }
        input.value = val;
      });
    });

    document.querySelectorAll("input[name='name']").forEach(input => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/[^a-zA-Z\s.']/g, "");
      });
    });
  }

  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("Service Worker registered on index page successfully:", reg.scope))
          .catch((err) => console.error("Service Worker registration failed:", err));
      });
    }
  }
}

// Instantiate global app logic
window.app = new TuitionApp();
