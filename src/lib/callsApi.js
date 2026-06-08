import { getSupabase } from "@/lib/supabaseClient";
import { getApiUrl } from "@/lib/apiBase";

async function callApi(path, body) {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in to place calls.");
  }

  const res = await fetch(getApiUrl(`/api/calls/${path}`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Call request failed (${res.status})`);
  }
  return json;
}

export function startCall({ conversationId, callType = "audio" }) {
  return callApi("start", { conversationId, callType });
}

export function joinCall({ callId }) {
  return callApi("join", { callId });
}

export function endCall({ callId, status = "ended" }) {
  return callApi("end", { callId, status });
}
