import React, { useState } from 'react';
import { LoginScreen } from '@/src/screens/auth/LoginScreen';
import { RegisterScreen } from '@/src/screens/auth/RegisterScreen';

interface AuthNavigatorProps {
  onAuthSuccess: () => void;
}

type AuthScreen = 'login' | 'register';

export function AuthNavigator({ onAuthSuccess }: AuthNavigatorProps) {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('login');

  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onNavigateToRegister={() => setCurrentScreen('register')}
        onLoginSuccess={onAuthSuccess}
      />
    );
  }

  return (
    <RegisterScreen
      onNavigateToLogin={() => setCurrentScreen('login')}
      onRegisterSuccess={onAuthSuccess}
    />
  );
}
