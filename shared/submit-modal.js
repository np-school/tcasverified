/* ═══════════════════════════════════════════════════════════════
   shared/submit-modal.js
   ฟอร์ม "ส่งกิจกรรมใหม่" แบบ modal ใช้ร่วมกันทุกหน้าที่นักเรียนเห็น
   (เดิมเป็นหน้าแยก student-submit.html — ยุบมาเป็น modal เพื่อไม่ต้องเปลี่ยนหน้า)

   วิธีใช้จากหน้าอื่น:
   1. โหลดสคริปต์นี้ต่อจาก shared/auth-guard.js
   2. หลัง guardPage สำเร็จและมี ctx.profile แล้ว เรียก
      initSubmitModal(ctx, { onSubmitted: () => { ...รีเฟรชรายการของหน้านั้น... } });
   3. เปิด modal ด้วยปุ่มที่มี onclick="openSubmitModal()"
   ═══════════════════════════════════════════════════════════════ */

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

const RECORD_TYPE_META = {
  activity: { label: "ชื่อกิจกรรม", placeholder: "เช่น ค่ายอบรมผู้นำเยาวชนอาเซียน", requiredExtra: ["sm_f_role"] },
  project: { label: "ชื่อโครงงาน", placeholder: "เช่น ระบบรดน้ำต้นไม้อัตโนมัติด้วย IoT", requiredExtra: ["sm_f_projecttype"] },
  award: { label: "ชื่อการแข่งขัน/รายการที่ได้รับรางวัล", placeholder: "เช่น การแข่งขันชีววิทยาโอลิมปิกระดับชาติ ครั้งที่ 22", requiredExtra: ["sm_f_prizename"] },
  course: { label: "ชื่อหลักสูตร", placeholder: "เช่น อบรม Unity Game Development", requiredExtra: [] },
};
const ALL_EXTRA_FIELD_IDS = ["sm_f_role", "sm_f_projecttype", "sm_f_prizename", "sm_f_coursecategory", "sm_f_score", "sm_f_expired"];

let __submitModalCtx = null;
let __submitModalOnSubmitted = null;
let __submitModalOptionsLoaded = false;
let __submitModalSelectedFile = null;

