import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { PrivateSettings, Profile } from "./types";

type Ctx = {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  settings: PrivateSettings | null;
  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<PrivateSettings>) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<PrivateSettings | null>(null);
  const userId = session?.user.id ?? null;

  const load = useCallback(async (uid: string | null) => {
    if (!uid) { setProfile(null); setSettings(null); return; }
    const [p, s] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("profile_private").select("*").eq("id", uid).maybeSingle(),
    ]);
    if (p.data) setProfile(p.data as Profile);
    if (s.data) setSettings(s.data as PrivateSettings);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await load(data.session?.user.id ?? null).catch(() => {});
      if (alive) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      load(s?.user.id ?? null).catch(() => {});
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [load]);

  const refresh = useCallback(() => load(userId), [load, userId]);

  const updateSettings = useCallback(async (patch: Partial<PrivateSettings>) => {
    if (!userId) return;
    setSettings((s) => (s ? { ...s, ...patch } : s));
    const { error } = await supabase.from("profile_private").update(patch).eq("id", userId);
    if (error) { await load(userId); throw error; }
  }, [userId, load]);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!userId) return { error: "not_authenticated" };
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select("*").single();
    if (error) return { error: error.code === "23505" ? "taken" : error.message };
    setProfile(data as Profile);
    return { error: null };
  }, [userId]);

  const value = useMemo(() => ({ ready, session, userId, profile, settings, refresh, updateSettings, updateProfile }),
    [ready, session, userId, profile, settings, refresh, updateSettings, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
