const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  getVersion:()=>ipcRenderer.invoke('app-version'),
  getState:()=>ipcRenderer.invoke('state-get'),
  dispatch:action=>ipcRenderer.invoke('state-action',action),
  windowAction:action=>ipcRenderer.invoke('window-action',action),
  backup:()=>ipcRenderer.invoke('backup'),
  onChange:callback=>ipcRenderer.on('state-changed',(_event,state)=>callback(state))
});
