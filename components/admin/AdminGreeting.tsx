"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function AdminGreeting({
  locale,
  name,
}: {
  locale: Locale;
  name: string | null;
}) {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    const updateHour = () => setHour(new Date().getHours());
    updateHour();
    const timer = window.setInterval(updateHour, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const greeting = hour === null
    ? (locale === "fr" ? "Bienvenue" : "Welcome back")
    : hour < 5 || hour >= 18
      ? (locale === "fr" ? "Bonsoir" : "Good evening")
      : hour < 12
        ? (locale === "fr" ? "Bonjour" : "Good morning")
        : (locale === "fr" ? "Bon après-midi" : "Good afternoon");
  const firstName = name?.trim().split(/\s+/)[0];

  return <>{greeting}{firstName ? `, ${firstName}` : ""}{locale === "fr" ? " 👋" : " 👋"}</>;
}
