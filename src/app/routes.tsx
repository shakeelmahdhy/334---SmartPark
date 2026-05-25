import { createBrowserRouter } from "react-router";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Booking } from "./pages/Booking";
import { Predictions } from "./pages/Predictions";
import { Admin } from "./pages/Admin";
import { Layout } from "./components/Layout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Login },
      { path: "dashboard", Component: Dashboard },
      { path: "booking", Component: Booking },
      { path: "predictions", Component: Predictions },
      { path: "admin", Component: Admin },
    ],
  },
]);
