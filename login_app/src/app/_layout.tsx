import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginScreen from '@/components/LoginScreen';
import RegisterScreen from '@/components/RegisterScreen';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function AuthFlow() {
  const [currentScreen, setCurrentScreen] = React.useState<'login' | 'register'>('login');

  if (currentScreen === 'login') {
    return <LoginScreen onNavigateToRegister={() => setCurrentScreen('register')} />;
  }
  return <RegisterScreen onNavigateToLogin={() => setCurrentScreen('login')} />;
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Render nothing underneath splash overlay while reading SecureStore
  }

  if (!isAuthenticated) {
    return <AuthFlow />;
  }

  return <AppTabs />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