const SUBMIT_MODAL_HTML = `
<div class="modal-overlay" id="submitModalOverlay">
  <div class="modal-box wide">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div>
        <h3 style="margin-bottom:2px;">ส่งกิจกรรมใหม่</h3>
        <div style="font-size:12.5px;color:var(--text2);">แนบเกียรติบัตรหรือหลักฐานให้ครบ เพื่อให้ครูตรวจสอบได้เร็วขึ้น</div>
      </div>
      <button type="button" class="icon-btn" onclick="closeSubmitModal()" title="ปิด"><i data-lucide="x" style="width:18px;height:18px"></i></button>
    </div>

    <form id="submitForm" style="margin-top:16px;">
      <div class="form-grid">
        <div class="field full">
          <label>รูปแบบข้อมูล <span class="req">*</span></label>
          <select id="sm_f_recordtype" required>
            <option value="">- เลือกรูปแบบ -</option>
            <option value="activity">กิจกรรม</option>
            <option value="project">โครงงาน</option>
            <option value="award">รางวัล</option>
            <option value="course">หลักสูตรอบรม</option>
          </select>
          <div class="hint">เลือกรูปแบบข้อมูลก่อน ระบบจะแสดงช่องกรอกที่ตรงกับประเภทนั้นให้อัตโนมัติ</div>
        </div>

        <div class="field full"><label id="sm_f_title_label">ชื่อรายการ <span class="req">*</span></label><input id="sm_f_title" required placeholder="เลือกรูปแบบข้อมูลก่อน"></div>

        <div class="field full rt-group" data-rt="activity" style="display:none;">
          <label>บทบาท / ผลที่ได้รับ <span class="req">*</span></label>
          <input id="sm_f_role" placeholder="เช่น ผู้เข้าร่วม, ประธานทีม, ผ่านการอบรม">
        </div>

        <div class="field rt-group" data-rt="project" style="display:none;">
          <label>ประเภท/สาขาโครงงาน <span class="req">*</span></label>
          <select id="sm_f_projecttype">
            <option value="">- เลือกสาขา -</option>
            <option value="วิทยาศาสตร์">วิทยาศาสตร์</option>
            <option value="คอมพิวเตอร์">คอมพิวเตอร์</option>
            <option value="สังคมศาสตร์">สังคมศาสตร์</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>

        <div class="field rt-group" data-rt="award" style="display:none;">
          <label>ชื่อรางวัลที่ได้รับ <span class="req">*</span></label>
          <input id="sm_f_prizename" placeholder="เช่น เหรียญทอง, รางวัลชนะเลิศ, ชมเชย">
        </div>

        <div class="field rt-group" data-rt="course" style="display:none;">
          <label>หมวดหมู่หลักสูตร</label>
          <input id="sm_f_coursecategory" placeholder="เช่น คอร์สออนไลน์ (MOOC)">
        </div>
        <div class="field rt-group" data-rt="course" style="display:none;">
          <label>คะแนน/ผลสอบ (ถ้ามี)</label>
          <input id="sm_f_score" placeholder="เช่น 85/100">
        </div>
        <div class="field rt-group" data-rt="course" style="display:none;">
          <label>วันหมดอายุใบรับรอง (ถ้ามี)</label>
          <input id="sm_f_expired" type="date">
        </div>

        <div class="field"><label>หมวดหมู่กิจกรรม (TCAS Certified) <span class="req">*</span></label>
          <select id="sm_f_type" required><option value="">- เลือกหมวดหมู่ -</option></select>
          <div class="hint" id="sm_f_type_hint">เลือกหมวดหมู่ตามเกณฑ์ TCAS Certified (T-C-A-S)</div>
        </div>
        <div class="field"><label>กลุ่มสาระที่เกี่ยวข้อง <span class="req">*</span></label>
          <select id="sm_f_department" required><option value="">- เลือกกลุ่มสาระ -</option></select>
          <div class="hint">ใช้ส่งให้ครูประจำกลุ่มสาระนี้เป็นผู้ตรวจสอบ</div>
        </div>
        <div class="field"><label>ระดับ <span class="req">*</span></label>
          <select id="sm_f_level" required>
            <option value="">- เลือกระดับ -</option>
            <option value="school">ระดับโรงเรียน</option>
            <option value="regional">ระดับภูมิภาค/จังหวัด</option>
            <option value="national">ระดับประเทศ</option>
            <option value="international">ระดับนานาชาติ</option>
          </select>
        </div>
        <div class="field"><label>จำนวนชั่วโมง (ถ้ามี)</label><input id="sm_f_hours" type="number" min="0" placeholder="เช่น 12"></div>
        <div class="field"><label>วันที่เริ่มกิจกรรม <span class="req">*</span></label><input id="sm_f_date" type="date" required></div>
        <div class="field"><label>วันที่สิ้นสุด (ถ้ามีมากกว่า 1 วัน)</label><input id="sm_f_enddate" type="date"></div>
        <div class="field"><label>ปีการศึกษา <span class="req">*</span></label><select id="sm_f_year" required></select></div>
        <div class="field full"><label>รายละเอียดเพิ่มเติม (ถ้ามี)</label><textarea id="sm_f_desc" rows="3" placeholder="อธิบายเพิ่มเติมเกี่ยวกับกิจกรรม/โครงงาน/รางวัล/หลักสูตร"></textarea></div>
        <div class="field full">
          <label>ไฟล์เกียรติบัตร / หลักฐาน <span class="req">*</span></label>
          <label class="upload-box" id="sm_uploadBox" for="sm_f_file">
            <i data-lucide="upload-cloud" style="width:22px;height:22px;margin-bottom:6px;"></i>
            <div id="sm_uploadLabel">คลิกเพื่อเลือกไฟล์ (PDF หรือรูปภาพ ไม่เกิน 6MB) — จะถูกเก็บใน Google Drive กลางของโรงเรียน</div>
          </label>
          <input id="sm_f_file" type="file" accept=".pdf,image/*" required style="display:none;">
        </div>
      </div>
    </form>

    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="closeSubmitModal()">ยกเลิก</button>
      <button type="submit" form="submitForm" class="btn-primary" id="sm_submitBtn"><i data-lucide="send" style="width:15px;height:15px"></i>ส่งกิจกรรม</button>
    </div>
  </div>
</div>`;

