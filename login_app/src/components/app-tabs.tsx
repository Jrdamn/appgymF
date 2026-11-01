import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  useColorScheme,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type ModuleTab = {
  route: string;
  label: string;
  icon: ImageSourcePropType;
};

const memberTabs: ModuleTab[] = [
  { route: 'index', label: 'Inicio', icon: require('@/assets/images/tabIcons/home.png') },
  { route: 'checkin', label: 'Acceso', icon: require('@/assets/images/tabIcons/checkin.png') },
  { route: 'store', label: 'Tienda', icon: require('@/assets/images/tabIcons/store.png') },
  { route: 'plans', label: 'Planes', icon: require('@/assets/images/tabIcons/plans.png') },
  { route: 'routines', label: 'Rutinas', icon: require('@/assets/images/tabIcons/routines.png') },
];

const adminTabs: ModuleTab[] = [
  { route: 'index', label: 'Inicio', icon: require('@/assets/images/tabIcons/home.png') },
  { route: 'checkin', label: 'Acceso', icon: require('@/assets/images/tabIcons/checkin.png') },
  { route: 'store', label: 'Tienda', icon: require('@/assets/images/tabIcons/store.png') },
  { route: 'routines', label: 'Rutinas', icon: require('@/assets/images/tabIcons/routines.png') },
  { route: 'explore', label: 'Usuarios', icon: require('@/assets/images/tabIcons/users.png') },
];

