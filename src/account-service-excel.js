import * as XLSX from 'xlsx';
export const ACCOUNT_HEADERS=['Account code','Account name','Register','Bank','Account number','Date opened','Date closed','Reason for closing'];
export const LINE_HEADERS=['Account code','Type (Project or Expenses)','Project','Company (Expenses only, optional)','Start date (YYYY-MM-DD)','End date (blank = ongoing)','Note'];
export function saveWorkbook(sheets,name){const wb=XLSX.utils.book_new();for(const [title,rows]of sheets){const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=(rows[0]||[]).map(()=>({wch:24}));XLSX.utils.book_append_sheet(wb,ws,title)}XLSX.writeFile(wb,name+'.xlsx')}
export function exportWorkbook(data,title){const keys=[...new Set(data.flatMap(Object.keys))].filter(k=>data.every(r=>typeof r[k]!=='object'));saveWorkbook([[title.slice(0,31),[keys,...data.map(r=>keys.map(k=>r[k]??''))]]],title)}
export function accountTemplate(){saveWorkbook([['Accounts',[ACCOUNT_HEADERS]],['Timeline',[LINE_HEADERS]],['Read me',[['One row per account. Match accounts by code.'],['One row per project or expense timeline. Leave the end date blank for ongoing lines.'],['Overlapping and duplicate timeline rows are skipped.']]]],'Account_in_Service_template')}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
function date(value){if(!value)return '';if(typeof value==='number'){const p=XLSX.SSF.parse_date_code(value);return p?[p.y,String(p.m).padStart(2,'0'),String(p.d).padStart(2,'0')].join('-'):''}const d=value instanceof Date?value:new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
export async function importPlan(file,kind,seed){
 if(file.size>20*1024*1024)throw new Error('Choose a workbook smaller than 20 MB.');
 const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true}),names=[...wb.SheetNames].sort((a,b)=>Number(new RegExp(kind==='accounts'?'account':'timeline|line','i').test(b))-Number(new RegExp(kind==='accounts'?'account':'timeline|line','i').test(a)));
 let sheet,header,index;for(const name of names){const data=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});const hi=data.findIndex(r=>r.some(c=>/^(account )?code$/i.test(String(c).trim())));if(hi>=0){sheet=data.slice(hi+1);header=data[hi].map(c=>String(c).toLowerCase());index=header.findIndex(c=>/^(account )?code$/.test(c));break}}
 if(!sheet)throw new Error('No Account code column found.');
 const next=structuredClone(seed),byCode=Object.fromEntries(Object.entries(seed.accounts).map(([id,a])=>[norm(a.code),{...a,id}])),skipped=[],seen=new Set();let count=0;
 const find=re=>header.findIndex(c=>re.test(c)),value=(r,i)=>String(r[i]??'').trim();
 for(const [i,r]of sheet.entries()){if(!r.some(v=>v!==''))continue;const code=value(r,index),a=byCode[norm(code)];
  if(kind==='accounts'){if(!code||seen.has(norm(code))||/total/i.test(code)){skipped.push('Row '+(i+2)+': missing or repeated code');continue}seen.add(norm(code));const id=a?.id||'ac_'+norm(code),opened=date(r[find(/opened/)]),closed=date(r[find(/date closed|closed on/)]),entry={...a,code,name:value(r,find(/account name|^name$/))||a?.name||'',bank:value(r,find(/^bank/))||a?.bank||'',accNo:value(r,find(/account number|account no/))||a?.accNo||'',register:value(r,find(/^register/))||a?.register||['SKA_C','SKA_P','MAC','MCA','PC'].find(k=>code.startsWith(k))||'Other',openedAt:opened||a?.openedAt||'',closedAt:closed||a?.closedAt||'',closeReason:value(r,find(/reason/))||a?.closeReason||'',status:a?.status&&a.status!=='Active'?a.status:closed?'Closed':'Active'};delete entry.id;next.accounts[id]=entry;count++;
  }else{const type=value(r,index+1),kind=/^p/i.test(type)?'Project':/^e/i.test(type)?'Expenses':'',project=value(r,index+2),company=value(r,index+3),start=date(r[index+4]),end=date(r[index+5]),note=value(r,index+6);let reason=!a?'account not found':!kind?'invalid type':!start?'start date missing':end&&end<start?'end precedes start':kind==='Project'&&!project?'project missing':!project&&!company?'payer missing':'';
   if(!reason&&Object.values(next.lines||{}).some(l=>l.acctId===a.id&&l.kind===kind&&l.start<=(end||'9999-12-31')&&(l.end||'9999-12-31')>=start))reason='duplicate or overlapping timeline';
   if(reason){skipped.push('Row '+(i+2)+': '+reason);continue}const id='ln_'+a.id+'_'+kind+'_'+start+'_'+norm(project+company);next.lines[id]={acctId:a.id,kind,project,company:kind==='Expenses'?company:'',start,end,note};count++;
  }
 }
 return {next,count,skipped,file:file.name};
}
