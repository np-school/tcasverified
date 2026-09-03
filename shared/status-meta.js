/* ═══════════════════════════════════════════════════════════════
   shared/status-meta.js
   สถานะกิจกรรม 4 แบบ ใช้ชุดเดียวกันทุกหน้า ไม่ให้สีความหมายเพี้ยนกันคนละหน้า
   ═══════════════════════════════════════════════════════════════ */

const STATUS_META = {
  submitted: { label: "รอครูกลุ่มสาระตรวจ", badgeClass: "submitted", icon: "clock", track: [1, 0, 0] },
  dept_confirmed: { label: "รอครูแนะแนวยืนยัน", badgeClass: "dept", icon: "user-check", track: [1, 1, 0] },
  guidance_confirmed: { label: "ยืนยันสมบูรณ์", badgeClass: "done", icon: "check-circle-2", track: [1, 1, 1] },
  revision: { label: "ตีกลับ ต้องแก้ไข", badgeClass: "revise", icon: "rotate-ccw", track: [1, 0, 0] },
};

function statusBadgeHtml(status) {
  const m = STATUS_META[status] || { label: status, badgeClass: "submitted", icon: "help-circle" };
  return `<span class="badge ${m.badgeClass}"><i data-lucide="${m.icon}" style="width:13px;height:13px"></i>${m.label}</span>`;
}

function statusTrackHtml(status) {
  const m = STATUS_META[status] || { track: [0, 0, 0] };
  const segClass = (i) => {
    if (!m.track[i]) return "seg";
    if (status === "revision" && i === 0) return "seg on red";
    if (i === 1) return "seg on sky";
    return "seg on";
  };
  return `<div class="track" style="width:200px;"><div class="${segClass(0)}"></div><div class="${segClass(1)}"></div><div class="${segClass(2)}"></div></div>`;
}
