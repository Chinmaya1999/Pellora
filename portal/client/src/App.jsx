import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./auth";
import { Nav, Footer } from "./components/Layout";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Docs from "./pages/Docs";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/dashboard/Dashboard";
import Overview from "./pages/dashboard/Overview";
import Keys from "./pages/dashboard/Keys";
import Playground from "./pages/dashboard/Playground";
import Billing from "./pages/dashboard/Billing";

function Public() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  const bare = pathname === "/login" || pathname === "/signup"; // auth pages have their own layout
  return (<>{!bare && <Nav />}<Outlet />{!bare && <Footer />}</>);
}

function Protected() {
  const { user } = useAuth();
  if (user === undefined) return <div className="center muted">Loading…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Public />}>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
      </Route>
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Overview />} />
          <Route path="keys" element={<Keys />} />
          <Route path="playground" element={<Playground />} />
          <Route path="billing" element={<Billing />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
