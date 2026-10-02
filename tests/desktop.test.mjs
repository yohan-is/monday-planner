import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as model from '../src/model.js';

test('desktop widgets dock to the work area and every window receives persisted edits', async () => {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'monday-test-'));
  const handles=new Map(), windows=[];
  const app=new EventEmitter();
  Object.assign(app,{getPath:()=>folder,getVersion:()=> '1.1.0',setPath(){},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),quit(){}});
  class Window extends EventEmitter {
    constructor(options){super();this.options=options;this.bounds={x:100,y:100,width:options.width,height:options.height};this.messages=[];this.webContents=new EventEmitter();Object.assign(this.webContents,{send:(channel,state)=>this.messages.push({channel,state}),setWindowOpenHandler(){}});windows.push(this);}
    loadFile(){} setPosition(x,y){Object.assign(this.bounds,{x,y});} setBounds(bounds){this.bounds=bounds;} getBounds(){return this.bounds;} isDestroyed(){return false;} show(){} focus(){}
    static fromWebContents(sender){return windows.find(w=>w.webContents===sender);}
  }
  const screen=new EventEmitter(),area={x:0,y:0,width:1920,height:1040};
  Object.assign(screen,{getPrimaryDisplay:()=>({workArea:area}),getDisplayMatching:()=>({workArea:area})});
  const electron={app,BrowserWindow:Window,screen,ipcMain:{handle:(name,fn)=>handles.set(name,fn)},Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},Tray:class{setToolTip(){}setContextMenu(){}on(){}},nativeImage:{createFromDataURL(){}},dialog:{showErrorBox:(_,message)=>{throw Error(message);}}};
  const source=fs.readFileSync(new URL('../electron/main.cjs',import.meta.url),'utf8').replace(/model=await import\([^\n]+\);/,'model=testModel;');
  vm.runInNewContext(source,{require:name=>name==='electron'?electron:name==='node:fs'?fs:name==='node:path'?path:{pathToFileURL:x=>x},__dirname:path.resolve('electron'),process:{env:{}},testModel:model,console});
  await new Promise(resolve=>setImmediate(resolve));
  try {
    assert.equal(windows.length,1);
    assert.equal(handles.get('app-version')(),'1.1.0');
    handles.get('window-action')({sender:windows[0].webContents},'widgets');
    assert.equal(windows.length,3);
    const todo=windows[2],planner=windows[1];
    assert.deepEqual({...todo.bounds},{x:1570,y:0,width:350,height:1040});
    assert.equal(todo.options.alwaysOnTop,true);assert.equal(todo.options.movable,false);assert.equal(todo.options.frame,false);
    assert.equal(planner.options.skipTaskbar,true);assert.equal(planner.options.alwaysOnTop,false);
    handles.get('state-action')({sender:todo.webContents},{type:'task-save',task:{id:'t',title:'공부',date:'2026-09-30',amount:10,unit:'쪽'}});
    handles.get('state-action')({sender:planner.webContents},{type:'task-save',task:{id:'t',title:'공부',amount:15}});
    assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'planner.json'))).tasks[0].amount,15);
    for(const win of windows) assert.equal(win.messages.at(-1).state.tasks[0].amount,15);
    assert.equal(fs.existsSync(path.join(folder,'planner.json.tmp')),false);
  } finally {
    assert.equal(path.dirname(path.resolve(folder)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(folder).startsWith('monday-test-'));
    fs.rmSync(folder,{recursive:true,force:true});
  }
});
