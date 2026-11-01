(function(){
  var data=JSON.parse(document.getElementById('jg-data').textContent);
  var b=document.body, nav=document.querySelector('nav.bar');
  var pop=document.createElement('div'); pop.id='pop'; pop.hidden=true; pop.setAttribute('role','dialog'); pop.tabIndex=-1;
  var back=document.createElement('button'); back.id='back'; back.type='button'; back.hidden=true;
  b.appendChild(pop); b.appendChild(back);
  var opener=null, returnTo=null;

  function rng(c,a,z){return c+':'+a+(a===z?'':'–'+z);}
  function navH(){return nav.getBoundingClientRect().bottom;}
  function where(el){
    var vp=el.closest('.vp'); if(vp){var m=vp.id.match(/^v(\d+)-(\d+)$/); return m[1]+':'+m[2];}
    var g=el.getAttribute('data-gap'); if(g){var x=data.gaps[g]; return x.whole?'Genesis '+x.c:rng(x.c,x.a,x.b);}
    var tr=el.closest('tr'); if(tr)return 'the apparatus';
    if(el.closest('#seams'))return 'Seams';
    if(el.closest('#preface'))return 'the preface';
    if(el.closest('nav'))return 'the text';
    return 'the text';
  }

  /* ---- popover ---- */
  function place(el){
    if(window.innerWidth<=560){pop.classList.add('sheet');pop.style.left='';pop.style.top='';return;}
    pop.classList.remove('sheet');
    var r=el.getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight;
    var left=Math.max(16,Math.min(r.left-24,document.documentElement.clientWidth-w-16));
    var below=r.bottom+8, top=(below+h>window.innerHeight-8 && r.top-h-8>navH())? r.top-h-8 : below;
    pop.style.left=(left+window.scrollX)+'px'; pop.style.top=(top+window.scrollY)+'px';
  }
  function open(el,html){
    if(opener)opener.setAttribute('aria-expanded','false');
    pop.innerHTML='<button type="button" class="x" aria-label="Close">×</button>'+html;
    pop.hidden=false; opener=el; el.setAttribute('aria-expanded','true');
    pop.setAttribute('aria-label',el.getAttribute('aria-label')||'Note');
    place(el); pop.focus({preventScroll:true});
  }
  function close(refocus){
    if(pop.hidden)return;
    pop.hidden=true;
    if(opener){opener.setAttribute('aria-expanded','false'); if(refocus)opener.focus({preventScroll:true});}
    opener=null;
  }
  function sigCard(el){
    var c=el.getAttribute('data-sig'), to=el.getAttribute('data-to'), gloss=el.getAttribute('data-gloss');
    var name=(el.getAttribute('aria-label')||'').split(':')[0];
    var h='<div class="pop-h"><span class="sig '+c+'">'+el.textContent+'</span><span>'+name+'</span></div>';
    h+='<p>'+(data.legend[c]||'')+'</p>';
    if(gloss)h+='<p class="here">'+gloss+'</p>';
    h+='<div class="links"><a href="#'+to+'" data-jump>Why: '+el.getAttribute('data-why')+' →</a>';
    if(to!=='sigla')h+='<a href="#sig-'+c+'" data-jump>Sigla key →</a>';
    return h+'</div>';
  }
  function gapCard(el){
    var id=el.getAttribute('data-gap'), g=data.gaps[id], n=g.b-g.a+1;
    var h='<div class="pop-h"><span>'+(g.whole?'Genesis '+g.c+' omitted':'Omitted: '+rng(g.c,g.a,g.b))+'</span></div>';
    h+='<p>'+n+(n===1?' verse':' verses')+' of the base text removed here.</p><ul>';
    g.segs.forEach(function(s){
      var cat=data.cats[s[0]];
      h+='<li><span class="sw" style="background:var(--om-'+cat.g+')"></span><strong>'+rng(g.c,s[1],s[2])+'</strong> '+cat.name+'<div class="links">';
      h+=cat.why?'<a href="#'+cat.why+'" data-jump>Why: '+cat.whyLabel+' →</a>':'<span class="note">No rationale in the preface yet.</span>';
      h+='<a href="#'+cat.row+'" data-jump>Apparatus →</a></div></li>';
    });
    h+='</ul><button type="button" class="show" data-show="'+id+'" aria-expanded="false">Show the omitted '+(n===1?'verse':'verses')+'</button><div class="ovs" hidden></div>';
    return h;
  }
  function showVerses(btn){
    var box=btn.nextElementSibling, g=data.gaps[btn.getAttribute('data-show')];
    if(!box.hidden){box.hidden=true;btn.setAttribute('aria-expanded','false');btn.textContent='Show the omitted verses';return;}
    if(!box.firstChild){
      var h='<p class="note">English: World English Bible, current edition, in Hebrew verse numbering; its wording can differ slightly from the base text above. Hebrew: Westminster Leningrad Codex.</p>';
      var rv=document.querySelectorAll('.rmv[data-gap="'+btn.getAttribute('data-show')+'"]');
      for(var i=0;i<rv.length;i++){
        var en=rv[i].querySelector('.en').cloneNode(true), tag=en.querySelector('.rmtag'); if(tag)tag.remove();
        var sv=en.querySelector('sup.v'); if(sv)sv.remove();
        h+='<div class="ov"><span class="en"><span class="r">'+rv[i].getAttribute('data-ref')+'</span>'+en.innerHTML+'</span><span class="heb" lang="he" dir="rtl">'+rv[i].querySelector('.he').innerHTML.replace(/<sup class="hv">\d+<\/sup>/,'')+'</span></div>';
      }
      box.innerHTML=h;
    }
    box.hidden=false; btn.setAttribute('aria-expanded','true'); btn.textContent='Hide the omitted verses';
  }

  /* ---- jumping and coming back ---- */
  function go(el){
    window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-navH()-16,behavior:'smooth'});
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  function jump(id,from){
    var t=document.getElementById(id); if(!t)return;
    if(t.classList.contains('gap')&&b.classList.contains('nogap'))setGaps(true);
    if(from){returnTo=from; back.textContent='↩ Back to '+where(from); back.hidden=false;}
    go(t);
    if(t.classList.contains('gap'))t.focus({preventScroll:true});
  }
  window.jgJump=jump;
  back.addEventListener('click',function(){
    if(returnTo){go(returnTo); if(returnTo.focus)returnTo.focus({preventScroll:true});}
    back.hidden=true; returnTo=null;
  });

  document.addEventListener('click',function(e){
    var t=e.target;
    var trig=t.closest('button.sig[data-sig], button.gap');
    if(trig&&!pop.contains(trig)){
      e.preventDefault();
      if(opener===trig&&!pop.hidden){close(false);return;}
      open(trig, trig.classList.contains('gap')?gapCard(trig):sigCard(trig));
      return;
    }
    if(t.closest('#pop .x')){close(true);return;}
    var sh=t.closest('#pop [data-show]'); if(sh){showVerses(sh);place(opener);return;}
    var j=t.closest('#pop a[data-jump]');
    if(j){e.preventDefault(); var from=opener; close(false); jump(j.getAttribute('href').slice(1),from); return;}
    var gl=t.closest('a[data-gaplink]');
    if(gl){e.preventDefault(); jump(gl.getAttribute('href').slice(1),gl); return;}
    if(!pop.hidden&&!pop.contains(t))close(false);
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pop.hidden)close(true);});
  window.addEventListener('resize',function(){if(!pop.hidden&&opener)place(opener);});

  /* ---- Omissions toggle ---- */
  var gb=document.getElementById('gaps');
  function setGaps(on){b.classList.toggle('nogap',!on);gb.setAttribute('aria-pressed',on);try{localStorage.setItem('jg-gaps',on?'1':'0');}catch(_){}}
  gb.addEventListener('click',function(){setGaps(b.classList.contains('nogap'));});
  try{if(localStorage.getItem('jg-gaps')==='0')setGaps(false);}catch(_){}
})();
