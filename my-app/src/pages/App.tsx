// src/pages/App.tsx
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import FloatingAIChat from "../components/FloatingAIChat";

export default function App() {
  const location = useLocation();
  const hideFloatingAI = location.pathname === "/super/talking-head-page";

  return (
    <>
      <Navbar />
      <Outlet />
      {!hideFloatingAI && <FloatingAIChat />}
    </>
  );
}
