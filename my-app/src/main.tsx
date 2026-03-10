import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import Protected from "./auth/Protected";

import App from "./pages/App";
import Home from "./pages/Home";
import Employees from "./pages/Employees";
import Admin from "./pages/Admin";
import SuperUser from "./pages/SuperUser";
import SuperAI from "./pages/SuperAI";
import Account from "./pages/Account";
import Login from "./pages/Login";
import ActivityReport from "./pages/ActivityReport";
import JobsAdmin from "./pages/JobsAdmin";
import WeeklyUpdate from "./pages/WeeklyUpdate";
import RetroBoard from "./pages/RetroBoard";
import Applicants from "./pages/Applicants";
import CharacterTutorialPage from "./pages/CharacterTutorialPage";
import { UpdatesProvider } from "./pages/UpdatesContext";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },

  {
    element: (
      <Protected roles={["employee", "admin", "super"]}>
        <App />
      </Protected>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "/employees", element: <Employees /> },
      { path: "/account", element: <Account /> },
      { path: "/character-tutorial", element: <CharacterTutorialPage /> },

      {
        path: "/applicants",
        element: (
          <Protected roles={["admin", "super"]}>
            <Applicants />
          </Protected>
        ),
      },

      {
        path: "/admin/jobs",
        element: (
          <Protected roles={["admin", "super"]}>
            <JobsAdmin />
          </Protected>
        ),
      },

      { path: "/updates/new", element: <WeeklyUpdate /> },

      {
        path: "/updates/board",
        element: (
          <Protected roles={["admin", "super"]}>
            <RetroBoard />
          </Protected>
        ),
      },

      {
        path: "/updates/activity",
        element: (
          <Protected roles={["admin", "super"]}>
            <ActivityReport />
          </Protected>
        ),
      },

      {
        path: "/admin",
        element: (
          <Protected roles={["admin", "super"]}>
            <Admin />
          </Protected>
        ),
      },

      {
        path: "/super",
        element: (
          <Protected roles={["super"]}>
            <SuperUser />
          </Protected>
        ),
      },

      {
        path: "/super/ai",
        element: (
          <Protected roles={["super"]}>
            <SuperAI />
          </Protected>
        ),
      },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <UpdatesProvider>
        <RouterProvider router={router} />
      </UpdatesProvider>
    </AuthProvider>
  </StrictMode>
);