// Pruebas de punta a punta de la app (Electron real, host real, extensiones de learn reales, proveedor falso con guion).
// Requieren el curso de demostración (e2e/curso_demo.py) y npm run build. Con LEARN_CAPTURAS=<carpeta> guardan capturas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { abrirApp, CURSO, espera, hayCurso, notas, VAULT } from "./ayuda.mjs";

const sinCurso = !hayCurso && "falta el curso de demostración: corré app/e2e/curso_demo.py";
const CAPTURAS = process.env.LEARN_CAPTURAS;
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
// Los avisos de «sin credenciales» son esperables en las pruebas: se ocultan en las capturas salvo que se pidan.
const capturar = async (win, nombre, { conAvisos = false } = {}) => {
  if (!CAPTURAS) return;
  await espera(350);
  if (!conAvisos) await win.addStyleTag({ content: ".avisos{visibility:hidden}" }).then(h => h.evaluate(e => e.setAttribute("data-captura", ""))).catch(() => {});
  await win.screenshot({ path: join(CAPTURAS, `${nombre}.png`) });
  await win.evaluate(() => document.querySelectorAll("style[data-captura]").forEach(e => e.remove())).catch(() => {});
};
const RAIZ = join(VAULT, "cursos", CURSO);

// El progreso y los respaldos que escriben registrar_progreso y /simulacro se devuelven a como estaban.
function guardarCurso(t) {
  const antes = new Set(readdirSync(RAIZ));
  const copia = join(RAIZ, "progreso.yaml.prueba-e2e");
  copyFileSync(join(RAIZ, "progreso.yaml"), copia);
  t.after(() => {
    copyFileSync(copia, join(RAIZ, "progreso.yaml"));
    rmSync(copia, { force: true });
    for (const f of readdirSync(RAIZ)) if (!antes.has(f) && f !== "sesiones") rmSync(join(RAIZ, f), { recursive: true, force: true });
  });
}

const PLAN = "1. Transmisión (Kurose p. 2)\\n2. Propagación (Kurose p. 2)\\n3. Encolamiento (Kurose p. 4)\\n4. De extremo a extremo (Kurose p. 5)";
const CLASE = `export default ai => [
  ai.fauxAssistantMessage([ai.fauxText("Antes de empezar leo la sección 1.4 del libro."),
    ai.fauxToolCall("leer_paginas", { doc: "kurose", desde: 1, hasta: 2 }, { id: "leer-1" }),
    ai.fauxToolCall("ver_pagina", { doc: "kurose", pagina: 2 }, { id: "ver-1" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage([ai.fauxText("Ya viste que transmitir es empujar los bits al enlace. Ahora, una vez que el último bit salió, todavía tiene que *viajar* hasta el otro router. Ese viaje no depende del tamaño del paquete: depende de la distancia y de lo rápido que se mueve la señal en el medio.[[cursos/redes-demo/fuentes/bibliografia/kurose.pdf#page=2]]\\n\\n$$d_{prop} = \\\\frac{d}{s}$$\\n\\nCon $s \\\\approx 2 \\\\cdot 10^8$ m/s en el cobre, un enlace de 2000 km tarda unos 10 ms."),
    ai.fauxToolCall("quiz", { question: "Si duplicás el largo del enlace y todo lo demás queda igual, ¿qué pasa con el retardo de propagación?", details: "Mismo medio y mismo paquete.",
      options: [{ label: "Se duplica", value: "dup" }, { label: "No cambia", value: "igual" }, { label: "Se reduce a la mitad", value: "mitad" }],
      correctAnswer: "dup", explanation: "Como $d_{prop} = d/s$, si la distancia se duplica el retardo también. Lo que no depende de la distancia es el retardo de transmisión: ahí suele estar la confusión." }, { id: "quiz-1" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage([ai.fauxText("Bien. Te propongo este objetivo: calcular retardos de extremo a extremo como en el parcial, que es lo que más pesa."),
    ai.fauxToolCall("ask_user_question", { question: "¿Arrancamos con este plan?", details: "Transmisión, propagación, encolamiento y de extremo a extremo.",
      options: [{ label: "Dale", value: "dale" }, { label: "Ajustar", value: "ajustar" }] }, { id: "ask-1" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage([ai.fauxText("El plan, de las raíces al objetivo:\\n\\n\`\`\`mermaid\\ngraph LR\\n  A[Transmisión] --> B[Propagación]\\n  B --> C[Encolamiento]\\n  C --> D[De extremo a extremo]\\n\`\`\`"),
    ai.fauxToolCall("registrar_progreso", { estado: "en_curso", borde: { domina: ["retardo de transmisión L/R"], falla: ["confunde propagación con transmisión"] },
      objetivo: "Calcular retardos de extremo a extremo como en el parcial", plan: "${PLAN}", resumen: "Probe: domina L/R; confunde propagación con transmisión.", proximo_paso: "Retardo de encolamiento con intensidad de tráfico" }, { id: "prog-1" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage("Seguimos con el encolamiento: cuando la intensidad de tráfico se acerca a 1, la cola crece sin límite."),
  ai.fauxAssistantMessage([ai.fauxToolCall("registrar_progreso", { cierre: true, resumen: "Se vio transmisión y propagación; falta encolamiento.", proximo_paso: "Retardo de encolamiento con intensidad de tráfico" }, { id: "prog-2" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage("Hoy viste transmisión y propagación. La próxima vez seguimos con el encolamiento, con la pregunta 3 del parcial de 2025."),
]`;

