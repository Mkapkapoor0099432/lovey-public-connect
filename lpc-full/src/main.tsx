import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { LangProvider } from "./i18n";
import App from "./App";
createRoot(document.getElementById("root")!).render(<StrictMode><LangProvider><App /></LangProvider></StrictMode>);