/** เรียกครั้งเดียวหลัง guardPage สำเร็จ (ต้องมี ctx.profile แล้ว) */
function initSubmitModal(ctx, opts = {}) {
  __submitModalCtx = ctx;
  __submitModalOnSubmitted = opts.onSubmitted || null;

  if (!document.getElementById("submitModalOverlay")) {
    document.body.insertAdjacentHTML("beforeend", SUBMIT_MODAL_HTML);
    wireSubmitModalEvents();
    if (window.lucide) lucide.createIcons();
  }
}

function wireSubmitModalEvents() {
  document.getElementById("sm_f_recordtype").addEventListener("change", updateRecordTypeFields);
  document.getElementById("sm_f_type").addEventListener("change", updateTypeScopeHint);
  document.getElementById("sm_f_file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      showToast("ไฟล์ใหญ่เกิน 6MB", "error");
      e.target.value = "";
      return;
    }
    __submitModalSelectedFile = file;
    document.getElementById("sm_uploadBox").classList.add("has-file");
    document.getElementById("sm_uploadLabel").textContent = "เลือกไฟล์แล้ว: " + file.name;
  });
  document.getElementById("submitForm").addEventListener("submit", handleSubmitModalSubmit);
  document.getElementById("submitModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "submitModalOverlay") closeSubmitModal();
  });
}

/** เปิด modal — โหลด options ครั้งแรกครั้งเดียว แล้ว reset ฟอร์มทุกครั้งที่เปิด */
async function openSubmitModal() {
  if (!__submitModalCtx || !__submitModalCtx.profile) {
    showToast("ไม่พบโปรไฟล์นักเรียน กรุณากรอกข้อมูลส่วนตัวก่อน", "error");
    return;
  }
  const overlay = document.getElementById("submitModalOverlay");
  if (!overlay) return;

  resetSubmitModalForm();
  if (!__submitModalOptionsLoaded) {
    await loadSubmitModalOptions();
    __submitModalOptionsLoaded = true;
  }
  buildSubmitModalYearOptions();
  document.getElementById("sm_f_date").valueAsDate = new Date();
  updateTypeScopeHint();

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  if (window.lucide) lucide.createIcons();
}

