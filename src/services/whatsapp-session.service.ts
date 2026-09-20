import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Boom } from '@hapi/boom';

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED';

export interface WhatsAppConnectedInfo {
  phone: string | null;
  name: string | null;
  jid: string | null;
  platform?: string;
}

export class WhatsAppSessionService {
  private static socket: any = null;
  private static status: WhatsAppConnectionStatus = 'DISCONNECTED';
  private static qrCodeString: string | null = null;
  private static qrCodeDataUrl: string | null = null;
  private static connectedInfo: WhatsAppConnectedInfo | null = null;
  private static lastConnectedAt: Date | null = null;
  private static isInitializing: boolean = false;
  private static reconnectAttempts: number = 0;
  private static maxReconnectAttempts: number = 10;
  private static authDir: string = (
    process.env.VERCEL || 
    process.env.AWS_LAMBDA_FUNCTION_NAME || 
    process.cwd().startsWith('/var/task')
  )
    ? path.join(os.tmpdir(), 'whatsapp_auth')
    : path.join(process.cwd(), 'storage', 'whatsapp_auth');
  private static isAutomationEnabled: boolean = true;

  /**
   * Checks if valid WhatsApp session credentials already exist on disk
   */
  public static hasSavedSession(): boolean {
    const credsPath = path.join(this.authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    try {
      const data = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
      return !!(data && (data.me || data.registered || data.account));
    } catch {
      return false;
    }
  }

  /**
   * Initializes the WhatsApp Baileys multi-device socket
   * @param force - If true, starts initialization even if no saved credentials exist (e.g. when Admin requests QR)
   */
  static async init(force: boolean = false) {
    if (this.isInitializing || (this.socket && this.status === 'CONNECTED')) {
      return;
    }

    // On backend boot, only auto-init if an existing paired session is saved
    if (!force && !this.hasSavedSession()) {
      this.status = 'DISCONNECTED';
      return;
    }

    this.isInitializing = true;
    this.status = 'CONNECTING';

    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      let baileysModule: any;
      try {
        baileysModule = await (new Function('m', 'return import(m)')('@whiskeysockets/baileys') as Promise<any>);
      } catch (importErr) {
        console.warn('[WhatsApp] Baileys library could not be dynamically imported (unsupported on serverless):', importErr);
        this.status = 'DISCONNECTED';
        this.isInitializing = false;
        return;
      }

      const makeWASocket = baileysModule.default || baileysModule.makeWASocket;
      const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileysModule;

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
      }));

      const logger = pino({ level: 'silent' });

      // End previous socket if any
      if (this.socket) {
        try {
          this.socket.end(undefined);
        } catch (_) {}
        this.socket = null;
      }

      this.socket = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Sculpt & Shine Admin', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
      });

      // Save credentials on updates
      this.socket.ev.on('creds.update', saveCreds);

      // Connection update handler
      this.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeString = qr;
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 320,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
            this.status = 'SCAN_QR';
            this.reconnectAttempts = 0;
          } catch (err) {
            console.error('[WhatsApp] Failed to generate QR data URL:', err);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isPaired = this.hasSavedSession();

          this.status = 'DISCONNECTED';
          this.qrCodeString = null;
          this.qrCodeDataUrl = null;

          if (isLoggedOut) {
            console.log('[WhatsApp] Session logged out. Clearing auth credentials.');
            await this.clearAuthState();
            this.isInitializing = false;
            this.reconnectAttempts = 0;
          } else if (isPaired) {
            // Reconnect only if this was an active, authorized session experiencing a temporary network disconnect
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(5000 * this.reconnectAttempts, 30000);
              console.log(`[WhatsApp] Paired connection dropped. Reconnecting in ${delay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              setTimeout(() => {
                this.isInitializing = false;
                this.init(true);
              }, delay);
            } else {
              console.warn('[WhatsApp] Max reconnect attempts reached for paired session.');
            }
          } else {
            // Not paired / QR expired without scan -> cleanly stop, do NOT loop reconnect
            this.isInitializing = false;
            this.reconnectAttempts = 0;
          }
        } else if (connection === 'open') {
          console.log('✅ [WhatsApp] Direct Multi-Device Session Connected successfully!');
          this.status = 'CONNECTED';
          this.qrCodeString = null;
          this.qrCodeDataUrl = null;
          this.reconnectAttempts = 0;
          this.lastConnectedAt = new Date();

          const userJid = this.socket?.user?.id || '';
          const phone = userJid.split(':')[0].replace(/@.*/, '');
          const name = this.socket?.user?.name || this.socket?.user?.notify || 'Store Administrator';

          this.connectedInfo = {
            phone: phone ? `+${phone}` : 'Connected Account',
            name,
            jid: userJid,
            platform: 'WhatsApp Multi-Device',
          };
        }
      });
    } catch (error) {
      console.error('[WhatsApp] Error initializing WhatsApp socket:', error);
      this.status = 'DISCONNECTED';
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Clears saved authentication files from disk
   */
  private static async clearAuthState() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
      this.connectedInfo = null;
      this.lastConnectedAt = null;
      this.status = 'DISCONNECTED';
      this.qrCodeString = null;
      this.qrCodeDataUrl = null;
      this.reconnectAttempts = 0;
    } catch (err) {
      console.error('[WhatsApp] Failed to clear auth state folder:', err);
    }
  }

  /**
   * Get current session status & QR code
   */
  static getStatus() {
    return {
      status: this.status,
      connectedUser: this.connectedInfo,
      lastConnectedAt: this.lastConnectedAt,
      qrCode: this.qrCodeDataUrl,
      isConfigured: this.status === 'CONNECTED',
      isAutomationEnabled: this.isAutomationEnabled,
    };
  }

  /**
   * Toggle automated customer notifications on or off
   */
  static toggleAutomation(enabled: boolean) {
    this.isAutomationEnabled = enabled;
    return {
      success: true,
      isAutomationEnabled: this.isAutomationEnabled,
      message: `Automated WhatsApp notifications ${enabled ? 'enabled' : 'paused'}.`,
    };
  }

  /**
   * Explicitly triggers QR regeneration / re-initialization on admin request
   */
  static async requestQR() {
    if (this.status === 'CONNECTED') {
      return this.getStatus();
    }

    this.isInitializing = false;
    await this.init(true);

    return this.getStatus();
  }

  /**
   * Disconnects / unlinks current WhatsApp session
   */
  static async disconnect() {
    try {
      if (this.socket) {
        await this.socket.logout().catch(() => {});
        this.socket.end(new Error('Admin disconnected session'));
        this.socket = null;
      }
    } catch (err) {
      console.error('[WhatsApp] Error logging out socket:', err);
    }

    await this.clearAuthState();

    return { success: true, message: 'WhatsApp session disconnected successfully.' };
  }

  /**
   * Normalizes phone number to standard international WhatsApp JID format
   */
  static normalizePhoneNumber(to: string): string | null {
    let digits = to.replace(/\D/g, '');
    if (!digits) return null;

    // If 10-digit Indian number without country code, prefix with 91
    if (digits.length === 10) {
      digits = `91${digits}`;
    }

    return `${digits}@s.whatsapp.net`;
  }

  /**
   * Sends a message via the active WhatsApp multi-device session
   */
  static async sendMessage(to: string, message: string, force = false) {
    if (!force && !this.isAutomationEnabled) {
      console.log('[WhatsApp] Automated notifications are currently paused by Admin.');
      return { sent: false, skipped: true, reason: 'AUTOMATION_PAUSED' };
    }

    if (this.status !== 'CONNECTED' || !this.socket) {
      console.warn('[WhatsApp] Cannot send message: WhatsApp account is not connected.');
      return { sent: false, skipped: true, reason: 'WHATSAPP_NOT_CONNECTED' };
    }

    const recipientJid = this.normalizePhoneNumber(to);
    if (!recipientJid) {
      console.warn(`[WhatsApp] Invalid phone number provided: "${to}"`);
      return { sent: false, skipped: true, reason: 'INVALID_PHONE_NUMBER' };
    }

    try {
      const sentMessage = await this.socket.sendMessage(recipientJid, {
        text: message,
      });

      return {
        sent: true,
        messageId: sentMessage?.key?.id,
        recipient: recipientJid,
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Failed to send message to ${recipientJid}:`, error);
      throw error;
    }
  }

  /**
   * Sends a test message
   */
  static async sendTestMessage(to: string, customMessage?: string) {
    const text = customMessage || `🔔 *Sculpt & Shine Verification*\n\nThis is a test notification from your connected Sculpt & Shine store WhatsApp engine.\n\nTime: ${new Date().toLocaleString('en-IN')}\nStatus: System Operational ✅`;
    return await this.sendMessage(to, text);
  }
}
