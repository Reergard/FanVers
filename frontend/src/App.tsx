import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Base } from "./app/Base";
import HomePage from "./main/HomePage";
import Profile from "./users/Profile";
import BookDetailRouter from "./catalog/BookDetailRouter";
import { bootstrapAuth, attachAuthAutoRefresh } from "./auth/bootstrap";
import { NotificationProvider } from "./shared/NotificationModal/NotificationProvider";

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
              <Route path="/profile" element={<Profile />} />
              <Route path="/books/:slug" element={<BookDetailRouter />} />
            </Routes>
          </Base>
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  );
}