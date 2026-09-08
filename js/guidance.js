lucide.createIcons();
let ctxGlobal = null;

/* กลุ่มสาระที่ครูแนะแนวยืนยันขั้นแรกแทนครูกลุ่มสาระได้เอง (แท็บ "ตรวจขั้นแรก (แนะแนว)")
   ต้องตรงกับชื่อกลุ่มสาระใน settings/departments เป๊ะๆ — ถ้าโรงเรียนเปลี่ยนชื่อกลุ่มสาระนี้ ต้องแก้ค่านี้ตาม */
const GUIDANCE_DEPARTMENT_NAME = "แนะแนว";
let pendingDeptRejectId = null; // id รายการที่กำลังจะตีกลับในขั้นแรก (แท็บตรวจขั้นแรก)

/* แคชข้อมูลไว้ใช้ร่วมกันหลายส่วน (แดชบอร์ด/รายชื่อนักเรียน/ค้นหา/ส่งออก) กันยิง query ซ้ำ */
let pendingCache = [];       // dept_confirmed ทั้งหมด (รอยืนยันขั้นสุดท้าย)
let allStudents = [];        // นักเรียนทั้งหมดในระบบ (จาก collection students)
let doneThisYearCache = [];  // guidance_confirmed ของปีการศึกษาปัจจุบัน (ไว้คำนวณสรุปแดชบอร์ด)
let exportSelectedStudentUid = null;
let deptPendingCache = [];   // submitted + revision ทั้งหมด (ไว้คำนวณภาพรวมกลุ่มสาระ)
let departmentListCache = []; // รายชื่อกลุ่มสาระจาก settings/departments
let activityTypeOptionsCache = []; // รายการหมวดหมู่กิจกรรมจาก settings/activityTypes (ใช้กับฟอร์มแก้ไข)
let pendingEditId = null;    // id รายการที่กำลังเปิดแก้ไขอยู่ (โมดัลแก้ไข)
let pendingGdRejectId = null; // id รายการที่กำลังจะตีกลับ (โมดัลตีกลับ)

/* ฟิลด์เฉพาะแต่ละรูปแบบข้อมูล (ตรงกับ typeDetails ที่ shared/submit-modal.js บันทึกไว้ตอนนักเรียนส่ง) */
const EDIT_EXTRA_FIELD_META = {
  activity: { label: "บทบาท / ผลที่ได้รับ", key: "expName" },
  project: { label: "ประเภท/สาขาโครงงาน", key: "projectType" },
  award: { label: "ชื่อรางวัลที่ได้รับ", key: "prizeName" },
};

guardPage(["guidance", "admin"], (ctx) => {
  ctxGlobal = ctx;
  document.getElementById("userLabel").textContent = ctx.user.email;
  if (ctx.role === "admin") renderAdminViewSwitch("guidance.html");

  buildYearOptions("allYearFilter");
  buildYearOptions("exportYearFilter");
  document.getElementById("allYearFilter").addEventListener("change", loadAll);

  loadPending();
  loadAll();
  loadDoneThisYear();
  loadRosterData();
  loadExportTypeOptions();
  loadDeptOverviewData();
  loadEditFormOptions();
  loadDeptReviewPending();
  loadDeptReviewDone();
  setupTabLinks();
  setupRosterControls();
  setupExportControls();
});

/* ── สลับแท็บ (sidebar) ── */
document.querySelectorAll(".sidebar-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-btn[data-tab]").forEach((b) => b.classList.remove("active", "staff"));
    btn.classList.add("active", "staff");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/** ลิงก์ "ดูทั้งหมด" ในแดชบอร์ด — คลิกแล้วสลับแท็บให้เหมือนกดปุ่ม sidebar ตรงๆ */
function setupTabLinks() {
  document.querySelectorAll("[data-tab-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const btn = document.querySelector(`.sidebar-btn[data-tab="${a.dataset.tabLink}"]`);
      if (btn) btn.click();
    });
  });
}

function buildYearOptions(selectId) {
  const el = document.getElementById(selectId);
  for (let y = CURRENT_ACADEMIC_YEAR; y >= CURRENT_ACADEMIC_YEAR - 2; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = "ปีการศึกษา " + y;
    el.appendChild(opt);
  }
}

/* ═══════════════════════════════════════════════════════════════
   แดชบอร์ด
   ═══════════════════════════════════════════════════════════════ */
function renderDashboardStats() {
  const deptCount = new Set(doneThisYearCache.map((a) => a.department).filter(Boolean)).size;
  const cards = [
    { cls: "dept", icon: "inbox", count: pendingCache.length, label: "รอยืนยันขั้นสุดท้าย" },
    { cls: "done", icon: "check-circle-2", count: doneThisYearCache.length, label: "ยืนยันสมบูรณ์ปีนี้" },
    { cls: "submitted", icon: "users", count: allStudents.length, label: "นักเรียนทั้งหมดในระบบ" },
    { cls: "revise", icon: "book-open", count: deptCount, label: "กลุ่มสาระที่มีผลงานปีนี้" },
  ];
  document.getElementById("gdStatGrid").innerHTML = cards.map((c) => `
    <div class="stat-card ${c.cls}">
      <div class="stat-icon"><i data-lucide="${c.icon}" style="width:18px;height:18px"></i></div>
      <div class="stat-count">${c.count}</div>
      <div class="stat-label">${c.label}</div>
    </div>`).join("");
  lucide.createIcons();
}

function renderDashboardPending() {
  const list = document.getElementById("gdPendingList");
  const empty = document.getElementById("gdPendingEmpty");
  const top = pendingCache.slice(0, 5);
  list.innerHTML = "";
  empty.style.display = top.length ? "none" : "block";
  top.forEach((a) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-soft);";
    row.innerHTML = `
      <div>
        <div style="font-weight:700;font-size:13.5px;">${escapeHtml(a.title)}</div>
        <div style="font-size:12px;color:var(--text2);">${escapeHtml(a.studentName)} · ${escapeHtml(a.studentLevel || "")} ${escapeHtml(a.studentRoom || "")}</div>
      </div>
      ${statusBadgeHtml(a.status)}`;
    list.appendChild(row);
  });
  lucide.createIcons();
}

/* ค้นหานักเรียนด่วนบนแดชบอร์ด */
document.getElementById("gdQuickSearch").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const box = document.getElementById("gdQuickResults");
  box.innerHTML = "";
  if (!q) return;
  studentMatches(q).slice(0, 6).forEach((s) => box.appendChild(quickResultRow(s, () => openStudentDetail(s.uid))));
});

