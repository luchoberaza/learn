import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registrarSesion } from '../extensions/curso/sesion.ts';
import { registrarProgreso, proximoTema } from '../extensions/curso/progreso.ts';

async function entorno(t, anterior=false) {
  const vault=mkdtempSync(join(tmpdir(),'pi-progreso-')),recursos=join(vault,'.pi'),raiz=join(vault,'cursos/ejemplo');t.after(()=>rmSync(vault,{recursive:true,force:true}));
  for(const p of [join(recursos,'skills/teach'),join(raiz,'sesiones')])mkdirSync(p,{recursive:true});
  writeFileSync(join(recursos,'skills/teach/SKILL.md'),'TEACH');writeFileSync(join(recursos,'modo-curso.md'),'MODO');writeFileSync(join(recursos,'curso.config.json'),JSON.stringify({max_tokens_dossier:3000,max_tokens_curso_md:1500}));
  writeFileSync(join(raiz,'indice.yaml'),'documentos: []\ntemas:\n- {id: derivacion}\n');writeFileSync(join(raiz,'progreso.yaml'),'version: 1\ntemas: {}\nhistorial: []\n');
  if(anterior)writeFileSync(join(raiz,`sesiones/${new Date().toISOString().slice(0,10)}-derivacion.md`),'> [!quote] VOS\n\nRespuesta del alumno.\n\nLOG ANTERIOR: pregunta sin respuesta, no un error del estudiante.');
  const d={curso:'ejemplo',nombre:'Ejemplo',contrato:'Contrato',documentos:[],temas:[{id:'derivacion',nombre:'Derivación',unidad:1,alias:[],objetivos:[],prerequisitos:[]}],items:{},progreso:{temas:{},historial:[]},avisos:[]};
  const comandos=new Map(),tools=new Map(),eventos=new Map(),entradas=[],avisos=[],bus=[],mensajes=[];
  const pi={registerCommand:(n,c)=>comandos.set(n,c),registerTool:c=>tools.set(c.name,c),on:(n,h)=>eventos.set(n,h),appendEntry:(customType,data)=>entradas.push({type:'custom',customType,data}),setSessionName:()=>{},sendUserMessage:m=>mensajes.push(m),sendMessage:m=>mensajes.push(m.content),exec:async()=>({code:0,stdout:JSON.stringify(d)}),events:{emit:(n,p)=>{bus.push(n);p.onComplete?.();}}};
  const ctx={isIdle:()=>true,hasUI:true,sessionManager:{getBranch:()=>entradas},ui:{notify:m=>avisos.push(m),setStatus:()=>{},confirm:async()=>true}};
  const sesion=registrarSesion(pi,vault,recursos),progreso=registrarProgreso(pi,sesion,vault);tools.set('registrar_progreso',{execute:progreso.registrar});tools.set('leer_sesion_anterior',{execute:progreso.leerAnterior});await comandos.get('estudiar').handler('ejemplo derivacion',ctx);
  const args={estado:'en_curso',borde:{domina:['Derivar un polinomio'],falla:['Identificar la interna']},conceptos_firmes:['Tasa de cambio'],errores_de_concepto:[],ejercicios:[],discrepancias:[],resumen:'Intento sintético',proximo_paso:'Composición'};
  const final=()=>entradas.push({type:'message',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'Resumen final.'}]}});
  const guardar=(extra={})=>tools.get('registrar_progreso').execute('prueba',{...args,...extra},undefined,undefined,ctx);
  return {vault,raiz,pi,ctx,comandos,tools,eventos,entradas,avisos,bus,mensajes,sesion,args,guardar,final,d};
}

