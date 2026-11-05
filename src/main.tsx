import React from "react";
import ReactDOM from "react-dom/client";
import { captureAuthLink } from "./lib/authRedirect";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// Read verification / reset parameters from the e-mail link before the router sees the URL.
captureAuthLink();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary></React.StrictMode>,
);
