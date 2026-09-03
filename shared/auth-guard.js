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
    return { role: perm.role, department: perm.department || null, user };
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
      window.location.href = routeForRole(ctx) || "index.html";
      return;
    }

    if (overlay) overlay.style.display = "none";
    onReady(ctx);
  });
}

/** Toast แจ้งเตือนสั้นๆ มุมล่างจอ — ต้องมี <div id="toast"></div> ในหน้า */
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
