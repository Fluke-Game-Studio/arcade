import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./theme.css";

import { AuthProvider } from "./auth/AuthContext";
import Protected from "./auth/Protected";

import App from "./pages/App";
import Home from "./pages/Home";
import Employees from "./pages/Employees";
import AdminWorkspace from "./pages/AdminWorkspace";
import SuperUser from "./pages/SuperUser";
import SuperAI from "./pages/SuperAI";
import SuperAwards from "./pages/SuperAwards";
import Account from "./pages/Account";
import Login from "./pages/Login";
import JobsAdmin from "./pages/JobsAdmin";
import ApiEndpoints from "./pages/ApiEndpoints";
import ApiEndpointsReadOnly from "./pages/ApiEndpointsReadOnly";
import WeeklyUpdate from "./pages/WeeklyUpdate";
import RetroBoard from "./pages/RetroBoard";
import Applicants from "./pages/Applicants";
import { UpdatesProvider } from "./pages/UpdatesContext";
import CharacterTutorialPage from "./pages/CharacterTutorialPage";
import ManagerAgentBuilderPage from "./pages/ManagerAgentBuilderPage";

function isVisibleElement(el: Element | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === "none") return false;
  if (cs.visibility === "hidden") return false;
  if (Number(cs.opacity || "1") <= 0.01) return false;
  return true;
}

function repairBodyScrollLockIfStale() {
  const body = document.body;
  if (!body) return;

  const hasModalOpen = Array.from(document.querySelectorAll(".modal")).some(
    (x) => x.classList.contains("open") || isVisibleElement(x)
  );
  const hasVisibleOverlay = Array.from(
    document.querySelectorAll(".modal-overlay")
  ).some((x) => isVisibleElement(x));

  const modalLockLikely =
    body.classList.contains("modal-open") ||
    document.querySelector(".modal-overlay") !== null;

  if (!modalLockLikely) return;
  if (hasModalOpen || hasVisibleOverlay) return;

  body.classList.remove("modal-open");
  if (body.style.overflow === "hidden") body.style.overflow = "";
  if (body.style.paddingRight) body.style.paddingRight = "";
}

function ModalScrollRepair() {
  useEffect(() => {
    const applyTheme = () => {
      const saved = (localStorage.getItem("fg_theme") || "").toLowerCase();
      const next = saved === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
    };

    applyTheme();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "fg_theme") applyTheme();
    };
    window.addEventListener("storage", onStorage);

    const id = window.setInterval(() => {
      try {
        repairBodyScrollLockIfStale();
      } catch {}
    }, 250);

    const mo = new MutationObserver(() => {
      try {
        repairBodyScrollLockIfStale();
      } catch {}
    });

    try {
      mo.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    } catch {}

    return () => {
      window.clearInterval(id);
      mo.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}

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
      {
        path: "/admin/endpoints",
        element: (
          <Protected roles={["super"]}>
            <ApiEndpoints />
          </Protected>
        ),
      },
      {
        path: "/docs/endpoints",
        element: (
          <Protected roles={["employee", "admin", "super"]}>
            <ApiEndpointsReadOnly />
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
            <AdminWorkspace initialTab="activity" />
          </Protected>
        ),
      },

      {
        path: "/admin",
        element: (
          <Protected roles={["admin", "super"]}>
            <AdminWorkspace initialTab="employees" />
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
      {
        path: "/super/ai-character-training",
        element: (
          <Protected roles={["super"]}>
            <CharacterTutorialPage />
          </Protected>
        ),
      },
      {
        path: "/super/talking-head-page",
        element: <Navigate to="/" replace />,
      },
      {
        path: "/super/manager-agent-builder",
        element: (
          <Protected roles={["super"]}>
            <ManagerAgentBuilderPage />
          </Protected>
        ),
      },

      {
        path: "/super/awards",
        element: (
          <Protected roles={["super"]}>
            <SuperAwards />
          </Protected>
        ),
      },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ModalScrollRepair />
    <AuthProvider>
      <UpdatesProvider>
        <RouterProvider router={router} />
      </UpdatesProvider>
    </AuthProvider>
  </StrictMode>
);
