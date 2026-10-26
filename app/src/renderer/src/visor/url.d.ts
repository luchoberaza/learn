// Vite: «archivo?url» da la dirección del archivo empaquetado (el trabajador de PDF.js).
declare module "*?url" {
  const url: string;
  export default url;
}
