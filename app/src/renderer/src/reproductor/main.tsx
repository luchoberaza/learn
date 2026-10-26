import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "../estilo/base.css";
import "./reproductor.css";
import { Reproductor } from "./Reproductor";

createRoot(document.getElementById("raiz")!).render(<Reproductor />);
