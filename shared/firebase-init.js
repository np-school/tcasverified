/* ═══════════════════════════════════════════════════════════════
   shared/firebase-init.js
   ⚠️ ต้องแก้ก่อนใช้งานจริง: ใส่ค่า config จากโปรเจกต์ Firebase ของคุณ
   (Firebase Console → Project settings → General → Your apps → SDK setup)
   ระบบนี้ตั้งใจให้ "แยกโปรเจกต์ Firebase" ต่างหากจากระบบ NP Origins เดิม
   ไม่ใช้ config ชุดเดียวกัน เพื่อไม่ให้ฐานข้อมูล/สิทธิ์ปนกัน
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// โดเมนอีเมลที่อนุญาตให้เข้าระบบ (Google Workspace ของโรงเรียน)
const ALLOWED_DOMAIN = "nongki.ac.th";

// ปีการศึกษาปัจจุบัน (พ.ศ.) — ใช้เป็นค่าเริ่มต้นในฟอร์ม/ตัวกรอง
// TODO: ปรับเป็นดึงจาก settings/academic ในอนาคตถ้าต้องการสลับปีอัตโนมัติตามปฏิทิน
const CURRENT_ACADEMIC_YEAR = 2569;
