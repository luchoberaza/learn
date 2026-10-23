import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararInvestigacion, registrarResearcher, verificacionPrevia } from '../extensions/curso/researcher.ts';

function entorno(t) {
  const vault=mkdtempSync(join(tmpdir(),'pi-researcher-')), recursos=join(vault,'.pi'), raiz=join(vault,'cursos/calculo');
  t.after(()=>rmSync(vault,{recursive:true,force:true}));
  for (const p of [join(recursos,'agents'),join(raiz,'_procesado/libro/paginas')]) mkdirSync(p,{recursive:true});
  writeFileSync(join(recursos,'curso.config.json'),JSON.stringify({modelo_researcher:'openai/gpt-6-luna'}));
  writeFileSync(join(recursos,'agents/researcher.md'),'PROMPT ESPAÑOL');
  writeFileSync(join(raiz,'curso.md'),'Contrato del curso');writeFileSync(join(raiz,'indice.yaml'),'version: 1');
  const pagina=join(raiz,'_procesado/libro/paginas/0001.md');writeFileSync(pagina,'<!-- p. PDF 1 -->\nLa derivada de $x^2$ es $2x$.');
  const tema={id:'derivadas',nombre:'Derivadas',bibliografia:[{doc:'libro',paginas:[1,2]}],objetivos:[],prerequisitos:[]};
  const d={curso:'calculo',contrato:'Contrato del curso',documentos:[{id:'libro',titulo:'Libro',tipo:'bibliografia',archivo:'fuentes/bibliografia/libro.pdf',paginas:2,prioridad:'principal'}],temas:[tema],items:{},progreso:{temas:{}},avisos:[]};
  let activo={a:{curso:'calculo',tema:'derivadas'},d,r:raiz}, llamadas=0, refrescos=0;
  const entradas=[],eventos=new Map(),avisos=[],entregas=[];
  const pi={on:(n,h)=>eventos.set(n,h),appendEntry:(customType,data)=>{if(data.tipo==='inicio')llamadas++;entradas.push({type:'custom',customType,data});},events:{emit:(n,p)=>entregas.push([n,p])},sendMessage:()=>{}};
  const ctx={sessionManager:{getBranch:()=>entradas,getEntries:assert.fail},ui:{notify:m=>avisos.push(m)},executeTool:assert.fail,modelRegistry:{find:()=>({}),hasConfiguredAuth:()=>true}};
  const dormido=join(vault,'dormido.mjs');writeFileSync(dormido,`import {existsSync} from 'node:fs';setInterval(()=>{if(!existsSync(${JSON.stringify(vault)}))process.exit(0);},100);`);
  const construir=()=>registrarResearcher(pi,()=>activo,()=>{refrescos++;return verificacionPrevia(vault,recursos,d,tema);},vault,recursos,[process.execPath,dormido]);
  const investigar=construir();
  const responder=async(extra={},texto)=>{
    const i=entradas.findLast(e=>e.data.tipo==='inicio').data;
    const content=texto||`## Resumen\nAfirmación sintética incorrecta.\n## Contra el material del curso\n**discrepa**: la fuente dice $2x$ ${'[[cursos/calculo/fuentes/bibliografia/libro.pdf#page=1]]'}, no $x$. [Fuente de prueba](https://openstax.org/)\n## Hallazgos\nHipótesis explícitas.\n## Extensiones útiles\nNinguna necesaria.\n## Fuentes\nhttps://openstax.org/\n## Huecos\nInforme sintético para tests; no certifica contenido.`;
    const dir=join(raiz,'notas/verificaciones/.trabajos',i.nombre);while(!existsSync(join(dir,'error.txt')))await new Promise(r=>setTimeout(r,10));writeFileSync(join(dir,'salida.md'),content);writeFileSync(join(dir,'codigo'),String(extra.exitCode??0));
    const event={messageType:'user',prompt:'Sigo',systemPromptOptions:{sections:{ajena:'conservar'}}};
    await eventos.get('before_agent_start')(event,ctx);await eventos.get('message_end')({message:{role:'user'}},ctx);return event;
  };
  return {vault,recursos,raiz,pagina,d,tema,ctx,entradas,eventos,avisos,entregas,construir,investigar,responder,get llamadas(){return llamadas},get refrescos(){return refrescos},set activo(a){activo=a}};
}
const args={modo:'alcance',afirmaciones:['La derivada de x² es x.']};
test('tarea anclada: rutas reales, PDF base 1, límites y modelo configurado',t=>{
  const e=entorno(t),p=prepararInvestigacion(e.vault,e.recursos,e.d,e.tema,'verificar',args.afirmaciones);
  assert.ok(p.tarea.includes(e.pagina));assert.ok(p.tarea.includes(e.d.contrato));assert.match(p.tarea,/#page=1/);assert.match(p.tarea,/1–3 afirmaciones/);assert.match(p.tarea,/Respondé en español/);assert.match(p.tarea,/libro\/2/);
  writeFileSync(e.pagina,'Otra transcripción');assert.notEqual(prepararInvestigacion(e.vault,e.recursos,e.d,e.tema,'verificar').huella,p.huella);
  e.tema.bibliografia[0].paginas=[0,1000000000];assert.throws(()=>prepararInvestigacion(e.vault,e.recursos,e.d,e.tema,'verificar'),/fuera de rango/);
});
test('incluye ejercicios curados sin soluciones e invalida al cambiar el enunciado',t=>{
  const e=entorno(t);e.d.documentos.push({id:'practico',tipo:'ejercicios',archivo:'fuentes/ejercicios/practico.pdf',paginas:1});
  e.tema.ejercicios=[{doc:'practico',items:['1']}];e.d.items.practico=[{id:'1',paginas:[1],enunciado:'Enunciado preparado',solucion:{doc:'soluciones',id:'1'}}];e.d.items.soluciones=[{id:'1',enunciado:'RESPUESTA RESERVADA'}];
  const p=prepararInvestigacion(e.vault,e.recursos,e.d,e.tema,'alcance');assert.match(p.tarea,/Enunciado preparado/);assert.ok(!p.tarea.includes('RESPUESTA RESERVADA'));assert.ok(p.citas.some(c=>c.includes('practico.pdf#page=1')));
  e.d.items.practico[0].enunciado='Enunciado nuevo';assert.notEqual(prepararInvestigacion(e.vault,e.recursos,e.d,e.tema,'alcance').huella,p.huella);
  e.d.items.practico[0].paginas=[0];assert.throws(()=>prepararInvestigacion(e.vault,e.recursos,e.d,e.tema,'alcance'),/fuera de rango/);
});
test('verificar distingue afirmaciones nuevas; alcance no duplica el mapa por otra redacción',async t=>{
  const e=entorno(t),a={modo:'verificar',afirmaciones:['Primera afirmación.']},b={modo:'verificar',afirmaciones:['Otra afirmación.']};
  await e.investigar('1',a,undefined,undefined,e.ctx);await e.investigar('2',b,undefined,undefined,e.ctx);assert.equal(e.llamadas,2);
  await e.investigar('3',b,undefined,undefined,e.ctx);assert.equal(e.llamadas,2);
  await e.investigar('4',args,undefined,undefined,e.ctx);await e.investigar('5',{...args,afirmaciones:['Otra redacción del alcance.']},undefined,undefined,e.ctx);assert.equal(e.llamadas,3);
});
test('alcance entrega discrepancias y segunda sesión usa caché sin otro hijo',async t=>{
  const e=entorno(t);const r=await e.investigar('1',args,undefined,undefined,e.ctx);assert.equal(r.isError,undefined);assert.equal(e.llamadas,1);
  const ev=await e.responder();assert.match(ev.systemPromptOptions.sections.curso,/discrepa/);assert.equal(ev.systemPromptOptions.sections.ajena,'conservar');assert.equal(e.refrescos,1);assert.equal(e.entregas.length,1);
  assert.deepEqual(readdirSync(join(e.raiz,'notas/verificaciones')),['derivadas.md']);
  e.entradas.length=0;const investigar=e.construir();const cache=await investigar('2',args,undefined,undefined,e.ctx);
  assert.equal(cache.details.cache,true);assert.equal(e.llamadas,1);assert.match(verificacionPrevia(e.vault,e.recursos,e.d,e.tema),/Caché de alcance vigente/);
});
test('fuentes nuevas invalidan caché y crean generación sin sobrescribir la anterior',async t=>{
  const e=entorno(t);await e.investigar('1',args,undefined,undefined,e.ctx);await e.responder();
  const file=join(e.raiz,'notas/verificaciones/derivadas.md'),antes=readFileSync(file,'utf8');writeFileSync(e.pagina,'Fuente nueva');
  assert.match(verificacionPrevia(e.vault,e.recursos,e.d,e.tema),/Caché de alcance previa/);
  await e.investigar('2',args,undefined,undefined,e.ctx);await e.responder();
  assert.equal(e.llamadas,2);assert.equal(readFileSync(file,'utf8'),antes);assert.equal(readdirSync(join(e.raiz,'notas/verificaciones')).length,2);
  assert.match(verificacionPrevia(e.vault,e.recursos,e.d,e.tema),/Caché de alcance vigente/);
});
test('cambios durante la investigación y fallo del proveedor no generan una caché',async t=>{
  const e=entorno(t);await e.investigar('1',args,undefined,undefined,e.ctx);writeFileSync(e.pagina,'Editada mientras corría');await e.responder();
  assert.match(e.entregas.at(-1)[1].error,/fuentes cambiaron/);assert.equal(e.entregas.at(-1)[1].estado,'no_guardada');
  await e.investigar('2',args,undefined,undefined,e.ctx);await e.responder({exitCode:1});assert.match(e.entregas.at(-1)[1].error,/no entregó/);
});
test('manual, incompleta o enlazada se preserva sin sobrescribir ni gastar otro alcance',async t=>{
  const e=entorno(t),carpeta=join(e.raiz,'notas/verificaciones');mkdirSync(carpeta,{recursive:true});const file=join(carpeta,'derivadas.md');writeFileSync(file,'NOTA DEL USUARIO');
  const r=await e.investigar('1',args,undefined,undefined,e.ctx);assert.equal(r.details.manual,true);assert.equal(e.llamadas,0);assert.equal(readFileSync(file,'utf8'),'NOTA DEL USUARIO');
  rmSync(file);symlinkSync(e.pagina,file);const otro=await e.investigar('2',args,undefined,undefined,e.ctx);assert.equal(otro.isError,true);assert.equal(e.llamadas,0);
});
test('verificar no reemplaza el mapa; entrega externa no cambia el curso activo',async t=>{
  const e=entorno(t);await e.investigar('1',args,undefined,undefined,e.ctx);await e.responder();const file=join(e.raiz,'notas/verificaciones/derivadas.md'),antes=readFileSync(file,'utf8');
  await e.investigar('2',{...args,modo:'verificar'},undefined,undefined,e.ctx);e.activo=undefined;await e.responder();
  assert.equal(e.refrescos,1);assert.equal(readFileSync(file,'utf8'),antes);assert.equal(e.entregas.at(-1)[1].estado,'recibida');
});
test('sin curso, entrada inválida y modo ad hoc no crean temas ni lanzan alcance',async t=>{
  const e=entorno(t);e.activo=undefined;assert.equal((await e.investigar('1',args,undefined,undefined,e.ctx)).isError,true);
  e.activo={a:{curso:'calculo',tema:'ad-hoc',adHoc:{...e.tema,id:'ad-hoc'}},d:e.d,r:e.raiz};assert.equal((await e.investigar('2',args,undefined,undefined,e.ctx)).isError,true);
  assert.equal(e.llamadas,0);
});
test('rama activa y despacho pendiente evitan duplicados; un resultado ajeno se ignora',async t=>{
  const e=entorno(t);e.entradas.push({type:'custom',customType:'curso-researcher',data:{tipo:'inicio',nombre:'entrada-incompleta'}});
  await e.investigar('1',args,undefined,undefined,e.ctx);await e.investigar('2',args,undefined,undefined,e.ctx);assert.equal(e.llamadas,1);
  const antes=e.entradas.length;await e.eventos.get('message_end')({message:{customType:'subagent_result',details:{name:'otro'}}},e.ctx);assert.equal(e.entradas.length,antes);
  e.entradas.length=0;assert.match((await e.investigar('3',args,undefined,undefined,e.ctx)).content[0].text,/en curso/);
});
test('informe sin contraste o con cita inventada no se guarda como caché válida',async t=>{
  const e=entorno(t);await e.investigar('1',args,undefined,undefined,e.ctx);await e.responder({},'## Resumen\nNo alcanza https://openstax.org/');assert.match(e.entregas.at(-1)[1].error,/incompleto/);
  await e.investigar('2',args,undefined,undefined,e.ctx);await e.responder({},'## Resumen\n## Contra el material del curso\nconcuerda [[cursos/calculo/fuentes/bibliografia/libro.pdf#page=2]] https://openstax.org/\n## Extensiones útiles\nNinguna');assert.match(e.entregas.at(-1)[1].error,/ajenas/);
});
// P1: la preparación del tema transcribe con visión las anclas dudosas mientras el researcher las lee.
const dudosa={paginas:{1:{motor:'pymupdf',requiere_vision:true,ruta:'pendiente'}}},transcripta={paginas:{1:{motor:'vision',requiere_vision:false,ruta:'vision',vision:{modelo:'openai/gpt-6-luna'}}}};
test('P1: con la preparación reescribiendo anclas, el alcance espera a que termine y se guarda contra el texto definitivo',async t=>{
  const e=entorno(t),calidad=join(e.raiz,'_procesado/libro/calidad.json'),lock=join(e.raiz,'_procesado/.preparacion.lock');
  writeFileSync(calidad,JSON.stringify(dudosa));writeFileSync(lock,JSON.stringify({pid:process.pid,inicio:Date.now()}));
  const r=await e.investigar('1',args,undefined,undefined,e.ctx);assert.match(r.content[0].text,/segundo plano/);assert.equal(r.isError,undefined);assert.equal(e.llamadas,0);
  await e.eventos.get('message_end')({message:{role:'assistant'}},e.ctx);assert.equal(e.llamadas,0,'la preparación sigue con la ancla');
  writeFileSync(e.pagina,'<!-- p. PDF 1 -->\nLa derivada de $x^2$ es $2x$ (transcripta con visión).');writeFileSync(calidad,JSON.stringify(transcripta));
  await e.eventos.get('message_end')({message:{role:'assistant'}},e.ctx);assert.equal(e.llamadas,1,'la ancla ya es definitiva aunque la preparación siga');
  const nombre=e.entradas.findLast(x=>x.data.tipo==='inicio').data.nombre;
  assert.match(readFileSync(join(e.raiz,'notas/verificaciones/.trabajos',nombre,'tarea.md'),'utf8'),/A1: "La derivada de x² es x\."/,'la espera conserva las afirmaciones');
  await e.responder();
  assert.equal(e.entregas.at(-1)[1].estado,'guardada');assert.deepEqual(e.avisos,['Verificación del material lista.']);
  assert.match(verificacionPrevia(e.vault,e.recursos,e.d,e.tema),/Caché de alcance vigente/);
});
test('P1: sin preparación en curso lanza enseguida, declara las anclas pendientes y la caché pasa a previa cuando cambian',async t=>{
  const e=entorno(t);writeFileSync(join(e.raiz,'_procesado/libro/calidad.json'),JSON.stringify(dudosa));
  await e.investigar('1',args,undefined,undefined,e.ctx);assert.equal(e.llamadas,1);
  const nombre=e.entradas.findLast(x=>x.data.tipo==='inicio').data.nombre;
  assert.match(readFileSync(join(e.raiz,'notas/verificaciones/.trabajos',nombre,'tarea.md'),'utf8'),/Pendientes de transcripción con visión.*: libro\/1\./);
  await e.responder();
  assert.match(readFileSync(join(e.raiz,'notas/verificaciones/derivadas.md'),'utf8'),/Páginas pendientes de transcripción al verificar \(lo dicho sobre ellas no está verificado contra su transcripción definitiva\): libro\/1\.\n\n## Resumen/);
  writeFileSync(e.pagina,'Transcripta con visión');
  assert.match(verificacionPrevia(e.vault,e.recursos,e.d,e.tema),/Caché de alcance previa/);
});
