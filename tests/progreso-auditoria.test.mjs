import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registrarSesion } from '../extensions/curso/sesion.ts';
import { registrarProgreso } from '../extensions/curso/progreso.ts';

// Regresiones de la auditoría de progreso: vault sintético, backend Python real, sin modelos.
async function entorno(t) {
  const vault=mkdtempSync(join(tmpdir(),'pi-progreso-aud-')),recursos=join(vault,'.pi'),raiz=join(vault,'cursos/ejemplo');t.after(()=>rmSync(vault,{recursive:true,force:true}));
  for(const p of [join(recursos,'skills/teach'),join(raiz,'sesiones'),join(raiz,'_procesado/practico')])mkdirSync(p,{recursive:true});
  writeFileSync(join(recursos,'skills/teach/SKILL.md'),'TEACH');writeFileSync(join(recursos,'modo-curso.md'),'MODO');writeFileSync(join(recursos,'curso.config.json'),JSON.stringify({max_tokens_dossier:3000,max_tokens_curso_md:1500}));
  writeFileSync(join(raiz,'indice.yaml'),'documentos:\n- {id: practico, tipo: ejercicios}\ntemas:\n- {id: derivacion}\n');writeFileSync(join(raiz,'progreso.yaml'),'version: 1\ntemas: {}\nhistorial: []\n');
  writeFileSync(join(raiz,'_procesado/practico/items.yaml'),'items:\n'+Array.from({length:10},(_,i)=>`- {id: "${i+1}", enunciado: x}\n`).join(''));
  const d={curso:'ejemplo',nombre:'Ejemplo',contrato:'Contrato',documentos:[],temas:[{id:'derivacion',nombre:'Derivación',unidad:1,alias:[],objetivos:[],prerequisitos:[]}],items:{},progreso:{temas:{},historial:[]},avisos:[]};
  const comandos=new Map(),eventos=new Map(),entradas=[],avisos=[],bus=[],mensajes=[],llamadas=[];
  const pi={registerCommand:(n,c)=>comandos.set(n,c),registerTool:()=>{},on:(n,h)=>eventos.set(n,h),appendEntry:(customType,data)=>entradas.push({type:'custom',customType,data}),setSessionName:()=>{},sendUserMessage:m=>mensajes.push(m),exec:async()=>({code:0,stdout:JSON.stringify(d)}),events:{emit:(n,p)=>{bus.push(n);p.onComplete?.();}}};
  const ctx={isIdle:()=>true,hasUI:true,sessionManager:{getBranch:()=>entradas},ui:{notify:m=>avisos.push(m),setStatus:()=>{},confirm:async()=>true}};
  const sesion=registrarSesion(pi,vault,recursos),progreso=registrarProgreso(pi,sesion,vault);await comandos.get('estudiar').handler('ejemplo derivacion',ctx);
  const args={estado:'en_curso',borde:{domina:['Derivar un polinomio'],falla:[]},conceptos_firmes:[],errores_de_concepto:[],ejercicios:[],discrepancias:[],resumen:'Intento sintético',proximo_paso:'Composición'};
  const guardar=(extra={})=>progreso.registrar('prueba',{...args,...extra},undefined,undefined,ctx);
  const final=()=>entradas.push({type:'message',message:{role:'assistant',stopReason:'stop',content:[{type:'text',text:'Resumen final.'}]}});
  return {vault,raiz,ctx,comandos,eventos,entradas,avisos,bus,mensajes,llamadas,sesion,progreso,guardar,final};
}

test("H13: /fin con el ítem '2(g)' guarda, avisa al modelo por '99' y cierra",async t=>{
  const e=await entorno(t);await e.comandos.get('fin').handler('',e.ctx);
  const ej=item=>({doc:'practico',item,fecha:'2026-01-01',resultado:'parcial'});
  const r=await e.guardar({cierre:true,ejercicios:[ej('2(g)'),ej('99')]});
  assert.equal(r.details.guardado,true);assert.equal(e.sesion.actual().d.progreso.temas.derivacion.ejercicios[0].item,'2');
  assert.match(r.content[0].text,/item '99' no existe en practico; ids válidos: 1–10/);assert.ok(!e.avisos.some(a=>/99/.test(a)),'El aviso del ítem es para el modelo, no para el alumno');
  e.final();await e.eventos.get('agent_settled')({},e.ctx);assert.equal(e.sesion.actual(),undefined);
});
test('H10: un delta con sólo resumen y borde se fusiona sin borrar lo previo',async t=>{
  const e=await entorno(t);await e.guardar();
  await e.progreso.registrar('delta',{resumen:'Delta',borde:{domina:['Regla de la cadena']}},undefined,undefined,e.ctx);
  const p=e.sesion.actual().d.progreso.temas.derivacion;
  assert.deepEqual(p.borde.domina,['Derivar un polinomio','Regla de la cadena']);assert.equal(p.proximo_paso,'Composición');assert.equal(p.estado,'en_curso');
  await e.comandos.get('fin').handler('',e.ctx);assert.match(e.mensajes.at(-1),/desde el último guardado/);
});
test('H27: falla_resuelta quita la falla del borde y el modelo recibe el aviso de dominado con fallas',async t=>{
  const e=await entorno(t);await e.guardar({borde:{domina:[],falla:['Identificar la interna','Signo']}});
  const r=await e.progreso.registrar('resuelta',{resumen:'Supera una',estado:'dominado',falla_resuelta:['Identificar la interna']},undefined,undefined,e.ctx);
  assert.deepEqual(e.sesion.actual().d.progreso.temas.derivacion.borde.falla,['Signo']);assert.match(r.content[0].text,/'dominado' con fallas/);
});
test('H04: con el log renombrado en Obsidian, /fin guarda igual y cierra',async t=>{
  const e=await entorno(t);const {renameSync}=await import('node:fs');renameSync(join(e.vault,e.sesion.actual().a.log),join(e.raiz,'sesiones/Clase renombrada.md'));
  await e.comandos.get('fin').handler('',e.ctx);const r=await e.guardar({cierre:true});assert.equal(r.details.guardado,true);assert.match(r.content[0].text,/se guardó igual/);
  e.final();await e.eventos.get('agent_settled')({},e.ctx);assert.equal(e.sesion.actual(),undefined);
});
test('H30: leer_sesion_anterior devuelve el principio y el final de un log largo, con el SHA del archivo completo',async t=>{
  const e=await entorno(t),{createHash}=await import('node:crypto'),{readFileSync}=await import('node:fs');
  const log='sesiones/2026-01-01-derivacion.md',contenido=`INICIO DEL LOG\n${'relleno ñ '.repeat(6000)}\nRESPUESTA FINAL: 42\n`;writeFileSync(join(e.raiz,log),contenido);e.sesion.refrescar();assert.equal(e.sesion.actual().pendiente,log);
  const texto=(await e.progreso.leerAnterior()).content[0].text;
  assert.match(texto,/INICIO DEL LOG/);assert.match(texto,/RESPUESTA FINAL: 42/);assert.ok(Buffer.byteLength(texto)<24500);assert.ok(!texto.includes('�'));
  assert.equal(texto.match(/SHA-256: ([a-f0-9]{64})/)[1],createHash('sha256').update(readFileSync(join(e.raiz,log))).digest('hex'));
});
