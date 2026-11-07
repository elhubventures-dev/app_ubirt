import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/lib/AuthContext";
import { getApiUrl } from "@/lib/apiBase";
import { resetAnalyticsUser } from "@/lib/monitoring";
import { SIGNUP_BONUS_COINS } from "@/lib/wallet";

const defaultAvatar =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop";

async function waitForClerkClient(clerk) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (clerk?.loaded && clerk?.client?.signIn && clerk?.client?.signUp) {
      return clerk.client;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Auth is still loading. Please wait a moment and try again.");
}

function clerkErrorMessage(err, fallback) {
  return (
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    err?.message ||
    fallback
  );
}

/**
 * Bridges Clerk session into the same AuthContext shape as AuthProvider.
 * Uses the existing UBIRT login form (email/password) — does not open Clerk's hosted UI.
 *
 * Custom flows go through useClerk().client (not useSignIn/useSignUp together),
 * because those hooks can stay unloaded forever when both are mounted in one tree.
 */
export function ClerkAuthBridge({ children }) {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  /** @type {React.MutableRefObject<'signup' | 'signin' | null>} */
  const emailVerifyFlowRef = useRef(null);

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

  const signIn = useCallback(
    async (email, password) => {
      const client = await waitForClerkClient(clerk);
      emailVerifyFlowRef.current = null;

      try {
        const result = await client.signIn.create({
          identifier: email,
          password,
        });

        if (result.status === "complete" && result.createdSessionId) {
          await clerk.setActive({ session: result.createdSessionId });
          navigate("/", { replace: true });
          return { mfaRequired: false };
        }

        if (result.status === "needs_first_factor") {
          const emailFactor = result.supportedFirstFactors?.find(
            (f) => f.strategy === "email_code"
          );
          if (emailFactor?.emailAddressId) {
            await client.signIn.prepareFirstFactor({
              strategy: "email_code",
              emailAddressId: emailFactor.emailAddressId,
            });
            emailVerifyFlowRef.current = "signin";
            return { needsEmailVerification: true, flow: "signin" };
          }
        }

        // Password accepted but email code still required as another factor
        if (result.status === "needs_second_factor") {
          const emailFactor = result.supportedSecondFactors?.find(
            (f) => f.strategy === "email_code"
          );
          if (emailFactor) {
            await client.signIn.prepareSecondFactor({ strategy: "email_code" });
            emailVerifyFlowRef.current = "signin_second";
            return { needsEmailVerification: true, flow: "signin" };
          }
          const totpFactor = result.supportedSecondFactors?.find((f) => f.strategy === "totp");
          if (totpFactor) {
            return { mfaRequired: true, factorId: totpFactor.strategy };
          }
        }

        throw new Error("Sign in could not be completed. Check your email/password.");
      } catch (err) {
        throw new Error(clerkErrorMessage(err, "Sign in could not be completed."));
      }
    },
    [clerk, navigate]
  );

  const signUp = useCallback(
    async (email, password, username) => {
      const client = await waitForClerkClient(clerk);
      emailVerifyFlowRef.current = null;

      // Keep username in unsafeMetadata — Clerk Production may not have
      // the Username attribute enabled (sending `username` returns 422).
      // Neon profiles still get the handle via webhook / first /api/platform/me sync.
      const cleanUsername = String(username || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 30);

      const payload = {
        emailAddress: email,
        password,
      };
      if (cleanUsername) {
        payload.unsafeMetadata = { username: cleanUsername, display_name: cleanUsername };
      }

      try {
        const result = await client.signUp.create(payload);

        if (result.status === "complete" && result.createdSessionId) {
          await clerk.setActive({ session: result.createdSessionId });
          navigate("/", { replace: true });
          return { needsEmailVerification: false };
        }

        // Email verification required in Clerk Dashboard settings
        if (result.status === "missing_requirements") {
          const needsEmail = result.unverifiedFields?.includes("email_address");
          if (needsEmail) {
            await result.prepareEmailAddressVerification({ strategy: "email_code" });
            emailVerifyFlowRef.current = "signup";
            return { needsEmailVerification: true, flow: "signup" };
          }
        }

        throw new Error("Sign up could not be completed. Please try again.");
      } catch (err) {
        throw new Error(clerkErrorMessage(err, "Sign up could not be completed."));
      }
    },
    [clerk, navigate]
  );

  const verifyEmailCode = useCallback(
    async (code) => {
      const client = await waitForClerkClient(clerk);
      const trimmed = String(code || "").trim();
      if (!/^\d{6}$/.test(trimmed)) {
        throw new Error("Enter the 6-digit code from your email.");
      }

      const flow = emailVerifyFlowRef.current;

      try {
        if (flow === "signup") {
          const result = await client.signUp.attemptEmailAddressVerification({
            strategy: "email_code",
            code: trimmed,
          });
          if (result.status === "complete" && result.createdSessionId) {
            await clerk.setActive({ session: result.createdSessionId });
            emailVerifyFlowRef.current = null;
            navigate("/", { replace: true });
            return;
          }
          throw new Error("Verification incomplete. Try again or request a new code.");
        }

        if (flow === "signin") {
          const result = await client.signIn.attemptFirstFactor({
            strategy: "email_code",
            code: trimmed,
          });
          if (result.status === "complete" && result.createdSessionId) {
            await clerk.setActive({ session: result.createdSessionId });
            emailVerifyFlowRef.current = null;
            navigate("/", { replace: true });
            return;
          }
          if (result.status === "needs_second_factor") {
            throw new Error("Additional verification required. Contact support if this persists.");
          }
          throw new Error("Invalid or expired code. Try again.");
        }

        if (flow === "signin_second") {
          const result = await client.signIn.attemptSecondFactor({
            strategy: "email_code",
            code: trimmed,
          });
          if (result.status === "complete" && result.createdSessionId) {
            await clerk.setActive({ session: result.createdSessionId });
            emailVerifyFlowRef.current = null;
            navigate("/", { replace: true });
            return;
          }
          throw new Error("Invalid or expired code. Try again.");
        }

        throw new Error("No verification in progress. Sign up or sign in again.");
      } catch (err) {
        throw new Error(clerkErrorMessage(err, "Invalid or expired code. Try again."));
      }
    },
    [clerk, navigate]
  );

  const resendEmailCode = useCallback(async () => {
    const client = await waitForClerkClient(clerk);
    const flow = emailVerifyFlowRef.current;

    try {
      if (flow === "signup") {
        await client.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        return;
      }

      if (flow === "signin") {
        const emailFactor = client.signIn.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code"
        );
        if (!emailFactor?.emailAddressId) {
          throw new Error("Could not resend code. Sign in again.");
        }
        await client.signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });
        return;
      }

      if (flow === "signin_second") {
        await client.signIn.prepareSecondFactor({ strategy: "email_code" });
        return;
      }

      throw new Error("No verification in progress. Sign up or sign in again.");
    } catch (err) {
      throw new Error(clerkErrorMessage(err, "Could not resend the code."));
    }
  }, [clerk]);

  const startOAuth = useCallback(
    async (strategy) => {
      const client = await waitForClerkClient(clerk);
      const redirectUrl = `${window.location.origin}/sso-callback`;
      const redirectUrlComplete = `${window.location.origin}/`;

      // Prefer SignIn resource APIs — clerk.authenticateWithRedirect does not exist.
      if (typeof client.signIn?.authenticateWithRedirect === "function") {
        await client.signIn.authenticateWithRedirect({
          strategy,
          redirectUrl,
          redirectUrlComplete,
        });
        return;
      }

      if (typeof client.signIn?.sso === "function") {
        await client.signIn.sso({
          strategy,
          redirectCallbackUrl: redirectUrl,
          redirectUrl: redirectUrlComplete,
        });
        return;
      }

      throw new Error("OAuth sign-in is unavailable in this Clerk SDK build.");
    },
    [clerk]
  );

  const signInWithGoogle = useCallback(async () => {
    await startOAuth("oauth_google");
  }, [startOAuth]);

  const signInWithApple = useCallback(async () => {
    await startOAuth("oauth_apple");
  }, [startOAuth]);

  const resetPassword = useCallback(
    async (email) => {
      const client = await waitForClerkClient(clerk);
      await client.signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
    },
    [clerk]
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
      isLoadingAuth: !isLoaded,
      isLoadingPublicSettings: false,
      authError,
      navigateToLogin: () => navigate("/login", { replace: true }),
      retryAuth: async () => {},
      signIn,
      signUp,
      verifyEmailCode,
      resendEmailCode,
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
      authError,
      navigate,
      signIn,
      signUp,
      verifyEmailCode,
      resendEmailCode,
      signInWithGoogle,
      signInWithApple,
      resetPassword,
      signOut,
      clerk,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
