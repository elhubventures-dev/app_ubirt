import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureUserProfile, getAuthAvatarUrl, getAuthDisplayName, getOAuthRedirectUrl } from "@/lib/authHelpers";
import { resetAnalyticsUser } from "@/lib/monitoring";
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

const defaultAvatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop";

function mapProfile(user, profile) {
  return {
    id: user.id,
    email: user.email,
    name: profile?.display_name ?? getAuthDisplayName(user),
    username: profile?.username ?? user.user_metadata?.username ?? "user",
    coins: profile?.coins ?? 1000,
    avatar: profile?.avatar_url ?? getAuthAvatarUrl(user) ?? defaultAvatar,
  };
}

/** Show the app immediately from JWT metadata; enrich from DB in the background. */
function setUserFromSession(session, setUser, setAuthError) {
  if (!session?.user) {
    setUser(null);
    setAuthError({ type: "auth_required" });
    return false;
  }
  setUser(mapProfile(session.user, null));
  setAuthError(null);
  return true;
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const useLiveAuth = isLiveMode() && isSupabaseConfigured();

  const [user, setUser] = useState(useLiveAuth ? null : demoUser);
  const [isLoadingAuth, setIsLoadingAuth] = useState(useLiveAuth);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const bootstrappedRef = useRef(false);

  const hydrateProfile = useCallback(async (authUser) => {
    try {
      await ensureUserProfile(authUser);
      const { data: profile, error } = await getSupabase()
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      if (error) {
        console.warn("Profile hydrate error (keeping session user):", error.message);
        return;
      }
      setUser(mapProfile(authUser, profile));
    } catch (error) {
      console.warn("Profile hydrate failed (keeping session user):", error);
    }
  }, []);

  const finishBootstrap = useCallback(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      setIsLoadingAuth(false);
    }
  }, []);

  const retryAuth = useCallback(async () => {
    if (!useLiveAuth) return;
    bootstrappedRef.current = false;
    setAuthError(null);
    setIsLoadingAuth(true);

    try {
      const { data: { session }, error } = await getSupabase().auth.getSession();
      if (error) throw error;
      if (setUserFromSession(session, setUser, setAuthError)) {
        hydrateProfile(session.user);
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("Auth retry error:", error);
      setAuthError({ type: "auth_error", message: error.message });
    } finally {
      finishBootstrap();
    }
  }, [useLiveAuth, hydrateProfile, navigate, finishBootstrap]);

  useEffect(() => {
    if (!useLiveAuth) return undefined;

    const supabase = getSupabase();
    let active = true;
    bootstrappedRef.current = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Never await Supabase DB calls directly inside this callback (auth deadlock).
      setTimeout(async () => {
        if (!active) return;

        if (event === "INITIAL_SESSION") {
          setUserFromSession(session, setUser, setAuthError);
          if (session?.user) hydrateProfile(session.user);
          finishBootstrap();
          return;
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          setAuthError({ type: "auth_required" });
          return;
        }

        if (!session?.user) {
          setUser(null);
          setAuthError({ type: "auth_required" });
          return;
        }

        setUserFromSession(session, setUser, setAuthError);
        hydrateProfile(session.user);

        if (event === "SIGNED_IN") {
          const fromOAuth =
            window.location.hash.includes("access_token") ||
            window.location.search.includes("code=");
          if (fromOAuth) {
            window.history.replaceState(null, "", window.location.pathname || "/");
            navigate("/", { replace: true });
          }
        }
      }, 0);
    });

    // If INITIAL_SESSION never fires (rare), stop blocking the UI.
    const safetyTimer = setTimeout(() => {
      if (!active || bootstrappedRef.current) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!active || bootstrappedRef.current) return;
        setUserFromSession(session, setUser, setAuthError);
        if (session?.user) hydrateProfile(session.user);
        finishBootstrap();
      });
    }, 5000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [useLiveAuth, hydrateProfile, navigate, finishBootstrap]);

  const signIn = useCallback(
    async (email, password) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session?.user) {
        throw new Error("Sign in failed. Please try again.");
      }
      setUserFromSession(data.session, setUser, setAuthError);
      finishBootstrap();
      navigate("/", { replace: true });
      hydrateProfile(data.session.user);
    },
    [hydrateProfile, navigate, finishBootstrap]
  );

  const signUp = useCallback(
    async (email, password, username) => {
      const supabase = getSupabase();
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
        setUserFromSession(data.session, setUser, setAuthError);
        finishBootstrap();
        navigate("/", { replace: true });
        hydrateProfile(data.session.user);
        return;
      }

      if (data.user && !data.session) {
        throw new Error(
          "Account created. Check your email to confirm your address, then sign in."
        );
      }

      throw new Error("Sign up could not be completed. Please try again.");
    },
    [hydrateProfile, navigate, finishBootstrap]
  );

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw error;
  }, []);

  const signInWithApple = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email) => {
    const supabase = getSupabase();
    const redirectTo = `${import.meta.env.VITE_APP_URL || window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    navigate("/login", { replace: true });
  }, [navigate]);

  const signOut = useCallback(async () => {
    if (useLiveAuth) {
      await getSupabase().auth.signOut();
    }
    resetAnalyticsUser();
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
      retryAuth,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      updatePassword,
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
      retryAuth,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      updatePassword,
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
