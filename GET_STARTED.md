# Cómo se usa

Guía de uso de punta a punta: crear un curso, estudiar un tema, practicar, rendir un simulacro y retomar. Supone la herramienta ya instalada según [`SETUP.md`](SETUP.md) y comprobada con el doctor.

## Antes de empezar

- **El vault.** Todo vive en `~/Projects/pi-learning`, que es a la vez un vault de Obsidian y la carpeta del proyecto. Este repo es su `.pi/`.
- **Obsidian abierto** en ese vault. Ahí se ven las notas de cada clase, y las citas al material abren el PDF en la página exacta.
- **Una terminal fish.** Siempre se abre con `pi-learn`, nunca con `pi` a secas:
  ```fish
  cd ~/Projects/pi-learning
  pi-learn
  ```
  `pi-learn` abre pi dentro de tmux y con sólo las skills del proyecto. Si ya hay un pi abierto en esa carpeta, se engancha a ese en vez de abrir otro.
- **La primera vez:**
  - pi pide confiar en el proyecto: aceptá, porque sin eso no carga `.pi/`;
  - si no hay credenciales del modelo, `/login`. Las claves nunca van en el chat ni en archivos.

Para ver si todo está en orden en cualquier momento: `.pi/scripts/doctor` desde la raíz del vault y dentro de tmux. Un «✗» es una falla y un «!» es sólo un aviso.

**Con la app de escritorio** (Windows o Linux) es lo mismo sin comandos. Los cursos y temas están en la barra de la izquierda, e Inicio ofrece «Seguir la clase» donde quedaste. Los botones de la clase son Simulacro y Terminar clase, y el quiz se responde con el mouse o con las teclas a, b, c y n. Con Ctrl+K se busca un tema, una sesión o cualquier comando. La tabla del final dice dónde está cada comando en la app.

## Mapa del vault

```
~/Projects/pi-learning/
├── _entrada/                 ← acá dejás los PDFs para crear o ampliar un curso
├── _procesado/               ← propuestas y archivos de trabajo (oculto en Obsidian)
├── cursos/
│   └── <curso>/
│       ├── curso.md          ← contrato: objetivos, cómo se evalúa, formato de los parciales
│       ├── indice.yaml       ← temas, rangos de páginas, prerequisitos, ejercicios
│       ├── progreso.yaml     ← tu progreso por tema (lo escribe la herramienta)
│       ├── fuentes/          ← copia de los PDFs del curso (los originales no se tocan)
│       ├── sesiones/         ← una nota por clase, con fotos en adjuntos/
│       ├── notas/verificaciones/  ← informes del verificador externo por tema
│       └── _procesado/       ← texto extraído, renders, ítems (oculto en Obsidian)
└── .pi/                      ← este repo
```

## 1. Crear un curso

1. **Juntá el material** en `_entrada/`: el programa, la bibliografía, los prácticos y los parciales, mejor con solución. También las grabaciones de las clases, en video o audio (mp4, mp3, m4a, wav, ogg, webm, mkv…). Pueden ir en subcarpetas. Los originales nunca se modifican.
2. **Abrí `pi-learn` y escribí** `/curso-nuevo <slug>`, por ejemplo `/curso-nuevo redes`. El slug es un nombre corto, sin espacios.
3. **El agente inventaría los PDFs** y te muestra qué toma para el curso. Si algo es dudoso (otra materia, una edición vieja), te pregunta con botones.
4. **Arma dos archivos.** `curso.md` es el contrato: objetivos, cómo se evalúa y formato de las preguntas, todo citado del programa o con «no consta». `indice.yaml` tiene los temas, el rango de páginas de la bibliografía de cada uno, los prerequisitos y los ejercicios.
5. **Indexa todas las páginas en local, sin modelo**, en segundo plano, y transcribe las grabaciones con faster-whisper, también en tu computadora y sin costo. La primera vez baja el modelo de transcripción, unos 1,6 GB. Una grabación se parte en tramos de 5 minutos, que el índice usa como páginas; el tutor la cita al minuto (`[[clase.mp4#t=725]]`). En la app, la cita abre el video ahí mismo; en Obsidian, el video se abre desde el principio, salvo que tengas un complemento como Video Notes. Transcribir con el procesador puede tardar del orden de la mitad de la grabación o más, según la computadora. Sobre el editor aparece una barra con el avance («⏳ Ingesta de <slug> [████░░…] 568/2592 páginas · 22%»). No hace falta escribir nada: cuando termina, el agente sigue solo con el armado. Si se corta, te avisa y te propone reanudar.
6. **Revisá la tabla tema → material** que te muestra y abrí `cursos/<slug>/informe-ingesta.md` en Obsidian. El curso queda como borrador hasta que la revises. Cada cambio a un curso ya guardado te muestra el diff y pide confirmación.