test("app: una clase entera, de la primera pregunta al cierre con nota y progreso", { skip: sinCurso, timeout: 240000 }, async t => {
  guardarCurso(t);
  const { win, errores } = await abrirApp(t, { guion: CLASE });
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  // La cita al margen, la fórmula y la página mostrada.
  const quiz = win.getByRole("group", { name: "Pregunta del tutor" });
  await quiz.waitFor({ timeout: 60000 });
  await win.locator(".nota-margen").first().waitFor();
  assert.match(await win.locator(".nota-margen").first().innerText(), /Kurose y Ross \(extracto de demostración\), página 2/);
  assert.ok(await win.locator(".tutor .katex").count() >= 2, "fórmulas con KaTeX");
  // Las miniaturas se piden recién cuando la nota entra en pantalla.
  await win.locator(".miniatura").first().scrollIntoViewIfNeeded();
  await win.locator(".miniatura img").first().waitFor({ timeout: 20000 });
  await win.locator(".pagina-mostrada").scrollIntoViewIfNeeded();
  await win.locator(".pagina-mostrada img").waitFor({ timeout: 20000 });
  await quiz.scrollIntoViewIfNeeded();
  assert.ok(await win.locator(".herramienta").count() >= 2, "líneas de las tools del curso");
  // Nada de la respuesta antes de responder.
  assert.doesNotMatch(await win.locator(".clase").innerText(), /si la distancia se duplica el retardo también/);
  await capturar(win, "clase-quiz");
  await capturar(win, "clase-quiz-aviso", { conAvisos: true });
  await quiz.getByRole("button", { name: /Se duplica/ }).click();
  await win.locator(".quiz.vivo .veredicto b.bien").waitFor();
  assert.match(await win.locator(".quiz.vivo .veredicto").innerText(), /si la distancia se duplica el retardo también/);
  await capturar(win, "clase-corregido");
  await win.getByRole("button", { name: "Seguir", exact: true }).click();
  const pregunta = win.locator(".pregunta.vivo");
  await pregunta.waitFor({ timeout: 20000 });
  await capturar(win, "clase-pregunta");
  await pregunta.getByRole("button", { name: /Dale/ }).click();
  await win.locator(".tutor .mermaid svg").waitFor({ timeout: 30000 });
  await win.getByText("Seguimos con el encolamiento").waitFor({ timeout: 30000 });
  await espera(1200);
  // Cada mensaje del tutor queda en su lugar (antes, dos mensajes con el mismo milisegundo se pisaban).
  const textos = await win.locator(".tutor").allInnerTexts();
  assert.match(textos[0], /Antes de empezar leo la sección 1\.4/);
  assert.match(textos.at(-1), /Seguimos con el encolamiento/);
  assert.equal(textos.filter(x => /Seguimos con el encolamiento/.test(x)).length, 1);
  // El plan guardado aparece arriba de la clase y el tema queda en curso en la barra lateral.
  await win.locator(".encabezado-clase .plan li.actual").waitFor({ timeout: 15000 });
  assert.equal(await win.locator(".encabezado-clase .plan li.actual").innerText(), "2 Propagación");
  assert.equal(await win.locator(".temas button.on .st.cur").count(), 1);
  await win.locator(".tutor .mermaid svg").evaluate(el => el.scrollIntoView({ block: "center" }));
  await capturar(win, "clase-diagrama");
  await win.locator(".lectura").evaluate(el => { el.scrollTop = 0; });
  await capturar(win, "clase-plan");
  // El temporizador de foco: «Foco 24:59» en la barra y la línea fina que se llena debajo.
  await win.getByRole("button", { name: "Empezar un bloque de foco" }).click();
  await win.getByRole("menuitem", { name: /Empezar 25 minutos de foco/ }).click();
  await win.locator(".foco-boton b").waitFor();
  assert.match(await win.locator(".foco-boton").innerText(), /Foco\s*2[45]:\d\d/);
  assert.equal(await win.locator(".linea-foco").count(), 1);
  await capturar(win, "clase-foco");
  // Terminar clase: confirma, el tutor guarda y la nota se cierra.
  await win.getByRole("button", { name: "Terminar clase" }).click();
  await win.getByRole("dialog", { name: "¿Terminar la clase?" }).getByRole("button", { name: "Terminar la clase" }).click();
  await win.getByText("Sesión cerrada. El log se conserva en Obsidian.").waitFor({ timeout: 60000 });
  const nuevas = notas();
  assert.equal(nuevas.length >= 1, true);
  const nota = readFileSync(join(RAIZ, "sesiones", nuevas.sort().at(-1)), "utf8");
  assert.match(nota, /Quiz/); assert.match(nota, /Se duplica/);
  // Inicio ofrece volver al tema con la última frase del tutor.
  await win.getByRole("button", { name: "Inicio", exact: true }).click();
  await win.getByRole("heading", { name: /Volvé a retardos y tasa de transferencia/ }).waitFor({ timeout: 20000 });
  assert.match(await win.locator(".ultima-frase").innerText(), /pregunta 3 del parcial de 2025/);
  await capturar(win, "inicio");
  await win.getByRole("button", { name: "Leer la nota de esa clase" }).click();
  await win.locator(".nota-prosa .callout").first().waitFor({ timeout: 15000 });
  await capturar(win, "nota");
  await win.locator(".temas button").first().click();
  await win.getByRole("heading", { name: "Próximo paso" }).waitFor();
  assert.match(await win.locator(".pantalla").innerText(), /Calcular retardos de extremo a extremo como en el parcial/);
  await capturar(win, "tema");
  assert.deepEqual(errores, []);
});

