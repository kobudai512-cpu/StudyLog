"use client";

import { useEffect } from "react";
import { getSession } from "next-auth/react";

export function useSessionRenewal(authenticated: boolean) {
  useEffect(() => {
    if (!authenticated) return;
    function renewWhenVisible() {
      if (document.visibilityState === "visible")
        void getSession({ broadcast: false });
    }
    renewWhenVisible();
    document.addEventListener("visibilitychange", renewWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", renewWhenVisible);
  }, [authenticated]);
}
