import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';

const prisma = new PrismaClient();

export class GoogleFitService {
  private static getOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generates the URL for the user to authenticate and authorize Google Fit access.
   * We pass the userProfileId in the state so we know who they are when they return.
   */
  public static getAuthUrl(userProfileId: string): string {
    const oauth2Client = this.getOAuth2Client();
    
    // Request access to read activity/workout data
    const scopes = [
      'https://www.googleapis.com/auth/fitness.activity.read'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get a refresh token
      prompt: 'consent', // Force consent prompt to guarantee a refresh token on first login
      scope: scopes,
      state: userProfileId // Pass the user profile ID back in the callback
    });
  }

  /**
   * Handles the OAuth callback, exchanges code for tokens, and saves/updates the integration.
   */
  public static async handleCallback(code: string, userProfileId: string) {
    const oauth2Client = this.getOAuth2Client();
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('Failed to retrieve access token from Google');
    }

    // Save or update the ExternalIntegration in the database
    await prisma.externalIntegration.upsert({
      where: {
        userProfileId_provider: {
          userProfileId,
          provider: 'GOOGLE_FIT'
        }
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '', // Sometimes refresh token is only sent on first auth
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
        isActive: true
      },
      create: {
        userProfileId,
        provider: 'GOOGLE_FIT',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      }
    });

    // Immediately trigger an initial sync
    await this.syncUserWorkouts(userProfileId);
  }

  /**
   * Syncs the user's Google Fit workout data and updates their AI Prediction baseline (workoutDaysPerWeek)
   */
  public static async syncUserWorkouts(userProfileId: string) {
    const integration = await prisma.externalIntegration.findUnique({
      where: {
        userProfileId_provider: {
          userProfileId,
          provider: 'GOOGLE_FIT'
        }
      }
    });

    if (!integration || !integration.isActive) {
      return;
    }

    const oauth2Client = this.getOAuth2Client();
    
    // Set credentials, handling automatic refresh if expired
    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt.getTime()
    });

    // Listen for automatic token refresh to save the new tokens to the DB
    oauth2Client.on('tokens', async (tokens) => {
      await prisma.externalIntegration.update({
        where: { id: integration.id },
        data: {
          ...(tokens.access_token && { accessToken: tokens.access_token }),
          ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
          ...(tokens.expiry_date && { expiresAt: new Date(tokens.expiry_date) })
        }
      });
    });

    const fitness = google.fitness({ version: 'v1', auth: oauth2Client });
    
    // Fetch data for the last 30 days
    const endTime = new Date();
    const startTime = subDays(endTime, 30);

    try {
      // Fetch fitness sessions (workouts)
      const res = await fitness.users.sessions.list({
        userId: 'me',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      const sessions = res.data.session || [];
      
      // Filter out sleeping or non-workout sessions if necessary
      // Google Fit activities map: 72=sleep, 109=light sleep, etc. We want active workouts.
      // Usually, any session that isn't sleep (72, 109, 110, 111, 112) is some form of workout/activity.
      const workoutSessions = sessions.filter(s => {
        const activityType = s.activityType;
        if (activityType === undefined || activityType === null) return false;
        // Exclude sleep activities
        return ![72, 109, 110, 111, 112].includes(activityType);
      });

      // Calculate how many unique days they worked out in the last 30 days
      const uniqueWorkoutDays = new Set(
        workoutSessions.map(s => {
          // Get the start date (YYYY-MM-DD)
          const date = new Date(parseInt(s.startTimeMillis || '0', 10));
          return date.toISOString().split('T')[0];
        })
      );

      // Average workouts per week over the 30 day period
      const totalDays = 30;
      const weeks = totalDays / 7;
      let averageWorkoutsPerWeek = Math.round(uniqueWorkoutDays.size / weeks);
      
      // Ensure it's at least 1, max 7
      averageWorkoutsPerWeek = Math.max(1, Math.min(7, averageWorkoutsPerWeek));

      console.log(`[Google Fit] User ${userProfileId} worked out on ${uniqueWorkoutDays.size} days in the last 30 days. Average: ${averageWorkoutsPerWeek}/week.`);

      // Update the user's profile with the new AI baseline
      await prisma.userProfile.update({
        where: { id: userProfileId },
        data: { workoutDaysPerWeek: averageWorkoutsPerWeek }
      });

      // Update sync timestamp
      await prisma.externalIntegration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date() }
      });

    } catch (error: any) {
      console.error(`[Google Fit] Error syncing data for user ${userProfileId}:`, error.message);
      // If token is permanently invalid, we could mark isActive = false
      if (error.code === 401 || error.code === 403) {
         await prisma.externalIntegration.update({
           where: { id: integration.id },
           data: { isActive: false }
         });
      }
    }
  }
}
