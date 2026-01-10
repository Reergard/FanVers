import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Base } from "./app/Base";
import HomePage from "./main/HomePage";
import Profile from "./users/Profile";


export default function App() {
  return (
    <BrowserRouter>
      <Base>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Base>
    </BrowserRouter>
  );
}