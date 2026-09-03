lucide.createIcons();

const DEFAULT_ACTIVITY_TYPES = [
  "T - Talent & Creativity",
  "C - Contribution to Society",
  "A - Academic Excellence",
  "S - Self-Development",
];
const ACTIVITY_TYPE_SCOPE = {
  "T - Talent & Creativity": "ความสามารถพิเศษและศิลปวัฒนธรรม เช่น ประกวดดนตรี, กีฬาเยาวชน, งานแสดงศิลปะ, E-Sports",
  "C - Contribution to Society": "จิตอาสาและภาวะผู้นำ เช่น ประธานนักเรียน, อาสาสมัครกู้ภัย, กิจกรรมปลูกป่า (ที่มีการเช็กอินจริง)",
  "A - Academic Excellence": "วิชาการและทักษะเฉพาะทาง เช่น สอวน., สอบวัดระดับภาษา, แข่งหุ่นยนต์, โครงงานวิทยาศาสตร์",
  "S - Self-Development": "การพัฒนาตนเอง เช่น คอร์สเรียนออนไลน์ (MOOC), การเข้าค่าย Pre-college ของคณะต่างๆ",
};
const DEFAULT_DEPARTMENTS = ["วิทยาศาสตร์", "เทคโนโลยี", "คณิตศาสตร์", "ภาษาไทย", "สังคมศึกษาฯ", "สุขศึกษาฯ", "ภาษาต่างประเทศ", "ศิลปะ", "การงานอาชีพ", "แนะแนว"];

/* ── รูปแบบข้อมูล (ตามโครงสร้างไฟล์นำเข้าเดิม: กิจกรรม/โครงงาน/รางวัล/หลักสูตรอบรม) ── */
const RECORD_TYPE_META = {
  activity: { label: "ชื่อกิจกรรม", placeholder: "เช่น ค่ายอบรมผู้นำเยาวชนอาเซียน", requiredExtra: ["f_role"] },
  project:  { label: "ชื่อโครงงาน", placeholder: "เช่น ระบบรดน้ำต้นไม้อัตโนมัติด้วย IoT", requiredExtra: ["f_projecttype"] },
  award:    { label: "ชื่อการแข่งขัน/รายการที่ได้รับรางวัล", placeholder: "เช่น การแข่งขันชีววิทยาโอลิมปิกระดับชาติ ครั้งที่ 22", requiredExtra: ["f_prizename"] },
  course:   { label: "ชื่อหลักสูตร", placeholder: "เช่น อบรม Unity Game Development", requiredExtra: [] },
};
const ALL_EXTRA_FIELD_IDS = ["f_role", "f_projecttype", "f_prizename", "f_coursecategory", "f_score", "f_expired"];

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
  updateTypeScopeHint();
});

document.getElementById("f_recordtype").addEventListener("change", updateRecordTypeFields);

function updateRecordTypeFields() {
  const rt = document.getElementById("f_recordtype").value;
  const meta = RECORD_TYPE_META[rt];

  // สลับการแสดงผลกลุ่มฟิลด์เฉพาะประเภท + ปรับ required ให้ตรงเฉพาะกลุ่มที่กำลังโชว์
  document.querySelectorAll(".rt-group").forEach((el) => {
    const show = meta && el.dataset.rt === rt;
    el.style.display = show ? "" : "none";
  });
  ALL_EXTRA_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.required = false;
  });
  if (meta) {
    meta.requiredExtra.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.required = true;
    });
    document.getElementById("f_title_label").innerHTML = meta.label + ' <span class="req">*</span>';
    document.getElementById("f_title").placeholder = meta.placeholder;
  } else {
    document.getElementById("f_title_label").innerHTML = 'ชื่อรายการ <span class="req">*</span>';
    document.getElementById("f_title").placeholder = "เลือกรูปแบบข้อมูลก่อน";
  }
}

document.getElementById("f_type").addEventListener("change", updateTypeScopeHint);

function updateTypeScopeHint() {
  const hintEl = document.getElementById("f_type_hint");
  if (!hintEl) return;
  const val = document.getElementById("f_type").value;
  hintEl.textContent = ACTIVITY_TYPE_SCOPE[val] || "เลือกหมวดหมู่ตามเกณฑ์ TCAS Certified (T-C-A-S)";
}

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
  if (file.size > 6 * 1024 * 1024) {
    showToast("ไฟล์ใหญ่เกิน 6MB", "error");
    e.target.value = "";
    return;
  }
  selectedFile = file;
  document.getElementById("uploadBox").classList.add("has-file");
  document.getElementById("uploadLabel").textContent = "เลือกไฟล์แล้ว: " + file.name;
});

document.getElementById("submitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const recordType = document.getElementById("f_recordtype").value;
  if (!recordType) {
    showToast("กรุณาเลือกรูปแบบข้อมูล", "error");
    return;
  }
  if (!selectedFile) {
    showToast("กรุณาแนบไฟล์เกียรติบัตร", "error");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = "กำลังอัปโหลดไฟล์ขึ้น Drive...";

  try {
    const profile = currentCtx.profile;
    const activityRef = db.collection("activities").doc();

    const title = document.getElementById("f_title").value.trim();
    const type = document.getElementById("f_type").value;
    const department = document.getElementById("f_department").value;
    const level = document.getElementById("f_level").value;
    const hours = document.getElementById("f_hours").value;
    const eventDate = document.getElementById("f_date").value;
    const endDate = document.getElementById("f_enddate").value || null;
    const year = document.getElementById("f_year").value;
    const description = document.getElementById("f_desc").value.trim() || null;

    // ฟิลด์เฉพาะตาม "รูปแบบข้อมูล" — ตรงกับโครงสร้างไฟล์นำเข้าเดิม (กิจกรรม/โครงงาน/รางวัล/หลักสูตรอบรม)
    const typeDetails = {};
    if (recordType === "activity") {
      typeDetails.expName = document.getElementById("f_role").value.trim();
    } else if (recordType === "project") {
      typeDetails.projectType = document.getElementById("f_projecttype").value;
    } else if (recordType === "award") {
      typeDetails.prizeName = document.getElementById("f_prizename").value.trim();
    } else if (recordType === "course") {
      typeDetails.category = document.getElementById("f_coursecategory").value.trim() || null;
      typeDetails.score = document.getElementById("f_score").value.trim() || null;
      typeDetails.expiredDate = document.getElementById("f_expired").value || null;
    }

    const fileBase64 = await fileToBase64(selectedFile);
    const idToken = await currentCtx.user.getIdToken();

    const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
      body: JSON.stringify({
        fileName: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        fileBase64,
        year,
        category: type, // "หมวดหมู่" ในชื่อไฟล์ = หมวด T-C-A-S
        eventDate,
        activityName: title,
      }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || "upload failed");

    await activityRef.set({
      studentUid: currentCtx.user.uid,
      studentId: profile.studentId || null,
      nationalId: profile.nationalId || null,
      studentName: `${profile.prefix}${profile.firstName} ${profile.lastName}`,
      studentLevel: profile.level,
      studentRoom: profile.room,
      studentTrack: profile.track,
      recordType,
      title,
      type,
      department,
      level,
      hours: hours ? Number(hours) : null,
      description,
      eventDate,
      endDate,
      year: Number(year),
      typeDetails,
      certificateUrl: uploadData.url,
      certificateFileId: uploadData.fileId,
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

/** อ่านไฟล์เป็น base64 (ตัด prefix "data:...;base64," ออกก่อนส่งให้ Cloud Function) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
