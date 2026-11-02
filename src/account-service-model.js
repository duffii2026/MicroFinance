// Business rules preserved from the MM2-05 original. UI is rendered by React.
export function accountModel(seed,today=new Date().toLocaleDateString('en-CA')) {
const D={settings:{},source:{},accounts:{},lines:{},risk:{},alerts:{},hist:{},...seed};
const todayStr=()=>today; const IS_CPA=false;
const rows=c=>Object.entries(D[c]||{}).map(([id,x])=>({...x,id}));
const aLabel=a=>a?[a.code,a.name].filter(Boolean).join(' · '):'';
const dayMs=s=>Date.parse(s+'T00:00:00Z');
const dayDiff=(a,b)=>Math.round((dayMs(a)-dayMs(b))/864e5);
const addDay=(s,n)=>new Date(dayMs(s)+n*864e5).toISOString().slice(0,10);
const fmtD=s=>s?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(s)):'';
function ageParts(from,to){
  if(!from)return null;to=to||todayStr();if(to<from)return {y:0,m:0,d:0,days:0,neg:true};
  let [fy,fm,fd]=from.split('-').map(Number),[ty,tm,td]=to.split('-').map(Number);
  let y=ty-fy,m=tm-fm,d=td-fd;
  if(d<0){m--;const pm=tm-1<1?12:tm-1,py=tm-1<1?ty-1:ty;d+=new Date(py,pm,0).getDate()}
  if(m<0){y--;m+=12}
  return {y,m,d,days:Math.round((dayMs(to)-dayMs(from))/864e5)};
}
const ageTxt=p=>!p?'':p.y?`${p.y} y ${p.m} m ${p.d} d`:p.m?`${p.m} m ${p.d} d`:`${p.d} d`;
const bandOf=p=>!p?'Date not set':p.days<92?'Under 3 months':p.days<366?'3 to 12 months':p.days<731?'1 to 2 years':'Over 2 years';
const BANDS=['Under 3 months','3 to 12 months','1 to 2 years','Over 2 years','Date not set'];
const inLine=(l,t)=>l.start&&l.start<=t&&(!l.end||l.end>=t);
function acctView(a){
  const t=todayStr(),L=rows('lines').filter(l=>l.acctId===a.id).sort((x,y)=>(x.start||'').localeCompare(y.start||''));
  const closed=(a.status||'Active')!=='Active',endD=closed&&a.closedAt?a.closedAt:null;
  const age=a.openedAt?ageParts(a.openedAt,endD||t):null;
  const cur=k=>{const c=L.filter(l=>l.kind===k&&inLine(l,t));return c[c.length-1]||null};
  return {...a,L,age,closed,curP:cur('Project'),curE:cur('Expenses')};
}
const views=()=>rows('accounts').map(acctView);
const lineName=l=>l?(l.kind==='Project'?l.project:[l.project,l.company].filter(Boolean).join(' / ')):'';
function attention(){
  const W=[],t=todayStr();
  views().forEach(a=>{
    const lab=aLabel(a),w=(sev,text)=>W.push({sev,text,id:a.id,lab,reg:a.register});
    const act=!a.closed;
    if(!a.openedAt)w('Check','Date opened is not set');
    if(a.closed&&!a.closedAt)w('Check','Not in service but no closing date');
    if(a.closed&&a.cdbStatus&&a.cdbStatus!==a.status)w('Note',`Central Database shows ${a.cdbStatus}`);
    if(act&&a.cdbStatus==='Closed')w('Urgent','Central Database shows Closed, but it is still Active here');
    if(act&&!a.curP)w('Check','No project assigned today');
    if(act&&!a.curE)w('Check','No expense payer today');
    ['Project','Expenses'].forEach(k=>{
      const ls=a.L.filter(l=>l.kind===k);
      ls.forEach(l=>{
        if(a.openedAt&&l.start&&l.start<a.openedAt)w('Check',`${k} "${lineName(l)}" starts before the account was opened`);
        if(a.closed&&a.closedAt&&(!l.end||l.end>a.closedAt))w('Urgent',`${k} "${lineName(l)}" is still open after the account closed`);
      });
      for(let i=1;i<ls.length;i++){
        const p=ls[i-1],n=ls[i];if(!p.end){w('Urgent',`${k} lines overlap: "${lineName(p)}" has no end date before "${lineName(n)}"`);continue}
        if(n.start<=p.end)w('Urgent',`${k} lines overlap: "${lineName(p)}" and "${lineName(n)}"`);
        else if(addDay(p.end,1)<n.start)w('Check',`${k} gap of ${Math.round((dayMs(n.start)-dayMs(p.end))/864e5)-1} day(s) between "${lineName(p)}" and "${lineName(n)}"`);
      }
    });
  });
  {const M=riskMap();views().forEach(a=>{if(a.closed)return;const s=riskStats(M[a.id]);const lab=aLabel(a);
    (M[a.id]||[]).filter(e=>['Blocked','Sign out','Complaint','Dormant'].includes(e.type)&&!e.end).forEach(e=>W.push({sev:'Check',text:e.type+' since '+fmtD(e.start)+' ('+evDays(e)+' days, ongoing)',id:a.id,lab,reg:a.register}));
    if(s.total&&s.level==='High')W.push({sev:'Check',text:'Risk level is High',id:a.id,lab,reg:a.register})})}
  const o={Urgent:0,Check:1,Note:2};return W.sort((x,y)=>o[x.sev]-o[y.sev]||x.lab.localeCompare(y.lab));
}
const REC_NAME=IS_CPA?'CPA Control System V3.3':'the Central Database';
const recNm=x=>String(x==null?'':x).toLowerCase().replace(/[^a-z0-9]/g,'');
const pgStat=p=>IS_CPA?(p.v33Status||''):(p.status||'Active');
const pgGrp=(id,p,S)=>(S[id]&&S[id].grp)||(IS_CPA?p.bank:p.register)||'—';
function recCalc(){
  const sn=D.source&&D.source.snap;if(!sn||!sn.accounts)return null;
  const S=sn.accounts,P=D.accounts,out=[];
  Object.entries(S).forEach(([id,s])=>{const p=P[id];
    if(!p){out.push({id:null,code:s.code,name:s.name,issue:'In the source, missing here',src:s.status,pg:'—'});return}
    const w=(issue,src,pg)=>out.push({id,code:p.code||s.code,name:p.name||s.name,issue,src,pg});
    const srcIn=s.status==='Active',pgIn=(p.status||'Active')==='Active';
    if(srcIn!==pgIn)w('In service differs',s.status,p.status||'Active');
    else if(s.status!==pgStat(p))w('Status differs',s.status,pgStat(p)||'—');
    if(recNm(s.accNo)!==recNm(p.accNo))w('Account number differs',s.accNo||'—',p.accNo||'—');
    if(recNm(s.bank)!==recNm(p.bank))w('Bank differs',s.bank||'—',p.bank||'—');
    if(IS_CPA&&recNm(s.holder)!==recNm(p.holder))w('Holder differs',s.holder||'—',p.holder||'—');
    if(recNm(s.project)!==recNm(p.cdbProject))w('Project differs',s.project||'—',p.cdbProject||'—');
  });
  Object.entries(P).forEach(([id,p])=>{if(!S[id])out.push({id,code:p.code,name:p.name,issue:'Here, not in the source',src:'—',pg:p.status||'Active'})});
  return {sn,S,P,out};
}
const RK=[['Blocked','Blocked','dur'],['Sign out','Signed out','dur'],['Complaint','Complaint','dur'],['Dormant','Dormant','dur'],['Unblock visit','Unblock visit (owner visited the bank)','visit'],['SOF request','Source of fund (SOF) explanation requested','one'],['Cheque rejected','Cheque rejected (no fund available)','one']];
const RK_COLS=[['Blocked','Blocked'],['Sign out','Sign out'],['Complaint','Complaint'],['Dormant','Dormant'],['Failed unblock','Unblock failed after visit'],['SOF request','SOF requests'],['Cheque rejected','Cheque rejected']];
const RK_DEF={'Blocked':[2,4],'Sign out':[2,4],'Complaint':[1,3],'Dormant':[1,2],'Failed unblock':[1,2],'SOF request':[1,3],'Cheque rejected':[1,2]};
const rkRules=()=>{const x=(D.settings.riskRules||{}).v;return x&&typeof x==='object'?{...RK_DEF,...x}:RK_DEF};
const evDays=e=>e.start?ageParts(e.start,e.end||todayStr()).days+1:0;
function riskMap(){const m={};rows('risk').forEach(e=>{(m[e.acctId]=m[e.acctId]||[]).push(e)});return m}
function riskStats(evs){
  evs=evs||[];const s={};RK_COLS.forEach(([k])=>s[k]={n:0,days:0,ongoing:0,dates:[]});
  evs.forEach(e=>{
    if(e.type==='Unblock visit'){if(e.result==='Not unblocked'){const c=s['Failed unblock'];c.n++;c.dates.push(e.start)}return}
    const c=s[e.type];if(!c)return;c.n++;c.dates.push(e.start);
    if(['Blocked','Sign out','Complaint','Dormant'].includes(e.type)){c.days+=evDays(e);if(!e.end)c.ongoing++}
  });
  s.visits=evs.filter(e=>e.type==='Unblock visit').length;
  const R=rkRules();let lvl=0;RK_COLS.forEach(([k])=>{const n=s[k].n,r=R[k];if(n>=r[1])lvl=Math.max(lvl,2);else if(n>=r[0])lvl=Math.max(lvl,1)});
  s.level=['Low','Medium','High'][lvl];s.total=evs.length;s.ongoing=RK_COLS.reduce((t,[k])=>t+s[k].ongoing,0);return s}
