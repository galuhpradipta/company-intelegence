/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from "@playwright/test";
import { installAuthState, registerUser, type RegisteredUser } from "../helpers/api";

type AuthFixtures = {
  authSession: RegisteredUser;
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authSession: async ({ request }, use) => {
    await use(await registerUser(request, { displayName: "Test" }));
  },
  authenticatedPage: async ({ page, authSession }, use) => {
    await installAuthState(page, authSession);

    if (process.env.PW_VISUAL_CURSOR) {
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const cursor = document.createElement("div");
          Object.assign(cursor.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "rgba(255, 69, 0, 0.7)",
            border: "2px solid rgba(255, 69, 0, 0.9)",
            pointerEvents: "none",
            zIndex: "999999",
            transform: "translate(-50%, -50%)",
            transition: "transform 0.1s ease, background 0.1s ease",
          });
          document.body.appendChild(cursor);

          document.addEventListener("mousemove", (e) => {
            cursor.style.left = e.clientX + "px";
            cursor.style.top = e.clientY + "px";
          });
          document.addEventListener("mousedown", () => {
            cursor.style.transform = "translate(-50%, -50%) scale(2)";
            cursor.style.background = "rgba(255, 69, 0, 1)";
          });
          document.addEventListener("mouseup", () => {
            cursor.style.transform = "translate(-50%, -50%) scale(1)";
            cursor.style.background = "rgba(255, 69, 0, 0.7)";
          });
        });
      });
    }

    await use(page);
  },
});

export { expect } from "@playwright/test";