function ModuleTabBar({ state, navigation }: BottomTabBarProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabs = user?.role === 'admin' ? adminTabs : memberTabs;

  return (
    <View style={[styles.moduleTabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const route = state.routes.find((item) => item.name === tab.route);
        if (!route) return null;

        const isSelected = state.routes[state.index]?.name === tab.route;
        const color = isSelected ? '#79bdff' : '#aeb8c6';

        return (
          <Pressable
            key={tab.route}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isSelected && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={({ pressed }) => [
              styles.moduleTabButton,
              pressed && styles.moduleTabPressed,
            ]}
          >
            <View style={[styles.moduleTabIconWrap, isSelected && styles.moduleTabIconWrapSelected]}>
              <Image
                source={tab.icon}
                style={[styles.moduleTabIcon, { tintColor: color }]}
                resizeMode="contain"
              />
            </View>
            <ThemedText style={[styles.moduleTabLabel, { color }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const insets = useSafeAreaInsets();

  const [menuVisible, setMenuVisible] = useState(false);

  const isMembershipActive = () => {
    if (!user?.fecha_vencimiento) return false;
    const expiry = new Date(user.fecha_vencimiento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <ModuleTabBar {...props} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="checkin" />
        <Tabs.Screen name="store" />
        <Tabs.Screen name="plans" />
        <Tabs.Screen name="routines" />
        <Tabs.Screen name="explore" />
      </Tabs>

      {/* Floating Hamburger Button */}
      {!menuVisible && (
        <Pressable
          style={[
            styles.hamburgerButton,
            { top: insets.top > 0 ? insets.top + 8 : 25 }
          ]}
          onPress={() => setMenuVisible(true)}
        >
          <ThemedText style={styles.hamburgerIconText}>☰</ThemedText>
        </Pressable>
      )}

      {/* Absolute Side Drawer Overlay */}
      {menuVisible && (
        <View style={[StyleSheet.absoluteFillObject, styles.drawerOverlay]}>
          {/* Backdrop (tap to close) */}
          <Pressable style={styles.drawerBackdrop} onPress={() => setMenuVisible(false)} />
          
          {/* Drawer Content */}
          <ThemedView
            type="backgroundElement"
            style={[
              styles.drawerContent,
              {
                paddingTop: insets.top > 0 ? insets.top + Spacing.two : Spacing.four,
                paddingBottom: insets.bottom > 0 ? insets.bottom + Spacing.two : Spacing.four,
              }
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.drawerHeader}>
                <ThemedText type="subtitle" style={styles.drawerBrand}>
                  Shark Gym 🦈
                </ThemedText>
                <Pressable onPress={() => setMenuVisible(false)} style={styles.drawerCloseButton}>
                  <ThemedText style={{ color: '#aaa', fontSize: 18 }}>✕</ThemedText>
                </Pressable>
              </View>

              <View style={styles.drawerProfileInfo}>
                <View style={[styles.drawerAvatar, { backgroundColor: '#208AEF', overflow: 'hidden' }]}>
                  {user?.foto_perfil ? (
                    <Image source={{ uri: user.foto_perfil }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <ThemedText style={styles.drawerAvatarInitials}>
                      {user?.nombre ? user.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'U'}
                    </ThemedText>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ fontSize: 15, color: '#ffffff' }}>{user?.nombre || 'Usuario'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 12, marginTop: 1 }}>{user?.email}</ThemedText>
                  <View style={[styles.drawerBadge, { backgroundColor: isMembershipActive() ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isMembershipActive() ? '#4caf50' : '#f44336' }} />
                      <ThemedText style={[styles.drawerBadgeText, { color: isMembershipActive() ? '#4caf50' : '#ff4d4f' }]}>
                        {isMembershipActive() ? 'Pase Activo' : 'Pase Vencido'}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.drawerDivider} />

              <ScrollView contentContainerStyle={styles.drawerLinksContainer} showsVerticalScrollIndicator={false}>
                {/* Link: Inicio */}
                <Pressable
                  style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                  onPress={() => {
                    setMenuVisible(false);
                    router.push({ pathname: '/', params: { view: 'home' } });
                  }}
                >
                  <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(32, 138, 239, 0.15)' }]}>
                    <ThemedText style={styles.drawerLinkIcon}>🏠</ThemedText>
                  </View>
                  <ThemedText style={styles.drawerLinkText}>Inicio / Dashboard</ThemedText>
                </Pressable>

                {/* Link: Mi Perfil */}
                <Pressable
                  style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                  onPress={() => {
                    setMenuVisible(false);
                    router.push({ pathname: '/', params: { view: 'profile' } });
                  }}
                >
                  <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                    <ThemedText style={styles.drawerLinkIcon}>👤</ThemedText>
                  </View>
                  <ThemedText style={styles.drawerLinkText}>Mi Perfil</ThemedText>
                </Pressable>

                {/* Link: Métodos de Pago */}
                {!isAdmin && (
                  <Pressable
                    style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push({ pathname: '/', params: { view: 'payments' } });
                    }}
                  >
                    <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <ThemedText style={styles.drawerLinkIcon}>💳</ThemedText>
                    </View>
                    <ThemedText style={styles.drawerLinkText}>Métodos de Pago</ThemedText>
                  </Pressable>
                )}

                {/* Link: Tienda */}
                <Pressable
                  style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                  onPress={() => {
                    setMenuVisible(false);
                    router.push('/store');
                  }}
                >
                  <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <ThemedText style={styles.drawerLinkIcon}>🛒</ThemedText>
                  </View>
                  <ThemedText style={styles.drawerLinkText}>Shark Store (Tienda)</ThemedText>
                </Pressable>

                {/* Link: Planes */}
                {!isAdmin && (
                  <Pressable
                    style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/plans');
                    }}
                  >
                    <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                      <ThemedText style={styles.drawerLinkIcon}>💳</ThemedText>
                    </View>
                    <ThemedText style={styles.drawerLinkText}>Planes de Membresía</ThemedText>
                  </Pressable>
                )}

                {/* Link: Rutinas */}
                <Pressable
                  style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                  onPress={() => {
                    setMenuVisible(false);
                    router.push('/routines');
                  }}
                >
                  <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                    <ThemedText style={styles.drawerLinkIcon}>💪</ThemedText>
                  </View>
                  <ThemedText style={styles.drawerLinkText}>
                    {isAdmin ? 'Asignar Rutinas' : 'Rutinas de Ejercicio'}
                  </ThemedText>
                </Pressable>

                {/* Link: Gestión de Usuarios */}
                {isAdmin && (
                  <Pressable
                    style={({ pressed }) => [styles.drawerLink, pressed && styles.drawerLinkPressed]}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/explore');
                    }}
                  >
                    <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
                      <ThemedText style={styles.drawerLinkIcon}>👥</ThemedText>
                    </View>
                    <ThemedText style={styles.drawerLinkText}>Gestión de Usuarios</ThemedText>
                  </Pressable>
                )}
              </ScrollView>
            </View>

            <View>
              <View style={styles.drawerDivider} />
              <Pressable
                style={({ pressed }) => [styles.drawerLink, { marginBottom: Spacing.two }, pressed && styles.drawerLinkPressed]}
                onPress={() => {
                  setMenuVisible(false);
                  logout();
                }}
              >
                <View style={[styles.drawerIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <ThemedText style={styles.drawerLinkIcon}>🚪</ThemedText>
                </View>
                <ThemedText style={[styles.drawerLinkText, { color: '#ff4d4f', fontWeight: 'bold' }]}>Cerrar Sesión</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  moduleTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 82,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: '#080a0e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  moduleTabButton: {
    flex: 1,
    minWidth: 56,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 16,
  },
  moduleTabPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ scale: 0.96 }],
  },
  moduleTabIconWrap: {
    width: 44,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTabIconWrapSelected: {
    backgroundColor: 'rgba(32, 138, 239, 0.28)',
  },
  moduleTabIcon: {
    width: 27,
    height: 27,
  },
  moduleTabLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  hamburgerButton: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1677d2',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  hamburgerIconText: {
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 28,
  },
  drawerOverlay: {
    zIndex: 1000,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerContent: {
    width: 290,
    height: '100%',
    paddingHorizontal: Spacing.four,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#11141a',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  drawerBrand: {
    fontWeight: '800',
    color: '#ffffff',
  },
  drawerCloseButton: {
    padding: 6,
  },
  drawerProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  drawerAvatarInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  drawerBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  drawerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.two,
  },
  drawerLinksContainer: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  drawerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(32, 138, 239, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(32, 138, 239, 0.32)',
    gap: 14,
  },
  drawerLinkPressed: {
    backgroundColor: 'rgba(32, 138, 239, 0.25)',
    borderColor: 'rgba(91, 174, 255, 0.75)',
    transform: [{ scale: 0.98 }],
  },
  drawerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  drawerLinkIcon: {
    fontSize: 22,
  },
  drawerLinkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
});
