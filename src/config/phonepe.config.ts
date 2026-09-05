import crypto from 'crypto';
import axios from 'axios';

export interface PhonePeConfigType {
  isTestMode: boolean;
  clientId: string;
  clientSecret: string;
  clientVersion: string;
  merchantId: string;
  baseUrl: string;
  callbackUrl: string;
  redirectUrl: string;
  frontendUrl: string;
}

const parseClientSecret = (secret?: string): string => {
  if (!secret) return '';
  if (!secret.includes('-')) {
    try {
      const decoded = Buffer.from(secret, 'base64').toString('utf-8');
      if (decoded.includes('-')) {
        return decoded;
      }
    } catch {
      // ignore
    }
  }
  return secret;
};

export const phonepeConfig: PhonePeConfigType = {
  isTestMode: process.env.PAYMENT_TEST_MODE !== 'false',
  clientId: process.env.PHONEPE_CLIENT_ID || process.env.PHONEPE_MERCHANT_ID || 'SU2606191700471590659908',
  clientSecret: parseClientSecret(process.env.PHONEPE_CLIENT_SECRET || process.env.PHONEPE_SALT_KEY || 'd4959e2b-0e37-4ae9-9698-5c58db27d201'),
  clientVersion: process.env.PHONEPE_CLIENT_VERSION || process.env.PHONEPE_SALT_INDEX || '1',
  merchantId: process.env.PHONEPE_MERCHANT_ID || 'SU2606191700471590659908',
  baseUrl: process.env.PHONEPE_BASE_URL || 'https://api.phonepe.com/apis/hermes',
  callbackUrl: process.env.PHONEPE_CALLBACK_URL || 'http://localhost:5000/api/payments/phonepe/callback',
  redirectUrl: process.env.PHONEPE_REDIRECT_URL || 'http://localhost:3000/checkout',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};

class PhonePeClient {
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  get isProd(): boolean {
    return !phonepeConfig.isTestMode;
  }

  /**
   * Fetch OAuth access token for PhonePe V2 API.
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const authUrl = this.isProd
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', phonepeConfig.clientId);
    params.append('client_secret', phonepeConfig.clientSecret);
    params.append('client_version', phonepeConfig.clientVersion);

    try {
      const response = await axios.post(authUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        const expiresInMs = (response.data.expires_in || 3600) * 1000;
        this.tokenExpiry = Date.now() + expiresInMs;
        return this.accessToken!;
      } else {
        throw new Error('Failed to fetch PhonePe OAuth token: invalid response');
      }
    } catch (error: any) {
      console.error('PhonePe OAuth error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch PhonePe V2 access token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create PhonePe V2 payment session
   */
  async createPaymentOrder(params: {
    merchantTransactionId: string;
    amount: number; // in rupees
    userId: string;
    orderId: string;
    mobileNumber?: string;
  }): Promise<{ isTestMode: boolean; merchantTransactionId: string; paymentUrl: string; rawResponse?: any }> {
    const { merchantTransactionId, amount, userId, orderId } = params;

    // Normal payment in test mode (no gateway needed)
    if (!this.isProd) {
      console.log(`🧪 [Payment] PAYMENT_TEST_MODE is true. Creating simulated payment redirect for ${merchantTransactionId}`);
      const simulatedRedirectUrl = `${phonepeConfig.callbackUrl}?merchantTransactionId=${merchantTransactionId}&code=PAYMENT_SUCCESS&transactionId=SIMULATED_${Date.now()}`;
      return {
        isTestMode: true,
        merchantTransactionId,
        paymentUrl: simulatedRedirectUrl,
      };
    }

    // Real PhonePe V2 API in Production
    const amountInPaise = Math.round(amount * 100);
    const redirectUrl = `${phonepeConfig.redirectUrl}?status=pending&order_id=${orderId}&txn=${merchantTransactionId}`;

    const payload = {
      merchantOrderId: merchantTransactionId,
      amount: amountInPaise,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        merchantUrls: {
          redirectUrl,
        },
      },
      metaInfo: {
        udf1: String(userId || ''),
        udf2: String(orderId || ''),
      },
    };

    const token = await this.getAccessToken();
    const payUrl = 'https://api.phonepe.com/apis/pg/checkout/v2/pay';

    console.log(`[PhonePe V2] Initiating payment for order ${orderId} (${amountInPaise} paise)`);

    try {
      const response = await axios.post(payUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `O-Bearer ${token}`,
        },
      });

      const data = response.data;
      const checkoutRedirectUrl =
        data?.redirectUrl ||
        data?.data?.instrumentResponse?.redirectInfo?.url ||
        data?.instrumentResponse?.redirectInfo?.url;

      if (checkoutRedirectUrl) {
        return {
          isTestMode: false,
          merchantTransactionId,
          paymentUrl: checkoutRedirectUrl,
          rawResponse: data,
        };
      }

      throw new Error(`PhonePe API did not return redirect URL: ${JSON.stringify(data)}`);
    } catch (error: any) {
      const errData = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error('PhonePe V2 order creation error:', errData);
      throw new Error(`Failed to create PhonePe payment: ${errData}`);
    }
  }

  /**
   * Check status of transaction
   */
  async checkTransactionStatus(merchantTransactionId: string): Promise<any> {
    if (!this.isProd) {
      return {
        success: true,
        code: 'PAYMENT_SUCCESS',
        state: 'COMPLETED',
        merchantOrderId: merchantTransactionId,
        orderId: `test_pp_gateway_${merchantTransactionId}`,
        transactionId: `test_txn_${Date.now()}`,
        message: 'Test payment simulated',
      };
    }

    try {
      const token = await this.getAccessToken();
      const statusUrl = `https://api.phonepe.com/apis/pg/checkout/v2/order/${merchantTransactionId}/status`;

      const response = await axios.get(statusUrl, {
        params: {
          details: false,
          errorContext: true,
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `O-Bearer ${token}`,
        },
      });

      const data = response.data;
      const state = data.state || data.data?.state;
      const isSuccess = String(state || '').toUpperCase() === 'COMPLETED';

      return {
        success: isSuccess,
        state,
        code: data.code,
        merchantOrderId: data.merchantOrderId || merchantTransactionId,
        orderId: data.orderId,
        transactionId: data.transactionId,
        rawResponse: data,
      };
    } catch (error: any) {
      console.error('PhonePe V2 status check error:', error.response?.data || error.message);
      throw new Error(`Failed to check PhonePe transaction status: ${error.message}`);
    }
  }
}

export const phonepeClient = new PhonePeClient();