const CITA = `export default ai => [
  ai.fauxAssistantMessage("El retardo de transmisión es el tiempo de empujar todos los bits del paquete al enlace: $d_{trans} = L/R$.[[cursos/redes-demo/fuentes/bibliografia/kurose.pdf#page=2]] Para un paquete de 1500 bytes en un enlace de 10 Mbps son 1,2 ms."),
]`;

test("app: el panel de página, la paleta y el modo Día", { skip: sinCurso, timeout: 180000 }, async t => {
  const { win, errores } = await abrirApp(t, { guion: CITA });
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  await win.locator(".tutor sup.llamada").first().waitFor({ timeout: 60000 });
  await win.locator(".tutor sup.llamada").first().click();
  const panel = win.getByRole("complementary", { name: "Página del material" });
  await panel.locator(".panel-cuerpo img").waitFor({ timeout: 20000 });
  assert.match(await panel.locator(".panel-titulo").innerText(), /Página 2 de 8/);
  await panel.getByRole("button", { name: "Página siguiente" }).click();
  await panel.getByText("Página 3 de 8").waitFor({ timeout: 20000 });
  await panel.getByRole("button", { name: "Página anterior" }).click();
  await panel.getByText("Página 2 de 8").waitFor({ timeout: 20000 });
  await panel.getByRole("button", { name: "Fijar el panel" }).click();
  await capturar(win, "panel-pagina");
  // Fijado, sobrevive a cambiar de pantalla; suelto, Esc lo cierra.
  await win.getByRole("button", { name: "Inicio", exact: true }).click();
  assert.equal(await panel.count(), 1);
  await panel.getByRole("button", { name: "Soltar el panel" }).click();
  await win.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  // Paleta: temas, sesiones y comandos de learn y de pi.
  await win.keyboard.press("Control+K");
  const paleta = win.getByRole("dialog", { name: "Buscar o hacer algo" });
  await paleta.waitFor();
  await paleta.getByRole("textbox").fill("simulacro");
  await paleta.getByRole("option", { name: /\/simulacro/ }).waitFor();
  await capturar(win, "paleta");
  await paleta.getByRole("textbox").fill("progreso");
  await paleta.getByRole("option", { name: /\/progreso/ }).click();
  await win.locator(".aviso").filter({ hasText: "Retardos y tasa de transferencia" }).first().waitFor({ timeout: 20000 });
  // Modo Día.
  await win.getByRole("button", { name: "Ajustes", exact: true }).click();
  await win.getByRole("radio", { name: /Día/ }).check();
  assert.equal(await win.evaluate(() => document.documentElement.dataset.tema), "dia");
  await capturar(win, "ajustes-dia");
  // El tema de la clase abierta lleva directo a la clase.
  await win.locator(".temas button").first().click();
  await win.locator(".tutor sup.llamada").first().waitFor();
  await capturar(win, "clase-dia");
  await win.getByRole("button", { name: "Inicio", exact: true }).click();
  await win.getByRole("heading", { level: 2 }).first().waitFor();
  // La última frase del tutor trae una fórmula: se dibuja con KaTeX, no queda «$d_{trans}$» en crudo.
  assert.ok(await win.locator(".ultima-frase .katex").count() >= 1);
  assert.doesNotMatch(await win.locator(".ultima-frase").innerText(), /\$/);
  await capturar(win, "inicio-dia");
  assert.deepEqual(errores, []);
});

