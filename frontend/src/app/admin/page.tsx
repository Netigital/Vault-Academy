"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../components/AuthContext";
import { getBackendBase } from "../../lib/api";

interface UserRow {
  id: number;
  username: string;
  role: "student" | "teacher";
  created_at: string;
}

interface Overview {
  accounts: number;
  teachers: number;
  students: number;
  resources: number;
  exams: number;
  submissions: number;
  arenaQuestions: number;
  security: {
    passwordStorage: string;
    sessionLifetimeHours: number;
    firewallScope: string;
    adminPasscodeConfigured: boolean;
    teacherInviteConfigured: boolean;
  };
  accountList: UserRow[];
}

export default function AdminPage() {
  const { user, sessionToken } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "teacher" || !sessionToken) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    Promise.resolve().then(async () => {
      try {
        const res = await fetch(`${getBackendBase()}/api/admin/overview`, {
          headers: { "X-Vault-Session": sessionToken },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load admin dashboard.");
        setOverview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load admin dashboard.");
      } finally {
        setLoading(false);
      }
    });
  }, [user?.role, sessionToken]);

  if (user?.role !== "teacher") {
    return (
      <div style={{ maxWidth: 700, margin: "3rem auto", textAlign: "center" }}>
        <div style={{ fontSize: "3rem" }}>Protected</div>
        <h1 style={{ color: "var(--text)" }}>Teacher access required</h1>
        <p style={{ color: "var(--text-muted)" }}>
          This dashboard is only available to authorized teacher accounts.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ color: "var(--text-muted)", padding: "3rem" }}>Loading admin dashboard...</div>;
  }

  if (error) {
    return (
      <div style={{ color: "#DC2626", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, padding: "1rem" }}>
        {error}
      </div>
    );
  }

  const cards = [
    ["Accounts", overview?.accounts ?? 0, "/"],
    ["Teachers", overview?.teachers ?? 0, "/arena"],
    ["Students", overview?.students ?? 0, "/cbt"],
    ["Library files", overview?.resources ?? 0, "/resources"],
    ["CBT exams", overview?.exams ?? 0, "/cbt"],
    ["Exam submissions", overview?.submissions ?? 0, "/cbt"],
    ["Arena questions", overview?.arenaQuestions ?? 0, "/arena"],
  ] as const;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="grid-page-heading" style={{ marginBottom: "2rem" }}>
        <div style={{ color: "var(--primary)", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Vault Academy Security & Operations
        </div>
        <h1 style={{ margin: "0.35rem 0 0.5rem", color: "var(--text)", fontSize: "clamp(1.8rem, 4vw, 2.5rem)" }}>
          Admin Dashboard
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          Local system overview, account activity, and security configuration.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {cards.map(([label, value, href]) => (
          <Link
            key={label}
            href={href}
            style={{
              textDecoration: "none",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "1.25rem",
              color: "var(--text)",
            }}
          >
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              {label}
            </div>
            <div style={{ color: "var(--primary)", fontSize: "2rem", fontWeight: 850 }}>
              {value}
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) minmax(340px, 1.2fr)", gap: "1.25rem" }}>
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--text)" }}>Security status</h2>
          {[
            ["Password storage", overview?.security.passwordStorage ?? "Unknown"],
            ["Session lifetime", `${overview?.security.sessionLifetimeHours ?? 0} hours`],
            ["Firewall scope", overview?.security.firewallScope ?? "Unknown"],
            ["Admin passcode", overview?.security.adminPasscodeConfigured ? "Configured" : "Not configured"],
            ["Teacher invite", overview?.security.teacherInviteConfigured ? "Configured" : "Not configured"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.65rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <strong style={{ color: value === "Not configured" ? "#DC2626" : "var(--accent-green)", textAlign: "right" }}>{value}</strong>
            </div>
          ))}
          <div style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Personal data: account and submission records remain local to this laptop.
          </div>
        </section>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--text)" }}>Recent accounts</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: "var(--text-muted)", padding: "0.6rem", borderBottom: "1px solid var(--border)" }}>Username</th>
                  <th style={{ textAlign: "left", color: "var(--text-muted)", padding: "0.6rem", borderBottom: "1px solid var(--border)" }}>Role</th>
                  <th style={{ textAlign: "left", color: "var(--text-muted)", padding: "0.6rem", borderBottom: "1px solid var(--border)" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.accountList ?? []).map((account) => (
                  <tr key={account.id}>
                    <td style={{ padding: "0.65rem", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>{account.username}</td>
                    <td style={{ padding: "0.65rem", color: "var(--text)", borderBottom: "1px solid var(--border)", textTransform: "capitalize" }}>{account.role}</td>
                    <td style={{ padding: "0.65rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      {account.created_at ? new Date(account.created_at).toLocaleDateString() : "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
