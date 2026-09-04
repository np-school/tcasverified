lucide.createIcons();

const DEFAULT_DEPARTMENTS = ["วิทยาศาสตร์", "เทคโนโลยี", "คณิตศาสตร์", "ภาษาไทย", "สังคมศึกษาฯ", "สุขศึกษาฯ", "ภาษาต่างประเทศ", "ศิลปะ", "การงานอาชีพ", "แนะแนว"];
const DEFAULT_ACTIVITY_TYPES = [
  "T - Talent & Creativity",
  "C - Contribution to Society",
  "A - Academic Excellence",
  "S - Self-Development",
];
const DEFAULT_ACADEMIC = {
  levels: ["มัธยมศึกษาปีที่ 4", "มัธยมศึกษาปีที่ 5", "มัธยมศึกษาปีที่ 6"],
  roomsPerLevel: { "มัธยมศึกษาปีที่ 4": ["1","2","3","4","5"], "มัธยมศึกษาปีที่ 5": ["1","2","3","4","5"], "มัธยมศึกษาปีที่ 6": ["1","2","3","4","5"] },
  tracks: ["วิทย์-คณิต", "ศิลป์-ภาษา", "ศิลป์-คำนวณ"],
};

guardPage(["admin"], (ctx) => {
  document.getElementById("userLabel").textContent = ctx.user.email;
  renderAdminViewSwitch("admin.html");
  loadStaff();
  loadDeptTeachers();
  loadGuidanceTeachers();
  loadReferenceData();
});

document.querySelectorAll(".sidebar-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-btn[data-tab]").forEach((b) => b.classList.remove("active", "staff"));
    btn.classList.add("active", "staff");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ── ครูประจำกลุ่มสาระ ── */
