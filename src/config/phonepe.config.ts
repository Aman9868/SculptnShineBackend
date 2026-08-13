import crypto from 'crypto';

export const phonepeConfig = {
  isTestMode: process.env.PAYMENT_TEST_MODE === 'true',
  merchantId: process.env.PHONEPE_MERCHANT_ID || 'ONLINEPGUAT',
  saltKey: process.env.PHONEPE_SALT_KEY || '099eb0cd-02aa-4e96-a76f-2e55162824c4',
  saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
  hostUrl: process.env.PHONEPE_HOST_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  callbackUrl: process.env.PHONEPE_CALLBACK_URL || 'http://localhost:5000/api/payments/phonepe/callback',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};

/**
 * Generate base64 payload string for PhonePe /pg/v1/pay API
 */
export const createPhonePePayload = (params: {
  merchantTransactionId: string;
  userId: string;
  amount: number; // in rupees
  mobileNumber?: string;
  redirectUrl: string;
}): { base64Payload: string; rawPayload: object } => {
  const payload = {
    merchantId: phonepeConfig.merchantId,
    merchantTransactionId: params.merchantTransactionId,
    merchantUserId: params.userId,
    amount: Math.round(params.amount * 100), // amount in paise
    redirectUrl: params.redirectUrl,
    redirectMode: 'POST',
    callbackUrl: phonepeConfig.callbackUrl,
    mobileNumber: params.mobileNumber || '9999999999',
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  const jsonString = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonString).toString('base64');
  return { base64Payload, rawPayload: payload };
};

/**
 * Generate X-VERIFY checksum header for PhonePe request
 * Formula: SHA256(base64Payload + apiEndpoint + saltKey) + "###" + saltIndex
 */
export const generatePhonePeChecksum = (base64Payload: string, apiEndpoint: string = '/pg/v1/pay'): string => {
  const dataToHash = base64Payload + apiEndpoint + phonepeConfig.saltKey;
  const sha256 = crypto.createHash('sha256').update(dataToHash).digest('hex');
  return `${sha256}###${phonepeConfig.saltIndex}`;
};

/**
 * Generate X-VERIFY checksum for status check GET request
 * Formula: SHA256("/pg/v1/status/" + merchantId + "/" + merchantTransactionId + saltKey) + "###" + saltIndex
 */
export const generatePhonePeStatusChecksum = (merchantTransactionId: string): string => {
  const apiEndpoint = `/pg/v1/status/${phonepeConfig.merchantId}/${merchantTransactionId}`;
  const dataToHash = apiEndpoint + phonepeConfig.saltKey;
  const sha256 = crypto.createHash('sha256').update(dataToHash).digest('hex');
  return `${sha256}###${phonepeConfig.saltIndex}`;
};

/**
 * Verify response/callback checksum from PhonePe
 */
export const verifyPhonePeChecksum = (responseBase64: string, receivedChecksum: string): boolean => {
  const dataToHash = responseBase64 + phonepeConfig.saltKey;
  const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  const expectedChecksum = `${calculatedHash}###${phonepeConfig.saltIndex}`;
  return expectedChecksum === receivedChecksum;
};
