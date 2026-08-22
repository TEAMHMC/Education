(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0.16});
    document.querySelectorAll('.hmc-reveal').forEach(function(el){io.observe(el);});
  } else { document.querySelectorAll('.hmc-reveal').forEach(function(el){el.classList.add('in');}); }
  document.querySelectorAll('.hmc-parallax-hero').forEach(function(hero){
    var img = getComputedStyle(hero).backgroundImage;
    if(!img || img === 'none') return;
    var layer = document.createElement('div');
    layer.className = 'hmc-bg-layer'; layer.style.backgroundImage = img;
    hero.style.backgroundImage = 'none'; hero.insertBefore(layer, hero.firstChild); hero.__hmcLayer = layer;
  });
  var progress = document.querySelector('.hmc-progress');
  var pins    = [].slice.call(document.querySelectorAll('.hmc-pin-wrap'));
  var heroes  = [].slice.call(document.querySelectorAll('.hmc-parallax-hero'));
  var layers  = [].slice.call(document.querySelectorAll('[data-layer]'));
  var kinetic = [].slice.call(document.querySelectorAll('[data-kinetic]'));
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  var ticking=false;
  function frame(){
    var y = window.scrollY||window.pageYOffset, vh = window.innerHeight;
    if(progress){var max=document.documentElement.scrollHeight-vh;progress.style.width=(max>0?clamp(y/max,0,1)*100:0)+'%';}
    if(!reduce){
      heroes.forEach(function(h){if(!h.__hmcLayer)return;var r=h.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;var sp=parseFloat(h.getAttribute('data-parallax'))||0.18;h.__hmcLayer.style.transform='translate3d(0,'+((r.top)*-sp).toFixed(1)+'px,0)';});
      layers.forEach(function(el){var r=el.getBoundingClientRect();var fc=(r.top+r.height/2)-vh/2;el.style.transform='translate3d(0,'+(fc*parseFloat(el.getAttribute('data-layer'))).toFixed(1)+'px,0)';});
      kinetic.forEach(function(el){el.style.transform='translate3d('+(-(y*parseFloat(el.getAttribute('data-kinetic')))).toFixed(1)+'px,0,0)';});
      pins.forEach(function(w){var top=w.offsetTop,span=w.offsetHeight-vh;var p=clamp((y-top)/(span||1),0,1);var f=w.querySelector('[data-pin-fade]');if(f){f.style.transform='translate3d(0,'+(-p*120).toFixed(1)+'px,0) scale('+(1-p*0.10).toFixed(3)+')';f.style.opacity=(1-clamp((p-0.55)/0.45,0,1)).toFixed(3);}var bg=w.querySelector('.hmc-pin-bg');if(bg){bg.style.transform='translate3d(0,'+(p*80).toFixed(1)+'px,0)';}});
    }
    ticking=false;
  }
  function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(frame);}}
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  onScroll();
})();
