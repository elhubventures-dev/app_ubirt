import { useAuth as useClerkAuth, useUser, useClerk, useSignIn, useSignUp } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/lib/AuthContext";
import { getApiUrl } from "@/lib/apiBase";
import { resetAnalyticsUser } from "@/lib/monitoring";
import { SIGNUP_BONUS_COINS } from "@/lib/wallet";

const defaultAvatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop";

/**
 * Bridges Clerk session into the same AuthContext shape as AuthProvider.
 * Uses the existing UBIRT login form (email/password) — does not open Clerk's hosted UI.
 */
export function ClerkAuthBridge({ children }) {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const { signIn: clerkSignIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp: clerkSignUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    window.__ubirtGetClerkToken = async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    };
    return () => {
      delete window.__ubirtGetClerkToken;
    };
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setUser(null);
      setAuthError({ type: "auth_required" });
      return;
    }

    let cancelled = false;

    (async () => {
      const token = await getToken();
      let profile = null;
      if (token) {
        try {
          const res = await fetch(getApiUrl("/api/platform/me"), {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (res.ok) profile = json.profile;
        } catch {
          // keep clerk metadata
        }
      }
      if (cancelled) return;

      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      setUser({
        id: profile?.id || clerkUser.id,
        email,
        phone: profile?.phone ?? "",
        name:
          profile?.display_name ||
          clerkUser.fullName ||
          clerkUser.username ||
          email.split("@")[0],
        username: profile?.username || clerkUser.username || email.split("@")[0] || "user",
        coins: profile?.coins ?? SIGNUP_BONUS_COINS,
        giftCoins: profile?.gift_coins ?? 0,
        avatar: profile?.avatar_url || clerkUser.imageUrl || defaultAvatar,
        cover: profile?.cover_url ?? "",
        bio: profile?.bio ?? "",
        website: profile?.website ?? "",
        location: profile?.location ?? "",
      });
      setAuthError(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, clerkUser, getToken]);

  const waitForSignIn = useCallback(async () => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (signInLoaded && clerkSignIn) return clerkSignIn;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth is still loading. Please wait a moment and try again.");
  }, [signInLoaded, clerkSignIn]);

  const waitForSignUp = useCallback(async () => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (signUpLoaded && clerkSignUp) return clerkSignUp;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Auth is still loading. Please wait a moment and try again.");
  }, [signUpLoaded, clerkSignUp]);

  const signIn = useCallback(
    async (email, password) => {
      const readySignIn = await waitForSignIn();

      const result = await readySignIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActiveSignIn({ session: result.createdSessionId });
        navigate("/", { replace: true });
        return { mfaRequired: false };
      }

      if (result.status === "needs_second_factor") {
        const factor = result.supportedSecondFactors?.find((f) => f.strategy === "totp");
        if (factor) {
          return { mfaRequired: true, factorId: factor.strategy };
        }
      }

      throw new Error("Sign in could not be completed. Check your email/password.");
    },
    [waitForSignIn, setActiveSignIn, navigate]
  );

  const signUp = useCallback(
    async (email, password, username) => {
      const readySignUp = await waitForSignUp();

      const payload = {
        emailAddress: email,
        password,
      };
      const cleanUsername = String(username || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 30);
      if (cleanUsername) {
        payload.username = cleanUsername;
      }

      const result = await readySignUp.create(payload);

      if (result.status === "complete" && result.createdSessionId) {
        await setActiveSignUp({ session: result.createdSessionId });
        navigate("/", { replace: true });
        return;
      }

      // Email verification required in Clerk Dashboard settings
      if (result.status === "missing_requirements") {
        const needsEmail = result.unverifiedFields?.includes("email_address");
        if (needsEmail) {
          await readySignUp.prepareEmailAddressVerification({ strategy: "email_code" });
          throw new Error(
            "Check your email for a verification code, then sign in. (Or disable email verification in Clerk for smoother signup.)"
          );
        }
      }

      throw new Error("Sign up could not be completed. Please try again.");
    },
    [waitForSignUp, setActiveSignUp, navigate]
  );

  const signInWithGoogle = useCallback(async () => {
    await clerk.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: `${window.location.origin}/login`,
      redirectUrlComplete: `${window.location.origin}/`,
    });
  }, [clerk]);

  const signInWithApple = useCallback(async () => {
    await clerk.authenticateWithRedirect({
      strategy: "oauth_apple",
      redirectUrl: `${window.location.origin}/login`,
      redirectUrlComplete: `${window.location.origin}/`,
    });
  }, [clerk]);

  const resetPassword = useCallback(
    async (email) => {
      const readySignIn = await waitForSignIn();
      await readySignIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
    },
    [waitForSignIn]
  );

  const signOut = useCallback(async () => {
    await clerkSignOut();
    resetAnalyticsUser();
    setUser(null);
    setAuthError({ type: "auth_required" });
    navigate("/login", { replace: true });
  }, [clerkSignOut, navigate]);

  const value = useMemo(
    () => ({
      user,
      // Gate the login form until session + sign-in/sign-up clients are ready
      isLoadingAuth: !isLoaded || !signInLoaded || !signUpLoaded,
      isLoadingPublicSettings: false,
      authError,
      navigateToLogin: () => navigate("/login", { replace: true }),
      retryAuth: async () => {},
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      updatePassword: async () => {
        await clerk.openUserProfile();
      },
      changeEmail: async () => {
        await clerk.openUserProfile();
      },
      changePassword: async () => {
        await clerk.openUserProfile();
      },
      signOut,
      signOutAllSessions: signOut,
      deleteAccount: async () => {
        throw new Error("Delete account via Clerk Dashboard or support in Neon mode.");
      },
      updateUserSession: (updates) => setUser((prev) => (prev ? { ...prev, ...updates } : null)),
      isLiveAuth: true,
    }),
    [
      user,
      isLoaded,
      signInLoaded,
      signUpLoaded,
      authError,
      navigate,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      signOut,
      clerk,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
