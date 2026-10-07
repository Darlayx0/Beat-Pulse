import { db } from './index.ts';
import { users } from './schema.ts';
import { eq, sql } from 'drizzle-orm';

export async function getOrCreateUser(
  uid: string,
  email: string,
  username?: string,
  avatarUrl?: string
) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing.length > 0) {
      // Update basic fields if provided
      const updateData: Record<string, unknown> = {
        email,
        updatedAt: new Date(),
      };
      if (username) updateData.username = username;
      if (avatarUrl) updateData.avatarUrl = avatarUrl;

      const updated = await db
        .update(users)
        .set(updateData)
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    const defaultUsername = username || email.split('@')[0] || 'BeatPlayer';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        username: defaultUsername,
        avatarUrl: avatarUrl || '',
        avatarType: 'google',
        title: 'Novice Beatmaster',
        level: 1,
        exp: 0,
        totalScore: 0,
        songsCompleted: 0,
        maxComboAllTime: 0,
        bestAccuracy: 0,
        unlockedTitles: ['Novice Beatmaster'],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to get or create user profile.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid));
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to fetch user profile.', { cause: error });
  }
}

export async function updateUserProfile(
  uid: string,
  updates: {
    username?: string;
    bio?: string;
    title?: string;
    avatarUrl?: string;
    avatarType?: string;
    presetAvatarId?: string;
    unlockedTitles?: string[];
  }
) {
  try {
    const result = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function recordGameProgress(
  uid: string,
  newScore: number,
  newCombo: number,
  newAccuracy: number
) {
  try {
    const currentUser = await getUserByUid(uid);
    if (!currentUser) return null;

    const addedExp = Math.max(10, Math.floor(newScore / 5000));
    const totalExp = currentUser.exp + addedExp;
    const newLevel = Math.floor(1 + Math.sqrt(totalExp / 100));
    const maxComboAllTime = Math.max(currentUser.maxComboAllTime, newCombo);
    const bestAccuracy = Math.max(currentUser.bestAccuracy, newAccuracy);
    const totalScore = Number(currentUser.totalScore) + newScore;
    const songsCompleted = currentUser.songsCompleted + 1;

    // Check titles to unlock
    const currentTitles = (currentUser.unlockedTitles as string[]) || ['Novice Beatmaster'];
    const unlocked = new Set(currentTitles);

    if (newLevel >= 5) unlocked.add('Rhythm Apprentice');
    if (newLevel >= 10) unlocked.add('Beat Specialist');
    if (newLevel >= 20) unlocked.add('Groove Master');
    if (newLevel >= 50) unlocked.add('Sonic Legend');
    if (maxComboAllTime >= 100) unlocked.add('Combo Breaker');
    if (maxComboAllTime >= 500) unlocked.add('Infinite Flow');
    if (bestAccuracy >= 98.0) unlocked.add('Precision Demon');
    if (bestAccuracy === 100.0) unlocked.add('Flawless Maestro');

    const result = await db
      .update(users)
      .set({
        level: newLevel,
        exp: totalExp,
        totalScore,
        songsCompleted,
        maxComboAllTime,
        bestAccuracy,
        unlockedTitles: Array.from(unlocked),
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in recordGameProgress:', error);
    throw new Error('Failed to record player progress.', { cause: error });
  }
}
