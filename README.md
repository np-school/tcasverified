# NP-TCAS Verified

ระบบส่ง/ยืนยันรายงานกิจกรรม อบรม และเกียรติบัตรของนักเรียน — แยกโปรเจกต์ ฐานข้อมูล
และโค้ดออกจากระบบ NP Origins เดิมโดยสิ้นเชิง (ใช้แค่ชุดดีไซน์เดียวกัน)

## หน้าทั้งหมด (แยกไฟล์ตามสิทธิ์)

| ไฟล์ | ใครเข้าได้ | ทำอะไร |
|---|---|---|
| `index.html` | ทุกคน | ล็อกอิน Google แล้วพาไปหน้าที่ถูกต้องตาม role อัตโนมัติ |
| `onboarding.html` | นักเรียน (ล็อกอินครั้งแรก) | กรอกข้อมูลส่วนตัว |
| `student-history.html` | นักเรียน | ดูประวัติ/สถานะกิจกรรมย้อนหลังทุกปี |
| _(modal)_ `shared/submit-modal.js` | นักเรียน | ฟอร์ม "ส่งกิจกรรมใหม่" + แนบเกียรติบัตร — เปิดเป็น modal จากหน้า `student-history.html`/`student-portfolio.html` ไม่ใช่หน้าแยกอีกต่อไป (`student-submit.html` เดิมเหลือไว้เป็นแค่ตัวรีไดเรกต์สำหรับลิงก์เก่า) |
| `student-portfolio.html` | นักเรียน | แฟ้มผลงาน — แสดงเฉพาะรายการที่ครูกลุ่มสาระรับรองแล้ว (`dept_confirmed`/`guidance_confirmed`) พร้อมภาพเกียรติบัตรอย่างย่อ แยกตามปีการศึกษาและกลุ่มสาระ |
| `teacher-review.html` | ครูประจำกลุ่มสาระ | ตรวจสอบ/ยืนยัน/ตีกลับ เฉพาะกลุ่มสาระของตัวเอง |
| `guidance.html` | ครูแนะแนว | ยืนยันขั้นสุดท้าย + ส่งออก CSV |
| `admin.html` | เจ้าหน้าที่/แอดมิน | เพิ่ม-ลบสิทธิ์ครู, ตั้งค่าห้องเรียน/กลุ่มการเรียน/ประเภทกิจกรรม |

ทุกหน้าโหลด `shared/firebase-init.js` + `shared/auth-guard.js` เหมือนกัน แล้วเรียก
`guardPage(['role ที่อนุญาต'], callback)` เพื่อเช็คสิทธิ์ก่อนแสดงเนื้อหา — ถ้า role ไม่ตรง
จะถูกเด้งไปหน้าเข้าใช้งานที่ถูกต้องอัตโนมัติ

## โครงสร้างข้อมูล (Firestore)

```
permissions/{email}        → { role: 'admin' | 'dept_teacher' | 'guidance', department?: string }
students/{uid}              → { prefix, firstName, lastName, nationalId, level, room, track, studentId, email }
activities/{id}              → {
  studentUid, studentName, studentLevel, studentRoom, studentTrack,
  title, type, department, eventDate, year,
  certificateUrl, certificateFileId, certificateFileName,
  status: 'submitted' | 'dept_confirmed' | 'guidance_confirmed' | 'revision',
  revisionReason, deptReviewerEmail, deptReviewedAt,
  guidanceReviewerEmail, guidanceReviewedAt, createdAt
}
settings/academic            → { levels: string[], roomsPerLevel: {level: string[]}, tracks: string[] }
settings/activityTypes       → { types: string[] }
settings/departments         → { departments: string[] }
```

**ไฟล์เกียรติบัตร** ไม่ได้เก็บใน Firebase Storage แต่อัปโหลดผ่าน Cloud Function
(`functions-drive-upload/`) เข้าโฟลเดอร์ **Google Drive กลางของโรงเรียน** โดยใช้ service account
เป็นคนเขียนไฟล์แทนผู้ใช้แต่ละคน แล้วแชร์สิทธิ์อ่านให้ทุกคนในโดเมน @nongki.ac.th — วิธี deploy
ดูที่ `functions-drive-upload/DEPLOY.md` (ทำผ่าน Google Cloud Console ล้วนๆ ไม่ต้องใช้ CLI)

## ขั้นตอนติดตั้ง