Más adelante:

- `/curso-agregar <slug> [archivos…]` suma material nuevo (dejalo antes en `_entrada/`). También muestra el diff y pide confirmación. Si estás en una clase, volvé a abrir el tema con `/estudiar` para que tome lo nuevo.
- `/curso-check <slug>` valida estructura, referencias y progreso, y por tema dice si su preparación está completa.
- `/cursos` lista los cursos.

> Lo que necesita modelo (transcribir escaneos y fórmulas, separar los ejercicios de los parciales) **no** se hace al crear el curso: se hace solo la primera vez que estudiás cada tema (ver «La preparación del tema» más abajo).

## 2. Empezar una clase

```text
/estudiar redes retardos
```

- **Curso y tema** se reconocen sin mayúsculas ni tildes, por id, nombre o alias, y si no coinciden, por parecido. Con un solo curso alcanza con el tema: `/estudiar retardos`. El autocompletado lista cursos y temas.
- **Sin tema** (`/estudiar redes`) aparece un selector. Primero lista los temas en curso y para repasar, después los que ya tienen los prerequisitos dominados y al final los dominados.
- **Un tema fuera del índice** (`/estudiar redes multicast`) se busca en la bibliografía:
  - si cae en un tema, lo abre;
  - si no, ofrece una **clase ad hoc**: no toca el índice ni el progreso y sólo deja su nota. Al cerrarla, el tutor ofrece sumar el tema al curso con `/curso-agregar`.
- **Cómo encararlo**, al final: `desde-cero` repasa todo el tema desde las bases, aunque figure como sabido; `fortalecer` trabaja lo que te costó (los errores guardados y sus bases). Por ejemplo, `/estudiar redes retardos desde-cero`. Sin nada, sigue donde quedaste.

Antes de arrancar, `/estudiar` comprueba credenciales y disco: con menos de 200 MB libres no arranca.

**Qué ves:**
- en segundos, la **primera pregunta**, sin que escribas nada más;
- en la barra de abajo, «📚 Redes › Retardos y tasa de transferencia»;
- en Obsidian, una nota nueva: `cursos/redes/sesiones/<fecha>-retardos.md`. Ahí queda toda la clase: preguntas, tus respuestas, explicaciones, fotos y páginas mostradas.

Si el tema ya lo estudiaste, el tutor arranca con una línea de dónde quedaron y retoma desde ahí.

## 3. Cómo es una clase

### Diagnóstico (probe)

El tutor primero ve qué sabés, sin dar nada por sabido:
1. **Una lista** con los conceptos base del tema: marcás los que ya viste. Lo que no marcás te lo enseña sin preguntártelo.
2. **Preguntas** sobre lo que marcaste. Empieza por la base de cada parte del tema y sigue hasta encontrar, en cada una, algo que acertás y algo que no. Si acertás, la siguiente es bastante más difícil; si fallás, rodea el error para entender de dónde viene.

No tiene un número fijo de preguntas, pero no repregunta lo que ya quedó claro. En un tema ya visto, sin la lista, arranca por lo que te costaba. **«No sé» no cuenta como error**: es una laguna y se enseña.

**Si querés que te explique ya**, apretá Esc en la pregunta y escribí algo como «explicame qué es el retardo de propagación». El diagnóstico se corta y empieza a enseñar; lo que quedó sin medir lo comprueba al llegar a ese paso, en vez de darlo por sabido.

**Desde cero** saltea la lista, repasa todos los pasos del tema y arma un objetivo y un plan nuevos. **Fortalecer lo flojo** pregunta primero por lo que figura como fallado, arma el plan sólo con eso y sus bases, y practica cada paso.

### Objetivo y plan

Al terminar el diagnóstico, el tutor:
1. te muestra en una línea por hebra lo que dominás y dónde está tu techo;
2. te propone el **objetivo que pide el curso**, con su peso: «cae en N de M parciales». Elegís «Lo que pide el curso» o «Ajustar»;
3. te propone un **plan**: el enfoque y un diagrama chico de los pasos (nodos), cada uno con su documento y página. Elegís «Dale» o «Ajustar».

Objetivo y plan quedan guardados: al retomar el tema no se vuelven a pedir.