async function loadDeptTeachers() {
  const deptSnap = await db.collection("settings").doc("departments").get();
  const departments = (deptSnap.exists && deptSnap.data().departments) || DEFAULT_DEPARTMENTS;
  const sel = document.getElementById("deptDept");
  sel.innerHTML = departments.map((d) => `<option>${d}</option>`).join("");

  const snap = await db.collection("permissions").where("role", "==", "dept_teacher").get();
  const body = document.getElementById("deptBody");
  body.innerHTML = "";
  snap.forEach((doc) => {
    const p = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${doc.id}</td><td>${p.department || "-"}</td><td><span class="role-tag dept">ครูประจำกลุ่มสาระ</span></td>
      <td><button class="icon-btn" onclick="removePermission('${doc.id}', loadDeptTeachers)"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button></td>`;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

async function addDeptTeacher() {
  const email = document.getElementById("deptEmail").value.trim().toLowerCase();
  const department = document.getElementById("deptDept").value;
  if (!validEmail(email)) return showToast("กรุณากรอกอีเมล @" + ALLOWED_DOMAIN + " ให้ถูกต้อง", "error");
  try {
    await db.collection("permissions").doc(email).set({
      role: "dept_teacher", department,
      addedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById("deptEmail").value = "";
    showToast("เพิ่มครูประจำกลุ่มสาระแล้ว", "success");
    loadDeptTeachers();
    refreshStaffRoles();
  } catch (err) { console.error(err); showToast("เพิ่มไม่สำเร็จ", "error"); }
}

/* ── ครูแนะแนว ── */
async function loadGuidanceTeachers() {
  const snap = await db.collection("permissions").where("role", "==", "guidance").get();
  const body = document.getElementById("guidanceBody");
  body.innerHTML = "";
  snap.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${doc.id}</td><td><span class="role-tag guidance">ครูแนะแนว</span></td>
      <td><button class="icon-btn" onclick="removePermission('${doc.id}', loadGuidanceTeachers)"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button></td>`;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

async function addGuidanceTeacher() {
  const email = document.getElementById("guidanceEmail").value.trim().toLowerCase();
  if (!validEmail(email)) return showToast("กรุณากรอกอีเมล @" + ALLOWED_DOMAIN + " ให้ถูกต้อง", "error");
  try {
    await db.collection("permissions").doc(email).set({
      role: "guidance",
      addedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById("guidanceEmail").value = "";
    showToast("เพิ่มครูแนะแนวแล้ว", "success");
    loadGuidanceTeachers();
    refreshStaffRoles();
  } catch (err) { console.error(err); showToast("เพิ่มไม่สำเร็จ", "error"); }
}

async function removePermission(email, reload) {
  if (!confirm(`ยกเลิกสิทธิ์ของ ${email} ใช่หรือไม่?`)) return;
  try {
    await db.collection("permissions").doc(email).delete();
    showToast("ยกเลิกสิทธิ์แล้ว", "success");
    reload();
    refreshStaffRoles();
  } catch (err) { console.error(err); showToast("ยกเลิกไม่สำเร็จ", "error"); }
}

function validEmail(email) {
  return email.endsWith("@" + ALLOWED_DOMAIN) && email.length > ("@" + ALLOWED_DOMAIN).length;
}

/* ── ข้อมูลอ้างอิง: ระดับชั้น / ห้องต่อระดับชั้น / กลุ่มการเรียน / ประเภทกิจกรรม / กลุ่มสาระ
   รวมเป็นแท็บเดียว แก้ไขแบบ "แท็ก" (พิมพ์แล้ว Enter เพื่อเพิ่ม, กดกากบาทเพื่อลบ) แทน textarea ดิบ ── */
let refLevelsEditor, refTracksEditor, refTypesEditor, refDeptsEditor;
let refRoomsPerLevel = {}; // เก็บห้องของแต่ละระดับชั้นไว้ระหว่างแก้ไข (sync กับ chip editor ของแต่ละระดับ)

async function loadReferenceData() {
  const [academicSnap, typesSnap, deptSnap] = await Promise.all([
    db.collection("settings").doc("academic").get(),
    db.collection("settings").doc("activityTypes").get(),
    db.collection("settings").doc("departments").get(),
  ]);
  const academic = academicSnap.exists ? { ...DEFAULT_ACADEMIC, ...academicSnap.data() } : DEFAULT_ACADEMIC;
  const types = (typesSnap.exists && typesSnap.data().types) || DEFAULT_ACTIVITY_TYPES;
  const departments = (deptSnap.exists && deptSnap.data().departments) || DEFAULT_DEPARTMENTS;
  refRoomsPerLevel = { ...academic.roomsPerLevel };

  refLevelsEditor = chipEditor("chipLevels", academic.levels, {
    placeholder: "เช่น มัธยมศึกษาปีที่ 4 — Enter เพื่อเพิ่ม",
    onChange: renderRoomsPerLevel, // เพิ่ม/ลบระดับชั้น → บล็อกห้องด้านล่างปรับตามทันที
  });
  refTracksEditor = chipEditor("chipTracks", academic.tracks, { placeholder: "เช่น วิทย์-คณิต" });
  refTypesEditor = chipEditor("chipTypes", types, { placeholder: "เช่น T - Talent & Creativity" });
  refDeptsEditor = chipEditor("chipDepartments", departments, { placeholder: "เช่น วิทยาศาสตร์" });

  renderRoomsPerLevel(academic.levels);
}

function renderRoomsPerLevel(levels) {
  const box = document.getElementById("roomsPerLevelBox");
  box.innerHTML = "";
  if (!levels.length) {
    box.innerHTML = '<p class="hint">เพิ่มระดับชั้นด้านบนก่อน แล้วจะมาตั้งห้องของแต่ละระดับที่นี่ได้</p>';
    return;
  }
  levels.forEach((lvl, i) => {
    const block = document.createElement("div");
    block.className = "room-level-block";
    block.innerHTML = `<div class="room-level-name"><i data-lucide="door-open" style="width:14px;height:14px"></i>${escapeHtml(lvl)}</div><div id="chipRoom-${i}"></div>`;
    box.appendChild(block);
    chipEditor("chipRoom-" + i, refRoomsPerLevel[lvl] || [], {
      placeholder: "เช่น 1, 2, 3 — Enter เพื่อเพิ่ม",
      onChange: (items) => { refRoomsPerLevel[lvl] = items; },
    });
  });
  lucide.createIcons();
}

async function saveReferenceData() {
  const levels = refLevelsEditor.get();
  const tracks = refTracksEditor.get();
  const types = refTypesEditor.get();
  const departments = refDeptsEditor.get();
  const roomsPerLevel = {};
  levels.forEach((lvl) => { roomsPerLevel[lvl] = refRoomsPerLevel[lvl] || []; });

  try {
    await Promise.all([
      db.collection("settings").doc("academic").set({ levels, tracks, roomsPerLevel }, { merge: false }),
      db.collection("settings").doc("activityTypes").set({ types }),
      db.collection("settings").doc("departments").set({ departments }),
    ]);
    showToast("บันทึกแล้ว", "success");
    loadDeptTeachers(); // รีเฟรช dropdown กลุ่มสาระให้ตรงของใหม่
  } catch (err) { console.error(err); showToast("บันทึกไม่สำเร็จ", "error"); }
}

/** chip editor ทั่วไป — ใส่ array เริ่มต้น, คืน {get,set} ให้ดึง/ตั้งค่าได้
 *  พิมพ์แล้วกด Enter หรือ , เพื่อเพิ่ม, กดกากบาทที่แท็กเพื่อลบ, Backspace ตอนช่องว่างลบตัวท้าย */
function chipEditor(containerId, initialItems, opts) {
  opts = opts || {};
  const container = document.getElementById(containerId);
  let items = initialItems.slice();

  function render() {
    container.className = "chip-editor-list";
    container.innerHTML = "";
    items.forEach((item, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${escapeHtml(item)} <button type="button" title="ลบ">&times;</button>`;
      chip.querySelector("button").onclick = () => {
        items.splice(i, 1);
        render();
        if (opts.onChange) opts.onChange(items.slice());
      };
      container.appendChild(chip);
    });
    const input = document.createElement("input");
    input.type = "text";
    input.className = "chip-input";
    input.placeholder = opts.placeholder || "พิมพ์แล้วกด Enter เพื่อเพิ่ม";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const v = input.value.trim();
        if (v && !items.includes(v)) {
          items.push(v);
          input.value = "";
          render();
          if (opts.onChange) opts.onChange(items.slice());
        }
      } else if (e.key === "Backspace" && !input.value && items.length) {
        items.pop();
        render();
        if (opts.onChange) opts.onChange(items.slice());
      }
    });
    container.appendChild(input);
  }
  render();
  return {
    get: () => items.slice(),
    set: (newItems) => { items = newItems.slice(); render(); },
  };
}

/* ── บุคลากร ── */
let staffCache = [];
let permissionsMap = {}; // email -> { role, department? } จาก collection permissions ใช้แสดง badge สิทธิ์ในตารางบุคลากร

async function loadStaff() {
  try {
    const snap = await db.collection("staff").orderBy("name").get();
    staffCache = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error(err);
    // เผื่อยังไม่เคยมีข้อมูล/ยังไม่ได้สร้าง index ให้ orderBy — ลองดึงแบบไม่เรียงแทน
    const snap = await db.collection("staff").get();
    staffCache = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
  }
  await loadPermissionsMap();
  populateStaffFilters();
  renderStaffTable();
}

/** ดึง permissions ทั้งหมดมาเก็บเป็น map สำหรับแสดง badge สิทธิ์ในตารางบุคลากร */
async function loadPermissionsMap() {
  const snap = await db.collection("permissions").get();
  permissionsMap = {};
  snap.forEach((doc) => (permissionsMap[doc.id] = doc.data()));
}

/** เรียกหลังแก้สิทธิ์จากแท็บครูกลุ่มสาระ/ครูแนะแนว เพื่อให้ badge ในตารางบุคลากรอัปเดตตาม โดยไม่ต้องโหลดข้อมูลบุคลากรใหม่ทั้งหมด */
async function refreshStaffRoles() {
  await loadPermissionsMap();
  renderStaffTable();
}

function roleBadge(email) {
  const perm = permissionsMap[email];
  if (!perm) return `<span class="role-tag none">ไม่มีสิทธิ์พิเศษ</span>`;
  if (perm.role === "dept_teacher") return `<span class="role-tag dept">ครูกลุ่มสาระ${perm.department ? " · " + escapeHtml(perm.department) : ""}</span>`;
  if (perm.role === "guidance") return `<span class="role-tag guidance">ครูแนะแนว</span>`;
  if (perm.role === "admin") return `<span class="role-tag admin">แอดมิน</span>`;
  return `<span class="role-tag none">${escapeHtml(perm.role)}</span>`;
}

function populateStaffFilters() {
  const depts = [...new Set(staffCache.map((s) => s.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const positions = [...new Set(staffCache.map((s) => s.position).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

  const deptFilter = document.getElementById("staffDeptFilter");
  const current = deptFilter.value;
  deptFilter.innerHTML = '<option value="">ทุกกลุ่มงาน</option>' + depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  if (depts.includes(current)) deptFilter.value = current;

  document.getElementById("staffDeptList").innerHTML = depts.map((d) => `<option value="${escapeHtml(d)}">`).join("");
  document.getElementById("staffPositionList").innerHTML = positions.map((p) => `<option value="${escapeHtml(p)}">`).join("");
}

function renderStaffTable() {
  const q = (document.getElementById("staffSearch").value || "").trim().toLowerCase();
  const dept = document.getElementById("staffDeptFilter").value;
  const filtered = staffCache.filter((s) => {
    if (dept && s.department !== dept) return false;
    if (!q) return true;
    return [s.name, s.email, s.subject, s.position].some((v) => (v || "").toLowerCase().includes(q));
  });

  const countEl = document.getElementById("staffCount");
  countEl.textContent = staffCache.length ? `(${filtered.length}${filtered.length !== staffCache.length ? " / " + staffCache.length : ""} คน)` : "";

  const body = document.getElementById("staffBody");
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i data-lucide="id-card" style="width:30px;height:30px"></i><p style="margin-top:8px;">${staffCache.length ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลบุคลากร — เพิ่มทีละคนหรือนำเข้าจากไฟล์ CSV"}</p></div></td></tr>`;
    lucide.createIcons();
    return;
  }

  body.innerHTML = filtered.map((s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.position || "-")}</td>
      <td>${escapeHtml(s.department || "-")}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.phone || "-")}</td>
      <td>${escapeHtml(s.subject || "-")}</td>
      <td>${escapeHtml(s.note || "-")}</td>
      <td>${roleBadge(s.email)}</td>
      <td style="white-space:nowrap;">
        <button class="icon-btn" onclick="openRoleModal('${escapeAttr(s.email)}')" title="ตั้งสิทธิ์"><i data-lucide="shield" style="width:15px;height:15px"></i></button>
        <button class="icon-btn" onclick="openStaffModal('${escapeAttr(s.id)}')" title="แก้ไข"><i data-lucide="pencil" style="width:15px;height:15px"></i></button>
        <button class="icon-btn" onclick="deleteStaff('${escapeAttr(s.id)}')" title="ลบ"><i data-lucide="trash-2" style="width:15px;height:15px"></i></button>
      </td>
    </tr>
  `).join("");
  lucide.createIcons();
}

document.getElementById("staffSearch").addEventListener("input", renderStaffTable);
document.getElementById("staffDeptFilter").addEventListener("change", renderStaffTable);
document.getElementById("staffCsvInput").addEventListener("change", importStaffCsv);

const STAFF_FORM_IDS = ["staffName", "staffPosition", "staffDept", "staffEmail", "staffPhone", "staffSubject", "staffNote"];

function openStaffModal(id) {
  const modal = document.getElementById("staffModal");
  const emailInput = document.getElementById("staffEmail");
  if (id) {
    const s = staffCache.find((x) => x.id === id);
    if (!s) return;
    document.getElementById("staffModalTitle").textContent = "แก้ไขบุคลากร";
    document.getElementById("staffName").value = s.name || "";
    document.getElementById("staffPosition").value = s.position || "";
    document.getElementById("staffDept").value = s.department || "";
    emailInput.value = s.email || "";
    document.getElementById("staffPhone").value = s.phone || "";
    document.getElementById("staffSubject").value = s.subject || "";
    document.getElementById("staffNote").value = s.note || "";
    emailInput.readOnly = true;
    document.getElementById("staffEmailHint").style.display = "block";
    modal.dataset.editingId = id;
  } else {
    STAFF_FORM_IDS.forEach((fid) => (document.getElementById(fid).value = ""));
    document.getElementById("staffModalTitle").textContent = "เพิ่มบุคลากร";
    emailInput.readOnly = false;
    document.getElementById("staffEmailHint").style.display = "none";
    delete modal.dataset.editingId;
  }
  modal.classList.add("open");
}

function closeStaffModal() {
  document.getElementById("staffModal").classList.remove("open");
}

async function saveStaffModal() {
  const name = document.getElementById("staffName").value.trim();
  const email = document.getElementById("staffEmail").value.trim().toLowerCase();
  const position = document.getElementById("staffPosition").value.trim();
  const department = document.getElementById("staffDept").value.trim();
  const phone = document.getElementById("staffPhone").value.trim();
  const subject = document.getElementById("staffSubject").value.trim();
  const note = document.getElementById("staffNote").value.trim();

  if (!name) return showToast("กรุณากรอกชื่อ-นามสกุล", "error");
  if (!validEmail(email)) return showToast("กรุณากรอกอีเมล @" + ALLOWED_DOMAIN + " ให้ถูกต้อง", "error");

  const btn = document.getElementById("staffSaveBtn");
  btn.disabled = true;
  try {
    await db.collection("staff").doc(email).set({
      name, position, department, email, phone, subject, note,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    showToast("บันทึกแล้ว", "success");
    closeStaffModal();
    loadStaff();
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ", "error");
  } finally {
    btn.disabled = false;
  }
}

async function deleteStaff(id) {
  const s = staffCache.find((x) => x.id === id);
  if (!confirm(`ลบข้อมูลของ ${s ? s.name : id} ใช่หรือไม่?`)) return;
  try {
    await db.collection("staff").doc(id).delete();
    showToast("ลบแล้ว", "success");
    loadStaff();
  } catch (err) {
    console.error(err);
    showToast("ลบไม่สำเร็จ", "error");
  }
}

/* ── ตั้งสิทธิ์การใช้งาน (permissions) จากหน้าบุคลากรโดยตรง ── */
let roleModalEmail = null;

async function openRoleModal(email) {
  const s = staffCache.find((x) => x.email === email);
  if (!s) return;
  roleModalEmail = email;
  document.getElementById("roleModalWho").textContent = `${s.name} — ${email}`;

  await populateRoleDeptSelect();

  const perm = permissionsMap[email];
  document.getElementById("roleSelect").value = perm ? perm.role : "";
  document.getElementById("roleDeptSelect").value = (perm && perm.department) || s.department || "";
  toggleRoleDeptField();

  document.getElementById("roleModal").classList.add("open");
}

async function populateRoleDeptSelect() {
  const deptSnap = await db.collection("settings").doc("departments").get();
  const departments = (deptSnap.exists && deptSnap.data().departments) || DEFAULT_DEPARTMENTS;
  document.getElementById("roleDeptSelect").innerHTML = departments.map((d) => `<option>${escapeHtml(d)}</option>`).join("");
}

function toggleRoleDeptField() {
  const show = document.getElementById("roleSelect").value === "dept_teacher";
  document.getElementById("roleDeptField").style.display = show ? "block" : "none";
}
document.getElementById("roleSelect").addEventListener("change", toggleRoleDeptField);

function closeRoleModal() {
  document.getElementById("roleModal").classList.remove("open");
  roleModalEmail = null;
}

async function saveRoleModal() {
  const email = roleModalEmail;
  if (!email) return;
  const role = document.getElementById("roleSelect").value;

  const btn = document.getElementById("roleSaveBtn");
  btn.disabled = true;
  try {
    if (!role) {
      await db.collection("permissions").doc(email).delete();
      showToast("ยกเลิกสิทธิ์พิเศษแล้ว", "success");
    } else {
      const data = { role, addedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (role === "dept_teacher") data.department = document.getElementById("roleDeptSelect").value;
      await db.collection("permissions").doc(email).set(data);
      showToast("ตั้งสิทธิ์แล้ว", "success");
    }
    closeRoleModal();
    refreshStaffRoles();
    loadDeptTeachers();
    loadGuidanceTeachers();
  } catch (err) {
    console.error(err);
    showToast("ตั้งสิทธิ์ไม่สำเร็จ", "error");
  } finally {
    btn.disabled = false;
  }
}

/* นำเข้า/ส่งออก CSV — หัวคอลัมน์ต้องเป็นภาษาไทยตามฟอร์แมตนี้ (ลำดับคอลัมน์สลับกันได้):
   ชื่อ-นามสกุล, ตำแหน่ง, กลุ่มงาน, อีเมล, เบอร์โทร, วิชาที่สอน, หมายเหตุ */
const STAFF_CSV_COLUMNS = { name: "ชื่อ-นามสกุล", position: "ตำแหน่ง", department: "กลุ่มงาน", email: "อีเมล", phone: "เบอร์โทร", subject: "วิชาที่สอน", note: "หมายเหตุ" };

async function importStaffCsv(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return showToast("ไฟล์ไม่มีข้อมูล หรืออ่านไม่ได้", "error");

  const header = rows[0].map((h) => h.trim());
  const idx = {};
  for (const key in STAFF_CSV_COLUMNS) idx[key] = header.indexOf(STAFF_CSV_COLUMNS[key]);
  if (idx.name === -1 || idx.email === -1) {
    return showToast("ไฟล์ CSV ต้องมีคอลัมน์ 'ชื่อ-นามสกุล' และ 'อีเมล' อย่างน้อย", "error");
  }

  const dataRows = rows.slice(1);
  const validRows = [];
  let skipped = 0;
  dataRows.forEach((r) => {
    const email = (r[idx.email] || "").trim().toLowerCase();
    const name = (r[idx.name] || "").trim();
    if (!email || !name) { skipped++; return; }
    validRows.push({
      name,
      position: idx.position > -1 ? (r[idx.position] || "").trim() : "",
      department: idx.department > -1 ? (r[idx.department] || "").trim() : "",
      email,
      phone: idx.phone > -1 ? (r[idx.phone] || "").trim() : "",
      subject: idx.subject > -1 ? (r[idx.subject] || "").trim() : "",
      note: idx.note > -1 ? (r[idx.note] || "").trim() : "",
    });
  });

  if (!validRows.length) return showToast("ไม่พบแถวข้อมูลที่ใช้ได้ในไฟล์", "error");

  try {
    const CHUNK = 400; // เผื่อ margin จากลิมิต batch write 500 รายการของ Firestore
    for (let i = 0; i < validRows.length; i += CHUNK) {
      const batch = db.batch();
      validRows.slice(i, i + CHUNK).forEach((data) => {
        batch.set(db.collection("staff").doc(data.email), { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }
    showToast(`นำเข้าสำเร็จ ${validRows.length} รายการ${skipped ? ` (ข้าม ${skipped} แถวที่ไม่มีชื่อ/อีเมล)` : ""}`, "success");
    loadStaff();
  } catch (err) {
    console.error(err);
    showToast("นำเข้าไม่สำเร็จ", "error");
  }
}

function exportStaffCsv() {
  if (!staffCache.length) return showToast("ไม่มีข้อมูลให้ส่งออก", "error");
  const header = Object.values(STAFF_CSV_COLUMNS);
  const rows = staffCache.map((s) => [s.name, s.position, s.department, s.email, s.phone, s.subject, s.note]);
  downloadCsv(`np-tcas-verified-บุคลากร-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
}

/** แปลงข้อความ CSV เป็น array ของแถว รองรับฟิลด์ที่ครอบด้วย " " (มีจุลภาค/ขึ้นบรรทัดใหม่ในฟิลด์ได้) */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM ถ้ามี
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\r") {
      // ข้าม — จัดการตอนเจอ \n
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
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
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str ?? "").replace(/'/g, "\\'");
}