const SIMULACRO = `export default ai => [
  ai.fauxAssistantMessage("Arranquemos: ¿qué es el retardo de transmisión?"),
  ai.fauxAssistantMessage("Simulacro de «Retardos y tasa de transferencia». Tenés unos 24 minutos, como en el examen. Mandá tu resolución en texto o foto cuando termines."),
]`;

test("app: el simulacro pide confirmación, cambia la barra al reloj del examen y pausa el foco", { skip: sinCurso, timeout: 180000 }, async t => {
  guardarCurso(t);
  const { win, errores } = await abrirApp(t, { guion: SIMULACRO });
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  await win.getByText("¿qué es el retardo de transmisión?").waitFor({ timeout: 60000 });
  await win.getByRole("button", { name: "Simulacro", exact: true }).click();
  // El diálogo viene de la extensión (elegir → ui.select), con sus mismas opciones.
  const dialogo = win.getByRole("dialog");
  await dialogo.waitFor({ timeout: 20000 });
  assert.match(await dialogo.innerText(), /el simulacro usa el único ítem reservado/);
  await capturar(win, "simulacro-confirmar");
  await dialogo.getByRole("button", { name: /Sí, rendirlo ahora/ }).click();
  // Responder cierra el diálogo (antes quedaba abierto encima de la clase).
  await dialogo.waitFor({ state: "detached", timeout: 5000 });
  await win.locator(".reloj-examen").waitFor({ timeout: 30000 });
  assert.match(await win.locator(".reloj-examen").innerText(), /Quedan .* de 24:00/);
  assert.match(await win.locator(".miga").innerText(), /Simulacro de Retardos y tasa de transferencia/);
  await win.getByText("Tenés unos 24 minutos").waitFor({ timeout: 30000 });
  await capturar(win, "simulacro");
  assert.deepEqual(errores, []);
});

