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
                path="/profile"
                element={
                  <Suspense fallback={<div />}>
                    <Profile />
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