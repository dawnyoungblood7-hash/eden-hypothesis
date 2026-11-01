(function(){
  var b=document.body, btn=document.getElementById('rmmode'), nav=document.querySelector('nav.bar');
  var modes=['off','shade','strike'], labels={off:'Removed: hidden',shade:'Removed: shaded',strike:'Removed: struck'};
  function anchor(){
    var top=nav.getBoundingClientRect().bottom, vs=document.querySelectorAll('.vp:not(.rmv)');
    for(var i=0;i<vs.length;i++){var r=vs[i].getBoundingClientRect(); if(r.bottom>top+4)return r.top<window.innerHeight?vs[i]:null;}
    return null;
  }
  function setMode(m){
    var a=anchor();
    b.classList.remove('rm-shade','rm-strike');
    if(m!=='off')b.classList.add('rm-'+m);
    btn.setAttribute('data-mode',m); btn.textContent=labels[m]; btn.setAttribute('aria-pressed',m!=='off');
    try{localStorage.setItem('jg-rm',m);}catch(_){}
    if(a)window.scrollTo({top:window.scrollY+a.getBoundingClientRect().top-nav.getBoundingClientRect().bottom-12,behavior:'instant'});
  }
  btn.addEventListener('click',function(){setMode(modes[(modes.indexOf(btn.getAttribute('data-mode'))+1)%modes.length]);});
  try{var m=localStorage.getItem('jg-rm'); if(m==='shade'||m==='strike')setMode(m);}catch(_){}

  /* Links from the preface, Seams, and key to the text */
  document.addEventListener('click',function(e){
    var a=e.target.closest('a.xref'); if(!a||!window.jgJump)return;
    e.preventDefault();
    var id=a.getAttribute('href').slice(1), ref=a.getAttribute('data-xref');
    if(ref&&btn.getAttribute('data-mode')!=='off'){
      var r=document.querySelector('.rmv[data-ref="'+(ref.indexOf(':')<0?ref+':1':ref)+'"]');
      if(r){if(!r.id)r.id='r'+r.getAttribute('data-ref').replace(':','-'); id=r.id;}
    }
    window.jgJump(id,a);
  });
})();
