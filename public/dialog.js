(() => {
  // Native dialogs retain Escape handling, focus trapping and return focus.
  for (const dialog of document.querySelectorAll('dialog')) {
    const outside = e => { const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom; };
    let startedOutside=false;
    dialog.addEventListener('pointerdown',e=>{startedOutside=e.target===dialog&&outside(e);});
    dialog.addEventListener('click',e=>{if(startedOutside&&e.target===dialog&&outside(e))dialog.close();startedOutside=false;});
  }
  document.addEventListener('click',e=>{
    const close=e.target.closest('.dialog-close,.dialog-ok');if(close)close.closest('dialog')?.close();
    for(const details of document.querySelectorAll('details[data-dismiss-outside],details.tools-menu'))if(details.open&&!details.contains(e.target))details.open=false;
  });
})();
