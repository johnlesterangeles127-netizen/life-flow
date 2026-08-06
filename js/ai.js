// ============================================
// LifeFlow — AI Chat (Groq API via local proxy)
// The Groq key now lives server-side (server.js / GROQ_API_KEY env var).
// Never put API keys in client-side JS — they get scraped/revoked fast.
// ============================================

const AI = (() => {

  function buildTaskContext(tasks) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (!tasks.length) return 'No tasks.';
    return tasks.map(t => {
      const hasEndTime   = t.end_date && t.end_date.includes('T');
      const dEnd         = t.end_date ? new Date(t.end_date) : null;
      const dEndDay      = dEnd ? new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate()) : null;
      const diff         = dEndDay ? Math.round((dEndDay-today)/(1000*60*60*24)) : null;
      const endTimeStr   = hasEndTime ? ` at ${dEnd.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}` : '';
      const when = diff===null?'no due date':diff===0?`due TODAY${endTimeStr}`:diff>0?`due in ${diff} day(s)${endTimeStr}`:`${Math.abs(diff)} day(s) OVERDUE${endTimeStr}`;
      const startStr = t.start_date ? ` | starts ${new Date(t.start_date).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}` : '';
      return `- [${t.done?'DONE':'PENDING'}] "${t.title}" | ${t.priority.toUpperCase()} | ${when}${startStr}${t.notes?' | '+t.notes:''}`;
    }).join('\n');
  }

  function buildExpenseContext(expenses) {
    if (!expenses.length) return 'No expenses logged.';
    const now  = new Date();
    const tm   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const td   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const me   = expenses.filter(e=>e.date?.startsWith(tm));
    const catT = {};
    me.forEach(e=>{ catT[e.category]=(catT[e.category]||0)+Number(e.amount); });
    return `Today: ₱${expenses.filter(e=>e.date===td).reduce((s,e)=>s+Number(e.amount),0).toFixed(2)}
This month total: ₱${me.reduce((s,e)=>s+Number(e.amount),0).toFixed(2)}
Category breakdown (this month): ${Object.entries(catT).sort((a,b)=>b[1]-a[1]).map(([c,a])=>`${c}: ₱${a.toFixed(2)}`).join(', ')||'none'}
Recent: ${expenses.slice(0,8).map(e=>`₱${Number(e.amount).toFixed(2)} on ${e.description} (${e.category}, ${e.date})`).join('; ')}`;
  }

  function buildBudgetContext(budgets, expenses) {
    if (!budgets.length) return 'No allotted budgets set.';
    const now    = new Date();
    const month  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const period = now.getDate() <= 15 ? 'first_half' : 'second_half';
    const [y, m] = month.split('-').map(Number);
    const start  = period === 'first_half' ? new Date(y, m-1, 1) : new Date(y, m-1, 16);
    const end    = period === 'first_half' ? new Date(y, m-1, 15) : new Date(y, m, 0);
    const pad    = n => String(n).padStart(2,'0');
    const startStr = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
    const endStr   = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`;
    const cycleLabel = period === 'first_half' ? `${month} (1–15)` : `${month} (16–${end.getDate()})`;

    const cb = budgets.filter(b => b.month === month && b.period === period);
    if (!cb.length) return `No allotted budget set for the current cycle (${cycleLabel}).`;

    const spent = {};
    expenses.filter(e => e.date >= startStr && e.date <= endStr).forEach(e => { spent[e.category]=(spent[e.category]||0)+Number(e.amount); });

    const rows = cb.map(b=>{
      const s      = spent[b.category]||0;
      const savings = Number(b.amount)-s;
      const pct    = Math.round(s/Number(b.amount)*100);
      return `${b.category}: allotted ₱${Number(b.amount).toFixed(2)}, spent ₱${s.toFixed(2)} (${pct}%), ${savings>=0?'₱'+savings.toFixed(2)+' saved so far':'OVER by ₱'+Math.abs(savings).toFixed(2)}`;
    }).join('\n');

    const totalAllotted = cb.reduce((sum,b)=>sum+Number(b.amount),0);
    const totalSpent    = cb.reduce((sum,b)=>sum+(spent[b.category]||0),0);
    const totalSavings  = totalAllotted-totalSpent;

    return `Current cycle: ${cycleLabel}\n${rows}\nTotal: allotted ₱${totalAllotted.toFixed(2)}, spent ₱${totalSpent.toFixed(2)}, ${totalSavings>=0?'₱'+totalSavings.toFixed(2)+' saved so far this cycle':'OVER by ₱'+Math.abs(totalSavings).toFixed(2)}`;
  }

  async function chat(userMessage, tasks, expenses, budgets=[]) {
    const today = new Date().toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

    const system = `You are a personal lifestyle assistant helping manage tasks, expenses, and budget. Today: ${today}.

TASKS:
${buildTaskContext(tasks)}

EXPENSES:
${buildExpenseContext(expenses)}

BUDGET (current 2-week cycle):
${buildBudgetContext(budgets, expenses)}

Be concise, practical, and friendly. Max 150 words. Help with task prioritization, spending insights, budget warnings, savings progress, and lifestyle advice.`;

    const res = await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'openai/gpt-oss-120b', // llama-3.3-70b-versatile is deprecated by Groq, shuts down 08/16/26
        max_tokens:300,
        messages:[{role:'system',content:system},{role:'user',content:userMessage}]
      })
    });
    if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e?.error||e?.error?.message||`API error ${res.status}`); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response.';
  }

  return { chat };
})();