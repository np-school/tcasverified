lucide.createIcons();

const DEFAULT_ACTIVITY_TYPES = ["อบรม/ค่าย", "การแข่งขัน", "จิตอาสา", "อื่นๆ"];
const DEFAULT_DEPARTMENTS = ["วิทยาศาสตร์", "คณิตศาสตร์", "สังคมศึกษา", "ภาษาไทย", "ภาษาต่างประเทศ", "สุขศึกษาและพลศึกษา", "ศิลปะ", "การงานอาชีพ"];

let currentCtx = null;
let selectedFile = null;

guardPage(["student", "admin"], async (ctx) => {
  currentCtx = ctx;
  if (ctx.role === "admin") renderAdminViewSwitch("student-submit.html");

  if (!ctx.profile) {
    document.getElementById("userLabel").textContent = ctx.user.email;
    document.querySelector(".content").innerHTML = `
      <div class="empty-state">
        <i data-lucide="user-x" style="width:36px;height:36px;margin-bottom:10px;"></i>
        <div>บัญชีแอดมินนี้ยังไม่มีโปรไฟล์นักเรียนทดสอบ</div>
        <a href="onboarding.html" class="btn-primary" style="margin-top:14px;display:inline-flex;">ไปกรอกข้อมูลทดสอบ</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  document.getElementById("userLabel").textContent = ctx.profile.firstName + " " + ctx.profile.lastName;
  await loadOptions();
  buildYearOptions();
  document.getElementById("f_date").valueAsDate = new Date();
});

async function loadOptions() {
  try {
    const [typesSnap, deptSnap] = await Promise.all([
      db.collection("settings").doc("activityTypes").get(),
      db.collection("settings").doc("departments").get(),
    ]);
    fillSelect("f_type", (typesSnap.exists && typesSnap.data().types) || DEFAULT_ACTIVITY_TYPES);
    fillSelect("f_department", (deptSnap.exists && deptSnap.data().departments) || DEFAULT_DEPARTMENTS);
  } catch (err) {
    console.warn("ใช้ตัวเลือกเริ่มต้น เพราะยังไม่ได้ตั้งค่าใน settings", err);
    fillSelect("f_type", DEFAULT_ACTIVITY_TYPES);
    fillSelect("f_department", DEFAULT_DEPARTMENTS);
  }
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

function buildYearOptions() {
  const el = document.getElementById("f_year");
  for (let y = CURRENT_ACADEMIC_YEAR; y >= CURRENT_ACADEMIC_YEAR - 1; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = "ปีการศึกษา " + y;
    el.appendChild(opt);
  }
}

document.getElementById("f_file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("ไฟล์ใหญ่เกิน 10MB", "error");
    e.target.value = "";
    return;
  }
  selectedFile = file;
  document.getElementById("uploadBox").classList.add("has-file");
  document.getElementById("uploadLabel").textContent = "เลือกไฟล์แล้ว: " + file.name;
});

document.getElementById("submitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedFile) {
    showToast("กรุณาแนบไฟล์เกียรติบัตร", "error");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = "กำลังอัปโหลด...";

  try {
    const profile = currentCtx.profile;
    const activityRef = db.collection("activities").doc();

    const filePath = `certificates/${currentCtx.user.uid}/${activityRef.id}_${selectedFile.name}`;
    const uploadTask = await storage.ref(filePath).put(selectedFile);
    const certificateUrl = await uploadTask.ref.getDownloadURL();

    await activityRef.set({
      studentUid: currentCtx.user.uid,
      studentName: `${profile.prefix}${profile.firstName} ${profile.lastName}`,
      studentLevel: profile.level,
      studentRoom: profile.room,
      studentTrack: profile.track,
      title: document.getElementById("f_title").value.trim(),
      type: document.getElementById("f_type").value,
      department: document.getElementById("f_department").value,
      eventDate: document.getElementById("f_date").value,
      year: Number(document.getElementById("f_year").value),
      certificateUrl,
      certificateFileName: selectedFile.name,
      status: "submitted",
      revisionReason: null,
      deptReviewerEmail: null,
      deptReviewedAt: null,
      guidanceReviewerEmail: null,
      guidanceReviewedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast("ส่งกิจกรรมสำเร็จ", "success");
    setTimeout(() => (window.location.href = "student-history.html"), 700);
  } catch (err) {
    console.error(err);
    showToast("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" style="width:15px;height:15px"></i>ส่งกิจกรรม';
    lucide.createIcons();
  }
});
