lucide.createIcons();
let allActivities = [];

guardPage(["student", "admin"], (ctx) => {
  if (ctx.role === "admin") renderAdminViewSwitch("student-history.html");

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
  buildYearFilter();
  loadActivities(ctx.user.uid);
});

function buildYearFilter() {
  const el = document.getElementById("yearFilter");
  el.innerHTML = "";
  // แสดงย้อนหลัง 3 ปีการศึกษา + ตัวเลือก "ทุกปี"
  for (let y = CURRENT_ACADEMIC_YEAR; y >= CURRENT_ACADEMIC_YEAR - 2; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = "ปีการศึกษา " + y;
    el.appendChild(opt);
  }
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "ทุกปี";
  el.appendChild(optAll);

  el.addEventListener("change", render);
  document.getElementById("statusFilter").addEventListener("change", render);
}

async function loadActivities(uid) {
  try {
    const snap = await db.collection("activities")
      .where("studentUid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();
    allActivities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  } catch (err) {
    console.error(err);
    showToast("โหลดข้อมูลไม่สำเร็จ", "error");
  }
}

function render() {
  const year = document.getElementById("yearFilter").value;
  const status = document.getElementById("statusFilter").value;
  const filtered = allActivities.filter(
    (a) => (!year || String(a.year) === String(year)) && (!status || a.status === status)
  );

  const list = document.getElementById("list");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";
  empty.style.display = filtered.length ? "none" : "block";

  filtered.forEach((a) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-weight:700;font-size:14.5px;">${escapeHtml(a.title)}</div>
          <div style="color:var(--text2);font-size:12.5px;margin-top:2px;">ประเภท: ${escapeHtml(a.type)} · ยื่นเมื่อ ${formatDate(a.createdAt)}</div>
          ${statusTrackHtml(a.status)}
          ${a.status === "revision" && a.revisionReason ? `<div style="font-size:12px;color:var(--c-red-deep);margin-top:6px;">เหตุผลตีกลับ: ${escapeHtml(a.revisionReason)}</div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          ${statusBadgeHtml(a.status)}
          ${a.certificateUrl ? `<a href="${a.certificateUrl}" target="_blank" style="font-size:12px;color:var(--accent);font-weight:700;display:flex;align-items:center;gap:4px;"><i data-lucide="file-text" style="width:13px;height:13px"></i>ดูเกียรติบัตร</a>` : ""}
        </div>
      </div>`;
    list.appendChild(card);
  });
  lucide.createIcons();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
