import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserDoc } from '../lib/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      const unsubDoc = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUserDoc({ id: snap.id, ...snap.data() } as unknown as UserDoc);
        } else {
          setUserDoc(null);
        }
        setLoading(false);
      });

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, []);

  return {
    user,
    userDoc,
    loading,
    workspaceId: userDoc?.workspaceId ?? null,
    isOwner: userDoc?.role === 'owner',
    isStaff: userDoc?.role === 'staff',
  };
}
