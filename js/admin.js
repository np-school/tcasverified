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
  loadDeptTeachers();
  loadGuidanceTeachers();
  loadAcademic();
  loadLists();
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
  } catch (err) { console.error(err); showToast("เพิ่มไม่สำเร็จ", "error"); }
}

async function removePermission(email, reload) {
  if (!confirm(`ยกเลิกสิทธิ์ของ ${email} ใช่หรือไม่?`)) return;
  try {
    await db.collection("permissions").doc(email).delete();
    showToast("ยกเลิกสิทธิ์แล้ว", "success");
    reload();
  } catch (err) { console.error(err); showToast("ยกเลิกไม่สำเร็จ", "error"); }
}

function validEmail(email) {
  return email.endsWith("@" + ALLOWED_DOMAIN) && email.length > ("@" + ALLOWED_DOMAIN).length;
}

/* ── ห้องเรียน/กลุ่มการเรียน ── */
async function loadAcademic() {
  const snap = await db.collection("settings").doc("academic").get();
  const data = snap.exists ? { ...DEFAULT_ACADEMIC, ...snap.data() } : DEFAULT_ACADEMIC;
  document.getElementById("academicLevels").value = data.levels.join("\n");
  document.getElementById("academicTracks").value = data.tracks.join("\n");
  const roomLines = data.levels.map((lvl) => `${lvl} = ${(data.roomsPerLevel[lvl] || []).join(",")}`);
  document.getElementById("academicRooms").value = roomLines.join("\n");
}

async function saveAcademic() {
  const levels = linesToArray(document.getElementById("academicLevels").value);
  const tracks = linesToArray(document.getElementById("academicTracks").value);
  const roomsPerLevel = {};
  linesToArray(document.getElementById("academicRooms").value).forEach((line) => {
    const [lvl, rooms] = line.split("=").map((s) => s.trim());
    if (lvl) roomsPerLevel[lvl] = (rooms || "").split(",").map((r) => r.trim()).filter(Boolean);
  });
  try {
    await db.collection("settings").doc("academic").set({ levels, tracks, roomsPerLevel }, { merge: false });
    showToast("บันทึกแล้ว", "success");
  } catch (err) { console.error(err); showToast("บันทึกไม่สำเร็จ", "error"); }
}

/* ── หัวข้อ/กลุ่มสาระ ── */
async function loadLists() {
  const [typesSnap, deptSnap] = await Promise.all([
    db.collection("settings").doc("activityTypes").get(),
    db.collection("settings").doc("departments").get(),
  ]);
  document.getElementById("activityTypesList").value = ((typesSnap.exists && typesSnap.data().types) || DEFAULT_ACTIVITY_TYPES).join("\n");
  document.getElementById("departmentsList").value = ((deptSnap.exists && deptSnap.data().departments) || DEFAULT_DEPARTMENTS).join("\n");
}

async function saveLists() {
  const types = linesToArray(document.getElementById("activityTypesList").value);
  const departments = linesToArray(document.getElementById("departmentsList").value);
  try {
    await Promise.all([
      db.collection("settings").doc("activityTypes").set({ types }),
      db.collection("settings").doc("departments").set({ departments }),
    ]);
    showToast("บันทึกแล้ว", "success");
    loadDeptTeachers(); // รีเฟรช dropdown กลุ่มสาระให้ตรงของใหม่
  } catch (err) { console.error(err); showToast("บันทึกไม่สำเร็จ", "error"); }
}

function linesToArray(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
