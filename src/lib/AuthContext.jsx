import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupabase, isLiveMode, isSupabaseConfigured } from "@/lib/supabaseClient";

const AuthContext = createContext(null);

const demoUser = {
  id: "user-demo-1",
  name: "Alex Demo",
  username: "alexdemo",
  coins: 1000,
  avatar:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop",
};

function mapProfile(user, profile) {
  return {
    id: user.id,
    email: user.email,
    name: profile?.display_name ?? user.email?.split("@")[0] ?? "User",
    username: profile?.username ?? "user",
    coins: profile?.coins ?? 1000,
    avatar:
      profile?.avatar_url ??
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop",
  };
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const useLiveAuth = isLiveMode() && isSupabaseConfigured();

  const [user, setUser] = useState(useLiveAuth ? null : demoUser);
  const [isLoadingAuth, setIsLoadingAuth] = useState(useLiveAuth);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (authUser) => {
    try {
      const supabase = getSupabase();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      if (error) {
        console.warn("Profile load error (non-fatal):", error.message);
      }
      setUser(mapProfile(authUser, profile));
    } catch (e) {
      console.warn("loadProfile failed (non-fatal):", e);
      setUser(mapProfile(authUser, null));
    }
    setAuthError(null);
  }, []);

  useEffect(() => {
    if (!useLiveAuth) return undefined;

    const supabase = getSupabase();

    const sessionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Session check timed out")), 8000)
    );

    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(({ data: { session } }) => {
        if (session?.user) {
          loadProfile(session.user).finally(() => setIsLoadingAuth(false));
        } else {
          setUser(null);
          setAuthError({ type: "auth_required" });
          setIsLoadingAuth(false);
        }
      })
      .catch((error) => {
        console.error("Auth session error:", error);
        setUser(null);
        setAuthError({ type: "auth_required" });
        setIsLoadingAuth(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          await loadProfile(session.user);
          setAuthError(null);
        } else {
          setUser(null);
          setAuthError({ type: "auth_required" });
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setUser(null);
        setAuthError({ type: "auth_error", message: error.message });
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [useLiveAuth, loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    navigate("/");
  }, [navigate]);

  const signUp = useCallback(async (email, password, username) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: username } },
    });
    if (error) throw error;
    navigate("/");
  }, [navigate]);

  const signOut = useCallback(async () => {
    if (useLiveAuth) {
      await getSupabase().auth.signOut();
    }
    setUser(null);
    navigate("/login");
  }, [useLiveAuth, navigate]);

  const updateUserSession = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const navigateToLogin = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  const value = useMemo(
    () => ({
      user,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      navigateToLogin,
      signIn,
      signUp,
      signOut,
      updateUserSession,
      isLiveAuth: useLiveAuth,
    }),
    [user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, signIn, signUp, signOut, updateUserSession, useLiveAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
