import { useEffect, useState } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { dataProvider } from "@/api/dataProvider";
import { getPreference } from "@/lib/preferences";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { playNotificationSound } from "@/lib/notificationSound";

export function usePushNotifications() {
  const [pushToken, setPushToken] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative || !getPreference("push", true)) {
      return undefined;
    }

    let disposed = false;

    const initNativePush = async () => {
      try {
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
      try {
        const platform = Capacitor.getPlatform();
        await dataProvider.updateDeviceToken(token.value, {
          platform,
          provider: platform === "ios" ? "apns" : "fcm",
        });
      } catch (e) {
        console.error("Failed to save device token to DB", e);
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

    return () => {
      disposed = true;
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      pushReceivedListener.then((l) => l.remove());
      pushActionPerformedListener.then((l) => l.remove());
    };
  }, [isNative, navigate, toast]);

  return {
    pushToken,
    hasPermission,
    isNative,
  };
}
