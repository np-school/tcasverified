lucide.createIcons();
let ctxGlobal = null;
let pendingRejectId = null;

guardPage(["dept_teacher"], (ctx) => {
  ctxGlobal = ctx;
  document.getElementById("userLabel").textContent = ctx.user.email;
  document.getElementById("deptLabel").textContent = "ครูประจำกลุ่มสาระ" + (ctx.department ? " · " + ctx.department : "");
  loadPending();
  loadDone();
});

document.querySelectorAll(".sidebar-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-btn[data-tab]").forEach((b) => b.classList.remove("active", "staff"));
    btn.classList.add("active", "staff");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

async function loadPending() {
  try {
    const snap = await db.collection("activities")
      .where("status", "==", "submitted")
      .where("department", "==", ctxGlobal.department)
      .orderBy("createdAt", "asc")
      .get();

    const body = document.getElementById("pendingBody");
    body.innerHTML = "";
    document.getElementById("pendingCount").textContent = snap.size ? `(${snap.size})` : "";
    document.getElementById("pendingEmpty").style.display = snap.size ? "none" : "block";

    snap.forEach((doc) => {
      const a = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div style="font-weight:700;">${escapeHtml(a.studentName)}</div><div style="color:var(--text3);font-size:12px;">${escapeHtml(a.studentLevel)} ${escapeHtml(a.studentRoom)}</div></td>
        <td>${escapeHtml(a.title)}</td>
        <td style="color:var(--text2);">${formatDate(a.createdAt)}</td>
        <td><a href="${a.certificateUrl}" target="_blank" style="color:var(--accent);font-weight:700;display:flex;align-items:center;gap:5px;"><i data-lucide="file-text" style="width:14px;height:14px"></i>ดูไฟล์</a></td>
        <td><div style="display:flex;gap:8px;">
          <button class="btn-approve" onclick="approveActivity('${doc.id}')"><i data-lucide="check" style="width:13px;height:13px"></i>ยืนยัน</button>
          <button class="btn-reject" onclick="openRejectModal('${doc.id}')"><i data-lucide="x" style="width:13px;height:13px"></i>ตีกลับ</button>
        </div></td>`;
      body.appendChild(tr);
    });
    lucide.createIcons();
  } catch (err) {
    console.error(err);
    showToast("โหลดรายการรอตรวจสอบไม่สำเร็จ", "error");
  }
}

async function loadDone() {
  try {
    const snap = await db.collection("activities")
      .where("deptReviewerEmail", "==", ctxGlobal.user.email)
      .orderBy("deptReviewedAt", "desc")
      .limit(100)
      .get();

    const body = document.getElementById("doneBody");
    body.innerHTML = "";
    document.getElementById("doneEmpty").style.display = snap.size ? "none" : "block";

    snap.forEach((doc) => {
      const a = doc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(a.studentName)}</td>
        <td>${escapeHtml(a.title)}</td>
        <td>${statusBadgeHtml(a.status)}</td>
        <td style="color:var(--text2);">${formatDate(a.deptReviewedAt)}</td>`;
      body.appendChild(tr);
    });
    lucide.createIcons();
  } catch (err) {
    console.error(err);
  }
}

async function approveActivity(id) {
  try {
    await db.collection("activities").doc(id).update({
      status: "dept_confirmed",
      deptReviewerEmail: ctxGlobal.user.email,
      deptReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("ยืนยันแล้ว ส่งต่อครูแนะแนวเรียบร้อย", "success");
    loadPending();
    loadDone();
  } catch (err) {
    console.error(err);
    showToast("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

function openRejectModal(id) {
  pendingRejectId = id;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectModal").classList.add("open");
}
function closeRejectModal() {
  document.getElementById("rejectModal").classList.remove("open");
  pendingRejectId = null;
}
async function confirmReject() {
  const reason = document.getElementById("rejectReason").value.trim();
  if (!reason) {
    showToast("กรุณาระบุเหตุผลที่ตีกลับ", "error");
    return;
  }
  try {
    await db.collection("activities").doc(pendingRejectId).update({
      status: "revision",
      revisionReason: reason,
      deptReviewerEmail: ctxGlobal.user.email,
      deptReviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("ตีกลับรายการแล้ว", "success");
    closeRejectModal();
    loadPending();
    loadDone();
  } catch (err) {
    console.error(err);
    showToast("ตีกลับไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
