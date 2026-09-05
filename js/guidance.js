lucide.createIcons();
let ctxGlobal = null;

/* แคชข้อมูลไว้ใช้ร่วมกันหลายส่วน (แดชบอร์ด/รายชื่อนักเรียน/ค้นหา/ส่งออก) กันยิง query ซ้ำ */
let pendingCache = [];       // dept_confirmed ทั้งหมด (รอยืนยันขั้นสุดท้าย)
let allStudents = [];        // นักเรียนทั้งหมดในระบบ (จาก collection students)
let doneThisYearCache = [];  // guidance_confirmed ของปีการศึกษาปัจจุบัน (ไว้คำนวณสรุปแดชบอร์ด)
let exportSelectedStudentUid = null;

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
            <button class="btn-approve" onclick="finalApprove('${a.id}')"><i data-lucide="badge-check" style="width:13px;height:13px"></i>ยืนยันขั้นสุดท้าย</button>
          </div>
        </div>`;
      list.appendChild(card);
    });
    lucide.createIcons();

    renderDashboardPending();
    renderDashboardStats();
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
  } catch (err) {
    console.error(err);
  }
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
   - วันที่ทุกคอลัมน์ต้องเป็น พ.ศ. รูปแบบ "YYYY-MM-DD 00:00:00" (ระบบเราเก็บ ค.ศ. ต้อง +543 ตอน export)
   - เทมเพลตมีคอลัมน์ "fee" แต่ระบบเราไม่มีฟิลด์นี้เก็บไว้ ปล่อยว่างไว้เสมอ */
function toBEDateTime(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || "");
  if (!m) return "";
  return `${Number(m[1]) + 543}-${m[2]}-${m[3]} 00:00:00`;
}

const EXPORT_SCHEMA = {
  activity: {
    fileSuffix: "กิจกรรม",
    header: ["citizen_id", "title", "first_name", "last_name", "program_title", "exp_name", "description", "date", "end_date", "year", "level", "hours", "fee"],
    row: (a, s) => [
      a.nationalId || (s && s.nationalId) || "",
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      (a.typeDetails && a.typeDetails.expName) || "",
      a.description || "",
      toBEDateTime(a.eventDate),
      toBEDateTime(a.endDate),
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
      a.nationalId || (s && s.nationalId) || "",
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      (a.typeDetails && a.typeDetails.projectType) || "",
      a.description || "",
      toBEDateTime(a.eventDate),
      toBEDateTime(a.endDate),
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
      a.nationalId || (s && s.nationalId) || "",
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      (a.typeDetails && a.typeDetails.prizeName) || "",
      a.description || "",
      toBEDateTime(a.eventDate),
      toBEDateTime(a.endDate),
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
      a.nationalId || (s && s.nationalId) || "",
      (s && s.prefix) || "",
      (s && s.firstName) || "",
      (s && s.lastName) || "",
      a.title,
      "",
      a.description || "",
      toBEDateTime(a.eventDate),
      toBEDateTime(a.typeDetails && a.typeDetails.expiredDate),
      (a.typeDetails && a.typeDetails.score) || "",
      a.year,
      (a.typeDetails && a.typeDetails.category) || "",
      a.level || "",
      a.hours ?? "",
      "",
    ],
  },
};

function setupExportControls() {
  const scopeEl = document.getElementById("exportScope");
  scopeEl.addEventListener("change", () => {
    document.getElementById("exportLevelBox").style.display = scopeEl.value === "level" ? "block" : "none";
    document.getElementById("exportStudentBox").style.display = scopeEl.value === "student" ? "block" : "none";
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

  const btn = document.getElementById("exportBtn");
  btn.disabled = true;
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
    let fileCount = 0;
    Object.keys(EXPORT_SCHEMA).forEach((rt) => {
      const list = grouped[rt];
      if (!list.length) return;
      const schema = EXPORT_SCHEMA[rt];
      downloadCsv(`${schema.fileSuffix}-${suffix}.csv`, [schema.header, ...list.map((a) => schema.row(a, studentByUid.get(a.studentUid)))]);
      fileCount++;
    });

    if (legacy.length) {
      const header = ["ชื่อ-สกุล", "ชั้น", "ห้อง", "ชื่อกิจกรรม", "ประเภท", "กลุ่มสาระ", "วันที่จัดกิจกรรม", "ผู้ยืนยันครูกลุ่มสาระ", "ผู้ยืนยันครูแนะแนว"];
      const rows = [header, ...legacy.map((a) => [a.studentName, a.studentLevel, a.studentRoom, a.title, a.type, a.department, a.eventDate, a.deptReviewerEmail, a.guidanceReviewerEmail])];
      downloadCsv(`np-tcas-verified-อื่นๆ-ก่อนอัปเดตฟอร์ม-${suffix}.csv`, rows);
      fileCount++;
    }

    showToast(`ส่งออกสำเร็จ ${fileCount} ไฟล์ (${items.length} รายการ)`, "success");
  } catch (err) {
    console.error(err);
    showToast("ส่งออกไม่สำเร็จ", "error");
  } finally {
    btn.disabled = false;
  }
});

function exportFilenameSuffix({ scope, year, level, room }) {
  const parts = [];
  if (scope === "student") parts.push("รายบุคคล");
  else if (scope === "level") parts.push((level + (room ? "-" + room : "")).replace(/\s+/g, ""));
  parts.push(year || "ทุกปี");
  return parts.join("-");
}

function downloadCsv(filename, rows) {
  const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
