/* ═══════════════════════════════════════════════════════════════
   shared/auth-guard.js
   ล็อกอิน Google + หาสิทธิ์ผู้ใช้ + คุมการเข้าถึงแต่ละหน้าตามสิทธิ์
   โหลดต่อจาก firebase-init.js เสมอ
   ═══════════════════════════════════════════════════════════════ */

/** เปิดหน้าต่างล็อกอิน Google จำกัดเฉพาะโดเมนโรงเรียน */
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // hd = จำกัดให้ Google เสนอเฉพาะบัญชีในโดเมนนี้ (ผู้ใช้ยังพิมพ์อีเมลอื่นเองได้
  // จึงต้องเช็คโดเมนซ้ำอีกชั้นหลังล็อกอินเสมอ ดู resolveUserContext ด้านล่าง)
  provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: "select_account" });
  return auth.signInWithPopup(provider);
}

function signOutUser() {
  return auth.signOut().then(() => (window.location.href = "index.html"));
}

/**
 * หา role ของผู้ใช้ที่ล็อกอินอยู่
 * ลำดับการเช็ค: permissions/{email} (admin/dept_teacher/guidance) → students/{uid} → ยังไม่เคยกรอกข้อมูล
 */
async function resolveUserContext(user) {
  if (!user || !user.email || !user.email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN)) {
    return { role: "unauthorized", user };
  }

  const permSnap = await db.collection("permissions").doc(user.email.toLowerCase()).get();
  if (permSnap.exists) {
    const perm = permSnap.data();
    const ctx = { role: perm.role, department: perm.department || null, user };
    // แอดมินอาจมีโปรไฟล์นักเรียนของตัวเอง (สร้างไว้ทดสอบ) ให้แนบมาด้วยถ้ามี
    if (perm.role === "admin") {
      const studentSnap = await db.collection("students").doc(user.uid).get();
      if (studentSnap.exists) ctx.profile = studentSnap.data();
    }
    return ctx;
  }

  const studentSnap = await db.collection("students").doc(user.uid).get();
  if (studentSnap.exists) {
    return { role: "student", profile: studentSnap.data(), user };
  }

  return { role: "student_new", user };
}

/** หน้าเริ่มต้นที่ role นี้ควรอยู่ */
function routeForRole(ctx) {
  switch (ctx.role) {
    case "admin": return "admin.html";
    case "dept_teacher": return "teacher-review.html";
    case "guidance": return "guidance.html";
    case "student": return "student-history.html";
    case "student_new": return "onboarding.html";
    default: return null;
  }
}

/**
 * เรียกใช้ตอนต้นของทุกหน้าที่ต้องล็อกอิน
 * @param {string[]} allowedRoles - role ที่อนุญาตให้อยู่หน้านี้ เช่น ['dept_teacher']
 * @param {(ctx: object) => void} onReady - เรียกเมื่อผ่านการตรวจสอบแล้ว พร้อมข้อมูล user/role
 */
function guardPage(allowedRoles, onReady) {
  const overlay = document.getElementById("loadingOverlay");
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    let ctx;
    try {
      ctx = await resolveUserContext(user);
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ ลองใหม่อีกครั้ง", "error");
      return;
    }

    if (ctx.role === "unauthorized") {
      alert("บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน ต้องเป็นอีเมลของโรงเรียน @" + ALLOWED_DOMAIN + " เท่านั้น");
      await auth.signOut();
      window.location.href = "index.html";
      return;
    }

    if (!allowedRoles.includes(ctx.role)) {
      const target = routeForRole(ctx);
      if (!target) {
        alert("บัญชีนี้มีสิทธิ์ที่ระบบไม่รู้จัก (role ผิดรูปแบบใน permissions) กรุณาแจ้งผู้ดูแลระบบ");
        await auth.signOut();
        window.location.href = "index.html";
        return;
      }
      window.location.href = target;
      return;
    }

    setNavAvatar(user);
    if (overlay) overlay.style.display = "none";
    onReady(ctx);
  });
}