test('tool guarda, refresca el borde y no cierra al registrar el probe',async t=>{
  const e=await entorno(t);const r=await e.guardar();assert.equal(r.details.guardado,true);assert.equal(e.sesion.actual().d.progreso.temas.derivacion.estado,'en_curso');
  const evento={systemPromptOptions:{sections:{}}};e.eventos.get('before_agent_start')(evento);assert.match(evento.systemPromptOptions.sections.curso,/Identificar la interna/);
  await e.eventos.get('agent_settled')({},e.ctx);assert.ok(e.sesion.actual());assert.ok(!e.bus.includes('md-log:unlink'));
});
test('/fin pide registro y cierra sólo después del mensaje final y guardado',async t=>{
  const e=await entorno(t);const log=join(e.vault,e.sesion.actual().a.log);await e.comandos.get('fin').handler('',e.ctx);assert.match(e.mensajes.at(-1),/registrar_progreso/);
  await e.eventos.get('agent_settled')({},e.ctx);assert.ok(e.sesion.actual());assert.ok(!e.bus.includes('md-log:unlink'));
  await e.guardar({cierre:true});appendFileSync(log,'RESUMEN FINAL');e.final();await e.eventos.get('agent_settled')({},e.ctx);assert.equal(e.sesion.actual(),undefined);assert.equal(e.bus.at(-1),'md-log:unlink');assert.match(readFileSync(log,'utf8'),/RESUMEN FINAL/);
  await e.eventos.get('session_start')({},e.ctx);assert.equal(e.sesion.actual(),undefined);
});
test('cierre natural usa el mismo camino; errores y busy dejan el log activo',async t=>{
  const e=await entorno(t);e.ctx.isIdle=()=>false;e.ctx.abort=()=>{};e.ctx.waitForIdle=async()=>{};await e.comandos.get('fin').handler('',e.ctx);assert.equal(e.entradas.filter(x=>x.customType==='curso-cierre').length,1);
  await assert.rejects(()=>e.guardar({estado:'inventado'}));assert.ok(e.sesion.actual());
  await e.guardar({cierre:true});e.final();await e.eventos.get('agent_settled')({},e.ctx);assert.equal(e.sesion.actual(),undefined);
});
test('reconstrucción lee el log sin tocarlo, pide confirmación y no cierra la sesión actual',async t=>{
  const e=await entorno(t,true),r=await e.tools.get('leer_sesion_anterior').execute();const texto=r.content[0].text;assert.match(texto,/pregunta sin respuesta/);
  const log=e.sesion.actual().pendiente,antes=readFileSync(join(e.raiz,log));const huella=texto.match(/SHA-256: ([a-f0-9]{64})/)[1];
  e.ctx.ui.confirm=async()=>false;await assert.rejects(()=>e.guardar({reconstruir_log:log,huella_log:huella}),/sin confirmar/);
  e.ctx.hasUI=false;await assert.rejects(()=>e.guardar({reconstruir_log:log,huella_log:huella}),/sin confirmar/);
  e.ctx.hasUI=true;e.ctx.ui.confirm=async()=>true;await e.guardar({estado:'sin_empezar',borde:{domina:[],falla:[]},conceptos_firmes:[],reconstruir_log:log,huella_log:huella});
  assert.equal(e.sesion.actual().pendiente,undefined);await e.eventos.get('agent_settled')({},e.ctx);assert.ok(e.sesion.actual());assert.deepEqual(readFileSync(join(e.raiz,log)),antes);
});
test('un registro sólo del probe sigue pendiente; el registro final y el historial legado no se reconstruyen',async t=>{
  const e=await entorno(t,true),log=e.sesion.actual().pendiente;
  const d=e.sesion.actual().d;
  d.progreso.historial=[{tema:'derivacion',log,cierre:false}];e.sesion.refrescar();assert.equal(e.sesion.actual().pendiente,log);
  d.progreso.historial[0].cierre=true;e.sesion.refrescar();assert.equal(e.sesion.actual().pendiente,undefined);
  delete d.progreso.historial[0].cierre;e.sesion.refrescar();assert.equal(e.sesion.actual().pendiente,undefined);
});
test('no ofrece reconstruir un log de otro tema con el mismo sufijo',async t=>{
  const e=await entorno(t);writeFileSync(join(e.raiz,`sesiones/${new Date().toISOString().slice(0,10)}-otra-derivacion.md`),'Otro tema');
  e.sesion.refrescar();assert.equal(e.sesion.actual().pendiente,undefined);
});
test('reconstrucción rechaza un log ajeno o modificado desde su lectura',async t=>{
  const e=await entorno(t,true);await assert.rejects(()=>e.guardar({reconstruir_log:'sesiones/ajeno.md',huella_log:'0'.repeat(64)}),/Releé/);
  const r=await e.tools.get('leer_sesion_anterior').execute(),log=e.sesion.actual().pendiente,huella=r.content[0].text.match(/SHA-256: ([a-f0-9]{64})/)[1];appendFileSync(join(e.raiz,log),'CAMBIÓ');
  await assert.rejects(()=>e.guardar({reconstruir_log:log,huella_log:huella}),/cambió/);
});
test('guardar cierre no desvincula sin mensaje final o si se abortó el turno',async t=>{
  const e=await entorno(t);await e.guardar({cierre:true});
  await e.eventos.get('agent_settled')({aborted:false},e.ctx);assert.ok(e.sesion.actual(),'Falta el mensaje final: el log debe seguir abierto');
  e.entradas.push({type:'message',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'Resumen final.'}]}});
  await e.eventos.get('agent_settled')({aborted:true},e.ctx);assert.ok(e.sesion.actual(),'Un aborto no debe cerrar el log');
  e.entradas.at(-1).message.stopReason='error';await e.eventos.get('agent_settled')({aborted:false},e.ctx);assert.ok(e.sesion.actual());
  e.entradas.at(-1).message.stopReason='stop';await e.eventos.get('agent_settled')({aborted:false},e.ctx);assert.equal(e.sesion.actual(),undefined);
});
test('fallo del acuse de md-log conserva el curso y permite reintentar cierre',async t=>{
  const e=await entorno(t);await e.guardar({cierre:true});e.final();const emitir=e.pi.events.emit;
  e.pi.events.emit=(n,p)=>{if(n==='md-log:unlink')p.onComplete('Vínculo cambiado; se preservó');else emitir(n,p);};
  await e.eventos.get('agent_settled')({aborted:false},e.ctx);assert.ok(e.sesion.actual());assert.match(e.avisos.at(-1),/Vínculo cambiado/);
  e.pi.events.emit=emitir;await e.eventos.get('agent_settled')({aborted:false},e.ctx);assert.equal(e.sesion.actual(),undefined);
});
test('/progreso informa estados; sugerencia respeta prerequisitos y omite dominados',async t=>{
  const e=await entorno(t);await e.comandos.get('progreso').handler('ejemplo',e.ctx);assert.match(e.avisos.at(-1),/sin_empezar/);
  e.d.temas.push({...e.d.temas[0],id:'cadena',nombre:'Cadena',prerequisitos:['derivacion']});e.d.progreso.temas.derivacion={estado:'dominado'};assert.equal(proximoTema(e.d).id,'cadena');
  e.d.progreso.temas.derivacion={estado:'repasar'};assert.equal(proximoTema(e.d).id,'derivacion');
});
