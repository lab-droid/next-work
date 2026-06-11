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

  // DELETE user endpoint
  app.delete('/api/users/:uid', async (req, res) => {
    try {
      const uid = req.params.uid;
      // Note: Ideally, you should verify an Identity token here to ensure the caller is an admin.
      // Skipping for this prototype as requested.
      
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
