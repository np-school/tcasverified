lucide.createIcons();

const DEFAULT_ACADEMIC = {
  levels: ["มัธยมศึกษาปีที่ 4", "มัธยมศึกษาปีที่ 5", "มัธยมศึกษาปีที่ 6"],
  roomsPerLevel: {
    "มัธยมศึกษาปีที่ 4": ["1", "2", "3", "4", "5"],
    "มัธยมศึกษาปีที่ 5": ["1", "2", "3", "4", "5"],
    "มัธยมศึกษาปีที่ 6": ["1", "2", "3", "4", "5"],
  },
  tracks: ["วิทย์-คณิต", "ศิลป์-ภาษา", "ศิลป์-คำนวณ"],
};

let academic = DEFAULT_ACADEMIC;
let currentCtx = null;

async function loadAcademicSettings() {
  try {
    const snap = await db.collection("settings").doc("academic").get();
    if (snap.exists) academic = { ...DEFAULT_ACADEMIC, ...snap.data() };
  } catch (err) {
    console.warn("ใช้ค่าระดับชั้น/ห้อง/กลุ่มการเรียนเริ่มต้น เพราะยังไม่ได้ตั้งค่าใน settings/academic", err);
  }

  fillSelect("f_level", academic.levels);
  fillSelect("f_track", academic.tracks);
  document.getElementById("f_level").addEventListener("change", updateRoomOptions);
  updateRoomOptions();
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  const placeholder = el.options[0];
  el.innerHTML = "";
  el.appendChild(placeholder);
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

function updateRoomOptions() {
  const level = document.getElementById("f_level").value;
  const rooms = (academic.roomsPerLevel && academic.roomsPerLevel[level]) || [];
  fillSelect("f_room", rooms);
}

/** ดึงเลขประจำตัวนักเรียนจากอีเมลที่ล็อกอิน เช่น "12345@nongki.ac.th" → "12345" */
function studentIdFromEmail(email) {
  return String(email || "").split("@")[0];
}

function prefillForm(profile) {
  document.getElementById("f_prefix").value = profile.prefix || "";
  document.getElementById("f_firstName").value = profile.firstName || "";
  document.getElementById("f_lastName").value = profile.lastName || "";
  document.getElementById("f_nationalId").value = profile.nationalId || "";
  document.getElementById("f_level").value = profile.level || "";
  updateRoomOptions();
  document.getElementById("f_room").value = profile.room || "";
  document.getElementById("f_track").value = profile.track || "";
}

guardPage(["student_new", "student", "admin"], async (ctx) => {
  currentCtx = ctx;
  document.getElementById("userLabel").textContent =
    ctx.profile ? ctx.profile.firstName + " " + ctx.profile.lastName : ctx.user.email;
  await loadAcademicSettings();
  // เลขประจำตัวนักเรียน = ส่วนหน้า @ ของอีเมลที่ล็อกอินเสมอ ไม่ให้แก้ไขเอง
  document.getElementById("f_studentId").value = studentIdFromEmail(ctx.user.email);
  if ((ctx.role === "student" || ctx.role === "admin") && ctx.profile) prefillForm(ctx.profile);
  if (ctx.role === "admin") {
    renderAdminViewSwitch("onboarding.html");
    const note = document.createElement("div");
    note.className = "hint";
    note.style.cssText = "text-align:center;margin-bottom:14px;";
    note.textContent = "โหมดแอดมิน: กรอกไว้เพื่อสร้างโปรไฟล์นักเรียนทดสอบของบัญชีนี้ ใช้สำหรับดูมุมมองนักเรียนเท่านั้น";
    document.querySelector(".onboard-wrap").prepend(note);
  }
});

document.getElementById("onboardForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const nationalId = document.getElementById("f_nationalId").value.trim();
  if (!/^\d{13}$/.test(nationalId)) {
    showToast("เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก", "error");
    return;
  }

  const profile = {
    prefix: document.getElementById("f_prefix").value,
    firstName: document.getElementById("f_firstName").value.trim(),
    lastName: document.getElementById("f_lastName").value.trim(),
    nationalId,
    level: document.getElementById("f_level").value,
    room: document.getElementById("f_room").value,
    track: document.getElementById("f_track").value,
    studentId: studentIdFromEmail(currentCtx.user.email), // มาจากอีเมลเสมอ ไม่รับค่าจากฟอร์ม
    email: currentCtx.user.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  btn.disabled = true;
  btn.textContent = "กำลังบันทึก...";
  try {
    await db.collection("students").doc(currentCtx.user.uid).set(profile, { merge: true });
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    btn.disabled = false;
    btn.innerHTML = 'บันทึกและเข้าใช้งาน <i data-lucide="arrow-right" style="width:15px;height:15px"></i>';
    lucide.createIcons();
  }
});
