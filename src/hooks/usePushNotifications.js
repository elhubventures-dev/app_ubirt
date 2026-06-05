import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { dataProvider } from "@/api/dataProvider";
import { getPreference } from "@/lib/preferences";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { playNotificationSound } from "@/lib/notificationSound";

const ANDROID_CHANNEL_ID = "ubirt_default";

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  await PushNotifications.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: "UBIRT notifications",
    description: "Likes, comments, messages, and follows",
    importance: 5,
    visibility: 1,
    sound: "default",
    vibration: true,
  }).catch(() => {});
}

async function saveDeviceToken(token) {
  const platform = Capacitor.getPlatform();
  await dataProvider.updateDeviceToken(token, {
    platform,
    provider: platform === "ios" ? "apns" : "fcm",
  });
}

export function usePushNotifications() {
  const [pushToken, setPushToken] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();
  const lastSavedTokenRef = useRef(null);

  useEffect(() => {
    if (!isNative || !user || !getPreference("push", true)) {
      return undefined;
    }

    let disposed = false;

    const initNativePush = async () => {
      try {
        await ensureAndroidChannel();

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") {
          console.log("User denied push notification permissions");
          return;
        }
        if (disposed) return;
        setHasPermission(true);
        await PushNotifications.register();
      } catch (error) {
        console.error("Error initializing Push Notifications:", error);
      }
    };

    initNativePush();

    const registrationListener = PushNotifications.addListener("registration", async (token) => {
      setPushToken(token.value);
      if (lastSavedTokenRef.current === token.value) return;
      lastSavedTokenRef.current = token.value;
      try {
        await saveDeviceToken(token.value);
      } catch (e) {
        console.error("Failed to save device token to DB", e);
        lastSavedTokenRef.current = null;
      }
    });

    const errorListener = PushNotifications.addListener("registrationError", (error) => {
      console.error("Error on registration:", error);
    });

    const pushReceivedListener = PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const type = notification.data?.type;
      playNotificationSound(type === "message" ? "message" : "default");
      toast({
        title: notification.title || "New Notification",
        description: notification.body || "Tap to view",
      });
    });

    const pushActionPerformedListener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        const data = notification.notification.data;
        if (data?.url) {
          navigate(data.url);
        } else if (data?.chatId) {
          navigate(`/chat/${data.chatId}`);
        } else {
          navigate("/notifications");
        }
      }
    );

    const appStateListener = App.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive || !getPreference("push", true)) return;
      try {
        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "granted") {
          await PushNotifications.register();
        }
      } catch (error) {
        console.warn("Push re-register on resume failed:", error);
      }
    });

    return () => {
      disposed = true;
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      pushReceivedListener.then((l) => l.remove());
      pushActionPerformedListener.then((l) => l.remove());
      appStateListener.then((l) => l.remove());
    };
  }, [isNative, user, navigate, toast]);

  return {
    pushToken,
    hasPermission,
    isNative,
  };
}
