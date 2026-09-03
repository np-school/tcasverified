lucide.createIcons();

// เฉพาะสถานะที่ "ครูกลุ่มสาระ" รับรองแล้วขึ้นไปเท่านั้นที่ถือว่าเป็นผลงานยืนยันแล้ว
const PORTFOLIO_STATUSES = ["dept_confirmed", "guidance_confirmed"];

let allCertified = [];
let currentProfile = null;
let currentUser = null;

guardPage(["student", "admin"], (ctx) => {
  if (ctx.role === "admin") renderAdminViewSwitch("student-portfolio.html");
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
  loadCertified(ctx.user.uid);

  initSubmitModal(ctx, { onSubmitted: () => loadCertified(ctx.user.uid) });
});

async function loadCertified(uid) {
  try {
    const snap = await db.collection("activities").where("studentUid", "==", uid).get();
    allCertified = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => PORTFOLIO_STATUSES.includes(a.status))
      .sort((a, b) => (b.year || 0) - (a.year || 0) || dateVal(b) - dateVal(a));
    renderProfileCard();
    buildFilters();
    render();
  } catch (err) {
    console.error(err);
    showToast("โหลดข้อมูลแฟ้มผลงานไม่สำเร็จ", "error");
  }
}

function dateVal(a) {
  return a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
}

function renderProfileCard() {
  const p = currentProfile;
  const deptCount = new Set(allCertified.map((a) => a.department).filter(Boolean)).size;
  const el = document.getElementById("profileCard");
  const photo = currentUser.photoURL;
  el.innerHTML = `
    ${
      photo
        ? `<img class="profile-avatar" src="${photo}" alt="รูปโปรไฟล์">`
        : `<div class="profile-avatar" style="display:flex;align-items:center;justify-content:center;"><i data-lucide="user" style="width:28px;height:28px"></i></div>`
    }
    <div>
      <div class="profile-name">${escapeHtml((p.prefix || "") + p.firstName + " " + p.lastName)}</div>
      <div class="profile-meta">
        ${p.studentId ? `<span>รหัสนักเรียน ${escapeHtml(p.studentId)}</span>` : ""}
        ${p.level ? `<span>· ระดับชั้น ${escapeHtml(p.level)}</span>` : ""}
        ${p.room ? `<span>· ห้อง ${escapeHtml(p.room)}</span>` : ""}
        ${p.track ? `<span>· กลุ่มการเรียน ${escapeHtml(p.track)}</span>` : ""}
      </div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><b>${allCertified.length}</b><span>ผลงานที่รับรองแล้ว</span></div>
      <div class="profile-stat"><b>${deptCount}</b><span>กลุ่มสาระ</span></div>
    </div>
  `;
  lucide.createIcons();
}

function buildFilters() {
  const years = [...new Set(allCertified.map((a) => a.year).filter(Boolean))].sort((a, b) => b - a);
  const depts = [...new Set(allCertified.map((a) => a.department).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "th")
  );

  const yearEl = document.getElementById("yearFilter");
  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = "ปีการศึกษา " + y;
    yearEl.appendChild(opt);
  });

  const deptEl = document.getElementById("deptFilter");
  depts.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    deptEl.appendChild(opt);
  });

  yearEl.addEventListener("change", render);
  deptEl.addEventListener("change", render);
}

