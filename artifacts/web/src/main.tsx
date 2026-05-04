import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { UiGallery } from "./components/ui";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found");
}

const isGalleryRoute =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("gallery") === "ui";

createRoot(container).render(
  <StrictMode>{isGalleryRoute ? <UiGallery /> : <App />}</StrictMode>
);
