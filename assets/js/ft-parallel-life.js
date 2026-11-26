(()=>{
  const $=id=>document.getElementById(id);
  const number=id=>Number($(id).value);
  const money=value=>new Intl.NumberFormat(undefined,{style:'decimal',maximumFractionDigits:0}).format(value);
  let seed=null, engine=null, lastBranch=null;
  try{seed=JSON.parse(sessionStorage.getItem('ft.parallel.seed')||'null')}catch(e){}
  if(seed&&seed.record&&seed.record.bazi){const b=seed.record.bazi;$('seed').textContent=`BaZi carried privately: ${b.year.name_zh} ${b.month.name_zh} ${b.day.name_zh}${b.hour?' '+b.hour.name_zh:''}. It remains a Tradition lens.`}
  async function loadEngine(){if(!engine)engine=await FTEngine.load('../assets/wasm/ft.wasm');return engine}
  function inputs(){return {cmd:'parallel_preview',age:number('age'),cash:number('cash'),yearly_income:number('income'),yearly_cost:number('cost'),years:number('years'),income_change:number('income-change')/100,cost_change:number('cost-change')/100,seed:Math.floor(Date.now()/86400000)}}
  function valid(v){return ['age','cash','yearly_income','yearly_cost','years','income_change','cost_change','seed'].every(key=>Number.isFinite(v[key]))&&v.age>=0&&v.age<=120&&v.cash>=0&&v.yearly_income>=0&&v.yearly_cost>=0&&v.years>=1&&v.years<=30}
  function revealOutput(){const output=$('output');output.hidden=false;output.removeAttribute('hidden');output.style.display='block';return output}
  function showRange(range,name,decision,evidence){revealOutput();$('result').innerHTML=`<p><strong>${escapeHtml(name)}</strong> explores “${escapeHtml(decision)}”. ${evidence?'<span class="tag">User-provided context</span>':'<span class="tag">No current context added</span>'}</p><div class="range"><div><small>Lower simulated range</small><strong>${money(range.ending_cash_low)}</strong></div><div class="middle"><small>Middle simulated range</small><strong>${money(range.ending_cash_middle)}</strong></div><div><small>Higher simulated range</small><strong>${money(range.ending_cash_high)}</strong></div></div>`}
  function escapeHtml(text){const d=document.createElement('div');d.textContent=text;return d.innerHTML}
  $('run').onclick=async()=>{const name=$('branch').value.trim()||'My branch',decision=$('decision').value.trim()||'a changed decision',evidence=$('seed-text').value.trim(),request=inputs();if(!valid(request)){alert('Please use valid non-negative amounts, an age from 0 to 120, and 1 to 30 years.');return}const button=$('run');button.disabled=true;button.textContent='Running on this device…';try{const result=(await loadEngine()).call(request);lastBranch={name,decision,evidence,assumptions:request,result,seed,created_at:Date.now()};showRange(result,name,decision,evidence)}catch(error){revealOutput();$('result').textContent=`The scenario could not run: ${error.message}`;console.error(error)}finally{button.disabled=false;button.textContent='Run my scenario'}};
  $('save').onclick=()=>{if(!lastBranch){return}try{sessionStorage.setItem('ft.parallel.branch',JSON.stringify(lastBranch));$('save').textContent='Saved on this device'}catch(e){$('save').textContent='This browser could not save it'}};
})();