function closeSubmitModal() {
  const overlay = document.getElementById("submitModalOverlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function resetSubmitModalForm() {
  document.getElementById("submitForm").reset();
  __submitModalSelectedFile = null;
  document.getElementById("sm_uploadBox").classList.remove("has-file");
  document.getElementById("sm_uploadLabel").textContent = "คลิกเพื่อเลือกไฟล์ (PDF หรือรูปภาพ ไม่เกิน 6MB) — จะถูกเก็บใน Google Drive กลางของโรงเรียน";
  updateRecordTypeFields();
  const btn = document.getElementById("sm_submitBtn");
  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="send" style="width:15px;height:15px"></i>ส่งกิจกรรม';
}

function updateRecordTypeFields() {
  const rt = document.getElementById("sm_f_recordtype").value;
  const meta = RECORD_TYPE_META[rt];

  document.querySelectorAll("#submitModalOverlay .rt-group").forEach((el) => {
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
    document.getElementById("sm_f_title_label").innerHTML = meta.label + ' <span class="req">*</span>';
    document.getElementById("sm_f_title").placeholder = meta.placeholder;
  } else {
    document.getElementById("sm_f_title_label").innerHTML = 'ชื่อรายการ <span class="req">*</span>';
    document.getElementById("sm_f_title").placeholder = "เลือกรูปแบบข้อมูลก่อน";
  }
  if (window.lucide) lucide.createIcons();
}

function updateTypeScopeHint() {
  const hintEl = document.getElementById("sm_f_type_hint");
  if (!hintEl) return;
  const val = document.getElementById("sm_f_type").value;
  hintEl.textContent = ACTIVITY_TYPE_SCOPE[val] || "เลือกหมวดหมู่ตามเกณฑ์ TCAS Certified (T-C-A-S)";
}

async function loadSubmitModalOptions() {
  try {
    const [typesSnap, deptSnap] = await Promise.all([
      db.collection("settings").doc("activityTypes").get(),
      db.collection("settings").doc("departments").get(),
    ]);
    fillSubmitModalSelect("sm_f_type", (typesSnap.exists && typesSnap.data().types) || DEFAULT_ACTIVITY_TYPES);
    fillSubmitModalSelect("sm_f_department", (deptSnap.exists && deptSnap.data().departments) || DEFAULT_DEPARTMENTS);
  } catch (err) {
    console.warn("ใช้ตัวเลือกเริ่มต้น เพราะยังไม่ได้ตั้งค่าใน settings", err);
    fillSubmitModalSelect("sm_f_type", DEFAULT_ACTIVITY_TYPES);
    fillSubmitModalSelect("sm_f_department", DEFAULT_DEPARTMENTS);
  }
}

function fillSubmitModalSelect(id, values) {
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

function buildSubmitModalYearOptions() {
  const el = document.getElementById("sm_f_year");
  el.innerHTML = "";
  for (let y = CURRENT_ACADEMIC_YEAR; y >= CURRENT_ACADEMIC_YEAR - 1; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = "ปีการศึกษา " + y;
    el.appendChild(opt);
  }
}

async function handleSubmitModalSubmit(e) {
  e.preventDefault();
  const recordType = document.getElementById("sm_f_recordtype").value;
  if (!recordType) {
    showToast("กรุณาเลือกรูปแบบข้อมูล", "error");
    return;
  }
  if (!__submitModalSelectedFile) {
    showToast("กรุณาแนบไฟล์เกียรติบัตร", "error");
    return;
  }

  const btn = document.getElementById("sm_submitBtn");
  btn.disabled = true;
  btn.innerHTML = "กำลังอัปโหลดไฟล์ขึ้น Drive...";

  try {
    const profile = __submitModalCtx.profile;
    const activityRef = db.collection("activities").doc();

    const title = document.getElementById("sm_f_title").value.trim();
    const type = document.getElementById("sm_f_type").value;
    const department = document.getElementById("sm_f_department").value;
    const level = document.getElementById("sm_f_level").value;
    const hours = document.getElementById("sm_f_hours").value;
    const eventDate = document.getElementById("sm_f_date").value;
    const endDate = document.getElementById("sm_f_enddate").value || null;
    const year = document.getElementById("sm_f_year").value;
    const description = document.getElementById("sm_f_desc").value.trim() || null;

    const typeDetails = {};
    if (recordType === "activity") {
      typeDetails.expName = document.getElementById("sm_f_role").value.trim();
    } else if (recordType === "project") {
      typeDetails.projectType = document.getElementById("sm_f_projecttype").value;
    } else if (recordType === "award") {
      typeDetails.prizeName = document.getElementById("sm_f_prizename").value.trim();
    } else if (recordType === "course") {
      typeDetails.category = document.getElementById("sm_f_coursecategory").value.trim() || null;
      typeDetails.score = document.getElementById("sm_f_score").value.trim() || null;
      typeDetails.expiredDate = document.getElementById("sm_f_expired").value || null;
    }

    const fileBase64 = await submitModalFileToBase64(__submitModalSelectedFile);
    const idToken = await __submitModalCtx.user.getIdToken();

    const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
      body: JSON.stringify({
        fileName: __submitModalSelectedFile.name,
        mimeType: __submitModalSelectedFile.type || "application/octet-stream",
        fileBase64,
        year,
        category: type,
        eventDate,
        activityName: title,
      }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || "upload failed");

    await activityRef.set({
      studentUid: __submitModalCtx.user.uid,
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
      certificateFileName: __submitModalSelectedFile.name,
      status: "submitted",
      revisionReason: null,
      deptReviewerEmail: null,
      deptReviewedAt: null,
      guidanceReviewerEmail: null,
      guidanceReviewedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast("ส่งกิจกรรมสำเร็จ", "success");
    closeSubmitModal();
    if (__submitModalOnSubmitted) __submitModalOnSubmitted();
  } catch (err) {
    console.error(err);
    showToast("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" style="width:15px;height:15px"></i>ส่งกิจกรรม';
    if (window.lucide) lucide.createIcons();
  }
}

function submitModalFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