test("app: barrido de pantallas, sin botones sin nombre ni errores", { skip: sinCurso, timeout: 240000 }, async t => {
  const { win, errores } = await abrirApp(t);
  await win.getByRole("heading", { level: 2 }).first().waitFor({ timeout: 60000 });
  const sinNombre = async pantalla => {
    const faltan = await win.evaluate(() => [...document.querySelectorAll("button, [role=button], a")].filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && !(b.getAttribute("aria-label") || b.textContent?.trim() || b.getAttribute("title"));
    }).map(b => b.outerHTML.slice(0, 120)));
    assert.deepEqual(faltan, [], `botones sin nombre en ${pantalla}`);
  };
  await sinNombre("Inicio");
  await win.getByRole("button", { name: "Redes (demo)" }).first().click();
  for (const p of ["Índice", "Material", "Notas de clase", "Estado"]) {
    await win.getByRole("tab", { name: p }).click();
    await espera(400);
    await sinNombre(`Curso, ${p}`);
    if (p === "Material") await capturar(win, "curso-material");
    if (p === "Índice") await capturar(win, "curso");
  }
  await win.getByRole("tab", { name: "Material" }).click();
  await win.getByRole("button", { name: "Hojear" }).first().click();
  await win.getByRole("complementary", { name: "Página del material" }).locator(".panel-cuerpo img").waitFor({ timeout: 20000 });
  await win.keyboard.press("Escape");
  await win.getByRole("button", { name: "Tema libre" }).click();
  await win.getByLabel("¿Qué querés aprender?").fill("transformada de Fourier");
  await sinNombre("Tema libre");
  await capturar(win, "tema-libre");
  await win.getByRole("button", { name: "Crear curso" }).click();
  await win.getByLabel("Nombre de la materia").fill("Álgebra Lineal");
  assert.equal(await win.getByLabel("Nombre corto, para la carpeta").inputValue(), "algebra-lineal");
  await win.getByLabel("Nombre corto, para la carpeta").fill("redes-demo");
  await win.getByText("Ya hay un curso con ese nombre").waitFor();
  await win.getByLabel("Nombre corto, para la carpeta").fill("algebra-lineal");
  await sinNombre("Crear curso");
  await capturar(win, "crear-curso");
  await win.getByRole("button", { name: "Ajustes", exact: true }).click();
  for (const s of ["Apariencia", "Foco", "Modelos", "Cuentas", "Conversación", "Carpeta del vault", "Avanzado"]) {
    await win.locator(".ajustes-nav").getByRole("button", { name: s }).click();
    await espera(500);
    await sinNombre(`Ajustes, ${s}`);
    if (s === "Foco") await capturar(win, "ajustes-foco");
    if (s === "Modelos") { await win.getByLabel("Modelo de la clase").waitFor(); await capturar(win, "ajustes-modelos"); }
  }
  await win.keyboard.press("Control+K");
  await win.getByRole("dialog", { name: "Buscar o hacer algo" }).getByRole("textbox").fill("atajos");
  await win.keyboard.press("Enter");
  await win.getByRole("dialog", { name: "Atajos de teclado" }).waitFor();
  await win.keyboard.press("Escape");
  await win.getByRole("button", { name: "Inicio", exact: true }).click();
  await win.getByRole("button", { name: "Buscar o hacer algo" }).click();
  await win.getByRole("dialog", { name: "Buscar o hacer algo" }).getByRole("textbox").fill("preparar");
  await win.keyboard.press("Enter");
  await win.getByText("Lo necesario para abrir").waitFor();
  await win.locator(".chequeo").first().waitFor({ timeout: 60000 });
  await win.getByText(/comprobaciones? (piden?|dan) /).waitFor({ timeout: 120000 });
  await sinNombre("Preparar");
  await capturar(win, "preparar");
  assert.deepEqual(errores, []);
});

