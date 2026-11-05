import { ClerkProvider } from "@clerk/react";
import { AuthProvider } from "@/lib/AuthContext";
import { ClerkAuthBridge } from "@/lib/ClerkAuthBridge";
import { isClerkAuth } from "@/lib/platformConfig";

/**
 * Selects Clerk (Neon cutover) or legacy Supabase AuthProvider.
 */
export function PlatformAuthProvider({ children }) {
  if (isClerkAuth()) {
    const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    if (!key) {
      console.error("VITE_CLERK_PUBLISHABLE_KEY is required when VITE_AUTH_PROVIDER=clerk");
      return <AuthProvider>{children}</AuthProvider>;
    }
    return (
      <ClerkProvider publishableKey={key} afterSignOutUrl="/login">
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }

  return <AuthProvider>{children}</AuthProvider>;
}
