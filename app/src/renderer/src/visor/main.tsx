import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "pdfjs-dist/web/pdf_viewer.css";
import "../estilo/base.css";
import "./visor.css";
import { Visor } from "./Visor";

createRoot(document.getElementById("raiz")!).render(<Visor />);