function studentMatches(q) {
  return allStudents.filter((s) => {
    const name = ((s.prefix || "") + (s.firstName || "") + " " + (s.lastName || "")).toLowerCase();
    return name.includes(q) || (s.studentId || "").toLowerCase().includes(q);
  });
}

function quickResultRow(s, onClick) {
  const row = document.createElement("div");
  row.className = "quick-result-row";
  row.onclick = onClick;
  row.innerHTML = `<span>${escapeHtml((s.prefix || "") + (s.firstName || "") + " " + (s.lastName || ""))}</span><span class="sub">${escapeHtml(s.level || "")} ${escapeHtml(s.room || "")}</span>`;
  return row;
}

/* ═══════════════════════════════════════════════════════════════
   รอยืนยันขั้นสุดท้าย
   ═══════════════════════════════════════════════════════════════ */
async function loadPending() {
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "dept_confirmed")
      .orderBy("deptReviewedAt", "asc")
      .get();
    pendingCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const list = document.getElementById("pendingList");
    list.innerHTML = "";
    document.getElementById("pendingCount").textContent = pendingCache.length ? `(${pendingCache.length})` : "";
    document.getElementById("pendingEmpty").style.display = pendingCache.length ? "none" : "block";

    pendingCache.forEach((a) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:14.5px;">${escapeHtml(a.title)}</div>
            <div style="color:var(--text2);font-size:12.5px;margin-top:3px;">นักเรียน: ${escapeHtml(a.studentName)} · ${escapeHtml(a.studentLevel)} ${escapeHtml(a.studentRoom)} · ประเภท: ${escapeHtml(a.type)}</div>
            ${recordDetailLine(a) ? `<div style="color:var(--text3);font-size:12px;margin-top:2px;">${escapeHtml(recordDetailLine(a))}</div>` : ""}
            <div style="color:var(--text2);font-size:12.5px;margin-top:2px;">ยืนยันโดยครูกลุ่มสาระ${escapeHtml(a.department || "")} · ${escapeHtml(a.deptReviewerEmail || "")} · ${formatDate(a.deptReviewedAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
            <a href="${a.certificateUrl}" target="_blank" style="color:var(--accent);font-weight:700;font-size:12.5px;display:flex;align-items:center;gap:5px;"><i data-lucide="file-text" style="width:14px;height:14px"></i>ดูเกียรติบัตร</a>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <button class="btn-secondary" onclick="openEditActivityModal('${a.id}')"><i data-lucide="pencil" style="width:13px;height:13px"></i>แก้ไข</button>
              <button class="btn-reject" onclick="openGdRejectModal('${a.id}')"><i data-lucide="rotate-ccw" style="width:13px;height:13px"></i>ตีกลับ</button>
              <button class="btn-approve" onclick="finalApprove('${a.id}')"><i data-lucide="badge-check" style="width:13px;height:13px"></i>ยืนยันขั้นสุดท้าย</button>
            </div>
          </div>
        </div>`;
      list.appendChild(card);
    });
    lucide.createIcons();

    renderDashboardPending();
    renderDashboardStats();
    renderDeptOverview();
  } catch (err) {
    console.error(err);
    showToast("โหลดรายการไม่สำเร็จ", "error");
  }
}

async function finalApprove(id) {
  try {
    await db.collection("activities").doc(id).update({
      status: "guidance_confirmed",
      guidanceReviewerEmail: ctxGlobal.user.email,
      guidanceReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("ยืนยันสมบูรณ์แล้ว", "success");
    loadPending();
    loadAll();
    loadDoneThisYear();
  } catch (err) {
    console.error(err);
    showToast("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

/* ═══════════════════════════════════════════════════════════════
   ตรวจสอบขั้นแรก (กลุ่มสาระแนะแนว) — ให้ครูแนะแนวยืนยัน/ตีกลับ
   กิจกรรมที่นักเรียนเลือกกลุ่มสาระ "แนะแนว" ได้เองแทนครูกลุ่มสาระ
   (เขียนสถานะ/ฟิลด์เหมือนที่ teacher-review.js ทำทุกอย่าง เพื่อให้
   ประวัติ/รายงาน/ส่งออก อ่านข้อมูลชุดเดียวกันได้โดยไม่ต้องแก้ที่อื่น)
   ═══════════════════════════════════════════════════════════════ */
async function loadDeptReviewPending() {
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "submitted")
      .where("department", "==", GUIDANCE_DEPARTMENT_NAME)
      .orderBy("createdAt", "asc")
      .get();

    const body = document.getElementById("deptReviewPendingBody");
    body.innerHTML = "";
    document.getElementById("deptReviewPendingCount").textContent = snap.size ? `(${snap.size})` : "";
    document.getElementById("deptReviewPendingEmpty").style.display = snap.size ? "none" : "block";

    snap.forEach((doc) => {
      const a = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div style="font-weight:700;">${escapeHtml(a.studentName)}</div><div style="color:var(--text3);font-size:12px;">${escapeHtml(a.studentLevel)} ${escapeHtml(a.studentRoom)}</div></td>
        <td><div style="font-weight:700;">${escapeHtml(a.title)}</div>${recordDetailLine(a) ? `<div style="color:var(--text3);font-size:12px;margin-top:2px;">${escapeHtml(recordDetailLine(a))}</div>` : ""}</td>
        <td style="color:var(--text2);">${formatDate(a.createdAt)}</td>
        <td><a href="${a.certificateUrl}" target="_blank" style="color:var(--accent);font-weight:700;display:flex;align-items:center;gap:5px;"><i data-lucide="file-text" style="width:14px;height:14px"></i>ดูไฟล์</a></td>
        <td><div style="display:flex;gap:8px;">
          <button class="btn-approve" onclick="approveDeptReviewActivity('${doc.id}')"><i data-lucide="check" style="width:13px;height:13px"></i>ยืนยัน</button>
          <button class="btn-reject" onclick="openDeptRejectModal('${doc.id}')"><i data-lucide="x" style="width:13px;height:13px"></i>ตีกลับ</button>
        </div></td>`;
      body.appendChild(tr);
    });
    lucide.createIcons();
  } catch (err) {
    console.error(err);
    showToast("โหลดรายการรอตรวจสอบขั้นแรกไม่สำเร็จ", "error");
  }
}

