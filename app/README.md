# app — la interfaz de escritorio de learn

Electron, React y TypeScript. Corre la misma pi 1.4.0 y el mismo `.pi/` del vault que la terminal: no reemplaza la lógica de learn, la muestra. Decisiones: `DECISIONES.md` (DA42–DA45, DA47 y DA48). Informe con capturas y pruebas: `informes/interfaz.md`.

## Cómo está armada

| Parte | Qué hace |
|---|---|
| `host/` | el proceso que corre pi, con el Node del sistema. `inicio.mjs` arma la sesión como `pi-learn` y atiende las acciones de la ventana. `filtro.mjs` decide qué sale hacia la ventana (nunca args ni resultados de las tools del curso, la correcta antes de responder, mensajes ocultos ni razonamiento). `interfaz.mjs` es la uiContext de pi (diálogos, quiz y preguntas). `paginas.mjs` aplica las reglas de `ver_pagina` al panel de página y a la ventana de PDF, que recibe una copia con las páginas vedadas en blanco (`lectura.py`). `curso.mjs` y `sesiones.mjs` leen el curso y las sesiones. `superficie.mjs` abre los paneles de subagentes. `consumo.mjs` junta el registro de consumo de learn, los cupos de los proveedores y el plan de cada cuenta, y estima cuántas consultas quedan con cada modelo |
| `src/main/` | el proceso principal de Electron: ventana, ventanas y pestañas de PDF (`visor.ts`), ajustes de la app (con la escala de la interfaz, los anchos y las pestañas), diálogos de archivos, «Preparar la computadora» (doctor e instalación) |
| `src/preload/` | la API `window.learn` de la ventana y la `window.visor`, mínima, de cada ventana de PDF; sin acceso a Node |
| `src/renderer/` | la interfaz: tienda de estado, pantallas, estilos (tokens Noche de Tokio y Día, Literata y Poppins empaquetadas). `visor.html` y `src/visor/` son la ventana de PDF, con PDF.js |
| `src/lib/` | lógica pura con tests: temporizador de foco, textos (citas, plan, fechas) y los del medidor de consumo |
| `subagentes/` | la superficie de paneles para pi-interactive-subagents y el script que la aplica al paquete instalado |
| `e2e/` | proveedor falso de pi-ai con guion, curso de demostración y pruebas de punta a punta con Playwright |

## Comandos

```bash
npm ci                 # dependencias (Electron baja su binario)
npm run dev            # la app con recarga en caliente
npm test               # host y lógica pura (node --test)
npm run e2e            # Electron real con el proveedor falso; necesita el curso de demostración
npm run empaquetar     # instalador NSIS (Windows) o AppImage (Linux) en dist/
```

El curso de demostración se genera con `.pi/.venv/bin/python .pi/app/e2e/curso_demo.py --vault .` desde la raíz del vault (en Windows, `.pi/.venv/Scripts/python.exe`): PDFs sintéticos de Redes curados e ingeridos con las mismas herramientas de learn, sin modelo. Si quedó uno de antes de la ventana de PDF (el libro con 7 páginas en vez de 8), borrá `cursos/redes-demo/`, `_entrada/demo/` y `_procesado/{propuesta,manifiesto}-redes-demo.json` y generalo de nuevo. Las pruebas usan datos de app y un agente de pi temporales: no tocan los ajustes, la confianza, las sesiones ni las credenciales reales. Con `LEARN_CAPTURAS=<carpeta>`, `npm run e2e` guarda capturas de cada pantalla.

## Variables

- `PI_LEARN_E2E`, `PI_LEARN_E2E_GUION`, `PI_LEARN_E2E_TOKENS`: el proveedor falso y su guion (sólo pruebas).
- `LEARN_APP_DATOS`: carpeta de datos de la app (sólo pruebas).
- `LEARN_E2E_VAULT`: el vault de las pruebas de punta a punta, si no es el que contiene esta copia de learn (por ejemplo, uno de prueba con el curso de demostración).
- `PI_LEARN_SIN_PARCHE=1`: no agrega la superficie de subagentes al paquete instalado.
- `PI_LEARN_BASH`: el bash de los paneles de subagentes, si no es Git Bash ni `/bin/bash`.
