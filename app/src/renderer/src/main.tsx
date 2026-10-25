import { createRoot } from "react-dom/client";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource-variable/literata/opsz-italic.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css";
import "katex/dist/katex.min.css";
import "./estilo/base.css";
import "./estilo/marco.css";
import "./estilo/clase.css";
import "./estilo/pantallas.css";
import "./estilo/capas.css";
import { App } from "./componentes/App";
import { iniciar } from "./tienda";

createRoot(document.getElementById("raiz")!).render(<App />);
void iniciar();
