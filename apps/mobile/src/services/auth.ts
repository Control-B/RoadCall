import {
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  resendSignUpCode,
} from 'aws-amplify/auth';
import { User } from '../types';

export const registerUser = async (
  phone: string,
  name: string,
  role: 'driver' | 'vendor',
  additionalData?: Record<string, string>
): Promise<void> => {
  try {
    await signUp({
      username: phone,
      password: generateTemporaryPassword(),
      options: {
        userAttributes: {
          phone_number: phone,
          name,
          'custom:role': role,
          ...additionalData,
        },
        autoSignIn: true,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const verifyOTP = async (
  phone: string,
  code: string
): Promise<boolean> => {
  try {
    await confirmSignUp({
      username: phone,
      confirmationCode: code,
    });
    return true;
  } catch (error) {
    console.error('OTP verification error:', error);
    return false;
  }
};

export const resendOTP = async (phone: string): Promise<void> => {
  try {
    await resendSignUpCode({
      username: phone,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    throw error;
  }
};

export const loginWithPhone = async (
  phone: string,
  password: string
): Promise<void> => {
  try {
    await signIn({
      username: phone,
      password,
    });
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getCurrentUserInfo = async (): Promise<User | null> => {
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();

    if (!user || !session.tokens) {
      return null;
    }

    const idToken = session.tokens.idToken;
    const payload = idToken?.payload;

    return {
      userId: user.userId,
      phone: (payload?.phone_number as string) || '',
      role: (payload?.['custom:role'] as 'driver' | 'vendor') || 'driver',
      name: (payload?.name as string) || '',
      email: payload?.email as string | undefined,
      companyId: payload?.['custom:companyId'] as string | undefined,
      truckNumber: payload?.['custom:truckNumber'] as string | undefined,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('Get auth token error:', error);
    return null;
  }
};

// Helper function to generate a temporary password for phone-based auth
function generateTemporaryPassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
