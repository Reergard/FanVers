import { useEffect, Suspense, lazy } from "react";
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
  useEffect(() => {
    bootstrapAuth();
    const detach = attachAuthAutoRefresh();
    return detach;
  }, []);

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