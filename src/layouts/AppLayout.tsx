import {
  Outlet,
  useLocation,
  Link,
  useOutletContext,
  useMatches,
} from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const context = useOutletContext();
  // Build breadcrumb
  const parts = pathname.split("/").filter(Boolean);
  // const matches = useMatches();

  // // Find the match that contains your specific handle data
  // // (or just grab the last one if you want the deepest active route)
  // const currentMatch = matches.find((match) => (match.handle as any)?.title);
  // const title = (currentMatch?.handle as any)?.title;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div
            className="flex-row"
            style={{ fontSize: 13, color: "var(--text-muted)" }}
          >
            {parts.map((part, i) => {
              const path = "/" + parts.slice(0, i + 1).join("/");
              const isLast = i === parts.length - 1;
              const label = decodeURIComponent(part);
              return (
                <span key={path} className="flex-row">
                  {i > 0 && <span style={{ margin: "0 4px" }}>/</span>}
                  {isLast ? (
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>
                      {label}
                    </span>
                  ) : (
                    <Link to={path} style={{ color: "var(--text-muted)" }}>
                      {label}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex-row">
            <span
              style={{
                background: "var(--primary-light)",
                color: "var(--primary)",
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {user?.role?.name}
            </span>
          </div>
        </div>
        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
