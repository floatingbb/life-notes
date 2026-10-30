import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {Module} from 'node:module';
import path from 'node:path';
import {build} from 'esbuild';
const dom=new JSDOM('<div id="app"></div>',{url:'https://days.test'}),saved=new Map();
for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,FileReader:dom.window.FileReader,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true})}
dom.window.scrollTo=()=>{};
const originalFetch=globalThis.fetch,originalInterval=globalThis.setInterval,originalClear=globalThis.clearInterval;let tick;
globalThis.setInterval=(fn,ms)=>{if(ms===60000){tick=fn;return 54321}return originalInterval(fn,ms)};globalThis.clearInterval=id=>id===54321?undefined:originalClear(id);
const initialData={me:'owner',members:[{id:'owner',name:'示例作者',avatar:'data:image/jpeg;base64,/9j/2Q=='}],posts:[{id:'example',author:'owner',body:'synthetic note',images:['/api/photo/example/0'],comments:[],scope:'family',recipients:[],mode:'comment',created:'2026-01-01T00:00:00Z',revision:1}]};
globalThis.fetch=async()=>Response.json(initialData);
const built=await build({entryPoints:['src/diary.tsx'],bundle:true,packages:'external',write:false,format:'cjs',jsx:'automatic',platform:'node',external:['/export-tools.js?v=opening-1']});
const filename=path.resolve('tests/virtual-diary.cjs'),module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(path.dirname(filename));module._compile(built.outputFiles[0].text,filename);const Diary=module.exports.default;
const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('app'));
try{
 await act(async()=>root.render(React.createElement(Diary,{initialData})));const picture=document.querySelector('.diary-card .photos img'),avatar=document.querySelector('.diary-card .avatar img');assert.ok(picture);assert.ok(avatar);
 await act(async()=>tick());assert.equal(document.querySelector('.diary-card .photos img'),picture,'Clock updates must keep the same image node');assert.equal(document.querySelector('.diary-card .avatar img'),avatar);
 const reply=[...document.querySelectorAll('button')].find(b=>b.textContent==='留句话');await act(async()=>reply.click());assert.ok(document.querySelector('#comment'));assert.equal(document.querySelector('.diary-card .photos img'),picture,'Opening a reply must not remount the home cards');
 const textarea=document.querySelector('#comment');await act(async()=>{const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set;setter.call(textarea,'synthetic reply');textarea.dispatchEvent(new dom.window.Event('input',{bubbles:true}))});assert.equal(document.querySelector('.diary-card .photos img'),picture,'Typing must not refetch all post images');
 await act(async()=>document.querySelector('[aria-label="关闭记录"]').click());await act(async()=>document.querySelector('[aria-label="刷新日记"]').click());assert.equal(document.querySelector('.diary-card .photos img'),picture,'Refreshing unchanged metadata must retain mounted image nodes');
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;globalThis.setInterval=originalInterval;globalThis.clearInterval=originalClear;dom.window.close();for(const [k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
console.log('PASS: actual React DOM keeps post and avatar image nodes mounted across clock ticks, reply opening/typing, and metadata refresh; no family data or cloud credentials used.');
