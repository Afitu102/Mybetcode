import { createRoot } from "react-dom/client";
import App from "./App";
import { Toaster } from "@/components/ui/toaster";
import "./index.css";

// Render the app with Toaster
createRoot(document.getElementById("root")!).render(
  <>
    <Toaster />
    <App />
  </>
);
