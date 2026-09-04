lucide.createIcons();

// สถานะที่ถือว่า "ยืนยันแล้ว" (โผล่ในแฟ้มผลงาน) — ใช้ชุดเดียวกับ student-portfolio.js
const PORTFOLIO_STATUSES = ["dept_confirmed", "guidance_confirmed"];
// สถานะที่ถือว่า "ยังรอดำเนินการ" ต้องติดตามต่อ
const PENDING_STATUSES = ["submitted", "dept_confirmed", "revision"];

let allActivities = [];
let currentProfile = null;
let currentUser = null;

guardPage(["student", "admin"], (ctx) => {
  if (ctx.role === "admin") renderAdminViewSwitch("dashboard.html");
  currentUser = ctx.user;

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

  currentProfile = ctx.profile;
  document.getElementById("userLabel").textContent = ctx.profile.firstName + " " + ctx.profile.lastName;
  loadActivities(ctx.user.uid);

  initSubmitModal(ctx, { onSubmitted: () => loadActivities(ctx.user.uid) });
});

async function loadActivities(uid) {
  try {
    const snap = await db.collection("activities")
      .where("studentUid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();
    allActivities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  } catch (err) {
    console.error(err);
    showToast("โหลดข้อมูลไม่สำเร็จ", "error");
  }
}

function renderAll() {
  renderProfileCard();
  renderStats();
  renderPending();
  renderCertified();
}

function renderProfileCard() {
  const p = currentProfile;
  const el = document.getElementById("profileCard");
  const photo = currentUser.photoURL;
  el.innerHTML = `
    ${
      photo
        ? `<img class="profile-avatar" src="${photo}" alt="รูปโปรไฟล์">`
        : `<div class="profile-avatar" style="display:flex;align-items:center;justify-content:center;"><i data-lucide="user" style="width:28px;height:28px"></i></div>`
    }
    <div>
      <div class="profile-name">สวัสดี ${escapeHtml((p.prefix || "") + p.firstName + " " + p.lastName)}</div>
      <div class="profile-meta">
        ${p.studentId ? `<span>รหัสนักเรียน ${escapeHtml(p.studentId)}</span>` : ""}
        ${p.level ? `<span>· ระดับชั้น ${escapeHtml(p.level)}</span>` : ""}
        ${p.room ? `<span>· ห้อง ${escapeHtml(p.room)}</span>` : ""}
        ${p.track ? `<span>· กลุ่มการเรียน ${escapeHtml(p.track)}</span>` : ""}
      </div>
    </div>`;
  lucide.createIcons();
}

function renderStats() {
  const counts = { submitted: 0, dept_confirmed: 0, guidance_confirmed: 0, revision: 0 };
  allActivities.forEach((a) => { if (counts[a.status] !== undefined) counts[a.status]++; });

  const cards = [
    { key: "submitted", cls: "submitted", icon: "clock", label: STATUS_META.submitted.label, count: counts.submitted },
    { key: "dept_confirmed", cls: "dept", icon: "user-check", label: STATUS_META.dept_confirmed.label, count: counts.dept_confirmed },
    { key: "guidance_confirmed", cls: "done", icon: "check-circle-2", label: STATUS_META.guidance_confirmed.label, count: counts.guidance_confirmed },
    { key: "revision", cls: "revise", icon: "rotate-ccw", label: STATUS_META.revision.label, count: counts.revision },
  ];

  const grid = document.getElementById("statGrid");
  grid.innerHTML = cards.map((c) => `
    <a class="stat-card ${c.cls}" href="student-history.html">
      <div class="stat-icon"><i data-lucide="${c.icon}" style="width:18px;height:18px"></i></div>
      <div class="stat-count">${c.count}</div>
      <div class="stat-label">${escapeHtml(c.label)}</div>
    </a>`).join("");
  lucide.createIcons();
}

function renderPending() {
  const pending = allActivities
    .filter((a) => PENDING_STATUSES.includes(a.status))
    .sort((a, b) => dateVal(b) - dateVal(a))
    .slice(0, 8);

  const list = document.getElementById("pendingList");
  const empty = document.getElementById("pendingEmpty");
  list.innerHTML = "";
  empty.style.display = pending.length ? "none" : "block";

  pending.forEach((a) => {
    const row = document.createElement("div");
    row.className = "pending-item";
    row.innerHTML = `
      <div>
        <div class="pending-item-title">${escapeHtml(a.title)}</div>
        <div class="pending-item-sub">ประเภท: ${escapeHtml(a.type || "")} · ยื่นเมื่อ ${formatDate(a.createdAt)}</div>
        ${a.status === "revision" && a.revisionReason ? `<div class="pending-item-reason">เหตุผลตีกลับ: ${escapeHtml(a.revisionReason)}</div>` : ""}
      </div>
      <div>${statusBadgeHtml(a.status)}</div>`;
    list.appendChild(row);
  });
  lucide.createIcons();
}

function renderCertified() {
  const certified = allActivities
    .filter((a) => PORTFOLIO_STATUSES.includes(a.status))
    .sort((a, b) => dateVal(b) - dateVal(a))
    .slice(0, 4);

  const grid = document.getElementById("miniCertGrid");
  const empty = document.getElementById("certifiedEmpty");
  grid.innerHTML = "";
  empty.style.display = certified.length ? "none" : "block";

  certified.forEach((a) => {
    const card = document.createElement("a");
    card.className = "mini-cert";
    card.href = "student-portfolio.html";
    card.innerHTML = `
      <div class="mini-cert-title">${escapeHtml(a.title)}</div>
      <div class="mini-cert-sub">${escapeHtml(a.department || "")}${a.department ? " · " : ""}${escapeHtml(a.eventDate || "")}</div>
      ${statusBadgeHtml(a.status)}`;
    grid.appendChild(card);
  });
  lucide.createIcons();
}

function dateVal(a) {
  return a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