### Enseñanza

Por cada nodo del plan: motivar → establecer → conectar → verificar con una pregunta.

- **Todo sale del material del curso.** Antes de cada nodo, el tutor lee la página de la bibliografía que lo define y la cita como `[[libro.pdf#page=N]]`. Hacé clic en Obsidian y se abre el PDF en esa página.
- **Ningún término sin presentar.** Antes de usar un término, un símbolo o la definición del libro, el tutor se fija si ya lo viste. Si no, te lo presenta primero, con un ejemplo y, si el tema se apoya en él, una pregunta.
- **Cada pregunta llega con su explicación.** Lo que una pregunta comprueba aparece escrito justo antes de ella. Si el tutor intenta preguntar sin haber explicado, la pregunta no aparece hasta que lo explica.
- **Lo que no sale del material** va marcado «fuera del material del curso» o «sin respaldo en el material».
- **Manda la notación de la cátedra.** Si el libro escribe distinto, el tutor lo traduce una vez y sigue con la de la cátedra.
- **«Mostrame esa página»** hace que el tutor la muestre con `ver_pagina`. La página también queda embebida en la nota.
- Al cerrar un nodo con fórmula aparece una tabla «lo que hicimos ↔ nombre y fórmula del material».

### Las preguntas

Hay dos tipos. **De múltiple opción**: una ventana con 3 opciones más «No sé».

| Tecla | Hace |
|---|---|
| ↑ ↓ | moverse entre opciones |
| Enter | responder |
| Tab | escribir una nota junto a tu respuesta (Ctrl+J nueva línea; Tab o Esc vuelve a las opciones) |
| Esc | cancelar la pregunta: el tutor espera lo que escribas |

Después de responder ves ✓ o ✗, la correcta y la explicación con su cita. Si fallaste, el tutor te dice qué creencia lleva a la opción que elegiste.

**De desarrollo**: una caja para escribir la respuesta con tus palabras, más «No sé». Enter la manda, Ctrl+J abre otro renglón, Tab va a «No sé» y Esc cancela. Después de responder ves la respuesta esperada; al seguir, el tutor te corrige: si está bien, a medias o mal, qué está bien, qué falta y de dónde viene el error. No te pide las palabras exactas.

**Cuántas de cada tipo** lo elegís con `/preguntas` (en la app, Ajustes → Cómo estudio), y vale desde la próxima pregunta, también con la clase abierta:
- **Automático** (el recomendado): múltiple opción al principio y más desarrollo a medida que dominás, como pide el examen;
- **Sólo múltiple opción** o **Sólo desarrollo**;
- **Más múltiple opción** (3 de cada 4), **Mitad y mitad** o **Más desarrollo** (3 de cada 4 de desarrollo).

Cuando el tutor necesita que elijas algo (objetivo, plan, seguir o practicar), aparece una ventana parecida con botones. Esc equivale a «No».

### Práctica tipo parcial

Con los conceptos firmes, el tutor propone de 1 a 3 **ejercicios reales** de los prácticos y parciales, de menor a mayor dificultad.

- **Antes de que lo hagas** te dice qué va a mirar (qué pide cada inciso, si hay que justificar), el puntaje oficial si consta y «tomate el tiempo» si es escrito. **Nunca te muestra la solución antes de tu intento.**
- **Entregás en texto o con una foto** de tu hoja: pegala con **Ctrl+V** en pi. Si no pega, guardá la foto y escribí su ruta sola en una línea. Usá JPEG o PNG; HEIC queda en la nota, pero el tutor no lo puede leer.
  - De una foto, el tutor primero transcribe lo que escribiste tal cual, con errores incluidos, y si un dato es ilegible te pregunta sólo ese.
- **Después corrige contra la solución oficial**, y dice contra qué corrige:
  - «≈ x/N» por pregunta, sólo si hay escala oficial;
  - el descuento de cada inciso;
  - qué está bien, citando la solución;
  - qué falta;
  - cada error asociado a un nodo del plan. Si fallaste, vuelve a ese nodo.
- **Un segundo intento** después de ver la corrección no cuenta como intento nuevo.

Si sentís que ya lo tenés antes de terminar el plan, decilo: te ofrece «Seguir con <nodo>» o «Practicar lo visto».

### Mientras tanto, en segundo plano

**La preparación del tema.** La primera vez que estudiás un tema, su material se prepara solo con el modelo de visión:
- transcribe las páginas escaneadas o con fórmulas de su bibliografía;
- transcribe y separa en ejercicios los parciales y prácticos;
- asigna esos ejercicios a temas.

