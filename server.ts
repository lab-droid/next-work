import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
// @ts-ignore
import admin from 'firebase-admin';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  try {
    // Try to initialize from env variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      // @ts-ignore
      const fbAdmin: any = admin;
      fbAdmin.initializeApp({
        credential: fbAdmin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_KEY');
    } else {
      // Fallback to Application Default Credentials
      const fbAdmin: any = admin;
      fbAdmin.initializeApp();
      console.log('Firebase Admin initialized from Application Default Credentials');
    }
  } catch (error) {
    console.log('Firebase Admin initialization warning:', error);
  }

  // Helper to obtain Custom DB id
  const dbId = 'ai-studio-439e1f63-9bcf-4dc0-a0a0-c3de1097820f';
  function getFirestoreDb() {
    const fbAdmin: any = admin;
    if (!fbAdmin || fbAdmin.apps.length === 0) {
      throw new Error("Firebase Admin not initialized");
    }
    try {
      return fbAdmin.firestore(dbId);
    } catch (err) {
      return fbAdmin.firestore();
    }
  }

  // Haversine formula to compute distance in meters
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  // DELETE user endpoint
  app.delete('/api/users/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      // @ts-ignore
      const fbAdmin: any = admin;
      if (fbAdmin.apps.length > 0) {
        await fbAdmin.auth().deleteUser(uid);
        res.json({ success: true, message: 'Firebase Auth User deleted' });
      } else {
        console.warn('Firebase Admin is not configured. User auth not actually deleted.');
        res.json({ success: true, message: 'Admin not configured, skipping auth deletion' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/attendance/check-in
  app.post('/api/attendance/check-in', async (req, res) => {
    try {
      const { userId, latitude, longitude, ipAddress, authType, companyCode } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const db = getFirestoreDb();
      
      // Fetch today's date in Seoul time
      const seoulTimeNow = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const nowSeoul = new Date(seoulTimeNow);
      
      const year = nowSeoul.getFullYear();
      const month = String(nowSeoul.getMonth() + 1).padStart(2, '0');
      const day = String(nowSeoul.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Check if check-in already exists
      const checkInQuery = await db.collection('attendances')
        .where('userId', '==', userId)
        .where('date', '==', todayStr)
        .get();

      if (!checkInQuery.empty) {
        return res.status(400).json({ error: '이미 오늘의 출근 기록이 존재합니다.' });
      }

      // Default policy values
      let standardIn = '09:00';
      let officeLat = 37.5665; // Seoul City Hall default
      let officeLon = 126.9780;
      let allowedIp = '';

      // Fetch company policy if code exists
      if (companyCode) {
        const policySnap = await db.collection('work_policies').doc(companyCode).get();
        if (policySnap.exists) {
          const policy = policySnap.data();
          if (policy.standardIn) standardIn = policy.standardIn;
          if (policy.officeLatitude) officeLat = Number(policy.officeLatitude);
          if (policy.officeLongitude) officeLon = Number(policy.officeLongitude);
          if (policy.allowedIp) allowedIp = policy.allowedIp;
        }
      }

      // GPS Validation
      let distance: number | null = null;
      let locationVerified = true;
      if (authType === 'GPS' && latitude && longitude) {
        distance = getDistance(Number(latitude), Number(longitude), officeLat, officeLon);
        // Let's say if distance > 1000m, we warn or flag it
        if (distance > 1000) {
          locationVerified = false; 
        }
      }

      // IP Validation
      let ipVerified = true;
      if (authType === 'IP' && ipAddress && allowedIp) {
        if (ipAddress !== allowedIp && !ipAddress.startsWith(allowedIp)) {
          ipVerified = false; 
        }
      }

      // Determine Status (Late or Normal)
      const currentHourMin = `${String(nowSeoul.getHours()).padStart(2, '0')}:${String(nowSeoul.getMinutes()).padStart(2, '0')}`;
      const checkInTimeStr = `${currentHourMin}:${String(nowSeoul.getSeconds()).padStart(2, '0')}`;
      
      let status = '근무중';
      if (currentHourMin > standardIn) {
        status = '지각';
      }

      const attendanceId = db.collection('attendances').doc().id;
      const newRecord = {
        id: attendanceId,
        userId,
        date: todayStr,
        checkIn: checkInTimeStr,
        checkOut: '',
        authType,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        ipAddress: ipAddress || '',
        distance: distance !== null ? Math.round(distance * 10) / 10 : null,
        locationVerified,
        ipVerified,
        status,
        companyCode: companyCode || '',
        createdAt: Date.now()
      };

      await db.collection('attendances').doc(attendanceId).set(newRecord);

      // Update User clock status
      await db.collection('users').doc(userId).set({
        clockState: 'IN',
        clockTime: checkInTimeStr
      }, { merge: true });

      res.json({ success: true, record: newRecord });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/attendance/check-out
  app.post('/api/attendance/check-out', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const db = getFirestoreDb();
      
      const seoulTimeNow = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      const nowSeoul = new Date(seoulTimeNow);
      
      const year = nowSeoul.getFullYear();
      const month = String(nowSeoul.getMonth() + 1).padStart(2, '0');
      const day = String(nowSeoul.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Find today's record
      const attendanceQuery = await db.collection('attendances')
        .where('userId', '==', userId)
        .where('date', '==', todayStr)
        .get();

      if (attendanceQuery.empty) {
        return res.status(400).json({ error: '오늘 출근한 기록을 찾을 수 없습니다.' });
      }

      const recordDoc = attendanceQuery.docs[0];
      const recordData = recordDoc.data();

      if (recordData.checkOut) {
        return res.status(400).json({ error: '이미 퇴근 기록이 존재합니다.' });
      }

      const checkOutTimeStr = `${String(nowSeoul.getHours()).padStart(2, '0')}:${String(nowSeoul.getMinutes()).padStart(2, '0')}:${String(nowSeoul.getSeconds()).padStart(2, '0')}`;

      // Calculate work hours
      const [inH, inM, inS] = recordData.checkIn.split(':').map(Number);
      const [outH, outM, outS] = checkOutTimeStr.split(':').map(Number);

      const checkInMs = (inH * 3600 + inM * 60 + inS) * 1000;
      const checkOutMs = (outH * 3600 + outM * 60 + outS) * 1000;
      
      let diffHours = (checkOutMs - checkInMs) / (1000 * 60 * 60);
      if (diffHours < 0) diffHours = 0;
      diffHours = Math.round(diffHours * 100) / 100;

      await db.collection('attendances').doc(recordDoc.id).update({
        checkOut: checkOutTimeStr,
        workHours: diffHours,
        status: '퇴근'
      });

      // Update User clock status
      await db.collection('users').doc(userId).set({
        clockState: 'OUT',
        clockTime: checkOutTimeStr
      }, { merge: true });

      res.json({ success: true, checkOut: checkOutTimeStr, workHours: diffHours });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/leaves/apply
  app.post('/api/leaves/apply', async (req, res) => {
    try {
      const { userId, userName, type, startDate, endDate, reason, companyCode } = req.body;
      if (!userId || !type || !startDate || !endDate) {
        return res.status(400).json({ error: '신청 정보가 부족합니다.' });
      }

      const db = getFirestoreDb();
      const leaveId = db.collection('leaves').doc().id;

      const newRequest = {
        id: leaveId,
        userId,
        userName: userName || '직원',
        type, // '연차', '반차', '연장근무', etc.
        startDate,
        endDate,
        reason: reason || '',
        status: 'pending',
        companyCode: companyCode || '',
        createdAt: Date.now()
      };

      await db.collection('leaves').doc(leaveId).set(newRequest);
      res.json({ success: true, leave: newRequest });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/leaves/approve/:id
  app.put('/api/leaves/approve/:id', async (req, res) => {
    try {
      const leaveId = req.params.id;
      const { status } = req.body; // 'approved' | 'rejected'
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: '올바르지 않은 처리 상태입니다.' });
      }

      const db = getFirestoreDb();
      const leaveDoc = db.collection('leaves').doc(leaveId);
      const leaveSnap = await leaveDoc.get();

      if (!leaveSnap.exists) {
        return res.status(404).json({ error: '해당 신청 건을 찾을 수 없습니다.' });
      }

      await leaveDoc.update({ status });
      res.json({ success: true, status });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/reports/csv
  app.get('/api/admin/reports/csv', async (req, res) => {
    try {
      const { companyCode, month } = req.query; // e.g. "2026-06"
      if (!companyCode) {
        return res.status(400).json({ error: 'companyCode is required' });
      }

      const db = getFirestoreDb();
      
      // Fetch users in this company to get names/departments
      const usersSnap = await db.collection('users')
        .where('companyCode', '==', companyCode)
        .get();
      
      const userMap: Record<string, {name: string, dept: string}> = {};
      usersSnap.forEach((doc: any) => {
        const u = doc.data();
        userMap[doc.id] = {
          name: u.name || u.displayName || '이름 없음',
          dept: u.department || '미지정'
        };
      });

      // Query attendances for the company code
      const attendRef = db.collection('attendances')
        .where('companyCode', '==', companyCode);
      
      const attendSnap = await attendRef.get();
      
      let records: any[] = [];
      attendSnap.forEach((doc: any) => {
        const r = doc.data();
        if (month) {
          if (r.date && r.date.startsWith(month as string)) {
            records.push(r);
          }
        } else {
          records.push(r);
        }
      });

      // Sort by date then userId
      records.sort((a, b) => a.date.localeCompare(b.date) || a.userId.localeCompare(b.userId));

      let csvContent = '\uFEFF'; // Excel UTF-8 BOM
      csvContent += '날짜,사원ID,이름,부서,출근시간,퇴근시간,인증방식,IP주소,근무시간(시간),상태,위치검증,IP검증\n';

      for (const r of records) {
        const userInfo = userMap[r.userId] || { name: '퇴사자/미등록', dept: '미지정' };
        const workHoursStr = r.workHours !== undefined ? r.workHours : '';
        const locVer = r.locationVerified ? '검증완료' : '사외/미검증';
        const ipVer = r.ipVerified ? '검증완료' : '외부/미검증';
        
        const row = [
          r.date,
          r.userId,
          `"${userInfo.name.replace(/"/g, '""')}"`,
          `"${userInfo.dept.replace(/"/g, '""')}"`,
          r.checkIn,
          r.checkOut || '',
          r.authType || '',
          r.ipAddress || '',
          workHoursStr,
          r.status || '',
          locVer,
          ipVer
        ].join(',');
        csvContent += row + '\n';
      }

      const filename = `attendance_report_${month || 'all'}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.status(200).send(csvContent);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
