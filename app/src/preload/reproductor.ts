// Lo único que puede pedir una ventana de grabación (DA51): sus datos (título, el permiso learn-medio:// y el segundo
// citado) y los avisos del proceso principal (ir a otro segundo, cambiar el tema).
import { contextBridge, ipcRenderer } from "electron";

const escuchar = (canal: string) => (alRecibir: (dato: any) => void) => {
  const f = (_e: unknown, dato: unknown) => alRecibir(dato);
  ipcRenderer.on(canal, f);
  return () => { ipcRenderer.off(canal, f); };
};

contextBridge.exposeInMainWorld("reproductor", {
  datos: () => ipcRenderer.invoke("reproductor:datos"),
  alIr: escuchar("reproductor:ir"),
  alTema: escuchar("reproductor:tema"),
});