const TEACH = `export default ai => [
  ai.fauxAssistantMessage([ai.fauxText("Para arrancar, contame qué sabés de señales periódicas."),
    ai.fauxToolCall("ask_user_question", { question: "¿Cuánto viste de series de Fourier?", options: [{ label: "Nada" }, { label: "Lo básico" }, { label: "Bastante" }] }, { id: "ask-libre" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage("Perfecto: empezamos por la idea de descomponer una señal en senos y cosenos, $x(t) = \\sum_k c_k e^{j k \\omega_0 t}$."),
]`;

test("app: tema libre con la skill teach y su nota en notas-libres/", { skip: sinCurso, timeout: 180000 }, async t => {
  const dir = join(VAULT, "notas-libres"), habia = existsSync(dir), antes = habia ? readdirSync(dir) : [];
  t.after(() => { if (!existsSync(dir)) return; for (const f of readdirSync(dir)) if (!antes.includes(f)) rmSync(join(dir, f), { recursive: true, force: true }); if (!habia) rmSync(dir, { recursive: true, force: true }); });
  const { win, errores } = await abrirApp(t, { guion: TEACH });
  await win.getByRole("button", { name: "Tema libre" }).click();
  await win.getByLabel("¿Qué querés aprender?").fill("series de Fourier");
  await win.getByRole("button", { name: "Empezar la clase" }).click();
  await win.getByText("Empezó la clase de tema libre").waitFor({ timeout: 60000 });
  // El SKILL.md no se muestra como mensaje del alumno: sólo qué skill se cargó y el tema.
  assert.doesNotMatch(await win.locator(".alumno").first().innerText(), /<skill|name: teach|SKILL/);
  const pregunta = win.locator(".pregunta.vivo");
  await pregunta.waitFor({ timeout: 30000 });
  await capturar(win, "tema-libre-clase");
  await pregunta.getByRole("button", { name: /Lo básico/ }).click();
  await win.getByText("descomponer una señal en senos y cosenos").waitFor({ timeout: 30000 });
  await win.locator(".pregunta-resuelta .respuesta").filter({ hasText: "Lo básico" }).waitFor();
  const nuevas = readdirSync(dir).filter(f => !antes.includes(f) && f.endsWith(".md"));
  assert.equal(nuevas.length, 1, JSON.stringify(nuevas));
  await espera(800);
  assert.match(readFileSync(join(dir, nuevas[0]), "utf8"), /descomponer una señal/);
  assert.deepEqual(errores, []);
});

const ARMADO = `export default ai => [
  ai.fauxAssistantMessage([ai.fauxText("Revisé _entrada/: hay un programa. Antes de seguir, una duda."),
    ai.fauxToolCall("ask_user_question", { question: "¿El programa es de este año?", options: [{ label: "Sí, de 2026" }, { label: "No, es viejo" }] }, { id: "ask-armado" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage("Listo, sigo con el contrato y el índice."),
]`;

test("app: crear curso copia el PDF a _entrada/ y arma el curso en una conversación", { skip: sinCurso, timeout: 180000 }, async t => {
  const entrada = join(VAULT, "_entrada"), antes = existsSync(entrada) ? readdirSync(entrada) : [];
  t.after(() => { for (const f of readdirSync(entrada)) if (!antes.includes(f)) rmSync(join(entrada, f), { force: true }); });
  const { win, errores } = await abrirApp(t, { guion: ARMADO });
  await win.getByRole("button", { name: "Crear curso" }).click();
  // Igual que soltar el archivo: la app lo copia sin tocar el original.
  const copiados = await win.evaluate(ruta => window.learn.aEntrada([ruta]), join(RAIZ, "fuentes", "programa", "programa.pdf"));
  assert.deepEqual(copiados, ["programa.pdf"]);
  await win.getByRole("button", { name: "Tema libre" }).click();
  await win.getByRole("button", { name: "Crear curso" }).click();
  await win.getByText("programa.pdf").waitFor();
  await win.getByRole("checkbox", { name: /programa\.pdf/ }).check();
  await win.getByLabel("Nombre de la materia").fill("Señales y Sistemas");
  await win.getByRole("button", { name: "Armar el curso" }).click();
  await win.getByText("Empezó el armado del curso").waitFor({ timeout: 60000 });
  assert.match(await win.locator(".alumno").first().innerText(), /senales-y-sistemas programa\.pdf/);
  const pregunta = win.locator(".pregunta.vivo");
  await pregunta.waitFor({ timeout: 30000 });
  await capturar(win, "crear-curso-conversacion");
  await pregunta.getByRole("button", { name: /Sí, de 2026/ }).click();
  await win.getByText("sigo con el contrato y el índice").waitFor({ timeout: 30000 });
  assert.ok(existsSync(join(RAIZ, "fuentes", "programa", "programa.pdf")), "el original sigue en su lugar");
  assert.equal(existsSync(join(VAULT, "cursos", "senales-y-sistemas")), false, "sin aprobar el diff no se crea el curso");
  assert.deepEqual(errores, []);
});

