import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MapTheme, PlaceResult, UnitSystem } from './types';

const STORAGE_KEY = 'uk-live-nav:settings:v1';
const RECENTS_KEY = 'uk-live-nav:recents:v1';

interface Settings {
  unit: UnitSystem;
  mapTheme: MapTheme;
  voiceGuidance: boolean;
  cameraAlerts: boolean;
}

interface AppState extends Settings {
  recents: PlaceResult[];
  setUnit: (u: UnitSystem) => void;
  setMapTheme: (t: MapTheme) => void;
  setVoiceGuidance: (v: boolean) => void;
  setCameraAlerts: (v: boolean) => void;
  addRecent: (p: PlaceResult) => void;
  clearRecents: () => void;
}

const defaultSettings: Settings = {
  unit: 'imperial',
  mapTheme: 'night',
  voiceGuidance: true,
  cameraAlerts: true,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [recents, setRecents] = useState<PlaceResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) });
        const rawRecents = await AsyncStorage.getItem(RECENTS_KEY);
        if (rawRecents) setRecents(JSON.parse(rawRecents));
      } catch {
        // ignore corrupt storage
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(recents)).catch(() => {});
  }, [recents, loaded]);

  const setUnit = useCallback((unit: UnitSystem) => setSettings((s) => ({ ...s, unit })), []);
  const setMapTheme = useCallback((mapTheme: MapTheme) => setSettings((s) => ({ ...s, mapTheme })), []);
  const setVoiceGuidance = useCallback((voiceGuidance: boolean) => setSettings((s) => ({ ...s, voiceGuidance })), []);
  const setCameraAlerts = useCallback((cameraAlerts: boolean) => setSettings((s) => ({ ...s, cameraAlerts })), []);

  const addRecent = useCallback((p: PlaceResult) => {
    setRecents((r) => {
      const filtered = r.filter((x) => x.id !== p.id);
      return [p, ...filtered].slice(0, 8);
    });
  }, []);

  const clearRecents = useCallback(() => setRecents([]), []);

  const value = useMemo<AppState>(
    () => ({ ...settings, recents, setUnit, setMapTheme, setVoiceGuidance, setCameraAlerts, addRecent, clearRecents }),
    [settings, recents, setUnit, setMapTheme, setVoiceGuidance, setCameraAlerts, addRecent, clearRecents]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