async function loadDeptReviewDone() {
  try {
    const snap = await db.collection("activities")
      .where("status", "in", ["dept_confirmed", "guidance_confirmed", "revision"])
      .where("department", "==", GUIDANCE_DEPARTMENT_NAME)
      .orderBy("deptReviewedAt", "desc")
      .limit(200)
      .get();

    const body = document.getElementById("deptReviewDoneBody");
    body.innerHTML = "";
    document.getElementById("deptReviewDoneEmpty").style.display = snap.size ? "none" : "block";

    snap.forEach((doc) => {
      const a = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(a.studentName)}</td>
        <td>${escapeHtml(a.title)}</td>
        <td>${statusBadgeHtml(a.status)}</td>
        <td style="color:var(--text2);">${escapeHtml(a.deptReviewerEmail || "")}</td>
        <td style="color:var(--text2);">${formatDate(a.deptReviewedAt)}</td>`;
      body.appendChild(tr);
    });
    lucide.createIcons();
  } catch (err) {
    console.error(err);
  }
}

/** ยืนยันขั้นแรกแทนครูกลุ่มสาระแนะแนว — เขียนฟิลด์ deptReviewer* เหมือนที่ teacher-review.js ทำทุกอย่าง
    เพื่อให้รายการไปต่อคิว "รอยืนยันขั้นสุดท้าย" ได้ตามปกติ (คนละคนหรือคนเดียวกันยืนยันต่อก็ได้) */
async function approveDeptReviewActivity(id) {
  try {
    await db.collection("activities").doc(id).update({
      status: "dept_confirmed",
      deptReviewerEmail: ctxGlobal.user.email,
      deptReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("ยืนยันขั้นแรกแล้ว รายการไปรอยืนยันขั้นสุดท้ายต่อได้เลย", "success");
    loadDeptReviewPending();
    loadDeptReviewDone();
    loadPending();
    loadDeptOverviewData();
  } catch (err) {
    console.error(err);
    showToast("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

function openDeptRejectModal(id) {
  pendingDeptRejectId = id;
  document.getElementById("gdDeptRejectReason").value = "";
  document.getElementById("gdDeptRejectModal").classList.add("open");
}
function closeDeptRejectModal() {
  document.getElementById("gdDeptRejectModal").classList.remove("open");
  pendingDeptRejectId = null;
}
async function confirmDeptReject() {
  const reason = document.getElementById("gdDeptRejectReason").value.trim();
  if (!reason) {
    showToast("กรุณาระบุเหตุผลที่ตีกลับ", "error");
    return;
  }
  try {
    await db.collection("activities").doc(pendingDeptRejectId).update({
      status: "revision",
      revisionReason: reason,
      deptReviewerEmail: ctxGlobal.user.email,
      deptReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("ตีกลับรายการแล้ว", "success");
    closeDeptRejectModal();
    loadDeptReviewPending();
    loadDeptReviewDone();
    loadDeptOverviewData();
  } catch (err) {
    console.error(err);
    showToast("ตีกลับไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

/* ═══════════════════════════════════════════════════════════════
   แก้ไขรายการที่นักเรียนส่ง (ครูแนะแนวแก้แทนได้ โดยไม่เปลี่ยนสถานะ)
   ═══════════════════════════════════════════════════════════════ */
async function loadEditFormOptions() {
  try {
    const [typesSnap, deptSnap] = await Promise.all([
      db.collection("settings").doc("activityTypes").get(),
      db.collection("settings").doc("departments").get(),
    ]);
    activityTypeOptionsCache = (typesSnap.exists && typesSnap.data().types) || [];
    fillSelectOptions("gdEdit_type", activityTypeOptionsCache);
    fillSelectOptions("gdEdit_department", (deptSnap.exists && deptSnap.data().departments) || []);
    buildYearOptions("gdEdit_year");
  } catch (err) {
    console.warn("โหลดตัวเลือกฟอร์มแก้ไขไม่สำเร็จ จะเติมค่าจากรายการเดิมแทนตอนเปิดโมดัล", err);
  }
}

function fillSelectOptions(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = "";
  values.forEach((v) => el.appendChild(new Option(v, v)));
}

/** เผื่อค่าที่เก็บไว้ในรายการเดิมไม่อยู่ในตัวเลือกปัจจุบันของ settings (เช่นกลุ่มสาระถูกลบ/เปลี่ยนชื่อไปแล้ว) จะได้ไม่หายไปจาก select เงียบๆ */
function ensureSelectHasValue(id, value) {
  if (!value) return;
  const el = document.getElementById(id);
  if (!el) return;
  const exists = Array.from(el.options).some((o) => o.value === value);
  if (!exists) el.appendChild(new Option(value, value));
}

function openEditActivityModal(id) {
  const a = pendingCache.find((x) => x.id === id);
  if (!a) { showToast("ไม่พบรายการนี้ อาจถูกดำเนินการไปแล้ว", "error"); return; }
  pendingEditId = id;

  document.getElementById("gdEditActivityStudent").textContent =
    [a.studentName, a.studentLevel, a.studentRoom, RECORD_TYPE_LABEL[a.recordType]].filter(Boolean).join(" · ");

  const titleLabel = a.recordType === "activity" ? "ชื่อกิจกรรม"
    : a.recordType === "project" ? "ชื่อโครงงาน"
    : a.recordType === "award" ? "ชื่อการแข่งขัน/รายการที่ได้รับรางวัล"
    : a.recordType === "course" ? "ชื่อหลักสูตร" : "ชื่อรายการ";
  document.getElementById("gdEdit_title_label").innerHTML = `${titleLabel} <span class="req">*</span>`;
  document.getElementById("gdEdit_title").value = a.title || "";

  const typeDetails = a.typeDetails || {};
  const extraMeta = EDIT_EXTRA_FIELD_META[a.recordType];
  const extraBox = document.getElementById("gdEdit_extraFieldBox");
  const courseBox = document.getElementById("gdEdit_courseExtraBox");
  extraBox.style.display = "none";
  courseBox.style.display = "none";
  if (extraMeta) {
    extraBox.style.display = "block";
    document.getElementById("gdEdit_extraFieldLabel").textContent = extraMeta.label;
    document.getElementById("gdEdit_extraField").value = typeDetails[extraMeta.key] || "";
  } else if (a.recordType === "course") {
    courseBox.style.display = "block";
    document.getElementById("gdEdit_courseCategory").value = typeDetails.category || "";
    document.getElementById("gdEdit_courseScore").value = typeDetails.score || "";
    document.getElementById("gdEdit_courseExpired").value = typeDetails.expiredDate || "";
  }

  ensureSelectHasValue("gdEdit_type", a.type);
  ensureSelectHasValue("gdEdit_department", a.department);
  document.getElementById("gdEdit_type").value = a.type || "";
  document.getElementById("gdEdit_department").value = a.department || "";
  document.getElementById("gdEdit_level").value = a.level || "school";
  document.getElementById("gdEdit_hours").value = a.hours ?? "";
  document.getElementById("gdEdit_date").value = a.eventDate || "";
  document.getElementById("gdEdit_enddate").value = a.endDate || "";
  document.getElementById("gdEdit_year").value = a.year || CURRENT_ACADEMIC_YEAR;
  document.getElementById("gdEdit_desc").value = a.description || "";

  document.getElementById("gdEditActivityOverlay").classList.add("open");
  if (window.lucide) lucide.createIcons();
}

function closeEditActivityModal() {
  document.getElementById("gdEditActivityOverlay").classList.remove("open");
  pendingEditId = null;
}

async function saveEditActivity() {
  if (!pendingEditId) return;
  const a = pendingCache.find((x) => x.id === pendingEditId);
  if (!a) { showToast("ไม่พบรายการนี้ อาจถูกดำเนินการไปแล้ว", "error"); closeEditActivityModal(); return; }

  const title = document.getElementById("gdEdit_title").value.trim();
  const eventDate = document.getElementById("gdEdit_date").value;
  if (!title || !eventDate) {
    showToast("กรุณากรอกชื่อรายการและวันที่เริ่มกิจกรรมให้ครบ", "error");
    return;
  }

  const typeDetails = { ...(a.typeDetails || {}) };
  const extraMeta = EDIT_EXTRA_FIELD_META[a.recordType];
  if (extraMeta) {
    typeDetails[extraMeta.key] = document.getElementById("gdEdit_extraField").value.trim();
  } else if (a.recordType === "course") {
    typeDetails.category = document.getElementById("gdEdit_courseCategory").value.trim() || null;
    typeDetails.score = document.getElementById("gdEdit_courseScore").value.trim() || null;
    typeDetails.expiredDate = document.getElementById("gdEdit_courseExpired").value || null;
  }

  const hoursVal = document.getElementById("gdEdit_hours").value;
  const updates = {
    title,
    type: document.getElementById("gdEdit_type").value,
    department: document.getElementById("gdEdit_department").value,
    level: document.getElementById("gdEdit_level").value,
    hours: hoursVal ? Number(hoursVal) : null,
    eventDate,
    endDate: document.getElementById("gdEdit_enddate").value || null,
    year: Number(document.getElementById("gdEdit_year").value),
    description: document.getElementById("gdEdit_desc").value.trim() || null,
    typeDetails,
  };

  const btn = document.getElementById("gdEditActivitySaveBtn");
  btn.disabled = true;
  try {
    await db.collection("activities").doc(pendingEditId).update(updates);
    showToast("บันทึกการแก้ไขแล้ว", "success");
    closeEditActivityModal();
    loadPending();
    loadDeptOverviewData();
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  } finally {
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ตีกลับให้นักเรียนกลับไปแก้ไขส่งใหม่ (เหมือนหน้าครูกลุ่มสาระ แต่ยิงจากขั้นแนะแนว)
   ═══════════════════════════════════════════════════════════════ */
function openGdRejectModal(id) {
  const a = pendingCache.find((x) => x.id === id);
  pendingGdRejectId = id;
  document.getElementById("gdRejectModalWho").textContent = a ? `${a.studentName || ""} · ${a.title || ""}` : "";
  document.getElementById("gdRejectReason").value = "";
  document.getElementById("gdRejectModal").classList.add("open");
}

function closeGdRejectModal() {
  document.getElementById("gdRejectModal").classList.remove("open");
  pendingGdRejectId = null;
}

async function confirmGdReject() {
  const reason = document.getElementById("gdRejectReason").value.trim();
  if (!reason) {
    showToast("กรุณาระบุเหตุผลที่ตีกลับ", "error");
    return;
  }
  try {
    await db.collection("activities").doc(pendingGdRejectId).update({
      status: "revision",
      revisionReason: reason,
      guidanceReviewerEmail: ctxGlobal.user.email,
      guidanceReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("ตีกลับให้นักเรียนแก้ไขแล้ว", "success");
    closeGdRejectModal();
    loadPending();
    loadDeptOverviewData();
  } catch (err) {
    console.error(err);
    showToast("ตีกลับไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

/* ═══════════════════════════════════════════════════════════════
   ประวัติการยืนยันทั้งหมด (เดิมชื่อ "รายนักเรียนทั้งหมด")
   ═══════════════════════════════════════════════════════════════ */
async function loadAll() {
  const year = document.getElementById("allYearFilter").value;
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "guidance_confirmed")
      .where("year", "==", Number(year))
      .orderBy("guidanceReviewedAt", "desc")
      .get();

    const body = document.getElementById("allBody");
    body.innerHTML = "";
    snap.forEach((doc) => {
      const a = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div style="font-weight:700;">${escapeHtml(a.studentName)}</div><div style="color:var(--text3);font-size:12px;">${escapeHtml(a.studentLevel)} ${escapeHtml(a.studentRoom)}</div></td>
        <td>${escapeHtml(a.title)}</td>
        <td>${escapeHtml(a.department || "")}</td>
        <td style="color:var(--text2);">${escapeHtml(a.guidanceReviewerEmail || "")}</td>
        <td style="color:var(--text2);">${formatDate(a.guidanceReviewedAt)}</td>`;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadDoneThisYear() {
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "guidance_confirmed")
      .where("year", "==", CURRENT_ACADEMIC_YEAR)
      .get();
    doneThisYearCache = snap.docs.map((d) => d.data());
    renderDashboardStats();
    renderDeptOverview();
  } catch (err) {
    console.error(err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ภาพรวมสถานะการส่งแยกตามกลุ่มสาระ — ให้ครูแนะแนวเห็นว่ากลุ่มสาระไหน
   ยังมีรายการค้างรอครูกลุ่มสาระกดยืนยันอยู่เท่าไหร่ ไม่ต้องไล่เปิดทีละกลุ่มสาระ
   ═══════════════════════════════════════════════════════════════ */
async function loadDeptOverviewData() {
  try {
    const [deptSnap, statusSnap] = await Promise.all([
      db.collection("settings").doc("departments").get(),
      db.collection("activities").where("status", "in", ["submitted", "revision"]).get(),
    ]);
    departmentListCache = (deptSnap.exists && deptSnap.data().departments) || [];
    deptPendingCache = statusSnap.docs.map((d) => d.data());
    renderDeptOverview();
  } catch (err) {
    console.error(err);
    showToast("โหลดภาพรวมกลุ่มสาระไม่สำเร็จ", "error");
  }
}

function renderDeptOverview() {
  const body = document.getElementById("gdDeptOverviewBody");
  const empty = document.getElementById("gdDeptOverviewEmpty");
  if (!body) return; // ยังไม่ถึงตอนโหลดหน้าเสร็จ

  // รวมรายชื่อกลุ่มสาระจาก settings + กลุ่มสาระที่มีข้อมูลจริงอยู่ (กันกรณีตั้งค่ายังไม่ครบ)
  const depts = new Set(departmentListCache);
  deptPendingCache.forEach((a) => a.department && depts.add(a.department));
  pendingCache.forEach((a) => a.department && depts.add(a.department));
  doneThisYearCache.forEach((a) => a.department && depts.add(a.department));

  const rows = [...depts].map((dept) => ({
    dept,
    submitted: deptPendingCache.filter((a) => a.department === dept && a.status === "submitted").length,
    revision: deptPendingCache.filter((a) => a.department === dept && a.status === "revision").length,
    deptConfirmed: pendingCache.filter((a) => a.department === dept).length,
    done: doneThisYearCache.filter((a) => a.department === dept).length,
  })).sort((a, b) => b.submitted - a.submitted || a.dept.localeCompare(b.dept, "th"));

  const totalSubmitted = rows.reduce((sum, r) => sum + r.submitted, 0);
  const totalEl = document.getElementById("gdDeptOverviewTotal");
  if (totalEl) totalEl.textContent = totalSubmitted ? `รวมรอครูกลุ่มสาระตรวจ ${totalSubmitted} รายการ` : "ไม่มีรายการค้างรอครูกลุ่มสาระตรวจ";

  body.innerHTML = "";
  empty.style.display = rows.length ? "none" : "block";

  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(r.dept)}</td>
      <td>${r.submitted ? `<span class="badge submitted">${r.submitted} รายการ</span>` : `<span style="color:var(--text3);">-</span>`}</td>
      <td>${r.deptConfirmed ? `<span class="badge dept">${r.deptConfirmed} รายการ</span>` : `<span style="color:var(--text3);">-</span>`}</td>
      <td>${r.revision ? `<span class="badge revise">${r.revision} รายการ</span>` : `<span style="color:var(--text3);">-</span>`}</td>
      <td style="color:var(--text2);">${r.done}</td>`;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

/* ═══════════════════════════════════════════════════════════════
   รายชื่อนักเรียน — ค้นหา/กรอง + ดูรายละเอียดรายบุคคล
   ═══════════════════════════════════════════════════════════════ */
async function loadRosterData() {
  try {
    const snap = await db.collection("students").get();
    allStudents = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    buildStudentFilterOptions();
    renderRoster();
    renderDashboardStats();
  } catch (err) {
    console.error(err);
    showToast("โหลดรายชื่อนักเรียนไม่สำเร็จ", "error");
  }
}

/** เติมตัวเลือกระดับชั้น/ห้อง ให้ทั้งตัวกรองในแท็บรายชื่อนักเรียน และตัวกรองในแท็บส่งออกข้อมูล */
function buildStudentFilterOptions() {
  const levels = [...new Set(allStudents.map((s) => s.level).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

  const rosterLevelEl = document.getElementById("rosterLevelFilter");
  const exportLevelEl = document.getElementById("exportLevel");
  levels.forEach((lvl) => {
    rosterLevelEl.appendChild(new Option(lvl, lvl));
    exportLevelEl.appendChild(new Option(lvl, lvl));
  });

  const rooms = [...new Set(allStudents.map((s) => s.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  const rosterRoomEl = document.getElementById("rosterRoomFilter");
  rooms.forEach((r) => rosterRoomEl.appendChild(new Option(r, r)));
}

function setupRosterControls() {
  document.getElementById("rosterSearch").addEventListener("input", renderRoster);
  document.getElementById("rosterLevelFilter").addEventListener("change", renderRoster);
  document.getElementById("rosterRoomFilter").addEventListener("change", renderRoster);
}

function renderRoster() {
  const q = document.getElementById("rosterSearch").value.trim().toLowerCase();
  const level = document.getElementById("rosterLevelFilter").value;
  const room = document.getElementById("rosterRoomFilter").value;

  const filtered = allStudents
    .filter((s) => {
      const name = ((s.prefix || "") + (s.firstName || "") + " " + (s.lastName || "")).toLowerCase();
      const matchQ = !q || name.includes(q) || (s.studentId || "").toLowerCase().includes(q);
      return matchQ && (!level || s.level === level) && (!room || s.room === room);
    })
    .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || "", "th"));

  const body = document.getElementById("rosterBody");
  const empty = document.getElementById("rosterEmpty");
  body.innerHTML = "";
  empty.style.display = filtered.length ? "none" : "block";

  filtered.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:700;">${escapeHtml((s.prefix || "") + (s.firstName || "") + " " + (s.lastName || ""))}</td>
      <td>${escapeHtml(s.studentId || "")}</td>
      <td>${escapeHtml(s.level || "")}</td>
      <td>${escapeHtml(s.room || "")}</td>
      <td>${escapeHtml(s.track || "")}</td>
      <td><button class="icon-btn" title="ดูรายละเอียด" onclick="openStudentDetail('${s.uid}')"><i data-lucide="eye" style="width:15px;height:15px"></i></button></td>`;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

async function openStudentDetail(uid) {
  const s = allStudents.find((x) => x.uid === uid);
  if (!s) return;

  document.getElementById("studentDetailName").textContent = (s.prefix || "") + (s.firstName || "") + " " + (s.lastName || "");
  document.getElementById("studentDetailMeta").textContent =
    [s.studentId && "รหัส " + s.studentId, s.level, s.room && "ห้อง " + s.room, s.track].filter(Boolean).join(" · ");
  document.getElementById("studentDetailList").innerHTML = '<div class="hint">กำลังโหลด...</div>';
  document.getElementById("studentDetailEmpty").style.display = "none";
  document.getElementById("studentDetailOverlay").classList.add("open");

  try {
    const snap = await db.collection("activities").where("studentUid", "==", uid).orderBy("createdAt", "desc").get();
    const items = snap.docs.map((d) => d.data());
    const list = document.getElementById("studentDetailList");
    list.innerHTML = "";
    document.getElementById("studentDetailEmpty").style.display = items.length ? "none" : "block";
    items.forEach((a) => {
      const row = document.createElement("div");
      row.className = "card";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:13.5px;">${escapeHtml(a.title)}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px;">ประเภท: ${escapeHtml(a.type || "")} · กลุ่มสาระ: ${escapeHtml(a.department || "")} · ยื่นเมื่อ ${formatDate(a.createdAt)}</div>
            ${recordDetailLine(a) ? `<div style="font-size:11.5px;color:var(--text3);margin-top:2px;">${escapeHtml(recordDetailLine(a))}</div>` : ""}
          </div>
          ${statusBadgeHtml(a.status)}
        </div>`;
      list.appendChild(row);
    });
    lucide.createIcons();
  } catch (err) {
    console.error(err);
    document.getElementById("studentDetailList").innerHTML = '<div class="hint">โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง</div>';
  }
}

function closeStudentDetail() {
  document.getElementById("studentDetailOverlay").classList.remove("open");
}

/* ═══════════════════════════════════════════════════════════════
   ส่งออกข้อมูล — เลือกได้ทั้งหมด / รายชั้น-ห้อง / รายบุคคล
   + กรองประเภทกิจกรรม + ช่วงวันที่จัดกิจกรรม (ทุกตัวกรองทำฝั่ง client
   หลังดึงข้อมูลตามปีมาแล้ว เพื่อไม่ต้องสร้าง composite index เพิ่ม)
   ═══════════════════════════════════════════════════════════════ */
/* Schema ตรงตามเทมเพลตนำเข้าจริงของโรงเรียน (ไฟล์ กิจกรรม.xls / โครงงาน.xls / รางวัล.xls / หลักสูตรอบรม.xls)
   หัวคอลัมน์เป็นชื่อฟิลด์ภาษาอังกฤษตามเทมเพลตเป๊ะๆ ไม่ใช่หัวไทยแบบเดิม
   - title ในเทมเพลต = คำนำหน้าชื่อ (นาย/นางสาว) ไม่ใช่ชื่อกิจกรรม — ดึงจาก students/{uid} ผ่าน allStudents cache
   - ไฟล์ต้นแบบเป็น .xls จริง (ไม่ใช่ CSV) และคอลัมน์วันที่ทั้งสอง (index 7, 8 ทุกเชมา) เป็น "เซลล์วันที่"
     ชนิดตัวเลขจริง ไม่ใช่ข้อความ — ค่าตัวเลข (serial) ที่เก็บคือ "วันที่ ค.ศ. บวกปีเป็น พ.ศ. (+543 ปี) แล้วตี
     เป็น Excel date serial ตามปฏิทินปกติ" (เช่น 15 ต.ค. 2568(พ.ศ.) → serial ของ 15 ต.ค. 2568 แบบปีปกติ = 244272)
     ระบบเราเก็บวันที่เป็น ค.ศ. จึงต้องแปลงด้วย toExcelSerialFakeBE() ตอน export แล้วค่อยตั้งฟอร์แมตเซลล์
     เป็นวันที่ (z: "m/d/yy") ทีหลังตอนสร้างชีต — ดู buildXlsxSheet()
   - citizen_id ในเทมเพลตเป็น "ตัวเลข" ถ้าเป็นเลขบัตร ปชช. ล้วนๆ แต่เป็น "ข้อความ" ถ้ามีตัวอักษรปน (เช่น
     รหัสพาสปอร์ตนักเรียนต่างชาติ "g123456789012") — ดู citizenIdCellValue()
   - เทมเพลตมีคอลัมน์ "fee" แต่ระบบเราไม่มีฟิลด์นี้เก็บไว้ ปล่อยว่างไว้เสมอ */

/** ค.ศ. "YYYY-MM-DD..." → Excel date serial ของ "พ.ศ. เดียวกันแต่ตีเป็นปีปกติ" (ตรงกับที่เทมเพลตโรงเรียนใช้) */
function toExcelSerialFakeBE(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || "");
  if (!m) return "";
  const beYear = Number(m[1]) + 543;
  const epoch = Date.UTC(1899, 11, 30); // จุดเริ่มต้น serial ของ Excel (ระบบวันที่ 1900)
  const target = Date.UTC(beYear, Number(m[2]) - 1, Number(m[3]));
  return Math.round((target - epoch) / 86400000);
}

/** citizen_id: เลขล้วน → number (ตรงกับเทมเพลต), มีตัวอักษรปน → string, ว่าง → "" */
function citizenIdCellValue(id) {
  const s = String(id ?? "").trim();
  if (!s) return "";
  return /^\d+$/.test(s) ? Number(s) : s;
}

const EXPORT_SCHEMA = {
  activity: {
    fileSuffix: "กิจกรรม",
    header: ["citizen_id", "title", "first_name", "last_name", "program_title", "exp_name", "description", "date", "end_date", "year", "level", "hours", "fee"],
    row: (a, s) => [
      citizenIdCellValue(a.nationalId || (s && s.nationalId)),
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      (a.typeDetails && a.typeDetails.expName) || "",
      a.description || "",
      toExcelSerialFakeBE(a.eventDate),
      toExcelSerialFakeBE(a.endDate),
      a.year,
      a.level || "",
      a.hours ?? "",
      "",
    ],
  },
  project: {
    fileSuffix: "โครงงาน",
    header: ["citizen_id", "title", "first_name", "last_name", "project_title", "project_type", "description", "date", "end_date", "year", "level", "hours", "fee"],
    row: (a, s) => [
      citizenIdCellValue(a.nationalId || (s && s.nationalId)),
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      (a.typeDetails && a.typeDetails.projectType) || "",
      a.description || "",
      toExcelSerialFakeBE(a.eventDate),
      toExcelSerialFakeBE(a.endDate),
      a.year,
      a.level || "",
      a.hours ?? "",
      "",
    ],
  },
  award: {
    fileSuffix: "รางวัล",
    header: ["citizen_id", "title", "first_name", "last_name", "program_title", "prize_name", "description", "date", "end_date", "year", "level", "hours", "fee"],
    row: (a, s) => [
      citizenIdCellValue(a.nationalId || (s && s.nationalId)),
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      (a.typeDetails && a.typeDetails.prizeName) || "",
      a.description || "",
      toExcelSerialFakeBE(a.eventDate),
      toExcelSerialFakeBE(a.endDate),
      a.year,
      a.level || "",
      a.hours ?? "",
      "",
    ],
  },
  course: {
    fileSuffix: "หลักสูตรอบรม",
    header: ["citizen_id", "title", "first_name", "last_name", "course_name", "course_level", "description", "issue_date", "expired_date", "score", "year", "category", "level", "hours", "fee"],
    row: (a, s) => [
      citizenIdCellValue(a.nationalId || (s && s.nationalId)),
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      "",
      a.description || "",
      toExcelSerialFakeBE(a.eventDate),
      toExcelSerialFakeBE(a.typeDetails && a.typeDetails.expiredDate),
      (a.typeDetails && a.typeDetails.score) || "",
      a.year,
      (a.typeDetails && a.typeDetails.category) || "",
      a.level || "",
      a.hours ?? "",
      "",
    ],
  },
};

/** สลับให้ปุ่ม/checkbox "เลือกทั้งหมด" ตรงกับ checkbox รูปแบบย่อยที่ติ๊กอยู่จริง + อัปเดตข้อความนับจำนวน */
function syncExportFormatAllToggle() {
  const boxes = Array.from(document.querySelectorAll(".export-format-check"));
  const allEl = document.getElementById("exportFormatAll");
  const checkedCount = boxes.filter((b) => b.checked).length;
  if (allEl) allEl.checked = checkedCount === boxes.length;
  const countEl = document.getElementById("exportFormatCount");
  if (countEl) countEl.textContent = `เลือกไว้ ${checkedCount} จาก ${boxes.length} รูปแบบ`;
}

/** แสดงจุดเตือนบนหัวข้อ "ตัวกรองเพิ่มเติม" ว่ามีการตั้งค่าไว้กี่รายการ จะได้รู้ทันทีแม้ยังไม่ได้กางดู */
function updateAdvancedFilterBadge() {
  const badge = document.getElementById("exportAdvancedBadge");
  if (!badge) return;
  const active = [
    document.getElementById("exportYearFilter").value,
    document.getElementById("exportTypeFilter").value,
    document.getElementById("exportDateFrom").value,
    document.getElementById("exportDateTo").value,
  ].filter(Boolean).length;
  if (active) {
    badge.style.display = "inline-flex";
    badge.textContent = `ตั้งค่าไว้ ${active} รายการ`;
  } else {
    badge.style.display = "none";
  }
}

function setupExportControls() {
  const scopeEl = document.getElementById("exportScope");
  scopeEl.addEventListener("change", () => {
    document.getElementById("exportLevelBox").style.display = scopeEl.value === "level" ? "block" : "none";
    document.getElementById("exportStudentBox").style.display = scopeEl.value === "student" ? "block" : "none";
  });

  document.querySelectorAll(".export-format-check").forEach((el) => {
    el.addEventListener("change", syncExportFormatAllToggle);
  });
  const allEl = document.getElementById("exportFormatAll");
  if (allEl) {
    allEl.addEventListener("change", () => {
      document.querySelectorAll(".export-format-check").forEach((el) => { el.checked = allEl.checked; });
      syncExportFormatAllToggle();
    });
  }
  syncExportFormatAllToggle();

  ["exportYearFilter", "exportTypeFilter", "exportDateFrom", "exportDateTo"].forEach((id) => {
    document.getElementById(id).addEventListener("change", updateAdvancedFilterBadge);
  });

  document.getElementById("exportLevel").addEventListener("change", updateExportRoomOptions);

  document.getElementById("exportStudentSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const box = document.getElementById("exportStudentResults");
    box.innerHTML = "";
    if (!q) return;
    studentMatches(q).slice(0, 8).forEach((s) => box.appendChild(quickResultRow(s, () => selectExportStudent(s))));
  });
}

function updateExportRoomOptions() {
  const level = document.getElementById("exportLevel").value;
  const roomEl = document.getElementById("exportRoom");
  roomEl.innerHTML = '<option value="">ทุกห้อง</option>';
  const rooms = [...new Set(allStudents.filter((s) => s.level === level).map((s) => s.room).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  rooms.forEach((r) => roomEl.appendChild(new Option(r, r)));
}

function selectExportStudent(s) {
  exportSelectedStudentUid = s.uid;
  document.getElementById("exportStudentSearch").value = "";
  document.getElementById("exportStudentResults").innerHTML = "";
  const box = document.getElementById("exportStudentSelected");
  box.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg-alt);border-radius:10px;padding:10px 12px;";
  box.innerHTML = `<span style="font-weight:700;font-size:13px;">${escapeHtml((s.prefix || "") + (s.firstName || "") + " " + (s.lastName || ""))} <span style="color:var(--text3);font-weight:600;">· ${escapeHtml(s.level || "")} ${escapeHtml(s.room || "")}</span></span><button class="icon-btn" onclick="clearExportStudent()"><i data-lucide="x" style="width:14px;height:14px"></i></button>`;
  lucide.createIcons();
}

function clearExportStudent() {
  exportSelectedStudentUid = null;
  document.getElementById("exportStudentSelected").style.display = "none";
}

async function loadExportTypeOptions() {
  try {
    const snap = await db.collection("settings").doc("activityTypes").get();
    const types = (snap.exists && snap.data().types) || [];
    const el = document.getElementById("exportTypeFilter");
    types.forEach((t) => el.appendChild(new Option(t, t)));
  } catch (err) {
    console.warn("โหลดรายการประเภทกิจกรรมไม่สำเร็จ ใช้ตัวกรองแบบไม่มีตัวเลือกประเภทแทน", err);
  }
}

document.getElementById("exportBtn").addEventListener("click", async () => {
  const scope = document.getElementById("exportScope").value;
  const year = document.getElementById("exportYearFilter").value; // "" = ทุกปี
  const type = document.getElementById("exportTypeFilter").value;
  const dateFrom = document.getElementById("exportDateFrom").value;
  const dateTo = document.getElementById("exportDateTo").value;
  const level = document.getElementById("exportLevel").value;
  const room = document.getElementById("exportRoom").value;

  if (scope === "level" && !level) { showToast("กรุณาเลือกระดับชั้นก่อน", "error"); return; }
  if (scope === "student" && !exportSelectedStudentUid) { showToast("กรุณาค้นหาและเลือกนักเรียนก่อน", "error"); return; }

  // ผู้ใช้เลือกได้ว่าจะส่งออกฟอร์มไหนบ้าง (กิจกรรม/โครงงาน/รางวัล/หลักสูตรอบรม/อื่นๆ)
  const checkedFormats = new Set(
    Array.from(document.querySelectorAll(".export-format-check:checked")).map((el) => el.value)
  );
  if (!checkedFormats.size) { showToast("กรุณาเลือกรูปแบบข้อมูลที่จะส่งออกอย่างน้อย 1 แบบ", "error"); return; }

  const btn = document.getElementById("exportBtn");
  btn.disabled = true;
  document.getElementById("exportResultPanel").style.display = "none";
  try {
    // ดึงจาก Firestore ด้วยเงื่อนไขเดิม (status + ปีการศึกษาถ้าเลือก) เท่านั้น — ตัวกรองที่เหลือ
    // (รายบุคคล/รายชั้น-ห้อง/ประเภท/ช่วงวันที่) กรองต่อฝั่ง client กันต้องสร้าง index เพิ่มทุกชุดตัวกรอง
    let q = db.collection("activities").where("status", "==", "guidance_confirmed");
    if (year) q = q.where("year", "==", Number(year));
    const snap = await q.get();

    let items = snap.docs.map((d) => d.data());
    if (scope === "student") items = items.filter((a) => a.studentUid === exportSelectedStudentUid);
    if (scope === "level") items = items.filter((a) => a.studentLevel === level && (!room || a.studentRoom === room));
    if (type) items = items.filter((a) => a.type === type);
    if (dateFrom) items = items.filter((a) => (a.eventDate || "") >= dateFrom);
    if (dateTo) items = items.filter((a) => (a.eventDate || "") <= dateTo);
    items.sort((a, b) => (a.studentRoom || "").localeCompare(b.studentRoom || "", "th", { numeric: true }) || (a.studentName || "").localeCompare(b.studentName || "", "th"));

    if (!items.length) {
      showToast("ไม่มีข้อมูลตรงตามเงื่อนไขที่เลือก", "error");
      return;
    }

    // แยกเอกสารตาม recordType — ของเก่าที่ไม่มี recordType (ส่งก่อนอัปเดตฟอร์ม) จะรวมอยู่ในกลุ่ม "อื่นๆ" ด้านล่าง
    const grouped = { activity: [], project: [], award: [], course: [] };
    const legacy = [];
    items.forEach((a) => { if (grouped[a.recordType]) grouped[a.recordType].push(a); else legacy.push(a); });

    const suffix = exportFilenameSuffix({ scope, year, level, room });
    const studentByUid = new Map(allStudents.map((s) => [s.uid, s]));
    const filesGenerated = []; // { filename, count } — ไว้แสดงสรุปผลให้ผู้ใช้เห็นชัดๆ หลังส่งออก
    Object.keys(EXPORT_SCHEMA).forEach((rt) => {
      if (!checkedFormats.has(rt)) return;
      const list = grouped[rt];
      if (!list.length) return;
      const schema = EXPORT_SCHEMA[rt];
      const ws = buildXlsxSheet(schema, list, studentByUid);
      const filename = `${schema.fileSuffix}-${suffix}.xlsx`;
      downloadXlsx(filename, ws, schema.fileSuffix);
      filesGenerated.push({ filename, count: list.length });
    });

    if (legacy.length && checkedFormats.has("legacy")) {
      const header = ["ชื่อ-สกุล", "ชั้น", "ห้อง", "ชื่อกิจกรรม", "ประเภท", "กลุ่มสาระ", "วันที่จัดกิจกรรม", "ผู้ยืนยันครูกลุ่มสาระ", "ผู้ยืนยันครูแนะแนว"];
      const rows = [header, ...legacy.map((a) => [a.studentName, a.studentLevel, a.studentRoom, a.title, a.type, a.department, a.eventDate, a.deptReviewerEmail, a.guidanceReviewerEmail])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const filename = `np-tcas-verified-รายการเก่า-${suffix}.xlsx`;
      downloadXlsx(filename, ws, "รายการเก่า");
      filesGenerated.push({ filename, count: legacy.length });
    }

    if (!filesGenerated.length) {
      showToast("ไม่มีข้อมูลตรงกับรูปแบบที่เลือกไว้", "error");
      return;
    }

    renderExportResultPanel(filesGenerated, items.length);
    showToast(`ส่งออกสำเร็จ ${filesGenerated.length} ไฟล์ (${items.length} รายการ)`, "success");
  } catch (err) {
    console.error(err);
    showToast("ส่งออกไม่สำเร็จ", "error");
  } finally {
    btn.disabled = false;
  }
});

/** สรุปผลหลังส่งออกให้เห็นชัดว่าได้ไฟล์อะไรบ้าง กี่รายการต่อไฟล์ — แทนที่จะให้เดาเองจากไฟล์ที่ดาวน์โหลดมา */
function renderExportResultPanel(filesGenerated, totalCount) {
  const panel = document.getElementById("exportResultPanel");
  const list = document.getElementById("exportResultList");
  list.innerHTML = filesGenerated.map((f) => `
    <div class="export-result-row">
      <span class="fname"><i data-lucide="file-spreadsheet" style="width:14px;height:14px"></i>${escapeHtml(f.filename)}</span>
      <span class="fcount">${f.count} รายการ</span>
    </div>`).join("");
  panel.style.display = "block";
  lucide.createIcons();
}

function exportFilenameSuffix({ scope, year, level, room }) {
  const parts = [];
  if (scope === "student") parts.push("รายบุคคล");
  else if (scope === "level") parts.push((level + (room ? "-" + room : "")).replace(/\s+/g, ""));
  parts.push(year || "ทุกปี");
  return parts.join("-");
}

/** สร้าง worksheet จาก schema + รายการข้อมูล แล้วตั้งฟอร์แมตคอลัมน์วันที่ (index 7,8 ทุกเชมา)
    ให้เป็นเซลล์วันที่จริง (ไม่ใช่ข้อความ) ตรงกับที่เทมเพลต .xls ของโรงเรียนใช้ */
function buildXlsxSheet(schema, list, studentByUid) {
  const rows = [schema.header, ...list.map((a) => schema.row(a, studentByUid.get(a.studentUid)))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const dateCols = schema.dateCols || [7, 8];
  for (let r = 1; r < rows.length; r++) {
    dateCols.forEach((c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.t === "n") cell.z = "m/d/yy"; // แสดงเป็นวันที่ ตรงฟอร์แมตเทมเพลตต้นฉบับ
    });
  }
  return ws;
}

function downloadXlsx(filename, worksheet, sheetName) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, worksheet, (sheetName || "Sheet1").slice(0, 31));
  XLSX.writeFile(wb, filename);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
