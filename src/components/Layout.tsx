import { Outlet } from "react-router";
import Header from "./Header.tsx";
import BottomNav from "./BottomNav.tsx";

export default function Layout() {
  return (
    <div className="flex flex-col flex-1 app-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-app-accent focus:text-white focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex flex-col flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
