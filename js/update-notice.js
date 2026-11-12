/* NHANHVALE WRITE — one-time notice for each newly installed app version. */
(()=>{
  'use strict';
  const version=String(window.NV_VERSION||'').trim();
  const key='nv-write-last-seen-version';
  if(!/^\d+\.\d+\.\d+$/.test(version))return;
  const compare=(a,b)=>{
    const x=a.split('.').map(Number),y=b.split('.').map(Number);
    for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i]}
    return 0;
  };
  let previous=null,hasUsedApp=false;
  try{
    previous=localStorage.getItem(key);
    if(previous===version)return;
    if(previous&&/^\d+\.\d+\.\d+$/.test(previous)&&compare(version,previous)<0)return;
    hasUsedApp=previous!==null||localStorage.getItem('nv-write-v1')!==null
      ||localStorage.getItem('nv-write-xp-v1')!==null;
    localStorage.setItem(key,version);
  }catch{return}
  // On a first installation, remember the version without claiming an update.
  if(!hasUsedApp)return;
  const show=()=>{
    if(document.getElementById('nvUpdateNotice'))return;
    const toast=document.createElement('div');
    toast.id='nvUpdateNotice';
    toast.className='nv-update-notice';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    const icon=document.createElement('span');
    icon.className='nv-update-icon';
    icon.setAttribute('aria-hidden','true');
    icon.textContent='✓';
    const content=document.createElement('div');
    content.className='nv-update-copy';
    const heading=document.createElement('strong');
    heading.textContent='Đã cập nhật phiên bản mới';
    const message=document.createElement('span');
    message.textContent='NHANHVALE WRITE v'+version+' đã sẵn sàng.';
    content.append(heading,message);
    const dismiss=document.createElement('button');
    dismiss.type='button';
    dismiss.className='nv-update-close';
    dismiss.setAttribute('aria-label','Đóng thông báo cập nhật');
    dismiss.textContent='×';
    toast.append(icon,content,dismiss);
    document.body.appendChild(toast);
    let timer;
    const close=()=>{
      clearTimeout(timer);
      toast.classList.remove('show');
      setTimeout(()=>toast.remove(),240);
    };
    dismiss.addEventListener('click',close,{once:true});
    requestAnimationFrame(()=>toast.classList.add('show'));
    timer=setTimeout(close,6000);
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',show,{once:true});
  }else show();
})();
