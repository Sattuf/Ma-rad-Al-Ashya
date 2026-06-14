"use client";

import { useEffect } from "react";
import { requestForToken } from "@/lib/firebase";
import { api } from "@/lib/api/auth";

export default function FCMProvider() {
  useEffect(() => {
    const setupFCM = async () => {
      if (typeof window !== "undefined" && "Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const token = await requestForToken();
          if (token) {
            try {
              await api.put("/users/fcm-token", { fcmToken: token });
            } catch (error) {
              console.error("Error saving FCM token:", error);
            }
          }
        }
      }
    };

    setupFCM();
  }, []);

  return null;
}
