import { useState } from "react";
import { Link } from "react-router";
import { Cube, SignOut } from "@phosphor-icons/react";
import { useAuth } from "../shared/hooks/useAuth.ts";
import { useOnline } from "../shared/hooks/useOnline.ts";
import { APP_NAME } from "../shared/config.ts";
import ConfirmDialog from "./ConfirmDialog.tsx";

export default function Header() {
  const { user, logout } = useAuth();
  const isOnline = useOnline();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <header className="header-glass sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Cube size={24} weight="fill" className="text-app-accent" />
          <span className="font-bold text-lg text-app-accent tracking-tight">
            {APP_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="text-xs text-app-text-muted bg-app-surface px-2 py-0.5 rounded-full border border-app-border-subtle">
              Offline
            </span>
          )}
          {user && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="touch-target-44 text-app-text-muted hover:text-app-text transition-colors"
              aria-label="Sign out"
            >
              <SignOut size={18} />
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign out?"
        description="You will be returned to the login screen."
        confirmLabel="Sign out"
        variant="warn"
        onConfirm={logout}
      />
    </header>
  );
}