La clase no espera: el tutor usa lo que ya hay, y el avance se ve en la barra («⏳ Preparando material de … N/M páginas»). Si falla (red, cuota, credenciales), ves una línea «Preparación del material no disponible: …; seguimos con lo que hay.», la clase sigue y se reintenta la próxima vez.

**La verificación externa.** Un verificador (researcher) contrasta el tema con fuentes web y deja su informe en `cursos/<curso>/notas/verificaciones/<tema>.md`. Cuando termina ves «Verificación del material lista.». Si el informe discrepa con el curso, el tutor te muestra ambas versiones y cuál espera la evaluación.

## 4. Simulacro

Por cada tema, **un ejercicio real de parcial queda reservado**: no aparece en la clase, ni él ni sus casi copias en prácticos o en el libro.

```text
/simulacro
```

- **Cuándo te lo ofrece el tutor:** al terminar el tema, con el plan cubierto y la práctica hecha.
- **Si lo pedís antes,** te pregunta si querés gastarlo, porque hay uno solo por tema y no se repite. La opción marcada es «No, seguir estudiando».
- **Cómo es:** te presenta el enunciado tal cual, con su puntaje y el tiempo proporcional del parcial (por ejemplo, ~24 min si el parcial es de 2 horas con 5 preguntas). No da pistas hasta que entregues, en texto o con foto. La barra muestra «📝 Simulacro · <tema>».
- **Al entregar:** corrige como en la práctica y te da un veredicto honesto. Registra el resultado y te propone un repaso ordenado por lo que más pesa en los parciales.
- **Si lo abandonás:** el ejercicio queda usado igual, apenas se presenta. Si hay otro, el próximo simulacro del tema toma ese.

No hay simulacro de varios temas ni del curso completo.

## 5. Cerrar, retomar y ver tu progreso

| Querés | Hacé |
|---|---|
| Terminar la clase | `/fin`. Guarda tu progreso con un resumen de toda la sesión, te muestra ese resumen y el próximo paso, y cierra la nota. Si hay una pregunta abierta en pantalla, Esc antes. |
| Ver cómo vas | `/progreso` (o `/progreso redes`): estado de cada tema y qué estudiar después, según prerequisitos. |
| Cambiar de tema | `/estudiar <otro tema>`. Te ofrece «Guardar y cambiar», «Cambiar sin guardar» o «Cancelar». |
| Cambiar el tipo de preguntas | `/preguntas`, o `/preguntas mitad`. Vale desde la próxima pregunta. |
| Retomar donde quedaste | Cerrá y abrí con `pi-learn -c` (la última sesión) o `pi-learn --resume` (elegís cuál; se llaman `<Curso> · <Tema>`). Desde pi, `/resume`. |
| Achicar una clase larga | `/compact`. Resume en español con tema, borde, práctica y próximo paso, y la clase sigue. |

**No se pierde nada.** Cerrar la ventana, un corte de luz o un `/compact` no pierden la clase. Al retomar, el tutor dice en una línea dónde quedaron y repite igual la pregunta que estaba abierta. Si escribiste algo que no llegó a responder, lo responde solo.

**Si una clase quedó sin `/fin`**, la próxima vez que abras ese tema el tutor te ofrece una sola vez reconstruir el progreso desde la nota de esa clase. Te muestra la propuesta y no guarda nada sin tu confirmación.

**Tu progreso** está en `cursos/<curso>/progreso.yaml`, por tema:
- estado (`sin_empezar`, `en_curso`, `dominado` o `repasar`);
- borde: lo que dominás y dónde fallás;
- objetivo y plan;
- intentos;
- historial de sesiones.

Antes de cada guardado se copia en `progreso.yaml.bak`. Sólo cuenta lo que realmente respondiste: una pregunta cancelada o un «No sé» no son errores, y un acierto aislado no da el tema por dominado.

## 6. Obsidian

- **Notas de clase** en `cursos/<curso>/sesiones/`. Podés renombrarlas o moverlas dentro de `sesiones/`: la herramienta las sigue. Si la borrás durante la clase, se recrea con un aviso.
- **Las citas** `[[…pdf#page=N]]` abren el PDF en esa página.
- **Las fotos** que mandás quedan en `sesiones/adjuntos/`, embebidas en la nota.
- **Las páginas que mostró el tutor** quedan como bloque «Página mostrada» con la imagen.
- **Una nota cualquiera** se puede vincular a mano a una sesión de pi con `/md-log <nota>.md`, y desvincular con `/md-unlog`. En una clase no hace falta: la nota se crea sola.

