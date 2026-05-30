import { useEffect, useState } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { dataProvider } from "@/api/dataProvider";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export function usePushNotifications() {
  const [pushToken, setPushToken] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Only run on iOS/Android native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const initPush = async () => {
      try {
        // Request Permission
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== "granted") {
          console.log("User denied push notification permissions");
          return;
        }

        setHasPermission(true);
        await PushNotifications.register();
      } catch (error) {
        console.error("Error initializing Push Notifications:", error);
      }
    };

    initPush();

    // Listeners
    const registrationListener = PushNotifications.addListener(
      "registration",
      async (token) => {
        console.log("Push registration success, token:", token.value);
        setPushToken(token.value);
        try {
          await dataProvider.updateDeviceToken(token.value);
        } catch (e) {
          console.error("Failed to save device token to DB", e);
        }
      }
    );

    const errorListener = PushNotifications.addListener(
      "registrationError",
      (error) => {
        console.error("Error on registration:", error);
      }
    );

    const pushReceivedListener = PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        console.log("Push received:", notification);
        toast({
          title: notification.title || "New Notification",
          description: notification.body || "Tap to view",
        });
      }
    );

    const pushActionPerformedListener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        console.log("Push action performed:", notification);
        const data = notification.notification.data;
        if (data && data.url) {
          navigate(data.url);
        } else if (data && data.chatId) {
          navigate(`/chat/${data.chatId}`);
        } else {
          navigate("/notifications");
        }
      }
    );

    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      pushReceivedListener.then(l => l.remove());
      pushActionPerformedListener.then(l => l.remove());
    };
  }, [navigate, toast]);

  return {
    pushToken,
    hasPermission,
    isNative: Capacitor.isNativePlatform(),
  };
}
