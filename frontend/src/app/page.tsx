"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBackendBase } from "../lib/api";

interface NetworkInfo {
  primaryIp: string;
}

interface DashboardStats {
  resources: number;
  exams: number;
  subjects: number;
}

const LEARNING_TOOLS = [
  {
    href: "/resources",
    code: "01",
    label: "Learning Library",
    description: "Search the local collection of study materials, past papers, and STEM resources.",
    action: "Open the library",
  },
  {
    href: "/cbt",
    code: "02",
    label: "CBT Exams",
    description: "Choose an assessment, work against its timer, and review your result.",
    action: "View exams",
  },
  {
    href: "/arena",
    code: "03",
    label: "Math Arena",
    description: "Join a teacher-hosted live mathematics competition with classmates.",
    action: "Enter the Arena",
  },
];

export default function Home() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [serverOnline, setServerOnline] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const isHostedApp = Boolean(process.env.NEXT_PUBLIC_API_URL);

  useEffect(() => {
    fetch(`${getBackendBase()}/api/network-info`)
      .then((response) => {
        if (!response.ok) throw new Error("Local server is unavailable.");
        return response.json();
      })
      .then((data) => {
        setNetworkInfo(data);
        setServerOnline(true);
      })
      .catch(() => setServerOnline(false));

    Promise.all([
      fetch(`${getBackendBase()}/api/resources/meta`).then((response) => {
        if (!response.ok) throw new Error("Could not load library statistics.");
        return response.json();
      }),
      fetch(`${getBackendBase()}/api/cbt/exams`).then((response) => {
        if (!response.ok) throw new Error("Could not load exam statistics.");
        return response.json();
      }),
    ])
      .then(([resources, exams]) => {
        setStats({
          resources: resources.stats?.total_count ?? 0,
          exams: exams.exams?.length ?? 0,
          subjects: resources.subjects?.length ?? 0,
        });
      })
      .catch(() => setStats(null));
  }, []);

  const hostIp =
    networkInfo?.primaryIp ||
    (typeof window !== "undefined" ? window.location.hostname : "localhost");
  const vaultUrl = process.env.NEXT_PUBLIC_API_URL
    ? (typeof window !== "undefined" ? window.location.origin : "")
    : `http://${hostIp}:5050`;

  const copyAddress = async () => {
    setCopyError("");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(vaultUrl);
      } else {
        const field = document.createElement("textarea");
        field.value = vaultUrl;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copiedSuccessfully = document.execCommand("copy");
        field.remove();
        if (!copiedSuccessfully) throw new Error("Clipboard access is unavailable.");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError("Copy was blocked by the browser. Select the address to copy it.");
    }
  };

  return (
    <div className="home-console">
      <template
        dangerouslySetInnerHTML={{
          __html: "<!-- THESIS: The school’s learning network is an exact blue instrument, not a row of generic app cards. OWN-WORLD: White and cobalt fields, visible construction cells, modular typography, and precise blue rules. STORY: Students see the local server state and move directly to resources, exams, or live competition. FIRST VIEWPORT: A monumental Vault Academy wordmark leads into live LAN status, an indexed three-row directory, compact counts, and the shareable LAN address. FORM: Blue Grid Instrument, assigned direction; staging is a direct operational directory organized on a visible construction grid. -->",
        }}
      />

      <header className="home-masthead">
        <div>
          <h1 className="home-title">Vault Academy</h1>
          <p className="home-subtitle">
            A local learning network for study resources, timed practice, and live mathematics.
          </p>
        </div>
        <div className="home-status" role="status" aria-live="polite">
          <span className="home-status-label">{isHostedApp ? "Application server" : "Local server"}</span>
          <strong style={{ color: serverOnline ? "var(--accent-green)" : "var(--text-muted)" }}>
            {serverOnline ? "● Online" : "● Check connection"}
          </strong>
          <span style={{ color: "var(--text-muted)", fontSize: ".76rem" }}>
            {serverOnline
              ? isHostedApp ? "Available online" : "Available on this Wi-Fi"
              : "Waiting for backend"}
          </span>
        </div>
      </header>

      <section className="home-directory" aria-labelledby="home-directory-title">
        <div className="home-directory-title">
          <h2 id="home-directory-title">Choose your next step</h2>
          <span>Three learning tools · one local network</span>
        </div>
        <nav aria-label="Learning tools">
          {LEARNING_TOOLS.map((tool) => (
            <Link href={tool.href} key={tool.href} className="home-module-row">
              <span className="home-module-code" aria-hidden="true">{tool.code}</span>
              <h3 className="home-module-name">{tool.label}</h3>
              <p className="home-module-description">{tool.description}</p>
              <span className="home-module-action">{tool.action} →</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="home-data-strip" aria-label="Available learning content">
        {[
          { label: "Library resources", value: stats?.resources },
          { label: "CBT exams", value: stats?.exams },
          { label: "Subjects", value: stats?.subjects },
        ].map((item) => (
          <div className="home-data-cell" key={item.label}>
            <span className="home-data-label">{item.label}</span>
            <strong className="home-data-value">{item.value ?? "—"}</strong>
          </div>
        ))}
      </section>

      <section className="home-network" aria-labelledby="home-network-title">
        <div>
          <h2 id="home-network-title">{isHostedApp ? "Share Vault Academy" : "Connect another device"}</h2>
          <p>
            {isHostedApp
              ? "Open this address on any internet-connected device."
              : "Open this address on a device connected to the same Wi-Fi network."}
          </p>
          <a className="home-network-address" href={vaultUrl}>{vaultUrl}</a>
          {copyError && <p role="status">{copyError}</p>}
        </div>
        <button type="button" className="home-copy-button" onClick={copyAddress}>
          {copied ? "Address copied" : "Copy server address"}
        </button>
      </section>
    </div>
  );
}
