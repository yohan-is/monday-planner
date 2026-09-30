const {app,BrowserWindow,ipcMain,screen,Menu,Tray,dialog} = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let state, model, tray, quitting=false;
const windows=new Map();
const iconPath=path.join(__dirname,'../assets/monday.ico');
if(process.env.MONDAY_DATA_DIR) app.setPath('userData',process.env.MONDAY_DATA_DIR);
const dataFile=()=>path.join(app.getPath('userData'),'planner.json');
function save(next) {
  fs.mkdirSync(app.getPath('userData'),{recursive:true});
  fs.writeFileSync(dataFile()+'.tmp',JSON.stringify(next,null,2),'utf8');
  fs.renameSync(dataFile()+'.tmp',dataFile());
  state=next;
  for(const win of windows.values()) if(!win.isDestroyed()) win.webContents.send('state-changed',state);
}
function dock(win) { const {x,y,width,height}=screen.getDisplayMatching(win.getBounds()).workArea; win.setBounds({x:x+width-350,y,width:350,height}); }
function openWindow(mode='main') {
  if(windows.has(mode)) {windows.get(mode).show();windows.get(mode).focus();return windows.get(mode);}
  const area=screen.getPrimaryDisplay().workArea;
  const widget=mode!=='main';
  const win=new BrowserWindow({icon:iconPath,title:mode==='todo'?'Monday · 오늘 할 일':mode==='planner'?'Monday · 주간 플래너':'Monday',width:mode==='todo'?350:mode==='planner'?Math.min(1000,area.width-380):Math.min(1420,area.width),height:mode==='todo'?area.height:mode==='planner'?580:Math.min(900,area.height),minWidth:mode==='todo'?320:640,minHeight:380,frame:false,show:false,backgroundColor:'#fafafa',skipTaskbar:widget,alwaysOnTop:mode==='todo',resizable:mode!=='todo',movable:mode!=='todo',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  windows.set(mode,win);
  win.loadFile(path.join(__dirname,'../index.html'),{query:{mode}});
  if(mode==='todo') dock(win);
  if(mode==='planner') win.setPosition(area.x+24,area.y+70);
  win.once('ready-to-show',()=>win.show());
  win.on('closed',()=>windows.delete(mode));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  return win;
}
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>openWindow());
  app.whenReady().then(async()=>{
    model=await import(pathToFileURL(path.join(__dirname,'../src/model.js')));
    try {state=JSON.parse(fs.readFileSync(dataFile(),'utf8')); if(state.version!==1 || !Array.isArray(state.tasks)||!Array.isArray(state.exams)||!Array.isArray(state.subjects)) throw new Error('저장 형식이 올바르지 않습니다.');}
    catch(error) {
      if(error.code!=='ENOENT') {dialog.showErrorBox('저장 파일을 확인해 주세요',`기존 파일을 보호하기 위해 앱을 종료합니다.\n${dataFile()}\n${error.message}`);app.quit();return;}
      state=model.emptyState();save(state);
    }
    ipcMain.handle('state-get',()=>state);
    ipcMain.handle('state-action',(event,action)=>{save(model.reduce(state,action));return state;});
    ipcMain.handle('window-action',(event,action)=>{
      const win=BrowserWindow.fromWebContents(event.sender);
      if(action==='widgets') {openWindow('planner');openWindow('todo');}
      if(action==='main') openWindow();
      if(action==='minimize') win.minimize();
      if(action==='close') win.close();
      if(action==='pin') {win.setAlwaysOnTop(!win.isAlwaysOnTop());return win.isAlwaysOnTop();}
      if(action==='dock') dock(win);
      if(action==='quit') {quitting=true;app.quit();}
    });
    ipcMain.handle('backup',async()=>{
      const result=await dialog.showSaveDialog({title:'플래너 백업',defaultPath:`Monday-${model.dateKey()}.json`,filters:[{name:'JSON',extensions:['json']}]});
      if(result.canceled)return false;fs.writeFileSync(result.filePath,JSON.stringify(state,null,2));return true;
    });
    tray=new Tray(iconPath);tray.setToolTip('Monday · 시험까지, 하루씩');
    tray.setContextMenu(Menu.buildFromTemplate([{label:'플래너 열기',click:()=>openWindow()},{label:'바탕화면 위젯 열기',click:()=>{openWindow('planner');openWindow('todo');}},{type:'separator'},{label:'완전히 종료',click:()=>{quitting=true;app.quit();}}]));
    tray.on('double-click',()=>openWindow());
    screen.on('display-metrics-changed',()=>{if(windows.has('todo'))dock(windows.get('todo'));});
    Menu.setApplicationMenu(null);openWindow();
  });
  app.on('window-all-closed',()=>{if(quitting)app.quit();});
  app.on('activate',()=>openWindow());
}
