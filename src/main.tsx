import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/inter";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/rethink-sans";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

// Register service worker for PWA support (C2)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => {
        // Registration successful; no need to log in production.
      })
      .catch(() => {
        // Registration failed; app still works offline via cached shell.
      });
  });
}
