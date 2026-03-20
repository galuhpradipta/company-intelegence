import { NavLink } from "react-router";
import { House, NotePencil } from "@phosphor-icons/react";

const NAV = [
  { to: "/", icon: House, label: "Home" },
  { to: "/notes/new", icon: NotePencil, label: "New Note" },
];

export default function BottomNav() {
  return (
    <nav aria-label="Main navigation" className="bottom-nav glass-panel-bottom">
      <ul className="flex items-center justify-around px-2 py-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `touch-target-44 flex flex-col items-center gap-0.5 px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-app-accent"
                    : "text-app-text-muted hover:text-app-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    weight={isActive ? "fill" : "regular"}
                    className={`nav-link-icon ${isActive ? "nav-link-icon-active" : ""}`}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