/** ตั้งรูปโปรไฟล์บน navbar (#userAvatar) จากบัญชี Google ที่ล็อกอิน ถ้าไม่มีรูป (บางบัญชีองค์กรปิดรูปไว้)
 *  ใช้ตัวอักษรย่อจากชื่อ/อีเมลสร้างเป็นไอคอนสำรองแทน */
function setNavAvatar(user) {
  const el = document.getElementById("userAvatar");
  if (!el) return;
  el.src = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || user.email || "U") + "&background=1d4ed8&color=fff";
  el.alt = user.displayName || user.email || "บัญชีผู้ใช้";
}

/** เปิด/ปิด sidebar แบบ drawer บนมือถือ (ปุ่มแฮมเบอร์เกอร์ #navMenuBtn เปิด #sidebar
 *  + ฉากหลังมืด #sidebarOverlay) — เลือกเมนูในนั้นแล้วปิดอัตโนมัติ
 *  ใช้ onclick ตรงๆ ในหน้า HTML เหมือนปุ่มอื่นๆ ในระบบ (ไม่พึ่ง DOMContentLoaded) */
function openSidebar() {
  const s = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  if (s) s.classList.add("open");
  if (ov) ov.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeSidebar() {
  const s = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  if (s) s.classList.remove("open");
  if (ov) ov.classList.remove("open");
  document.body.style.overflow = "";
}
function toggleSidebar(e) {
  if (e) e.stopPropagation();
  const s = document.getElementById("sidebar");
  if (!s) return;
  if (s.classList.contains("open")) closeSidebar();
  else openSidebar();
}
// เลือกเมนู/แท็บใดๆ ใน sidebar แล้วปิด drawer ให้อัตโนมัติ (ทั้ง <a href> และ <button data-tab>)
document.addEventListener("click", (e) => {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar || !sidebar.classList.contains("open")) return;
  if (e.target.closest(".sidebar-btn")) closeSidebar();
});
let toastTimer;
function showToast(message, type = "default") {
  const el = document.getElementById("toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.className = "show" + (type !== "default" ? " " + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 3200);
}

/** แปลง Firestore Timestamp เป็นวันที่ไทยอ่านง่าย */
function formatDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * แถบลอยมุมล่างขวา ให้แอดมินสลับไปดูหน้าของสิทธิ์อื่นได้ทันที เพื่อความสะดวกตอนพัฒนา/ทดสอบ
 * เรียกจากหน้าไหนก็ได้หลัง guardPage สำเร็จ ถ้า ctx.role !== 'admin' จะไม่ทำอะไรเลย
 */
function renderAdminViewSwitch(currentPage) {
  const pages = [
    { href: "student-history.html", label: "มุมมองนักเรียน", icon: "user" },
    { href: "teacher-review.html", label: "มุมมองครูกลุ่มสาระ", icon: "clipboard-check" },
    { href: "guidance.html", label: "มุมมองครูแนะแนว", icon: "badge-check" },
    { href: "admin.html", label: "มุมมองแอดมิน", icon: "settings" },
  ];
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;bottom:18px;right:18px;background:var(--c-ink-deep);padding:6px;border-radius:14px;display:flex;gap:5px;z-index:3500;box-shadow:0 6px 20px rgba(0,0,0,.28);";
  pages.forEach((p) => {
    const a = document.createElement("a");
    a.href = p.href;
    a.title = p.label;
    const isCurrent = p.href === currentPage;
    a.style.cssText =
      "width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;" +
      (isCurrent ? "background:var(--accent);" : "background:rgba(255,255,255,.1);");
    a.innerHTML = `<i data-lucide="${p.icon}" style="width:17px;height:17px"></i>`;
    bar.appendChild(a);
  });
  document.body.appendChild(bar);
  if (window.lucide) lucide.createIcons();
}
