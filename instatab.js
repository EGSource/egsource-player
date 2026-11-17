(function(){
var d=document.querySelector('[data-egtab]');
if(!d)return;
(function injectCSS(){
  var id='egtab-css';
  if(document.getElementById(id))return;
  var s=document.createElement('style');
  s.id=id;
  s.textContent='.eg-section-header{font-weight:700!important;font-size:.82rem!important;letter-spacing:.1em;text-transform:uppercase;color:#e8e4dc!important;margin-top:14px;margin-bottom:4px;padding-top:4px;white-space:normal;display:block!important}.eg-tab-line{white-space:pre!important;display:block!important}.eg-blank{display:block;height:.3em}.eg-nav{display:flex!important;flex-wrap:wrap;gap:6px;padding:10px 0 8px;border-bottom:1px solid #333;margin-bottom:10px}.eg-nav-btn{font-size:.72rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid #333;background:transparent;color:#777;cursor:pointer;white-space:nowrap;transition:all .15s}.eg-nav-btn:hover{border-color:#22ffde;color:#111;background:#22ffde}';
  (document.head||document.documentElement||d.parentNode).appendChild(s);
})();
var C=JSON.parse(decodeURIComponent(escape(atob(d.getAttribute('data-egtab')))));
var CS=C.CS||{};
var SH=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var FL=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
var TC={'h':1,'p':1,'/':1,'\\':1,'~':1,'r':1,'x':1,'X':1,'^':1};
var AK=['A','Bb','B','C','Db','D','Eb','E','F','F#','G','Ab'];
function nti(n){var i=SH.indexOf(n);return i<0?FL.indexOf(n):i;}
function isTS(s){return/^[-0-9hpb\/\\~rxX^]*$/.test(s.trim());}
function splitBars(content){
  var segs=content.split('|'),aS=segs.length;
  for(var i=segs.length-1;i>=0;i--){if(segs[i]==='')continue;if(!isTS(segs[i]))aS=i;else break;}
  var ts=segs.slice(0,aS);
  if(aS<segs.length&&ts.length&&ts[ts.length-1]!=='')ts.push('');
  var ap=segs.slice(aS),an=ap.length?' '+ap.filter(function(s){return s;}).join('|').trim():'';
  return{tabSegs:ts,annotation:an};
}
function tok(c){
  if(!c)return[];
  c=c.replace(/[\u2013\u2014\u2015\u2212]/g,'-');
  var t=[],i=0;
  while(i<c.length){var ch=c[i];
    if(ch>='0'&&ch<='9'){var j=i+1;while(j<c.length&&c[j]>='0'&&c[j]<='9')j++;t.push({tp:'f',v:parseInt(c.slice(i,j)),r:c.slice(i,j),ow:j-i,pos:i});i=j;}
    else if(TC[ch]){t.push({tp:'t',r:ch,ow:1,pos:i});i++;}
    else{var j=i+1;while(j<c.length&&!(c[j]>='0'&&c[j]<='9')&&!TC[c[j]])j++;t.push({tp:'d',r:c.slice(i,j),ow:j-i,pos:i});i=j;}
  }return t;
}
function clamp(f){return Math.max(0,Math.min(21,f));}
function transposeBar(segs,sNames,st,tkP,uC,sh){
  if(segs.every(function(s){return !s;}))return segs.map(function(s){return s||'';});
  var parsed=segs.map(function(seg,si){var tks=tok(seg||'');var pos=0;tks.forEach(function(tk){tk.pos=pos;pos+=tk.r.length;});return{seg:seg||'',tks:tks,sn:sNames[si],si:si};});
  var colMap={},nNV={},occ={},done={},techMove={},extra=[];
  parsed.forEach(function(p,si){p.tks.forEach(function(tk,tki){if(tk.tp!=='f')return;if(!colMap[tk.pos])colMap[tk.pos]=[];colMap[tk.pos].push({si:si,tki:tki,v:tk.v,sn:p.sn,ow:tk.ow,pos:tk.pos});});});
  var SO2=['e','b','G','D','A','E'];
  var OA2={E:4,A:9,D:14,G:19,b:23,e:28};
  var SP2={E:4,A:9,D:2,G:7,b:11,e:4};
  function keepOpen(sn){return tkP!=null&&uC!=null&&((SP2[sn]+uC)%12+12)%12===((tkP%12)+12)%12;}
  function md(n){return((n%12)+12)%12;}
  function freeAt(tsi,pos){return !occ[tsi+','+pos]&&!(colMap[pos]&&colMap[pos].some(function(e2){return e2.si===tsi;}));}
  // 1) Linked notes (hammer-ons, pull-offs, bends, slides, vibrato) move together as one unit
  if(!sh)parsed.forEach(function(p,si){
    var t=p.tks,i=0;
    while(i<t.length){
      if(t[i].tp!=='f'){i++;continue;}
      var fs=[i],ts=[],j=i+1;
      while(j<t.length&&t[j].tp==='t'&&t[j].r!=='x'&&t[j].r!=='X'){ts.push(j);j++;if(j<t.length&&t[j].tp==='f'){fs.push(j);j++;}}
      if(ts.length){
        var nf=fs.map(function(k){return t[k].v+st;}),ok=nf.every(function(f){return f>=0&&f<=21;});
        if(ok){fs.forEach(function(k,n){nNV[si+','+k]={fret:nf[n],targetSi:null};done[si+','+k]=1;});}
        else{
          var dir=nf.some(function(f){return f<0;})?1:-1,ai=SO2.indexOf(p.sn)+dir,moved=false;
          if(ai>=0&&ai<SO2.length){
            var dn=SO2[ai],tsi=sNames.indexOf(dn);
            if(tsi>=0){
              var mf=fs.map(function(k){return OA2[p.sn]+t[k].v+st-OA2[dn];});
              if(mf.every(function(f){return f>=0&&f<=21;})&&fs.every(function(k){return freeAt(tsi,t[k].pos);})){
                fs.forEach(function(k,n){nNV[si+','+k]={fret:mf[n],targetSi:tsi,rerouted:true};occ[tsi+','+t[k].pos]=1;done[si+','+k]=1;});
                ts.forEach(function(k){techMove[si+','+k]=tsi;});moved=true;
              }
            }
          }
          if(!moved){fs.forEach(function(k){nNV[si+','+k]=null;done[si+','+k]=1;});ts.forEach(function(k){techMove[si+','+k]=-1;});}
        }
      }
      i=j;
    }
  });
  // 2) Re-voice an open-position strum (3+ notes struck together) as the matching open chord in the new key
  function chordRoot(pcs,bassPc){
    var best=null,bs=-99;
    pcs.forEach(function(r){
      var iv=pcs.map(function(q){return md(q-r);}),s=0;
      if(iv.indexOf(3)>=0||iv.indexOf(4)>=0)s+=3;
      if(iv.indexOf(7)>=0)s+=2;
      if(r===bassPc)s+=2;
      iv.forEach(function(x){if(x===1||x===6||x===8)s-=4;});
      if(s>bs){bs=s;best=r;}
    });
    return best;
  }
  function revoice(ents){
    var bass=null;ents.forEach(function(e){var a=OA2[e.sn]+e.v;if(!bass||a<bass.a)bass={a:a,e:e};});
    var pcs=[];ents.forEach(function(e){var q=md(OA2[e.sn]+e.v);if(pcs.indexOf(q)<0)pcs.push(q);});
    var bp=md(bass.a),root=chordRoot(pcs,bp),tR=md(root+st),tP=pcs.map(function(q){return md(q+st);});
    var bIdx=SO2.indexOf(bass.e.sn),nb=bIdx,bf=null;
    if(bp===root){
      var order=[bIdx,bIdx+1,bIdx+2,bIdx-1,bIdx-2];
      for(var o=0;o<order.length&&bf===null;o++){
        var ix=order[o];if(ix<0||ix>5||sNames.indexOf(SO2[ix])<0)continue;
        for(var f=0;f<=4;f++)if(md(OA2[SO2[ix]]+f)===tR){nb=ix;bf=f;break;}
      }
      if(bf===null)return null;
    }
    var tgt={},strs=[nb];
    ents.forEach(function(e){
      var ix=SO2.indexOf(e.sn),t=(e===bass.e)?nb:ix;
      if(t>nb||(t===nb&&e!==bass.e)){tgt[e.si+','+e.tki]=-1;return;}
      tgt[e.si+','+e.tki]=t;if(strs.indexOf(t)<0)strs.push(t);
    });
    var filler=(bf!==null&&bIdx<nb&&strs.indexOf(bIdx)<0)?bIdx:-1;
    if(filler>=0)strs.push(filler);
    var role={};ents.forEach(function(e){var t=tgt[e.si+','+e.tki];if(t>=0)role[t]=md(OA2[e.sn]+e.v+st);});
    var opts=strs.map(function(s){
      if(s===nb&&bf!==null)return[bf];
      var o=[];for(var f=0;f<=4;f++)if(tP.indexOf(md(OA2[SO2[s]]+f))>=0)o.push(f);
      if(s===filler)o.push(null);
      return o;
    });
    if(opts.some(function(o){return !o.length;}))return null;
    var third=[md(tR+3),md(tR+4)].filter(function(q){return tP.indexOf(q)>=0;})[0],fifth=md(tR+7);
    var best=null,bsc=-1e9,cur=[];
    (function walk(k){
      if(k<strs.length){for(var q=0;q<opts[k].length;q++){cur[k]=opts[k][q];walk(k+1);}return;}
      var fr=[],cov={},sc=0,bassA=OA2[SO2[nb]]+cur[0],okLow=true;
      for(var n=0;n<strs.length;n++){
        var f=cur[n];if(f===null)continue;
        var a=OA2[SO2[strs[n]]]+f;if(n>0&&a<=bassA)okLow=false;
        if(f>0)fr.push(f);else sc+=2;
        cov[md(a)]=1;sc-=f*0.5;if(role[strs[n]]===md(a))sc+=2;if(strs[n]===filler)sc+=1;
      }
      if(!okLow||fr.length>4)return;
      if(fr.length&&Math.max.apply(null,fr)-Math.min.apply(null,fr)>3)return;
      tP.forEach(function(q){if(cov[q])sc+=(q===tR?10:q===third?8:q===fifth?6:5);});
      if(sc>bsc){bsc=sc;best=cur.slice();}
    })(0);
    if(!best)return null;
    var fret={};strs.forEach(function(s,n){fret[s]=best[n];});
    return{tgt:tgt,fret:fret,filler:filler};
  }
  Object.keys(colMap).map(Number).sort(function(a,b){return a-b;}).forEach(function(pos){
    if(sh)return;
    var ents=colMap[pos];
    if(ents.length>=3&&!ents.some(function(e){return done[e.si+','+e.tki];})&&ents.every(function(e){return e.v<=5;})){
      var fails=ents.some(function(e){var sf=e.v+st;return e.v===0||sf<0||sf>21;});
      var rv=fails?revoice(ents):null;
      if(rv){
        ents.forEach(function(e){
          var k=e.si+','+e.tki,t=rv.tgt[k];done[k]=1;
          if(t<0||rv.fret[t]===null){nNV[k]=null;return;}
          var tsi=sNames.indexOf(SO2[t]);
          if(tsi===e.si)nNV[k]={fret:rv.fret[t],targetSi:null};
          else{nNV[k]={fret:rv.fret[t],targetSi:tsi,rerouted:true};occ[tsi+','+pos]=1;}
        });
        if(rv.filler>=0&&rv.fret[rv.filler]!==null)extra.push({si:sNames.indexOf(SO2[rv.filler]),pos:pos,fret:rv.fret[rv.filler]});
        return;
      }
    }
  });
  // 3) Everything else: note-by-note
  Object.keys(colMap).map(Number).sort(function(a,b){return a-b;}).forEach(function(pos){
    var entries=colMap[pos].slice().sort(function(a,b){return SO2.indexOf(b.sn)-SO2.indexOf(a.sn);});
    entries.forEach(function(e){
      if(done[e.si+','+e.tki])return;
      var abs=OA2[e.sn]+e.v,tAbs=abs+st,sameFret=tAbs-OA2[e.sn],lone=colMap[pos].length===1;
      if(e.v===0){
        if(keepOpen(e.sn)){nNV[e.si+','+e.tki]={fret:0,targetSi:null};return;}
        if(!lone){nNV[e.si+','+e.tki]=null;return;}
      }
      if(sameFret>=0&&sameFret<=21){nNV[e.si+','+e.tki]={fret:sameFret,targetSi:null};return;}
      var fromIdx=SO2.indexOf(e.sn),dir=sameFret<0?1:-1,adjIdx=fromIdx+dir,placed=false;
      if(adjIdx>=0&&adjIdx<SO2.length){var newSn=SO2[adjIdx],newFret=tAbs-OA2[newSn];if(newFret>=0&&newFret<=21){var tsi=sNames.indexOf(newSn);if(tsi>=0&&freeAt(tsi,pos)){nNV[e.si+','+e.tki]={fret:newFret,targetSi:tsi,rerouted:true};occ[tsi+','+pos]=1;placed=true;}}}
      if(!placed&&lone){
        var oa=tAbs+(sameFret<0?12:-12),bestC=null;
        [fromIdx,fromIdx-1,fromIdx+1].forEach(function(ix){
          if(ix<0||ix>5)return;var sn2=SO2[ix],tsi2=sNames.indexOf(sn2),f2=oa-OA2[sn2];
          if(tsi2<0||f2<0||f2>21||(tsi2!==e.si&&!freeAt(tsi2,pos)))return;
          if(!bestC||f2<bestC.f)bestC={f:f2,tsi:tsi2};
        });
        if(bestC){
          if(bestC.tsi===e.si)nNV[e.si+','+e.tki]={fret:bestC.f,targetSi:null};
          else{nNV[e.si+','+e.tki]={fret:bestC.f,targetSi:bestC.tsi,rerouted:true};occ[bestC.tsi+','+pos]=1;}
          placed=true;
        }
      }
      if(!placed)nNV[e.si+','+e.tki]=null;
    });
  });
  var injected={};
  parsed.forEach(function(p,si){p.tks.forEach(function(tk,tki){if(tk.tp!=='f')return;var val=nNV[si+','+tki];if(val&&val.rerouted&&val.targetSi!=null){if(!injected[val.targetSi])injected[val.targetSi]=[];injected[val.targetSi].push({pos:tk.pos,fret:val.fret,origW:tk.ow});}});});
  extra.forEach(function(x){if(!injected[x.si])injected[x.si]=[];injected[x.si].push({pos:x.pos,fret:x.fret,origW:1});});
  var pl=sNames.map(function(){return[];});
  if(sh){
    parsed.forEach(function(p,si){var dn=SO2[SO2.indexOf(p.sn)-sh.k],tsi=sNames.indexOf(dn);p.tks.forEach(function(tk){
      if(tk.tp==='f'){var nf=String(OA2[p.sn]+tk.v+sh.d-OA2[dn]);pl[tsi].push({pos:tk.pos,txt:nf,ow:tk.ow,nw:nf.length,t:false});}
      else if(tk.tp==='t')pl[tsi].push({pos:tk.pos,txt:tk.r,ow:1,nw:1,t:true});
    });});
  }else{
    parsed.forEach(function(p,si){p.tks.forEach(function(tk,tki){
      if(tk.tp==='f'){var val=nNV[si+','+tki];if(val&&!val.rerouted){var nf=String(val.fret);pl[si].push({pos:tk.pos,txt:nf,ow:tk.ow,nw:nf.length,t:false});}else pl[si].push({pos:tk.pos,txt:null,ow:tk.ow,nw:1,t:false});}
      else if(tk.tp==='t'){var mv=techMove[si+','+tki];if(mv===-1)return;pl[mv!=null?mv:si].push({pos:tk.pos,txt:tk.r,ow:1,nw:1,t:true});}
    });});
    Object.keys(injected).forEach(function(k){injected[k].forEach(function(inj){var nf=String(inj.fret);pl[+k].push({pos:inj.pos,txt:nf,ow:inj.origW,nw:nf.length,t:false});});});
  }
  var ev={};
  function addEv(pos,ow,nw,si,isT){var e=ev[pos];if(!e)e=ev[pos]={ow:0,nw:0,fs:{},ts:{}};if(ow>e.ow)e.ow=ow;if(nw>e.nw)e.nw=nw;if(isT)e.ts[si]=1;else e.fs[si]=1;}
  pl.forEach(function(list,si){list.forEach(function(x){addEv(x.pos,x.ow,x.nw,si,x.t);});});
  var L=0;parsed.forEach(function(p){if(p.seg.length>L)L=p.seg.length;});
  var evPos=Object.keys(ev).map(Number).sort(function(a,b){return a-b;});
  var NP={},newLen=L;
  if(evPos.length){
    NP[evPos[0]]=evPos[0];
    for(var k=0;k<evPos.length;k++){
      var P=evPos[k],last=k+1>=evPos.length,nxt=last?L:evPos[k+1];
      var g=nxt-P,e=ev[P],sep=g-e.ow,ng;
      var linked=false;
      if(!last){var nt=ev[nxt].ts;Object.keys(e.fs).forEach(function(x){if(nt[x])linked=true;});}
      var same=false;if(!last){var nf2=ev[nxt].fs;Object.keys(e.fs).forEach(function(x){if(nf2[x])same=true;});}
      if(sep<0)ng=Math.max(1,g+(e.nw-e.ow));
      else if(e.nw<e.ow&&!linked)ng=e.nw+Math.max(sep,1);
      else ng=Math.max(1,e.nw+sep);
      if(same&&ng<e.nw+1)ng=e.nw+1;
      if(last)newLen=NP[P]+ng;else NP[nxt]=NP[P]+ng;
    }
  }
  function put(arr,at,txt){for(var c=0;c<txt.length;c++){while(arr.length<=at+c)arr.push('-');arr[at+c]=txt.charAt(c);}}
  var rebuilt=pl.map(function(list){
    var arr=[];for(var q=0;q<newLen;q++)arr.push('-');
    list.forEach(function(x){if(x.txt!==null)put(arr,NP[x.pos],x.txt);});
    return arr.join('');
  });
  var tw=0;rebuilt.forEach(function(s){if(s.length>tw)tw=s.length;});
  return rebuilt.map(function(s){while(s.length<tw)s+='-';return s;});
}
function findShift(barSets,sNames,st){
  if(((st%12)+12)%12===0)return null;
  var SO3=['e','b','G','D','A','E'],OA3={E:4,A:9,D:14,G:19,b:23,e:28};
  var notes=[],hasOpen=false;
  barSets.forEach(function(segs){segs.forEach(function(seg,si){tok(seg||'').forEach(function(tk){if(tk.tp==='f'){notes.push({sn:sNames[si],v:tk.v});if(tk.v===0)hasOpen=true;}});});});
  if(!hasOpen)return null;
  var ks=[1,-1];
  for(var a=0;a<ks.length;a++){
    var k=ks[a],d=null,ok=true;
    for(var n=0;n<notes.length&&ok;n++){
      var x=notes[n],di=SO3.indexOf(x.sn)-k;
      if(di<0||di>=SO3.length||sNames.indexOf(SO3[di])<0){ok=false;break;}
      var dn=SO3[di];
      if(x.v===0){var dd=OA3[dn]-OA3[x.sn];if((((dd-st)%12)+12)%12!==0){ok=false;break;}if(d===null)d=dd;else if(d!==dd){ok=false;break;}}
    }
    if(!ok||d===null)continue;
    for(var n2=0;n2<notes.length;n2++){var y=notes[n2],dn2=SO3[SO3.indexOf(y.sn)-k],nf=OA3[y.sn]+y.v+d-OA3[dn2];if(nf<0||nf>21){ok=false;break;}}
    if(ok)return{k:k,d:d};
  }
  return null;
}
function txBlock(lines,st,tkP,uC){
  var result=lines.slice();
  var i=0;
  while(i<lines.length){
    var line=lines[i].replace(/[\u2013\u2014\u2015\u2212]/g,'-');
    if(!/^\s*[EADGBbe]\s*\|/.test(line)){i++;continue;}
    var run=[];
    while(i<lines.length){
      var l=lines[i].replace(/[\u2013\u2014\u2015\u2212]/g,'-');
      if(!/^\s*[EADGBbe]\s*\|/.test(l))break;
      var m=l.match(/^(\s*[EADGBbe]\s*\|)(.*?)(\s*)$/s);
      var sn=l.match(/^\s*([EADGBbe])\s*\|/)[1];
      var sp=splitBars(m[2]);
      run.push({idx:i,prefix:m[1],segs:sp.tabSegs,annotation:sp.annotation,trail:m[3],sn:sn});
      i++;
    }
    if(!run.length)continue;
    var nb=run[0].segs.length;
    var out=run.map(function(){return[];});
    var bN=run.map(function(p){return p.sn;}),allBars=[];
    for(var b0=0;b0<nb;b0++)allBars.push(run.map(function(p){return p.segs[b0]||'';}));
    var runSh=findShift(allBars,bN,st);
    for(var b=0;b<nb;b++){
      var bS=allBars[b],sh=runSh||findShift([bS],bN,st);
      var res=transposeBar(bS,bN,st,tkP,uC,sh);
      run.forEach(function(_,li){out[li].push(res[li]);});
    }
    run.forEach(function(p,li){
      result[p.idx]=p.prefix+out[li].join('|')+p.annotation+p.trail;
    });
  }
  return result;
}
function isSectionHdr(line){
  if(!line.trim())return false;
  if(/^\s*[EADGBbe]\s*\|/.test(line))return false;
  if(!/^[A-Za-z]/.test(line.trim()))return false;
  return true;
}
function renderToHTML(lines,isOriginal){
  var sections=[],secIdx=0;
  var frag=document.createDocumentFragment();
  function setI(el,prop,val){el.style.setProperty(prop,val,'important');}
  lines.forEach(function(line){
    var el;
    if(isSectionHdr(line)){
      var id='eg-sec-'+(secIdx++);
      sections.push({name:line.trim(),id:id});
      el=document.createElement('div');
      el.id=id;
      setI(el,'font-weight','700');
      setI(el,'font-size','.82rem');
      setI(el,'letter-spacing','.1em');
      setI(el,'text-transform','uppercase');
      setI(el,'color','#e8e4dc');
      setI(el,'margin-top','14px');
      setI(el,'margin-bottom','4px');
      setI(el,'padding-top','4px');
      setI(el,'display','block');
      setI(el,'font-family','system-ui,-apple-system,sans-serif');
      setI(el,'white-space','normal');
      el.textContent=line.trim();
      frag.appendChild(el);
    } else if(!line.trim()){
      el=document.createElement('div');
      setI(el,'display','block');
      setI(el,'height','1em');
      el.textContent=' ';
      frag.appendChild(el);
    } else {
      el=document.createElement('span');
      setI(el,'white-space','pre');
      setI(el,'display','block');
      setI(el,'font-family','Courier New,Courier,monospace');
      el.textContent=line;
      frag.appendChild(el);
    }
  });
  return{frag:frag,sections:sections};
}
function egShort(n){var s=n.replace(/\s*\([^)]*\)?/g,'');var t=s.replace(/\s+-\s+["\u201C][^"\u201D]*["\u201D]\.{0,3}/g,'');if(t!==s)t=t.replace(/(\d)\s+([A-Z]{3,})/,'$1 & $2');s=t.replace(/\s+-\s+.*$/,'').replace(/\s{2,}/g,' ').trim();return s||n;}
function buildNav(sections,outEl){
  var existing=outEl.parentNode.querySelector('.eg-nav');
  if(existing)existing.parentNode.removeChild(existing);
  if(sections.length<2)return;var __sl=sections.map(function(s){return egShort(s.name)}),__cn={},__ci=0;__sl.forEach(function(l){__cn[l]=(__cn[l]||0)+1});var __fl=[],__fc={};__sl.forEach(function(l,k){var f=__cn[l]>1?(sections[k].name.replace(/\s*\([^)]*\)?/g,'').replace(/\s{2,}/g,' ').trim()||sections[k].name):l;__fl.push(f);__fc[f]=(__fc[f]||0)+1});var __oc={};__fl=__fl.map(function(f){if(__fc[f]>1){__oc[f]=(__oc[f]||0)+1;return __oc[f]>1?f+' #'+__oc[f]:f}return f});
  var nav=document.createElement('div');
  nav.className='eg-nav';
  var btnStyle='font-size:.72rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid #444;background:transparent;color:#888;cursor:pointer;white-space:nowrap;margin:0;font-family:system-ui,-apple-system,sans-serif';
  sections.forEach(function(sec){
    var btn=document.createElement('button');
    btn.setAttribute('style',btnStyle);
    btn.textContent=__fl[__ci];__ci++;
    btn.onmouseover=function(){this.style.background='#22ffde';this.style.color='#111';this.style.borderColor='#22ffde';};
    btn.onmouseout=function(){this.style.background='transparent';this.style.color='#888';this.style.borderColor='#444';};
    btn.onclick=function(){
      var el=outEl.querySelector('#'+sec.id);
      if(el){
        var top=el.offsetTop-outEl.offsetTop-12;
        outEl.scrollTo({top:Math.max(0,top),behavior:'smooth'});
      }
    };
    nav.appendChild(btn);
  });
  nav.setAttribute('style','display:flex;flex-wrap:wrap;gap:6px;padding:10px 0 8px;border-bottom:1px solid #333;margin-bottom:10px');
  outEl.parentNode.insertBefore(nav,outEl);
}
function render(){
  var part=document.querySelector('.eg-part').value;
  var tk=document.querySelector('.eg-key').value;
  var origCapo=part==='EG1'?C.C1:C.C2;
  var userCapo=parseInt(document.querySelector('.eg-user-capo').value,10);
  var raw=C[part]||'';
  var f=nti(C.k),t=nti(tk);
  if(f<0||t<0){f=0;t=0;}
  var keySt=t-f;if(keySt>6)keySt-=12;if(keySt<-6)keySt+=12;
  var totalSt=keySt+(origCapo-userCapo);
    var cb=document.querySelector('.eg-cap-badge');
  if(userCapo>0){cb.style.display='';document.querySelector('.eg-cap-num').textContent=userCapo;}
  else cb.style.display='none';
  var pl=part==='EG1'?'Electric Guitar 1':'Electric Guitar 2';
  var lb=document.querySelector('.eg-tab-label');lb.textContent=pl+' \u2014 '+(totalSt===0?'':'transposed to ');var ksp=document.createElement('span');ksp.style.setProperty('text-transform','none','important');ksp.textContent=totalSt===0?C.k:tk;lb.appendChild(ksp);if(totalSt===0)lb.appendChild(document.createTextNode(' (original)'));
  var csS=document.querySelector('.eg-chord-section');
  if(part==='EG2'){
    var tkIdx=nti(tk),si2=((tkIdx-userCapo)%12+12)%12;
    var csD=CS[SH[si2]]||{};
    var csM=csD.shapes||'',csA=csD.alts||'';
    if(csM||csA){csS.style.display='';document.querySelector('.eg-cs-main').textContent=csM||'(none)';document.querySelector('.eg-cs-alt').textContent=csA||'(none)';}
    else csS.style.display='none';
  }else csS.style.display='none';
  var outEl=document.querySelector('.eg-output'),stEl=document.querySelector('.eg-status');
  if(!raw.trim()){outEl.textContent='No tab loaded.';outEl.className='eg-output';stEl.textContent='';stEl.className='eg-status';return;}
  var capMsg=userCapo>0?' \u00b7 Capo '+userCapo:'';
  if(totalSt===0){
    var rh=renderToHTML(raw.split('\n'),true);outEl.innerHTML='';outEl.appendChild(rh.frag);outEl.className='eg-output eg-original';buildNav(rh.sections,outEl);
    stEl.textContent='Showing original tab in '+C.k+capMsg+'.';stEl.className='eg-status eg-match';
  }else{
    var res=txBlock(raw.split('\n'),totalSt,nti(tk),userCapo);
    var rh2=renderToHTML(res,false);outEl.innerHTML='';outEl.appendChild(rh2.frag);outEl.className='eg-output';buildNav(rh2.sections,outEl);
    var dir=totalSt>0?'up':'down';
    stEl.textContent='Transposed '+Math.abs(totalSt)+' semitone'+(Math.abs(totalSt)!==1?'s':'')+' '+dir+' from '+C.k+' \u2192 '+tk+capMsg+'.';
    stEl.className='eg-status eg-transposed';
  }
}
function egCopy(){
  var t=document.querySelector('.eg-output').innerText;if(!t)return;
  navigator.clipboard.writeText(t).then(function(){var b=document.querySelector('.eg-copy-btn');b.textContent='Copied!';b.classList.add('eg-copied');setTimeout(function(){b.textContent='Copy';b.classList.remove('eg-copied');},2000);});
}
document.querySelector('.eg-orig-key').textContent=C.k;
var ks=document.querySelector('.eg-key');
AK.forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=k;if(k===C.k)o.selected=true;ks.appendChild(o);});
var cs2=document.querySelector('.eg-user-capo');
for(var ci=0;ci<=7;ci++){var co=document.createElement('option');co.value=ci;co.textContent=ci===0?'No Capo':'Capo '+ci;cs2.appendChild(co);}
function uDC(){var part=document.querySelector('.eg-part').value;cs2.value=part==='EG1'?C.C1:C.C2;}
uDC();
document.querySelector('.eg-part').addEventListener('change',function(){uDC();render();});
document.querySelector('.eg-key').addEventListener('change',render);
cs2.addEventListener('change',render);
render();
})();
