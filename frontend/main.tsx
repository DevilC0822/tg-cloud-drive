import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@fontsource/space-grotesk/400.css"
import "@fontsource/space-grotesk/500.css"
import "@fontsource/space-grotesk/700.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/jetbrains-mono/700.css"
import "./styles/globals.css"
import App from "./App"
import {
  applyPrimaryHueToDocument,
  applyThemeToDocument,
  getStoredPrimaryHue,
  getStoredTheme,
} from "@/lib/theme"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Missing root element")
}

applyThemeToDocument(getStoredTheme())
applyPrimaryHueToDocument(getStoredPrimaryHue())

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
