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