1. **สร้างโปรเจกต์ Firebase ใหม่** (แยกจากโปรเจกต์เดิม) ที่ https://console.firebase.google.com
2. **เปิดใช้ Authentication → Sign-in method → Google**
3. **เปิดใช้ Firestore Database** (โหมด production)
4. คัดลอกค่า config จาก Project settings → General → Your apps → Web app
   มาใส่ใน `shared/firebase-init.js` แทนค่า `YOUR_...`
5. Deploy Firestore security rules: เปิด Firestore Database → แท็บ Rules → วางเนื้อหาจาก
   `firestore.rules` → Publish
6. **Deploy Cloud Function สำหรับอัปโหลดเกียรติบัตรเข้า Drive กลาง** — ทำตาม
   `functions-drive-upload/DEPLOY.md` ทั้งหมด แล้วเอา Trigger URL ที่ได้มาใส่ใน
   `shared/firebase-init.js` ตัวแปร `DRIVE_UPLOAD_URL`
7. **สร้างแอดมินคนแรกด้วยมือ** (เพราะ admin.html ต้องมี admin อยู่ก่อนถึงจะเข้าได้):
   ไปที่ Firestore Console → สร้าง collection `permissions` → เพิ่มเอกสารรหัส
   เป็นอีเมลของคุณ เช่น `admin@nongki.ac.th` → ใส่ field `role: "admin"` (ตัวพิมพ์เล็กล้วน)
8. ตั้งค่าตัวเลือกเริ่มต้น (ไม่บังคับ ถ้าไม่ตั้งระบบจะใช้ค่า default ในโค้ดไปก่อน):
   เข้า `admin.html` → แท็บ "ห้องเรียน/กลุ่มการเรียน" และ "หัวข้อ/กลุ่มสาระ" → กรอกแล้วบันทึก
9. เพิ่มครูประจำกลุ่มสาระ/ครูแนะแนวที่เหลือผ่านหน้า `admin.html` ได้เลย (ไม่ต้องเข้า Console อีก)
10. โฮสต์ไฟล์ทั้งหมด (`index.html`, `*.html`, `shared/`, `js/` — ไม่รวม `functions-drive-upload/`)
    ด้วย GitHub Pages หรือเว็บ static host ใดก็ได้ แล้วเพิ่มโดเมนนั้นใน
    Authentication → Settings → Authorized domains ไม่งั้น popup ล็อกอินจะ error

## จุดที่ควรตรวจสอบ/ต่อยอดก่อนใช้งานจริง

- **ตอนนี้แนะแนวยืนยันแบบไม่ผูกกับกลุ่มสาระ** (ครูแนะแนวคนไหนก็ยืนยันของกลุ่มสาระไหนก็ได้) —
  ถ้าอยากแบ่งงานแนะแนวตามระดับชั้น ต้องเพิ่ม field กรองเพิ่ม
- **การตีกลับ**: ตอนนี้นักเรียนแก้ไขสถานะ `revision` ได้ (rules อนุญาต) แต่ modal "ส่งกิจกรรมใหม่"
  (`shared/submit-modal.js`) ยังเป็นฟอร์ม "ส่งใหม่" ไม่ใช่ "แก้ไขของเดิม" — ถ้าต้องการให้แก้ไขรายการเดิมแทนการสร้างใหม่
  ต้องเพิ่มโหมดแก้ไข activity ที่มีอยู่ให้ modal นี้
- **เทมเพลต export ของครูแนะแนว**: ตอนนี้ export เป็น CSV คอลัมน์มาตรฐานไปก่อน ยังไม่มีไฟล์
  ตัวอย่างจริงมาอ้างอิง — ส่งไฟล์เทมเพลตมาได้ จะปรับ `js/guidance.js` ให้ตรงคอลัมน์
- **ตรวจสอบ index ของ Firestore**: query ที่มี `where` และ `orderBy` ร่วมกัน (เช่นในหน้า teacher-review,
  guidance) Firestore มักขึ้นลิงก์ให้สร้าง composite index อัตโนมัติตอนรันครั้งแรกจาก console log
  ของเบราว์เซอร์ — กดสร้างตามที่มันแนะนำได้เลย
- ยังไม่ได้ทำ push notification / อีเมลแจ้งเตือนเมื่อสถานะเปลี่ยน (ระบบเดิมมี แต่ระบบนี้ยังไม่มี)
