/* ═══════════════════════════════════════════════════════════════
   functions-drive-upload/index.js
   Cloud Function (HTTP, 2nd gen) — อัปโหลดไฟล์เกียรติบัตรเข้าโฟลเดอร์ Google Drive
   กลางของโรงเรียน โดยใช้ service account เป็นคนเขียนไฟล์แทนผู้ใช้

   วิธี deploy: ดู DEPLOY.md ในโฟลเดอร์นี้ (ทำผ่าน Google Cloud Console ล้วนๆ ไม่ต้องใช้ CLI)
   ═══════════════════════════════════════════════════════════════ */

const admin = require("firebase-admin");
const { google } = require("googleapis");
const { Readable } = require("stream");

admin.initializeApp();

const ALLOWED_DOMAIN = "nongki.ac.th";
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // ตั้งค่าตอน deploy (ดู DEPLOY.md)
const SERVICE_ACCOUNT_KEY = process.env.DRIVE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.DRIVE_SERVICE_ACCOUNT_KEY)
  : null;
const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6MB ดิบ (base64 แล้ว request จะโตขึ้น ~33%)

function driveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

function setCors(res) {
  // อนุญาตทุกโดเมนเรียกได้ — ปลอดภัยเพราะเราตรวจ Firebase ID token เองในฟังก์ชันอยู่แล้ว
  // ไม่ได้พึ่ง cookie/credentials ของเบราว์เซอร์
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

exports.uploadCertificate = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  if (!DRIVE_FOLDER_ID || !SERVICE_ACCOUNT_KEY) {
    console.error("ยังไม่ได้ตั้งค่า DRIVE_FOLDER_ID หรือ DRIVE_SERVICE_ACCOUNT_KEY");
    return res.status(500).json({ error: "server not configured" });
  }

  try {
    // ── 1. ตรวจว่าเป็นผู้ใช้ที่ล็อกอินด้วยอีเมลโรงเรียนจริง ──
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "missing token" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.email || !decoded.email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: "unauthorized domain" });
    }

    // ── 2. ตรวจไฟล์ที่ส่งมา ──
    const { fileName, mimeType, fileBase64 } = req.body || {};
    if (!fileName || !mimeType || !fileBase64) {
      return res.status(400).json({ error: "missing fields" });
    }
    if (!/^application\/pdf$|^image\//.test(mimeType)) {
      return res.status(400).json({ error: "unsupported file type" });
    }
    const buffer = Buffer.from(fileBase64, "base64");
    if (buffer.length > MAX_FILE_BYTES) {
      return res.status(400).json({ error: "file too large" });
    }

    // ── 3. อัปโหลดเข้าโฟลเดอร์กลางด้วย service account ──
    const drive = driveClient();
    const safeName = fileName.replace(/[\\/]/g, "_");
    const created = await drive.files.create({
      requestBody: {
        name: `${decoded.uid}_${Date.now()}_${safeName}`,
        parents: [DRIVE_FOLDER_ID],
      },
      media: { mimeType, body: Readable.from(buffer) },
      fields: "id, webViewLink",
      supportsAllDrives: true, // จำเป็นเมื่อ DRIVE_FOLDER_ID อยู่ใน Shared Drive
    });

    // ── 4. แชร์สิทธิ์อ่านให้ทุกคนในโดเมนโรงเรียน (ไม่เปิด public) ──
    await drive.permissions.create({
      fileId: created.data.id,
      requestBody: { type: "domain", domain: ALLOWED_DOMAIN, role: "reader" },
      supportsAllDrives: true, // จำเป็นเมื่อ DRIVE_FOLDER_ID อยู่ใน Shared Drive
    });

    return res.status(200).json({ fileId: created.data.id, url: created.data.webViewLink });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "upload failed" });
  }
};
