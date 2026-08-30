import express from 'express';
import { GoogleFitService } from '../services/google-fit.service';
import { authenticate } from '../middlewares/auth.middleware';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @route   GET /api/integrations/google-fit/auth
 * @desc    Get Google OAuth URL to connect Google Fit
 * @access  Private
 */
router.get('/google-fit/auth', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User not authenticated' });
    }

    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!userProfile) {
      return res.status(400).json({ success: false, message: 'User profile not found' });
    }

    const authUrl = GoogleFitService.getAuthUrl(userProfile.id);
    res.json({ success: true, url: authUrl });
  } catch (error: any) {
    console.error('Error generating Google Fit auth URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate auth URL' });
  }
});

/**
 * @route   GET /api/integrations/google-fit/callback
 * @desc    Google OAuth Callback
 * @access  Public (Redirected from Google)
 */
router.get('/google-fit/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Google OAuth Error:', error);
      // Redirect back to frontend with error
      return res.redirect(`${process.env.FRONTEND_URL}/profile/settings?error=google_fit_declined`);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }

    // `state` contains the userProfileId
    const userProfileId = state as string;

    await GoogleFitService.handleCallback(code as string, userProfileId);

    // Redirect back to frontend profile settings with success
    res.redirect(`${process.env.FRONTEND_URL}/profile/settings?success=google_fit_connected`);
  } catch (error: any) {
    console.error('Error in Google Fit callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/profile/settings?error=google_fit_failed`);
  }
});

/**
 * @route   POST /api/integrations/google-fit/sync
 * @desc    Manually trigger a sync for the logged-in user
 * @access  Private
 */
router.post('/google-fit/sync', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User not authenticated' });
    }

    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!userProfile) {
      return res.status(400).json({ success: false, message: 'User profile not found' });
    }

    await GoogleFitService.syncUserWorkouts(userProfile.id);
    res.json({ success: true, message: 'Google Fit synced successfully' });
  } catch (error: any) {
    console.error('Error syncing Google Fit:', error);
    res.status(500).json({ success: false, message: 'Failed to sync Google Fit data' });
  }
});

export { router as integrationRoutes };