const AL_DEF={ageYears:[1,2,3,5],ageAhead:30,ageBack:7,lineAhead:30,evWarn:7,evCrit:30,newDays:30};
const alRules=()=>{const x=(D.settings.alertRules||{}).v;return x&&typeof x==='object'?{...AL_DEF,...x}:AL_DEF};
const AL_TYPES=['Account age','New account','Line ending','Risk event','Risk level','Data','Central Database','Source copy'];
const AL_ORD={Critical:0,Warning:1,Info:2};
const alKey=(t,id,ref)=>(t+'_'+id+'_'+ref).replace(/[^A-Za-z0-9_\-]/g,'');
function alertsCalc(){
  const R=alRules(),t=todayStr(),out=[],M=riskMap();
  const add=(sev,type,a,text,ref,due)=>out.push({key:alKey(type,a.id,ref),sev,type,text,id:a.id,lab:aLabel(a),reg:a.register||'',due:due||'',days:due?dayDiff(due,t):null});
  views().forEach(a=>{
    if(a.closed)return;
    if(a.openedAt){
      const [Y,Mo,Dd]=a.openedAt.split('-').map(Number);
      (R.ageYears||[]).forEach(y=>{const ann=new Date(Date.UTC(Y+y,Mo-1,Dd)).toISOString().slice(0,10),df=dayDiff(ann,t);
        if(df<=R.ageAhead&&df>=-R.ageBack)add('Info','Account age',a,df>=0?`Reaches ${y} year${y>1?'s':''} in service on ${fmtD(ann)}`:`Reached ${y} year${y>1?'s':''} in service on ${fmtD(ann)}`,'y'+y,ann)});
      const age=dayDiff(t,a.openedAt);
      if(age>=0&&age<=R.newDays)add('Info','New account',a,`Opened ${age} day${age===1?'':'s'} ago, still in its first ${R.newDays} days: watch it`,'new',a.openedAt);
    }
    [['Project',a.curP],['Expenses',a.curE]].forEach(([kind,cur])=>{
      if(cur&&cur.end){const df=dayDiff(cur.end,t);
        if(df>=0&&df<=R.lineAhead&&!a.L.some(l=>l.kind===kind&&l.start>cur.end))add(df<=7?'Critical':'Warning','Line ending',a,`${kind==='Project'?'Project':'Expense payer'} "${lineName(cur)}" ends ${fmtD(cur.end)} (${df} day${df===1?'':'s'}) and nothing follows`,kind+cur.end,cur.end)}
    });
    (M[a.id]||[]).filter(e=>['Blocked','Sign out','Complaint','Dormant'].includes(e.type)&&!e.end).forEach(e=>{const n=evDays(e);
      if(n>=R.evCrit)add('Critical','Risk event',a,`${e.type} since ${fmtD(e.start)}: ${n} days and still ongoing`,e.type+e.start,e.start);
      else if(n>=R.evWarn)add('Warning','Risk event',a,`${e.type} since ${fmtD(e.start)}: ${n} days and still ongoing`,e.type+e.start,e.start)});
    const s=riskStats(M[a.id]);if(s.total&&s.level==='High')add('Critical','Risk level',a,'Risk level is High: too many events of the same type','high','');
    if(!a.openedAt)add('Warning','Data',a,'Date opened is not set, so its age cannot be tracked','open','');
    if(!a.curP)add('Warning','Data',a,'No project assigned today','proj','');
    if(!a.curE)add('Warning','Data',a,'No expense payer today','exp','');
    if(a.cdbStatus==='Closed')add('Critical','Central Database',a,'Central Database shows Closed, but the account is still in service here','cdbclosed','');
  });
  const rc=recCalc();if(rc&&rc.out.length)out.push({key:alKey('Source','copy',String(rc.out.length)),sev:'Warning',type:'Source copy',text:`${rc.out.length} difference${rc.out.length===1?'':'s'} between this page and the Central Database`,id:null,tab:'rec',lab:'All accounts',reg:'',due:'',days:null});
  out.forEach(x=>{x.ack=D.alerts[x.key]||null});
  return out.sort((x,y)=>AL_ORD[x.sev]-AL_ORD[y.sev]||(x.days==null?9e3:x.days)-(y.days==null?9e3:y.days)||x.lab.localeCompare(y.lab));
}
const alOpen=()=>alertsCalc().filter(x=>!x.ack);

return {accounts:views(),attention:attention(),alerts:alertsCalc(),riskStats,riskMap:riskMap(),riskTypes:RK,riskColumns:RK_COLS,riskRules:rkRules(),alertRules:alRules(),reconciliation:recCalc(),bandOf,BANDS,ageParts,ageTxt,addDay,dayDiff,lineName,aLabel,fmtD,evDays};
}