const SUBAGENTE = `export default ai => [
  ai.fauxAssistantMessage([ai.fauxText("Mando un explorador a mirar la carpeta de cursos."),
    ai.fauxToolCall("subagent", { agent: "scout", name: "explorador", task: "Listá las carpetas de cursos/ y decí cuántas hay." }, { id: "sub-1" })], { stopReason: "toolUse" }),
  ai.fauxAssistantMessage("Lo mandé; sigo cuando vuelva."),
  ai.fauxAssistantMessage("El explorador volvió."),
  ai.fauxAssistantMessage("Listo."),
]`;

test("app: un subagente corre en su panel (sin tmux) y su resultado vuelve a la clase", { skip: sinCurso, timeout: 240000 }, async t => {
  const { win, errores } = await abrirApp(t, { guion: SUBAGENTE });
  await win.getByRole("heading", { level: 2 }).first().waitFor({ timeout: 60000 });
  await win.keyboard.press("Control+K");
  await win.getByRole("dialog", { name: "Buscar o hacer algo" }).getByRole("textbox").fill("/new");
  await win.keyboard.press("Enter");
  await win.getByRole("textbox", { name: "Mensaje para el tutor" }).fill("Explorá la carpeta de cursos con un subagente");
  await win.keyboard.press("Enter");
  const panel = win.getByRole("region", { name: "Subagentes" });
  await panel.waitFor({ timeout: 60000 });
  await panel.getByRole("tab", { name: /explorador/ }).waitFor();
  // La terminal del panel muestra el pi del subagente con su interfaz completa, como un panel de tmux.
  await win.waitForFunction(() => /\[scout\]/.test(document.querySelector(".consola-subagente .xterm-rows")?.textContent ?? ""), null, { timeout: 90000 });
  await capturar(win, "subagente");
  // Sin credenciales el pi del subagente queda esperando (igual que en tmux): el alumno lo detiene desde el panel y el
  // paquete lo ve como un fin, en lugar de esperar para siempre.
  await panel.getByRole("button", { name: "Detener este subagente" }).click();
  await panel.getByRole("tab", { name: /terminado|terminó/ }).waitFor({ timeout: 60000 });
  await win.getByText("El explorador volvió.").waitFor({ timeout: 60000 });
  assert.deepEqual(errores, []);
});

test("app: el buscador del curso acepta un alias y abre la clase de ese tema", { skip: sinCurso, timeout: 180000 }, async t => {
  const { win, errores } = await abrirApp(t, { guion: `export default ai => [ai.fauxAssistantMessage("Arranquemos con los retardos.")]` });
  await win.getByRole("button", { name: "Redes (demo)" }).first().click();
  await win.getByLabel("Estudiar algo de este curso").fill("delay");
  await win.getByRole("button", { name: "Estudiar", exact: true }).click();
  await win.getByText("Arranquemos con los retardos.").waitFor({ timeout: 60000 });
  assert.match(await win.locator(".miga").innerText(), /Redes \(demo\) \/ Retardos y tasa de transferencia/);
  assert.deepEqual(errores, []);
});