function render() {
  const yearFilter = document.getElementById("yearFilter").value;
  const deptFilter = document.getElementById("deptFilter").value;

  const filtered = allCertified.filter(
    (a) => (!yearFilter || String(a.year) === String(yearFilter)) && (!deptFilter || a.department === deptFilter)
  );

  const groupsEl = document.getElementById("groups");
  const emptyEl = document.getElementById("emptyState");
  groupsEl.innerHTML = "";
  emptyEl.style.display = filtered.length ? "none" : "block";
  if (!filtered.length) return;

  // จัดกลุ่ม: ปีการศึกษา (มาก→น้อย) → กลุ่มสาระ (เฉพาะที่มีข้อมูลจริง)
  const byYear = new Map();
  filtered.forEach((a) => {
    const y = a.year || "ไม่ระบุปี";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(a);
  });
  const sortedYears = [...byYear.keys()].sort((a, b) => (Number(b) || 0) - (Number(a) || 0));

  sortedYears.forEach((year) => {
    const items = byYear.get(year);
    const yearWrap = document.createElement("div");
    yearWrap.className = "year-group";
    yearWrap.innerHTML = `
      <div class="year-group-head">
        <i data-lucide="calendar" style="width:17px;height:17px;color:var(--accent)"></i>
        <div class="year-group-title">ปีการศึกษา ${escapeHtml(String(year))}</div>
        <div class="year-group-count">${items.length} รายการ</div>
      </div>
    `;

    const byDept = new Map();
    items.forEach((a) => {
      const dep = a.department || "ไม่ระบุกลุ่มสาระ";
      if (!byDept.has(dep)) byDept.set(dep, []);
      byDept.get(dep).push(a);
    });
    const sortedDepts = [...byDept.keys()].sort((a, b) => a.localeCompare(b, "th"));

    sortedDepts.forEach((dep) => {
      const deptItems = byDept.get(dep);
      const deptBlock = document.createElement("div");
      deptBlock.className = "dept-block";
      deptBlock.innerHTML = `
        <div class="dept-block-head">
          <i data-lucide="bookmark" style="width:14px;height:14px;color:var(--text3)"></i>
          <div class="dept-block-title">${escapeHtml(dep)}</div>
          <div class="dept-block-line"></div>
          <div style="font-size:11px;color:var(--text3);font-weight:700;">${deptItems.length} รายการ</div>
        </div>
        <div class="cert-grid"></div>
      `;
      const grid = deptBlock.querySelector(".cert-grid");
      deptItems.forEach((a) => grid.appendChild(certCard(a)));
      yearWrap.appendChild(deptBlock);
    });

    groupsEl.appendChild(yearWrap);
  });

  lucide.createIcons();
}

function certCard(a) {
  const card = document.createElement("div");
  card.className = "cert-card";

  const thumbSrc = a.certificateFileId ? `https://drive.google.com/thumbnail?id=${a.certificateFileId}&sz=w500` : null;
  const isGuidance = a.status === "guidance_confirmed";

  card.innerHTML = `
    <div class="cert-thumb-wrap">
      ${
        thumbSrc
          ? `<img src="${thumbSrc}" alt="ภาพเกียรติบัตร" loading="lazy" onerror="this.closest('.cert-thumb-wrap').innerHTML='<div class=\\'cert-thumb-fallback\\'><i data-lucide=\\'file-text\\' style=\\'width:26px;height:26px\\'></i><span>ดูไฟล์แนบ</span></div>';lucide.createIcons();">`
          : `<div class="cert-thumb-fallback"><i data-lucide="file-text" style="width:26px;height:26px"></i><span>ดูไฟล์แนบ</span></div>`
      }
      <div class="cert-thumb-badge">${statusBadgeHtml(a.status)}</div>
    </div>
    <div class="cert-body">
      <div class="cert-type">${escapeHtml(a.type || "")}</div>
      <div class="cert-title">${escapeHtml(a.title)}</div>
      ${recordDetailLine(a) ? `<div class="cert-detail">${escapeHtml(recordDetailLine(a))}</div>` : ""}
      <div class="cert-footer">
        <span class="cert-date">${escapeHtml(a.eventDate || "")}</span>
        ${
          a.certificateUrl
            ? `<a class="cert-link" href="${a.certificateUrl}" target="_blank" rel="noopener"><i data-lucide="external-link" style="width:12px;height:12px"></i>เปิดไฟล์</a>`
            : ""
        }
      </div>
      ${
        isGuidance
          ? ""
          : `<div style="font-size:10.5px;color:var(--c-sky-deep);display:flex;align-items:center;gap:4px;"><i data-lucide="user-check" style="width:11px;height:11px"></i>รับรองโดยครูกลุ่มสาระ${a.deptReviewerEmail ? " · " + escapeHtml(a.deptReviewerEmail) : ""}</div>`
      }
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
