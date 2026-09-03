lucide.createIcons();
const overlay = document.getElementById("loadingOverlay");

// ถ้าล็อกอินค้างอยู่แล้ว ให้เด้งไปหน้าที่ถูกต้องตาม role ทันที ไม่ต้องกดปุ่มซ้ำ
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    overlay.style.display = "none";
    return;
  }
  const ctx = await resolveUserContext(user);
  if (ctx.role === "unauthorized") {
    await auth.signOut();
    overlay.style.display = "none";
    showToast("บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน (ต้องเป็นอีเมล @" + ALLOWED_DOMAIN + ")", "error");
    return;
  }
  const target = routeForRole(ctx);
  if (!target) {
    await auth.signOut();
    overlay.style.display = "none";
    showToast("บัญชีนี้มีสิทธิ์ที่ระบบไม่รู้จัก (role ผิดรูปแบบใน permissions) กรุณาแจ้งผู้ดูแลระบบ", "error");
    return;
  }
  window.location.href = target;
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    overlay.style.display = "flex";
    await signInWithGoogle();
    // onAuthStateChanged ด้านบนจะรับช่วงเปลี่ยนหน้าต่อเอง
  } catch (err) {
    overlay.style.display = "none";
    if (err.code !== "auth/popup-closed-by-user") {
      console.error(err);
      showToast("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
   โซนโชว์ผลงาน — 20 รายการล่าสุดที่ครูกลุ่มสาระรับรองแล้ว (สถานะ
   dept_confirmed ขึ้นไป คือ dept_confirmed หรือ guidance_confirmed)
   แสดงแบบ public ไม่ต้องล็อกอิน จึงต้องเปิด read ให้เฉพาะสถานะนี้ไว้ใน
   firestore.rules ด้วย (ดูหมายเหตุใน rules)
   ═══════════════════════════════════════════════════════════════ */
loadShowcase();

async function loadShowcase() {
  const loadingEl = document.getElementById("showcaseLoading");
  const emptyEl = document.getElementById("showcaseEmpty");
  const countEl = document.getElementById("showcaseCount");
  const grid = document.getElementById("showcaseGrid");

  try {
    const snap = await db
      .collection("activities")
      .where("status", "in", ["dept_confirmed", "guidance_confirmed"])
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    loadingEl.style.display = "none";

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!items.length) {
      emptyEl.style.display = "block";
      return;
    }

    countEl.textContent = "ล่าสุด " + items.length + " รายการ";
    countEl.style.display = "inline-flex";

    items.forEach((a) => grid.appendChild(showcaseCard(a)));
    lucide.createIcons();
  } catch (err) {
    console.error(err);
    loadingEl.style.display = "none";
    emptyEl.querySelector("div:last-child").textContent = "โหลดผลงานล่าสุดไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง";
    emptyEl.style.display = "block";
  }
}

function showcaseCard(a) {
  const card = document.createElement("div");
  card.className = "cert-card";

  const thumbSrc = a.certificateFileId ? `https://drive.google.com/thumbnail?id=${a.certificateFileId}&sz=w500` : null;
  const studentMeta = [a.studentLevel, a.studentRoom].filter(Boolean).join("/");

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
      ${a.department ? `<span class="role-tag dept cert-dept">${escapeHtml(a.department)}</span>` : ""}
      ${a.type ? `<div class="cert-type">${escapeHtml(a.type)}</div>` : ""}
      <div class="cert-title">${escapeHtml(a.title)}</div>
      ${recordDetailLine(a) ? `<div class="cert-detail">${escapeHtml(recordDetailLine(a))}</div>` : ""}
      <div class="cert-student">
        <i data-lucide="user" style="width:12px;height:12px;color:var(--text3)"></i>
        ${escapeHtml(a.studentName || "ไม่ระบุชื่อ")}
        ${studentMeta ? `<span class="dim">· ${escapeHtml(studentMeta)}</span>` : ""}
      </div>
      <div class="cert-footer">
        <span class="cert-date">${escapeHtml(a.eventDate || "")}</span>
        ${
          a.certificateUrl
            ? `<a class="cert-link" href="${a.certificateUrl}" target="_blank" rel="noopener"><i data-lucide="external-link" style="width:12px;height:12px"></i>เปิดไฟล์</a>`
            : ""
        }
      </div>
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
