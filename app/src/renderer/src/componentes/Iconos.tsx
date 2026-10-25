// Íconos de trazo fino, dibujados a mano para no sumar una librería; heredan el color del texto.
const base = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const Clip = () => <svg {...base}><path d="M20.5 11.5 12 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.4 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" /></svg>;
export const Enviar = () => <svg {...base}><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>;
export const Detener = () => <svg {...base}><rect x="7" y="7" width="10" height="10" rx="1.5" /></svg>;
export const Cerrar = () => <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const Menu = () => <svg {...base}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
export const Chincheta = ({ puesta }: { puesta?: boolean }) => <svg {...base} fill={puesta ? "currentColor" : "none"}><path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7" /></svg>;
export const Izquierda = () => <svg {...base}><path d="M15 5l-7 7 7 7" /></svg>;
export const Derecha = () => <svg {...base}><path d="M9 5l7 7-7 7" /></svg>;
export const Buscar = () => <svg {...base}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>;
export const Lupa = ({ mas }: { mas: boolean }) => <svg {...base}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M8.5 11h5" />{mas && <path d="M11 8.5v5" />}</svg>;
export const Afuera = () => <svg {...base}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
export const Hoja = () => <svg {...base}><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>;
export const Terminal = () => <svg {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></svg>;
export const Ok = () => <svg {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
