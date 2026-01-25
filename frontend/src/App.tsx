import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Base } from "./app/Base";
import HomePage from "./main/HomePage";
import Profile from "./users/Profile";
import { bootstrapAuth, attachAuthAutoRefresh } from "./auth/bootstrap";
import { NotificationProvider } from "./shared/NotificationModal/NotificationProvider";


export default function App() {
  useEffect(() => {
    bootstrapAuth();
    const detach = attachAuthAutoRefresh();
    return detach;
  }, []);

  return (
    <NotificationProvider>
      <BrowserRouter>
        <Base>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Base>
      </BrowserRouter>
    </NotificationProvider>
  );
}