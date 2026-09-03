/* ═══════════════════════════════════════════════════════════════
   shared/firebase-init.js
   ⚠️ ต้องแก้ก่อนใช้งานจริง: ใส่ค่า config จากโปรเจกต์ Firebase ของคุณ
   (Firebase Console → Project settings → General → Your apps → SDK setup)
   ระบบนี้ตั้งใจให้ "แยกโปรเจกต์ Firebase" ต่างหากจากระบบ NP Origins เดิม
   ไม่ใช้ config ชุดเดียวกัน เพื่อไม่ให้ฐานข้อมูล/สิทธิ์ปนกัน
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyCUb3sghtw67uETaW_bokj7wVYi1vUj2hk",
  authDomain: "np-tcasverified.firebaseapp.com",
  projectId: "np-tcasverified",
  storageBucket: "np-tcasverified.firebasestorage.app",
  messagingSenderId: "1046291797340",
  appId: "1:1046291797340:web:d4a1023810adfad25bdd99",
  measurementId: "G-QP63ERT6D3"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// โดเมนอีเมลที่อนุญาตให้เข้าระบบ (Google Workspace ของโรงเรียน)
const ALLOWED_DOMAIN = "nongki.ac.th";

// ปีการศึกษาปัจจุบัน (พ.ศ.) — ใช้เป็นค่าเริ่มต้นในฟอร์ม/ตัวกรอง
// TODO: ปรับเป็นดึงจาก settings/academic ในอนาคตถ้าต้องการสลับปีอัตโนมัติตามปฏิทิน
const CURRENT_ACADEMIC_YEAR = 2569;

// ⚠️ ต้องแก้หลัง deploy Cloud Function แล้ว (ดู functions-drive-upload/DEPLOY.md)
// ใช้อัปโหลดเกียรติบัตรเข้าโฟลเดอร์ Google Drive กลางของโรงเรียน แทน Firebase Storage
const DRIVE_UPLOAD_URL = "https://upload-certificate-1046291797340.asia-southeast3.run.app";
