import { AuthenticateWithRedirectCallback } from "@clerk/react";

/**
 * Completes Clerk OAuth redirect (Google / Apple).
 * Must stay outside the authenticated app shell.
 */
export default function SsoCallback() {
  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center text-slate-300 text-sm">
      <AuthenticateWithRedirectCallback />
      {/* Required when Clerk bot protection is enabled on sign-up */}
      <div id="clerk-captcha" />
    </div>
  );
}
