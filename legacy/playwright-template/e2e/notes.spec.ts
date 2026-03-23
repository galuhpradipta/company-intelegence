import { test, expect } from "./fixtures/auth";
import { createNote } from "./helpers/api";

test("show empty state when no notes", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/");
  await expect(authenticatedPage.getByText("No notes yet.")).toBeVisible();
});

test("create a note via the form", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/notes/new");

  await authenticatedPage.getByLabel("Title").fill("My First Note");
  await authenticatedPage.getByLabel("Content").fill("Hello world");
  await authenticatedPage.getByRole("button", { name: "Create note" }).click();

  await expect(authenticatedPage.getByText("Note created")).toBeVisible();
  await expect(authenticatedPage.getByText("My First Note")).toBeVisible();
});

test("view a note detail page", async ({ authenticatedPage, authSession, request }) => {
  const note = await createNote(request, authSession.token, {
    title: "Detail Test",
    content: "Some content here",
  });

  await authenticatedPage.goto(`/notes/${note.id}`);

  await expect(authenticatedPage.getByText("Detail Test")).toBeVisible();
  await expect(authenticatedPage.getByText("Some content here")).toBeVisible();
});

test("edit a note", async ({ authenticatedPage, authSession, request }) => {
  const note = await createNote(request, authSession.token, {
    title: "Original Title",
  });

  await authenticatedPage.goto(`/notes/${note.id}/edit`);

  await authenticatedPage.getByLabel("Title").fill("Updated Title");
  await authenticatedPage.getByRole("button", { name: "Save changes" }).click();

  await expect(authenticatedPage.getByText("Note updated")).toBeVisible();
  await expect(authenticatedPage.getByText("Updated Title")).toBeVisible();
});

test("delete a note with confirmation", async ({ authenticatedPage, authSession, request }) => {
  const note = await createNote(request, authSession.token, {
    title: "To Be Deleted",
  });

  await authenticatedPage.goto(`/notes/${note.id}`);
  await authenticatedPage.getByRole("button", { name: "Delete" }).click();

  // Confirm in the dialog
  await authenticatedPage.getByRole("button", { name: "Delete" }).last().click();

  await expect(authenticatedPage).toHaveURL("/");
  await expect(authenticatedPage.getByText("Note deleted")).toBeVisible();
});

test("notes list shows created notes on home page", async ({
  authenticatedPage,
  authSession,
  request,
}) => {
  await createNote(request, authSession.token, { title: "Listed Note" });

  await authenticatedPage.goto("/");

  await expect(authenticatedPage.getByText("Listed Note")).toBeVisible();
});
