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
