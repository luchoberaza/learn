// Lo único que la interfaz puede pedirle al sistema: canales con nombre, sin acceso a Node.
import { contextBridge, ipcRenderer, webUtils } from "electron";

const escuchar = (canal: string) => (alRecibir: (dato: any) => void) => {
  const f = (_e: unknown, dato: unknown) => alRecibir(dato);
  ipcRenderer.on(canal, f);
  return () => { ipcRenderer.off(canal, f); };
};

contextBridge.exposeInMainWorld("learn", {
  info: () => ipcRenderer.invoke("app:info"),
  ajustes: (cambios?: unknown) => ipcRenderer.invoke("app:ajustes", cambios),
  elegirCarpeta: (titulo: string) => ipcRenderer.invoke("app:elegir-carpeta", titulo),
  elegirArchivos: (filtro: "pdf" | "imagen" | "nota" | "sesion") => ipcRenderer.invoke("app:elegir-archivos", filtro),
  arrancar: (vault: string) => ipcRenderer.invoke("app:arrancar", vault),
  estadoHost: () => ipcRenderer.invoke("app:estado-host"),
  pedir: (tipo: string, datos?: unknown) => ipcRenderer.invoke("host:pedir", tipo, datos ?? {}),
  enviarHost: (mensaje: unknown) => ipcRenderer.send("host:enviar", mensaje),
  alMensaje: escuchar("host:mensaje"),
  diagnostico: () => ipcRenderer.invoke("sistema:diagnostico"),
  instalar: (accion: string, vault?: string) => ipcRenderer.invoke("sistema:instalar", accion, vault),
  alSalidaSistema: escuchar("sistema:salida"),
  aEntrada: (rutas: string[]) => ipcRenderer.invoke("archivos:a-entrada", rutas),
  listarEntrada: () => ipcRenderer.invoke("archivos:entrada"),
  abrirRegistros: () => ipcRenderer.invoke("app:abrir-registros"),
  rutaDeArchivo: (archivo: File) => webUtils.getPathForFile(archivo),
  leerImagen: (ruta: string) => ipcRenderer.invoke("archivos:leer-imagen", ruta),
  temporal: (nombre: string, base64: string) => ipcRenderer.invoke("archivos:temporal", nombre, base64),
  configLocal: (cambios?: Record<string, string | undefined>) => ipcRenderer.invoke("archivos:config-local", cambios),
  notaLibre: (tema: string) => ipcRenderer.invoke("archivos:nota-libre", tema),
  abrirExterno: (url: string) => ipcRenderer.invoke("app:abrir-externo", url),
  abrirEnVault: (relativa: string) => ipcRenderer.invoke("app:abrir-en-vault", relativa),
  mostrarEnCarpeta: (relativa: string) => ipcRenderer.invoke("app:mostrar-en-carpeta", relativa),
  copiar: (texto: string) => ipcRenderer.invoke("app:copiar", texto),
  foco: (suma?: { dia: string; minutos: number; bloque: boolean }) => ipcRenderer.invoke("app:foco", suma),
  titulo: (titulo: string) => ipcRenderer.invoke("app:titulo", titulo),
  abrirPdf: (pedido: unknown) => ipcRenderer.invoke("visor:abrir", pedido),
  salir: () => ipcRenderer.invoke("app:salir"),
});
