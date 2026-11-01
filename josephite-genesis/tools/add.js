(function(){
  var b=document.body, r=document.getElementById('refs'), s=document.getElementById('sigs'),
      p=document.getElementById('point'), langBtns=document.querySelectorAll('[data-lang]');
  function save(k,v){try{localStorage.setItem('jg-'+k,v);}catch(e){}}
  function load(k){try{return localStorage.getItem('jg-'+k);}catch(e){return null;}}

  /* Keep the reader's place when the layout changes. */
  function anchorVerse(){
    var nav=document.querySelector('nav.bar').getBoundingClientRect().bottom, vs=document.querySelectorAll('.vp');
    for(var i=0;i<vs.length;i++){if(vs[i].getBoundingClientRect().bottom>nav+4)return vs[i];}
    return null;
  }
  function keepPlace(fn){
    var a=anchorVerse(), nav=document.querySelector('nav.bar').getBoundingClientRect().bottom;
    var inText=a&&a.getBoundingClientRect().top<window.innerHeight;
    fn();
    if(inText){window.scrollTo({top:window.scrollY+a.getBoundingClientRect().top-nav-12,behavior:'instant'});}
  }

  /* Chapter and verse numbers; sigla */
  function setRefs(on){b.classList.toggle('refs',on);r.setAttribute('aria-pressed',on);save('refs',on?'1':'0');}
  function setSigs(on){b.classList.toggle('nosig',!on);s.setAttribute('aria-pressed',on);save('sigs',on?'1':'0');}
  r.addEventListener('click',function(){keepPlace(function(){setRefs(!b.classList.contains('refs'));});});
  s.addEventListener('click',function(){setSigs(b.classList.contains('nosig'));});

  /* English / Parallel / Hebrew */
  function setLang(l){
    b.classList.remove('lang-par','lang-he');
    if(l!=='en')b.classList.add('lang-'+l);
    for(var i=0;i<langBtns.length;i++)langBtns[i].setAttribute('aria-pressed',langBtns[i].getAttribute('data-lang')===l);
    save('lang',l);
  }
  for(var i=0;i<langBtns.length;i++){
    langBtns[i].addEventListener('click',function(){var l=this.getAttribute('data-lang');keepPlace(function(){setLang(l);});});
  }

  /* Pointing: full (vowels and accents), vowels only, consonants only */
  var ACCENTS=/[֑-ֽ֯]/g, VOWELS=/[ְ-ׇּֿׁׂׅׄ]/g;
  var nodes=null, modes=['full','vowels','cons'], labels={full:'Pointing: full',vowels:'Pointing: vowels',cons:'Pointing: none'};
  function collect(){
    nodes=[];
    var hs=document.querySelectorAll('.he');
    for(var i=0;i<hs.length;i++){
      var w=document.createTreeWalker(hs[i],NodeFilter.SHOW_TEXT,null), n;
      while((n=w.nextNode())){if(!(n.parentNode.classList&&n.parentNode.classList.contains('hv')))nodes.push([n,n.nodeValue]);}
    }
  }
  function setPoint(m){
    if(!nodes)collect();
    for(var i=0;i<nodes.length;i++){
      var t=nodes[i][1];
      if(m!=='full')t=t.replace(ACCENTS,'');
      if(m==='cons')t=t.replace(VOWELS,'');
      nodes[i][0].nodeValue=t;
    }
    p.textContent=labels[m];p.setAttribute('data-mode',m);save('point',m);
  }
  p.addEventListener('click',function(){
    var m=modes[(modes.indexOf(p.getAttribute('data-mode')||'full')+1)%modes.length];
    setPoint(m);
  });

  /* Restore the reader's last settings */
  if(load('refs')==='1')setRefs(true);
  if(load('sigs')==='0')setSigs(false);
  var l=load('lang');if(l==='par'||l==='he')setLang(l);
  var m=load('point');if(m==='vowels'||m==='cons')setPoint(m);
})();
