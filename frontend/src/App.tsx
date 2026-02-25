import { useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Base } from "./app/Base";
import HomePage from "./main/HomePage";
const Profile = lazy(() => import("./users/Profile"));
import { bootstrapAuth, attachAuthAutoRefresh } from "./auth/bootstrap";
import { NotificationProvider } from "./shared/NotificationModal/NotificationProvider";
import BookDetailSkeleton from "./catalog/BookDetailSkeleton";

const BookDetailRouter = lazy(() => import("./catalog/BookDetailRouter"));
const BookmarksPage = lazy(() => import("./bookmarks/BookmarksPage"));
const UserTranslations = lazy(() => import("./users/UserTranslations"));
const Authors = lazy(() => import("./users/Authors"));
const TranslatorsList = lazy(() => import("./users/TranslatorsList"));
const LoginPage = lazy(() => import("./auth/LoginPage"));
const NotificationsPage = lazy(() =>
  import("./notification/NotificationsPage").then((m) => ({ default: m.NotificationsPage }))
);
const CreateBookPage = lazy(() =>
  import("./catalog/CreateBookPage").then((m) => ({ default: m.CreateBookPage }))
);
const AddChapter = lazy(() =>
  import("./catalog/AddChapter").then((m) => ({ default: m.default }))
);
const ChapterDetailRouter = lazy(() =>
  import("./catalog/ChapterDetailRouter").then((m) => ({ default: m.default }))
);
const AbandonedTranslations = lazy(() =>
  import("./catalog/AbandonedTranslations").then((m) => ({ default: m.default }))
);
const Catalog = lazy(() =>
  import("./catalog/Catalog").then((m) => ({ default: m.default }))
);
const MagicalGuide = lazy(() =>
  import("./main/MagicalGuide").then((m) => ({ default: m.default }))
);
const SearchPage = lazy(() =>
  import("./search/search").then((m) => ({ default: m.default }))
);
const ChatPage = lazy(() =>
  import("./chat/Chat").then((m) => ({ default: m.default }))
);
const SettingsBook = lazy(() =>
  import("./catalog/settings/SettingsBook").then((m) => ({ default: m.default }))
);

const queryClient = new QueryClient();

export default function App() {
  const [bootstrapDone, setBootstrapDone] = useState(false);

  useEffect(() => {
    bootstrapAuth()
      .finally(() => setBootstrapDone(true));
    const detach = attachAuthAutoRefresh();
    return detach;
  }, []);

  // Не рендерим Routes до завершения bootstrap — избегаем мигания "Увійдіть" при F5
  if (!bootstrapDone) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.8)" }}>
        Завантаження…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <BrowserRouter>
          <Base>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/create-book"
                element={
                  <Suspense fallback={<div />}>
                    <CreateBookPage />
                  </Suspense>
                }
              />
              <Route
                path="/profile"
                element={
                  <Suspense fallback={<div />}>
                    <Profile />
                  </Suspense>
                }
              />
              <Route
                path="/bookmarks"
                element={
                  <Suspense fallback={<div />}>
                    <BookmarksPage />
                  </Suspense>
                }
              />
              <Route
                path="/my-translations"
                element={
                  <Suspense fallback={<div />}>
                    <UserTranslations />
                  </Suspense>
                }
              />
              <Route
                path="/authors"
                element={
                  <Suspense fallback={<div />}>
                    <Authors />
                  </Suspense>
                }
              />
              <Route
                path="/translators"
                element={
                  <Suspense fallback={<div />}>
                    <TranslatorsList />
                  </Suspense>
                }
              />
              <Route
                path="/login"
                element={
                  <Suspense fallback={<div />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route
                path="/messages"
                element={
                  <Suspense fallback={<div />}>
                    <NotificationsPage />
                  </Suspense>
                }
              />
              <Route
                path="/catalog"
                element={
                  <Suspense fallback={<div />}>
                    <Catalog />
                  </Suspense>
                }
              />
              <Route
                path="/MagicalGuide"
                element={
                  <Suspense fallback={<div />}>
                    <MagicalGuide />
                  </Suspense>
                }
              />
              <Route
                path="/abandoned"
                element={
                  <Suspense fallback={<div />}>
                    <AbandonedTranslations />
                  </Suspense>
                }
              />
              <Route
                path="/search"
                element={
                  <Suspense fallback={<div />}>
                    <SearchPage />
                  </Suspense>
                }
              />
              <Route
                path="/chat"
                element={
                  <Suspense fallback={<div />}>
                    <ChatPage />
                  </Suspense>
                }
              />
              <Route
                path="/books/:slug/settings"
                element={
                  <Suspense fallback={<div />}>
                    <SettingsBook />
                  </Suspense>
                }
              />
              <Route
                path="/books/:slug/add-chapter"
                element={
                  <Suspense fallback={<div />}>
                    <AddChapter />
                  </Suspense>
                }
              />
              <Route
                path="/books/:bookSlug/chapters/:chapterSlug"
                element={
                  <Suspense fallback={<div />}>
                    <ChapterDetailRouter />
                  </Suspense>
                }
              />
              <Route
                path="/books/:slug"
                element={
                  <Suspense fallback={<BookDetailSkeleton />}>
                    <BookDetailRouter />
                  </Suspense>
                }
              />
            </Routes>
          </Base>
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  );
}