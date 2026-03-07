// src/pages/App.tsx
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import FloatingAIChat from "../components/FloatingAIChat";

export default function App() {
  return (
    <>
      <Navbar />
      <Outlet />
      <FloatingAIChat />
    </>
  );
}
