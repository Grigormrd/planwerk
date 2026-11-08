"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { clearOfflineData } from "@/components/board/offline-storage";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ isGuest, gitHubEnabled }: { isGuest: boolean; gitHubEnabled: boolean }) {
  const router = useRouter();

  async function signOut() {
    // Boards cached for offline use must not outlive the session.
    await clearOfflineData();
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  async function keepWork() {
    // Signing in with GitHub links the guest account; workspaces move over.
    await authClient.signIn.social({ provider: "github", callbackURL: "/app" });
  }

  return (
    <div className="flex items-center gap-1">
      {isGuest && gitHubEnabled && (
        <button type="button" onClick={keepWork} className={buttonClass.secondary}>
          Save with GitHub
        </button>
      )}
      <button type="button" onClick={signOut} className={buttonClass.ghost}>
        Sign out
      </button>
    </div>
  );
}
