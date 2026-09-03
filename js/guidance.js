lucide.createIcons();
let ctxGlobal = null;

guardPage(["guidance"], (ctx) => {
  ctxGlobal = ctx;
  document.getElementById("userLabel").textContent = ctx.user.email;
  buildYearOptions("allYearFilter");
  buildYearOptions("exportYearFilter");
  loadPending();
  document.getElementById("allYearFilter").addEventListener("change", loadAll);
  loadAll();
});

document.querySelectorAll(".sidebar-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-btn[data-tab]").forEach((b) => b.classList.remove("active", "staff"));
    btn.classList.add("active", "staff");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

function buildYearOptions(selectId) {
  const el = document.getElementById(selectId);
  for (let y = CURRENT_ACADEMIC_YEAR; y >= CURRENT_ACADEMIC_YEAR - 2; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = "ปีการศึกษา " + y;
    el.appendChild(opt);
  }
}

async function loadPending() {
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "dept_confirmed")
      .orderBy("deptReviewedAt", "asc")
      .get();

    const list = document.getElementById("pendingList");
    list.innerHTML = "";
    document.getElementById("pendingCount").textContent = snap.size ? `(${snap.size})` : "";
    document.getElementById("pendingEmpty").style.display = snap.size ? "none" : "block";

    snap.forEach((doc) => {
      const a = doc.data();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:14.5px;">${escapeHtml(a.title)}</div>
            <div style="color:var(--text2);font-size:12.5px;margin-top:3px;">นักเรียน: ${escapeHtml(a.studentName)} · ${escapeHtml(a.studentLevel)} ${escapeHtml(a.studentRoom)} · ประเภท: ${escapeHtml(a.type)}</div>
            <div style="color:var(--text2);font-size:12.5px;margin-top:2px;">ยืนยันโดยครูกลุ่มสาระ${escapeHtml(a.department || "")} · ${escapeHtml(a.deptReviewerEmail || "")} · ${formatDate(a.deptReviewedAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
            <a href="${a.certificateUrl}" target="_blank" style="color:var(--accent);font-weight:700;font-size:12.5px;display:flex;align-items:center;gap:5px;"><i data-lucide="file-text" style="width:14px;height:14px"></i>ดูเกียรติบัตร</a>
            <button class="btn-approve" onclick="finalApprove('${doc.id}')"><i data-lucide="badge-check" style="width:13px;height:13px"></i>ยืนยันขั้นสุดท้าย</button>
          </div>
        </div>`;
      list.appendChild(card);
    });
    lucide.createIcons();
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
  } catch (err) {
    console.error(err);
    showToast("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

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
        <td style="color:var(--text2);">${formatDate(a.guidanceReviewedAt)}</td>`;
      body.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("exportBtn").addEventListener("click", async () => {
  const year = document.getElementById("exportYearFilter").value;
  const btn = document.getElementById("exportBtn");
  btn.disabled = true;
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "guidance_confirmed")
      .where("year", "==", Number(year))
      .orderBy("studentRoom")
      .get();

    if (snap.empty) {
      showToast("ไม่มีข้อมูลในปีการศึกษาที่เลือก", "error");
      return;
    }

    const header = ["ชื่อ-สกุล", "ชั้น", "ห้อง", "ชื่อกิจกรรม", "ประเภท", "กลุ่มสาระ", "วันที่จัดกิจกรรม", "ผู้ยืนยันครูกลุ่มสาระ", "ผู้ยืนยันครูแนะแนว"];
    const rows = [header];
    snap.forEach((doc) => {
      const a = doc.data();
      rows.push([a.studentName, a.studentLevel, a.studentRoom, a.title, a.type, a.department, a.eventDate, a.deptReviewerEmail, a.guidanceReviewerEmail]);
    });

    const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `np-tcas-verified-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    showToast("ส่งออกไม่สำเร็จ", "error");
  } finally {
    btn.disabled = false;
  }
});

function csvEscape(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
