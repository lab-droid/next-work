import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ChannelChat from './ChannelChat';

/**
 * Project conversation feed — a dedicated channel scoped to a single project,
 * so tasks and discussion live in one place (Flow-style). Reuses ChannelChat
 * for threads, mentions, reactions, and read tracking.
 */
export default function ProjectFeed({
  project,
}: {
  project: { id: string; name: string; companyCode: string };
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  const channelId = `proj_${project.id}`;

  // Ensure the project channel document exists (idempotent).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, 'chats', channelId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            name: `${project.name} 대화`,
            type: 'channel',
            companyCode: project.companyCode,
            projectId: project.id,
            members: [user.uid],
            isPrivate: false,
            createdBy: user.uid,
            userId: user.uid,
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'chats');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, channelId, project.name, project.companyCode, project.id]);

  // Load company members for mentions.
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users'),
      where('companyCode', '==', project.companyCode),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
    );
    return () => unsub();
  }, [user, project.companyCode]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChannelChat channelId={channelId} channelName={project.name} users={members} />
    </div>
  );
}
