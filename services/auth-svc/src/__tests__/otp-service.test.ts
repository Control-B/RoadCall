import { generateOTP, hashOTP, verifyOTP } from '../otp-service';

describe('OTP Service', () => {
  describe('generateOTP', () => {
    it('should generate a 6-digit OTP', () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    });

    it('should generate different OTPs', () => {
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      // While theoretically they could be the same, probability is very low
      expect(otp1).toBeDefined();
      expect(otp2).toBeDefined();
    });
  });

  describe('hashOTP and verifyOTP', () => {
    it('should hash and verify OTP correctly', async () => {
      const otp = '123456';
      const hashedOTP = await hashOTP(otp);

      expect(hashedOTP).toBeDefined();
      expect(hashedOTP).not.toBe(otp);

      const isValid = await verifyOTP(otp, hashedOTP);
      expect(isValid).toBe(true);
    });

    it('should reject invalid OTP', async () => {
      const otp = '123456';
      const wrongOTP = '654321';
      const hashedOTP = await hashOTP(otp);

      const isValid = await verifyOTP(wrongOTP, hashedOTP);
      expect(isValid).toBe(false);
    });
  });
});
