# วิธี Deploy — อัปโหลดเกียรติบัตรเข้า Google Drive กลาง

ทำทั้งหมดผ่านหน้าเว็บ ไม่ต้องลง Firebase CLI หรือ Node บนเครื่องตัวเอง

## ส่วนที่ 1 — สร้าง Service Account + โฟลเดอร์ Drive กลาง

1. ไปที่ https://console.cloud.google.com เลือกโปรเจกต์เดียวกับ Firebase (เช่น `np-tcasverified`)
2. เมนูซ้าย → **IAM & Admin → Service Accounts** → **Create Service Account**
   - ชื่อ เช่น `drive-uploader` → Create and continue → ข้ามขั้น role (ไม่ต้องให้สิทธิ์ระดับโปรเจกต์) → Done
3. คลิกเข้าไปที่ service account ที่สร้าง → แท็บ **Keys** → **Add key → Create new key → JSON** → ดาวน์โหลดไฟล์ JSON ที่ได้มา
   ⚠️ ไฟล์นี้เปิดได้แค่ครั้งเดียว เก็บไว้ให้ดี ห้าม commit ขึ้น GitHub เด็ดขาด
4. เปิด [Google Drive](https://drive.google.com) ด้วยบัญชีโรงเรียน (หรือบัญชีที่จะเป็นเจ้าของโฟลเดอร์กลาง)
   → สร้างโฟลเดอร์ใหม่ เช่น `เกียรติบัตร NP-TCAS Verified`
5. คลิกขวาโฟลเดอร์ → **Share** → แชร์ให้กับอีเมลของ service account (หน้าตาแบบ
   `drive-uploader@np-tcasverified.iam.gserviceaccount.com` ดูได้จากหน้า Service Accounts) → สิทธิ์ **Editor**
6. เปิดโฟลเดอร์ → คัดลอก **Folder ID** จาก URL
   `https://drive.google.com/drive/folders/`**`นี่คือ Folder ID`**

## ส่วนที่ 2 — เปิดใช้ Google Drive API

1. ใน Cloud Console → เมนูซ้าย **APIs & Services → Library**
2. ค้นหา **Google Drive API** → กด **Enable**

## ส่วนที่ 3 — Deploy Cloud Function

1. เมนูซ้าย → **Cloud Functions** → **Create Function**
2. ตั้งค่า:
   - Environment: **2nd gen**
   - Function name: `uploadCertificate`
   - Region: เลือกใกล้ๆ (เช่น `asia-southeast1`)
   - Trigger type: **HTTPS**
   - Authentication: **Allow unauthenticated invocations**
     (ฟังก์ชันตรวจสิทธิ์เองด้วย Firebase ID token อยู่แล้วในโค้ด ไม่ต้องพึ่ง IAM auth)
3. กด Next → **Runtime**: Node.js 20 → **Source code**: Inline editor
   - เปิดไฟล์ `index.js` ในโฟลเดอร์นี้ → คัดลอกทั้งหมดวางแทนโค้ดตัวอย่างในกล่อง `index.js`
   - เปิดไฟล์ `package.json` ในโฟลเดอร์นี้ → คัดลอกทั้งหมดวางแทนในกล่อง `package.json`
   - **Entry point**: พิมพ์ `uploadCertificate`
4. เลื่อนลงหา **Runtime, build, connections and security settings** → แท็บ **Runtime**
   → ส่วน **Runtime environment variables** เพิ่ม 2 ตัว:
   - `DRIVE_FOLDER_ID` = Folder ID ที่คัดลอกมาจากส่วนที่ 1 ข้อ 6
   - `DRIVE_SERVICE_ACCOUNT_KEY` = เปิดไฟล์ JSON key ที่ดาวน์โหลดมา คัดลอกเนื้อหาทั้งไฟล์มาวางเป็นค่าเดียว (บรรทัดเดียวหรือหลายบรรทัดก็ได้ Console จะเก็บให้)
   > ถ้าอยากปลอดภัยขึ้น ใช้ **Secret Manager** แทน (มีตัวเลือก "Reference a secret" ในหน้าเดียวกัน) แล้วอัปโหลดค่า JSON key เป็น secret แทนการวางตรงๆ
5. กด **Deploy** รอสักครู่ (2-5 นาที)
6. Deploy เสร็จแล้ว จะเห็น **Trigger URL** หน้าตาแบบ
   `https://asia-southeast1-np-tcasverified.cloudfunctions.net/uploadCertificate`
   คัดลอก URL นี้ไปใส่ใน `shared/firebase-init.js` ตัวแปร `DRIVE_UPLOAD_URL`

## ทดสอบ

ลองส่งกิจกรรมใหม่จากหน้านักเรียนจริงๆ ถ้าอัปโหลดสำเร็จ ไฟล์จะไปโผล่ในโฟลเดอร์ Drive กลางที่สร้างไว้
ชื่อไฟล์จะขึ้นต้นด้วย uid ของนักเรียนแล้วตามด้วยชื่อไฟล์เดิม

ถ้า error ให้เปิด **Cloud Functions → uploadCertificate → Logs** ดูข้อความ error เต็มๆ ได้เลย

## ข้อควรรู้

- ไฟล์ที่อัปโหลดจะถูกแชร์แบบ "ใครก็ตามในโดเมน @nongki.ac.th ที่มีลิงก์ ดูได้" (ไม่ public ทั่วอินเทอร์เน็ต)
- ขนาดไฟล์จำกัดที่ 6MB (ปรับได้ที่ `MAX_FILE_BYTES` ในโค้ด และเงื่อนไข `file.size > 6 * 1024 * 1024` ใน `shared/submit-modal.js` ให้ตรงกัน)
- ถ้าโรงเรียนใช้ Google Workspace และมีการจำกัดแอปภายนอกไว้เข้ม อาจต้องให้แอดมิน Workspace อนุมัติ service account
  นี้ก่อน (ปกติไม่จำเป็น เพราะเราแชร์โฟลเดอร์ให้ service account ตรงๆ ไม่ได้ขอสิทธิ์ระดับโดเมน)
