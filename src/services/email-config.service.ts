import { prisma } from '../config/prisma';
import nodemailer from 'nodemailer';

export class EmailConfigService {
  /**
   * Retrieves the current EmailConfig or creates a default disabled one if none exists.
   */
  static async getConfig() {
    let config = await prisma.emailConfig.findFirst();

    if (!config) {
      config = await prisma.emailConfig.create({
        data: {
          host: '',
          port: 465,
          secure: true,
          user: '',
          password: '',
          fromName: 'Sculpt & Shine',
          fromEmail: '',
          isEnabled: false,
        },
      });
    }

    return config;
  }

  /**
   * Updates or creates the EmailConfig.
   */
  static async upsertConfig(data: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
    isEnabled: boolean;
  }) {
    let config = await prisma.emailConfig.findFirst();

    const updateData: any = {
      host: data.host,
      port: data.port,
      secure: data.secure,
      user: data.user,
      isEnabled: data.isEnabled,
    };

    if (data.password) {
      updateData.password = data.password;
    }
    if (data.fromName !== undefined) {
      updateData.fromName = data.fromName;
    }
    if (data.fromEmail !== undefined) {
      updateData.fromEmail = data.fromEmail;
    }

    if (config) {
      config = await prisma.emailConfig.update({
        where: { id: config.id },
        data: updateData,
      });
    } else {
      config = await prisma.emailConfig.create({
        data: {
          ...updateData,
          password: data.password || '',
          fromName: data.fromName || 'Sculpt & Shine',
          fromEmail: data.fromEmail || data.user,
        },
      });
    }

    return config;
  }

  /**
   * Tests the SMTP connection with the provided credentials.
   */
  static async testConnection(data: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
  }) {
    let passwordToUse = data.password;

    // If password is not provided in test payload, try to fetch existing password
    if (!passwordToUse) {
      const existingConfig = await prisma.emailConfig.findFirst();
      if (existingConfig && existingConfig.password) {
        passwordToUse = existingConfig.password;
      } else {
        throw new Error("Password is required to test connection.");
      }
    }

    const transporter = nodemailer.createTransport({
      host: data.host,
      port: data.port,
      secure: data.secure,
      auth: {
        user: data.user,
        pass: passwordToUse,
      },
    });

    try {
      await transporter.verify();
      return { success: true, message: "Connection successful" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to connect to SMTP server" };
    }
  }
}
