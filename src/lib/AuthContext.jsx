import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureUserProfile, getAuthAvatarUrl, getAuthDisplayName, getOAuthRedirectUrl } from "@/lib/authHelpers";
import { hasNativeWebviewOAuthCallback, hasPendingWebOAuth, isNativePlatform } from "@/lib/platform";
import { resetAnalyticsUser } from "@/lib/monitoring";
import { getApiUrl } from "@/lib/apiBase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { SIGNUP_BONUS_COINS } from "@/lib/wallet";

const AuthContext = createContext(null);

const demoUser = {
  id: "user-demo-1",
  name: "Alex Demo",
  username: "alexdemo",
  email: "demo@ubirt.ai",
  coins: SIGNUP_BONUS_COINS,
  giftCoins: 0,
  bio: "",
  phone: "",
  website: "",
  location: "",
  avatar:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop",
};

const defaultAvatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop";

function mapProfile(user, profile) {
  return {
    id: user.id,
    email: user.email,
    phone: profile?.phone ?? user.phone ?? "",
    name: profile?.display_name ?? getAuthDisplayName(user),
    username: profile?.username ?? user.user_metadata?.username ?? "user",
    coins: profile?.coins ?? SIGNUP_BONUS_COINS,
    giftCoins: profile?.gift_coins ?? 0,
    avatar: profile?.avatar_url ?? getAuthAvatarUrl(user) ?? defaultAvatar,
    cover: profile?.cover_url ?? "",
    bio: profile?.bio ?? "",
    website: profile?.website ?? "",
    location: profile?.location ?? "",
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
  const useLiveAuth = isSupabaseConfigured();

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
      // Update React auth state synchronously so native OAuth navigation does not
      // briefly hit AuthenticatedApp with stale auth_required and bounce to /login.
      if (event === "INITIAL_SESSION") {
        // OAuth redirect lands with ?code= before Supabase finishes PKCE exchange.
        // Do not treat a null session as signed-out yet or the code is dropped.
        if (!session?.user && (hasPendingWebOAuth() || hasNativeWebviewOAuthCallback())) {
          return;
        }
        setUserFromSession(session, setUser, setAuthError);
        finishBootstrap();
        if (session?.user) {
          setTimeout(() => {
            if (active) hydrateProfile(session.user);
          }, 0);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setAuthError({ type: "auth_required" });
        return;
      }

      if (!session?.user) {
        if (hasPendingWebOAuth() || hasNativeWebviewOAuthCallback()) return;
        setUser(null);
        setAuthError({ type: "auth_required" });
        return;
      }

      setUserFromSession(session, setUser, setAuthError);
      finishBootstrap();

      if (event === "SIGNED_IN") {
        const fromOAuth =
          isNativePlatform() ||
          window.location.hash.includes("access_token") ||
          window.location.search.includes("code=");
        if (fromOAuth) {
          if (isNativePlatform()) {
            import("@capacitor/browser")
              .then(({ Browser }) => Browser.close().catch(() => {}))
              .catch(() => {});
            window.history.replaceState(null, "", "/");
          } else {
            window.history.replaceState(null, "", window.location.pathname || "/");
          }
          navigate("/", { replace: true });
        }
      }

      // Never await Supabase DB calls directly inside this callback (auth deadlock).
      setTimeout(() => {
        if (active) hydrateProfile(session.user);
      }, 0);
    });

    const pendingOAuth = hasPendingWebOAuth();

    // If auth never settles (or OAuth exchange fails), stop blocking the UI.
    const safetyTimer = setTimeout(() => {
      if (!active || bootstrappedRef.current) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!active || bootstrappedRef.current) return;
        if (!session?.user && hasPendingWebOAuth()) {
          setAuthError({
            type: "auth_error",
            message: "Sign-in could not be completed. Please try again.",
          });
          window.history.replaceState(null, "", "/login");
          navigate("/login", { replace: true });
        } else {
          setUserFromSession(session, setUser, setAuthError);
          if (session?.user) hydrateProfile(session.user);
        }
        finishBootstrap();
      });
    }, pendingOAuth ? 15000 : 5000);

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

  const signInWithOAuthProvider = useCallback(async (provider) => {
    const supabase = getSupabase();
    const redirectTo = getOAuthRedirectUrl();

    if (isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(provider === "google"
            ? { queryParams: { access_type: "offline", prompt: "consent" } }
            : {}),
        },
      });
      if (error) throw error;
      if (data?.url) {
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(provider === "google"
          ? { queryParams: { access_type: "offline", prompt: "consent" } }
          : {}),
      },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithOAuthProvider("google");
  }, [signInWithOAuthProvider]);

  const signInWithApple = useCallback(async () => {
    await signInWithOAuthProvider("apple");
  }, [signInWithOAuthProvider]);

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

  const changeEmail = useCallback(async (newEmail) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) throw error;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const supabase = getSupabase();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("Not authenticated");

    const hasEmailIdentity = authUser.identities?.some((i) => i.provider === "email");
    if (hasEmailIdentity && authUser.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Current password is incorrect");
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (useLiveAuth) {
      await getSupabase().auth.signOut();
    }
    resetAnalyticsUser();
    setUser(null);
    setAuthError({ type: "auth_required" });
    navigate("/login", { replace: true });
  }, [useLiveAuth, navigate]);

  const deleteAccount = useCallback(async () => {
    if (!useLiveAuth) {
      setUser(null);
      navigate("/login", { replace: true });
      return;
    }
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }

    const res = await fetch(getApiUrl("/api/account/delete"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Failed to delete account");
    }

    await supabase.auth.signOut();
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
      changeEmail,
      changePassword,
      signOut,
      deleteAccount,
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
      changeEmail,
      changePassword,
      signOut,
      deleteAccount,
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
