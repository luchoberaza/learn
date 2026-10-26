// Lo único que puede pedir una ventana de PDF: su documento (la copia que ya filtró el host), los datos de PDF.js y
// los avisos del proceso principal (ir a una página, recargar, dejar de mostrar, cambiar el tema).
import { contextBridge, ipcRenderer } from "electron";

const escuchar = (canal: string) => (alRecibir: (dato: any) => void) => {
  const f = (_e: unknown, dato: unknown) => alRecibir(dato);
  ipcRenderer.on(canal, f);
  return () => { ipcRenderer.off(canal, f); };
};

contextBridge.exposeInMainWorld("visor", {
  datos: () => ipcRenderer.invoke("visor:datos"),
  recurso: (tipo: string, nombre: string) => ipcRenderer.invoke("visor:recurso", tipo, nombre),
  alIr: escuchar("visor:ir"),
  alRecargar: escuchar("visor:recargar"),
  alError: escuchar("visor:error"),
  alTema: escuchar("visor:tema"),
});
