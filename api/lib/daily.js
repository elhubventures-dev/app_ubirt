const DAILY_API = "https://api.daily.co/v1";

function getDailyApiKey() {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY is not configured on the server.");
  return key;
}

export function getDailyDomain() {
  return process.env.DAILY_DOMAIN || process.env.VITE_DAILY_DOMAIN || "";
}

async function dailyFetch(path, options = {}) {
  const res = await fetch(`${DAILY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getDailyApiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || json?.info || `Daily API error (${res.status})`);
  }
  return json;
}

export async function createDailyRoom({ roomName, callType, expiresInSec = 3600 }) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const startVideoOff = callType !== "video";

  return dailyFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        max_participants: 2,
        exp,
        enable_chat: false,
        enable_knocking: false,
        start_video_off: startVideoOff,
        start_audio_off: false,
      },
    }),
  });
}

export async function createDailyMeetingToken({
  roomName,
  userName,
  isOwner = false,
  callType,
  expiresInSec = 3600,
}) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const startVideoOff = callType !== "video";

  const json = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName || "UBIRT user",
        is_owner: isOwner,
        exp,
        start_video_off: startVideoOff,
        start_audio_off: false,
        enable_screenshare: false,
      },
    }),
  });

  return json.token;
}

export async function deleteDailyRoom(roomName) {
  try {
    await dailyFetch(`/rooms/${encodeURIComponent(roomName)}`, { method: "DELETE" });
  } catch {
    // Room may already expire — ignore cleanup errors.
  }
}
