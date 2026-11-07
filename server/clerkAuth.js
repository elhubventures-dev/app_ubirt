import { createClerkClient, verifyToken } from "@clerk/backend";
import { getNeonSql, isNeonConfigured } from "./neon.js";

export function isClerkConfigured() {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

export function getClerkClient() {
  if (!isClerkConfigured()) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

/**
 * Verify Clerk session JWT and resolve app user id (UUID in app_users when Neon is live).
 * @returns {Promise<{ user: { id: string, email?: string, clerkId?: string }, error?: undefined } | { error: { status: number, message: string } }>}
 */
export async function authenticateClerkRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: { status: 401, message: "Missing auth token" } };
  }
  if (!isClerkConfigured()) {
    return { error: { status: 500, message: "Clerk is not configured" } };
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const clerkId = payload.sub;
    if (!clerkId) {
      return { error: { status: 401, message: "Unauthorized" } };
    }

    let appUserId = clerkId;
    let email = payload.email || payload.primary_email_address || undefined;

    if (isNeonConfigured()) {
      const sql = getNeonSql();
      let rows = await sql`
        select id, email from public.app_users where clerk_id = ${clerkId} limit 1
      `;

      // Webhook may not have fired yet (local/dev or missing Vercel env) — sync on first API call.
      if (!rows?.[0]?.id) {
        try {
          const clerk = getClerkClient();
          const clerkUser = await clerk.users.getUser(clerkId);
          const primaryEmail =
            clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
              ?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;
          const meta = clerkUser.unsafeMetadata || clerkUser.publicMetadata || {};
          const synced = await syncClerkUserToNeon({
            clerkId,
            email: primaryEmail,
            username: clerkUser.username || meta.username || undefined,
            displayName:
              meta.display_name ||
              [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
              clerkUser.username ||
              meta.username ||
              primaryEmail,
            avatarUrl: clerkUser.imageUrl || null,
            emailVerified: Boolean(
              clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
                ?.verification?.status === "verified"
            ),
          });
          rows = [{ id: synced.id, email: synced.email }];
        } catch (syncError) {
          console.warn("Clerk→Neon sync on auth failed:", syncError?.message || syncError);
        }
      }

      if (rows?.[0]?.id) {
        appUserId = rows[0].id;
        email = rows[0].email || email;
      }
    }

    return {
      user: {
        id: appUserId,
        email,
        clerkId,
      },
    };
  } catch (error) {
    console.warn("Clerk auth failed:", error?.message || error);
    return { error: { status: 401, message: "Unauthorized" } };
  }
}

/**
 * Upsert Clerk user into Neon app_users + profiles.
 */
export async function syncClerkUserToNeon({
  clerkId,
  email,
  username,
  displayName,
  avatarUrl,
  emailVerified = false,
}) {
  if (!isNeonConfigured()) {
    throw new Error("Neon is not configured");
  }
  const sql = getNeonSql();
  const safeEmail = email || `${clerkId}@users.clerk.local`;
  const safeUsername =
    (username || safeEmail.split("@")[0] || "user")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 30) || "user";

  const users = await sql`
    insert into public.app_users (clerk_id, email, email_verified, raw_meta)
    values (
      ${clerkId},
      ${safeEmail},
      ${emailVerified},
      ${JSON.stringify({ username: safeUsername, display_name: displayName, avatar_url: avatarUrl })}::jsonb
    )
    on conflict (clerk_id) do update set
      email = excluded.email,
      email_verified = excluded.email_verified,
      raw_meta = excluded.raw_meta,
      updated_at = now()
    returning id, email
  `;

  const userId = users[0].id;

  // Avoid unique username collisions across Clerk users
  let resolvedUsername = safeUsername;
  for (let i = 0; i < 5; i += 1) {
    const candidate = i === 0 ? resolvedUsername : `${safeUsername}_${i + 1}`;
    try {
      await sql`
        insert into public.profiles (id, username, display_name, avatar_url)
        values (
          ${userId},
          ${candidate},
          ${displayName || candidate},
          ${avatarUrl || null}
        )
        on conflict (id) do update set
          display_name = coalesce(excluded.display_name, public.profiles.display_name),
          avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url)
      `;
      resolvedUsername = candidate;
      break;
    } catch (error) {
      const msg = String(error?.message || error);
      if (!msg.toLowerCase().includes("unique") || i === 4) throw error;
    }
  }

  return { id: userId, email: users[0].email, username: resolvedUsername };
}
