import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid, updateUserProfile, recordGameProgress } from './src/db/users.ts';
import { getSettingsByUserUid, upsertSettings } from './src/db/settings.ts';
import { getAllSongs, getSongById, saveSongWithCharts, deleteSong } from './src/db/songs.ts';
import { getHighScores, saveHighScore } from './src/db/scores.ts';
import { seedPresetSongsIfNeeded } from './src/db/seed.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Auth & Profile Endpoints
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email, name, picture } = req.user!;
      const user = await getOrCreateUser(uid, email || '', name, picture);
      const settings = await getSettingsByUserUid(uid);
      res.json({ user, settings });
    } catch (error: any) {
      console.error('Error syncing auth profile:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user profile' });
    }
  });

  app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const user = await getUserByUid(uid);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
    }
  });

  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const updated = await updateUserProfile(uid, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: error.message || 'Failed to update user profile' });
    }
  });

  // Settings Endpoints
  app.get('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const settings = await getSettingsByUserUid(uid);
      res.json(settings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch settings' });
    }
  });

  app.put('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const settings = await upsertSettings(uid, req.body);
      res.json(settings);
    } catch (error: any) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: error.message || 'Failed to update settings' });
    }
  });

  // Songs & Charts Endpoints
  app.get('/api/songs', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const userUid = req.user?.uid;
      const songsList = await getAllSongs(userUid);
      res.json(songsList);
    } catch (error: any) {
      console.error('Error fetching songs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch songs' });
    }
  });

  app.get('/api/songs/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const song = await getSongById(req.params.id);
      if (!song) {
        return res.status(404).json({ error: 'Song not found' });
      }
      res.json(song);
    } catch (error: any) {
      console.error('Error fetching song by id:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch song' });
    }
  });

  app.post('/api/songs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userUid = req.user!.uid;
      const savedSong = await saveSongWithCharts(req.body, userUid);
      res.json(savedSong);
    } catch (error: any) {
      console.error('Error saving song:', error);
      res.status(500).json({ error: error.message || 'Failed to save song and chart configuration' });
    }
  });

  app.delete('/api/songs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userUid = req.user!.uid;
      const success = await deleteSong(req.params.id, userUid);
      if (!success) {
        return res.status(404).json({ error: 'Song not found or already deleted' });
      }
      res.json({ success: true, message: 'Song deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting song:', error);
      res.status(400).json({ error: error.message || 'Failed to delete song' });
    }
  });

  // High Scores & Progression Endpoints
  app.get('/api/scores', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const songId = req.query.songId as string | undefined;
      const userUid = req.query.userOnly === 'true' ? req.user?.uid : undefined;
      const scores = await getHighScores(songId, userUid);
      res.json(scores);
    } catch (error: any) {
      console.error('Error fetching high scores:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch scores' });
    }
  });

  app.post('/api/scores', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userUid = req.user!.uid;
      const scoreData = req.body;
      const savedScore = await saveHighScore(scoreData, userUid);
      
      // Also update player progress, stats, and EXP
      const updatedUser = await recordGameProgress(
        userUid,
        scoreData.score,
        scoreData.maxCombo,
        scoreData.accuracy
      );

      res.json({ score: savedScore, progress: updatedUser });
    } catch (error: any) {
      console.error('Error saving high score:', error);
      res.status(500).json({ error: error.message || 'Failed to record high score' });
    }
  });

  // Seed default presets on startup asynchronously
  seedPresetSongsIfNeeded().catch((err) => {
    console.warn('Auto seed preset warning:', err.message);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