## 7. Cuando algo falla

Un problema externo nunca corta la clase: avisa en una línea y sigue.

| Ves | Qué pasa y qué hacer |
|---|---|
| «Sin credenciales para …: ejecutá /login y repetí /estudiar.» | Falta iniciar sesión con el proveedor del modelo. `/login`. |
| Un error del proveedor y debajo una línea en español (cuota, red, credenciales, disco) | El turno del tutor falló. Escribí «seguí» para reintentar o `/fin` para guardar. |
| «Preparación del material no disponible: …; seguimos con lo que hay.» | La visión no está disponible. La clase sigue con el texto ya extraído; se reintenta en la próxima clase. |
| «Material desde la última carga; el entorno de ingesta no respondió…» | Python (`.pi/.venv`) no responde. Corré el doctor. |
| «Disco lleno: no se guardó el progreso; liberá espacio y repetí /fin.» | `progreso.yaml` quedó intacto. Liberá espacio y repetí. |
| «No se pudo crear la nota de la clase en Obsidian…; seguimos sin nota.» | La clase sigue, pero sin nota. Revisá permisos o disco. |
| «Verificación del material no disponible; seguimos con el material del curso.» | El verificador externo falló. Lo que exceda el material va marcado «sin verificación externa». |
| «Warning: …», «Error: …», «Operation aborted» | Esos prefijos en inglés los dibuja pi y no se pueden cambiar desde la extensión. Lo que sigue al prefijo es el aviso en español. |

Cualquier otro texto en inglés es un defecto: anotalo junto con la nota de la clase.

## 8. Cuánto gasta

- **Crear un curso:** el agente lee programa e índices y arma la propuesta. La indexación de páginas es local y no usa modelo.
- **Transcribir grabaciones de clase:** nada; se hace en tu computadora con faster-whisper.
- **Cada clase:** el modelo principal (`settings.json`), un turno por mensaje tuyo.
- **Primera clase de un tema:** además, el modelo de visión (`modelo_vision` en `curso.config.json`):
  - una llamada por página pendiente;
  - una por parcial o práctico a separar;
  - una cada 40 ejercicios a clasificar.

  La primera clase del curso es la más cara porque procesa todos los parciales y prácticos. En Redes son unas 85–90 llamadas, con un tope de 150 páginas por corrida.
- **El verificador:** el modelo de `agents/researcher.md` más búsquedas web, una vez por tema mientras la caché siga vigente.

## Resumen de comandos

| Comando | Para qué | En la app |
|---|---|---|
| `pi-learn`, `pi-learn -c`, `pi-learn --resume` | abrir, seguir la última sesión, elegir una sesión | abrir la app; Inicio, «Seguir la clase»; «Todas las sesiones» |
| `/curso-nuevo <slug>` | crear un curso desde `_entrada/` | «Crear curso», abajo a la izquierda |
| `/curso-agregar <slug> [archivos…]` | sumar material a un curso | «Agregar material» en el curso |
| `/curso-check <slug>` | validar el curso y ver la preparación de cada tema | pestaña Estado del curso, «Validar el curso» |
| `/curso-estado <slug>` | ver cómo va la indexación | pestaña Estado; la barra de avance a la izquierda |
| `/cursos` | listar cursos | la barra de la izquierda |
| `/estudiar [curso] [tema] [desde-cero\|fortalecer]` | abrir una clase, también desde cero o para fortalecer lo flojo | tocar un tema y «Empezar la clase», «Desde cero» o «Fortalecer lo flojo»; el buscador del curso acepta cualquier texto |
| `/preguntas [mezcla]` | elegir cuántas preguntas van de múltiple opción y cuántas de desarrollo | Ajustes → Cómo estudio |
| `/simulacro` | rendir el ejercicio reservado del tema | botón Simulacro de la clase |
| `/progreso [curso]` | ver el progreso y el próximo tema | la vista del curso y la del tema |
| `/fin` | guardar y cerrar la clase | botón Terminar clase |
| `/compact`, `/resume` | resumir la clase, retomar otra sesión (de pi) | menú de la clase; «Todas las sesiones» |
| `/md-log <nota>`, `/md-unlog` | vincular o desvincular una nota a mano | menú de la clase |
| `/skill:teach <tema>` | estudiar un tema suelto, sin curso | «Tema libre» |
