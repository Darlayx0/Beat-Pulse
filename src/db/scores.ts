import { db } from './index.ts';
import { highScores, users } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { HighScore } from '../types.ts';

export async function getHighScores(songId?: string, userUid?: string): Promise<HighScore[]> {
  try {
    let rows;
    if (songId && userUid) {
      rows = await db
        .select({
          songId: highScores.songId,
          difficulty: highScores.difficulty,
          score: highScores.score,
          maxCombo: highScores.maxCombo,
          accuracy: highScores.accuracy,
          grade: highScores.grade,
          timestamp: highScores.timestamp,
          userId: highScores.userUid,
          username: users.username,
        })
        .from(highScores)
        .leftJoin(users, eq(highScores.userUid, users.uid))
        .where(and(eq(highScores.songId, songId), eq(highScores.userUid, userUid)))
        .orderBy(desc(highScores.score));
    } else if (songId) {
      rows = await db
        .select({
          songId: highScores.songId,
          difficulty: highScores.difficulty,
          score: highScores.score,
          maxCombo: highScores.maxCombo,
          accuracy: highScores.accuracy,
          grade: highScores.grade,
          timestamp: highScores.timestamp,
          userId: highScores.userUid,
          username: users.username,
        })
        .from(highScores)
        .leftJoin(users, eq(highScores.userUid, users.uid))
        .where(eq(highScores.songId, songId))
        .orderBy(desc(highScores.score));
    } else if (userUid) {
      rows = await db
        .select({
          songId: highScores.songId,
          difficulty: highScores.difficulty,
          score: highScores.score,
          maxCombo: highScores.maxCombo,
          accuracy: highScores.accuracy,
          grade: highScores.grade,
          timestamp: highScores.timestamp,
          userId: highScores.userUid,
          username: users.username,
        })
        .from(highScores)
        .leftJoin(users, eq(highScores.userUid, users.uid))
        .where(eq(highScores.userUid, userUid))
        .orderBy(desc(highScores.score));
    } else {
      rows = await db
        .select({
          songId: highScores.songId,
          difficulty: highScores.difficulty,
          score: highScores.score,
          maxCombo: highScores.maxCombo,
          accuracy: highScores.accuracy,
          grade: highScores.grade,
          timestamp: highScores.timestamp,
          userId: highScores.userUid,
          username: users.username,
        })
        .from(highScores)
        .leftJoin(users, eq(highScores.userUid, users.uid))
        .orderBy(desc(highScores.score));
    }

    return rows.map((r) => ({
      songId: r.songId,
      difficulty: r.difficulty,
      score: r.score,
      maxCombo: r.maxCombo,
      accuracy: r.accuracy,
      grade: r.grade as HighScore['grade'],
      timestamp: Number(r.timestamp),
      userId: r.userId,
      username: r.username || 'Anonymous',
    }));
  } catch (error) {
    console.error('Database query failed in getHighScores:', error);
    throw new Error('Failed to retrieve high scores.', { cause: error });
  }
}

export async function saveHighScore(scoreData: HighScore, userUid: string): Promise<HighScore> {
  try {
    // Check if user already has a score for this song + difficulty
    const existing = await db
      .select()
      .from(highScores)
      .where(
        and(
          eq(highScores.songId, scoreData.songId),
          eq(highScores.difficulty, scoreData.difficulty),
          eq(highScores.userUid, userUid)
        )
      );

    if (existing.length > 0) {
      const prev = existing[0];
      // If new score is higher or equal, update
      if (scoreData.score >= prev.score) {
        await db
          .update(highScores)
          .set({
            score: scoreData.score,
            maxCombo: Math.max(scoreData.maxCombo, prev.maxCombo),
            accuracy: Math.max(scoreData.accuracy, prev.accuracy),
            grade: scoreData.grade,
            timestamp: scoreData.timestamp || Date.now(),
          })
          .where(eq(highScores.id, prev.id));
      }
    } else {
      await db.insert(highScores).values({
        songId: scoreData.songId,
        difficulty: scoreData.difficulty,
        userUid,
        score: scoreData.score,
        maxCombo: scoreData.maxCombo,
        accuracy: scoreData.accuracy,
        grade: scoreData.grade,
        timestamp: scoreData.timestamp || Date.now(),
      });
    }

    return scoreData;
  } catch (error) {
    console.error('Database query failed in saveHighScore:', error);
    throw new Error('Failed to save high score.', { cause: error });
  }
}
