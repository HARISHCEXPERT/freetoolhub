/* FreeToolHub chemistry widget loader. Usage:
   <div data-fth-chem data-tool="molar-mass"></div>   (or data-tool="balancer")
   <script src="https://freetoolhub.app/embed/embed.js" async></script> */
(function(){
  var BASE='https://freetoolhub.app/embed/chem.html';
  var frames=[];
  document.querySelectorAll('[data-fth-chem]').forEach(function(el){
    var tool=el.getAttribute('data-tool')==='balancer'?'?tool=balancer':'';
    var f=document.createElement('iframe');
    f.src=BASE+tool;
    f.loading='lazy';
    f.title=tool?'Chemical Equation Balancer':'Molar Mass Calculator';
    f.style.cssText='width:100%;height:380px;border:1px solid #e2e8f0;border-radius:10px';
    el.appendChild(f);
    frames.push(f);
  });
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='fth-chem-height')return;
    frames.forEach(function(f){if(f.contentWindow===e.source)f.style.height=(e.data.h+4)+'px';});
  });
})();
