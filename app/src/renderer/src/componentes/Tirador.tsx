// El borde que se arrastra con el mouse (DA54), en la barra lateral y en el panel de página. Mientras se arrastra cambia
// la variable CSS de la ventana (sin volver a dibujar la app); al soltar se guarda el ancho. Doble clic vuelve al de
// siempre; con el teclado, las flechas lo mueven de a 16 px.
import { useRef } from "react";
import { anchoLateral, anchoPanel, LATERAL, PANEL } from "../../../lib/escala.ts";
import { guardarAjustes, leer } from "../tienda";

const PASO = 16;

export function Tirador({ cual }: { cual: "lateral" | "panel" }) {
  const yo = useRef<HTMLDivElement>(null);
  const caja = () => yo.current?.parentElement as HTMLElement;
  const ventana = () => yo.current?.closest(".ventana") as HTMLElement;
  const lateral = () => (ventana().querySelector(".lateral") as HTMLElement).getBoundingClientRect().width;
  const limitar = (v: number) => cual === "lateral" ? anchoLateral(v) : anchoPanel(v, window.innerWidth, lateral());
  const poner = (v: number) => ventana().style.setProperty(cual === "lateral" ? "--lat" : "--panel", `${v}px`);
  const guardar = (v: number | undefined) => cual === "lateral"
    ? guardarAjustes({ lateral: { ...leer().ajustes?.lateral, ancho: v } })
    : guardarAjustes({ anchoPanel: v });
  // La barra lateral crece hacia la derecha; el panel, hacia la izquierda.
  const signo = cual === "lateral" ? 1 : -1;

  const empezar = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = yo.current!, desde = e.clientX, base = caja().getBoundingClientRect().width;
    let ultimo = base;
    el.setPointerCapture(e.pointerId);
    document.body.classList.add("arrastrando");
    el.classList.add("en-uso");
    const mover = (ev: PointerEvent) => { ultimo = limitar(base + signo * (ev.clientX - desde)); poner(ultimo); };
    const soltar = () => {
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", soltar);
      el.removeEventListener("pointercancel", soltar);
      document.body.classList.remove("arrastrando");
      el.classList.remove("en-uso");
      if (Math.round(ultimo) !== Math.round(base)) void guardar(ultimo);
    };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
  };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const v = limitar(caja().getBoundingClientRect().width + (e.key === "ArrowRight" ? 1 : -1) * signo * PASO);
    poner(v);
    void guardar(v);
  };
  const reponer = () => {
    ventana().style.removeProperty("--panel");
    void guardar(undefined);
  };
  const nombre = cual === "lateral" ? "Ancho de la barra lateral" : "Ancho del panel de página";
  return (
    <div ref={yo} className="tirador" role="separator" aria-orientation="vertical" aria-label={nombre} tabIndex={0}
      aria-valuemin={cual === "lateral" ? LATERAL.min : PANEL.min} aria-valuemax={cual === "lateral" ? LATERAL.max : undefined}
      title={`${nombre}: arrastrá para cambiarlo; doble clic, el de siempre`}
      onPointerDown={empezar} onKeyDown={teclas} onDoubleClick={reponer} />
  );
}
