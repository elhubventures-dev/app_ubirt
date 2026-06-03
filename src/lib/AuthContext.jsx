import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureUserProfile } from "@/lib/authHelpers";
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

  const applySession = useCallback(async (session) => {
    if (session?.user) {
      await ensureUserProfile(session.user);
      const supabase = getSupabase();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.warn("Profile load error (using fallback):", error.message);
      }
      setUser(mapProfile(session.user, profile));
      setAuthError(null);
      return true;
    }

    setUser(null);
    setAuthError({ type: "auth_required" });
    return false;
  }, []);

  useEffect(() => {
    if (!useLiveAuth) return undefined;

    const supabase = getSupabase();
    let active = true;

    const boot = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) await applySession(session);
      } catch (error) {
        console.error("Auth bootstrap error:", error);
        if (active) {
          setUser(null);
          setAuthError({ type: "auth_error", message: error.message });
        }
      } finally {
        if (active) setIsLoadingAuth(false);
      }
    };

    const fallbackTimeout = setTimeout(() => {
      if (active) {
        console.error("Auth boot timed out after 10 seconds.");
        setAuthError({ type: "auth_error", message: "Connection timed out. Please check your Supabase configuration." });
        setIsLoadingAuth(false);
      }
    }, 10000);

    boot().finally(() => clearTimeout(fallbackTimeout));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      // getSession() handles the first load; avoid clearing session twice
      if (event === "INITIAL_SESSION") return;

      setIsLoadingAuth(true);
      try {
        await applySession(session);
      } catch (error) {
        console.error("Auth state change error:", error);
        setUser(null);
        setAuthError({ type: "auth_error", message: error.message });
      } finally {
        if (active) setIsLoadingAuth(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [useLiveAuth, applySession]);

  const signIn = useCallback(
    async (email, password) => {
      const supabase = getSupabase();
      setIsLoadingAuth(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session?.user) {
          throw new Error("Sign in failed. Please try again.");
        }
        await applySession(data.session);
        navigate("/", { replace: true });
      } finally {
        setIsLoadingAuth(false);
      }
    },
    [applySession, navigate]
  );

  const signUp = useCallback(
    async (email, password, username) => {
      const supabase = getSupabase();
      setIsLoadingAuth(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username, display_name: username },
            emailRedirectTo: `${import.meta.env.VITE_APP_URL || window.location.origin}/login`,
          },
        });
        if (error) throw error;

        if (data.session?.user) {
          await applySession(data.session);
          navigate("/", { replace: true });
          return;
        }

        if (data.user && !data.session) {
          throw new Error(
            "Account created. Check your email to confirm your address, then sign in."
          );
        }

        throw new Error("Sign up could not be completed. Please try again.");
      } finally {
        setIsLoadingAuth(false);
      }
    },
    [applySession, navigate]
  );

  const signOut = useCallback(async () => {
    if (useLiveAuth) {
      await getSupabase().auth.signOut();
    }
    setUser(null);
    setAuthError({ type: "auth_required" });
    navigate("/login", { replace: true });
  }, [useLiveAuth, navigate]);

  const updateUserSession = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const navigateToLogin = useCallback(() => {
    navigate("/login", { replace: true });
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
    [
      user,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      navigateToLogin,
      signIn,
      signUp,
      signOut,
      updateUserSession,
      useLiveAuth,
    ]
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
