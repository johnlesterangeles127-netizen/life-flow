// ============================================================
// TaskFlow — AI Chat Module
// Sends task context + user message to Claude via Anthropic API
// ============================================================

function buildTaskContext() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (!tasks.length) return 'No tasks yet.';
  return tasks.map(t => {
    const hasEndTime = t.end_date && t.end_date.includes('T');
    const dEnd       = t.end_date ? new Date(t.end_date) : null;
    const dEndDay    = dEnd ? new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate()) : null;
    const diff       = dEndDay ? Math.round((dEndDay - now) / (1000 * 60 * 60 * 24)) : null;
    const endTimeStr = hasEndTime ? ` at ${dEnd.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}` : '';
    const when = diff === null     ? 'no due date'
      : diff === 0                 ? `due TODAY${endTimeStr}`
      : diff > 0                   ? `due in ${diff} day(s)${endTimeStr}`
      : `${Math.abs(diff)} day(s) OVERDUE${endTimeStr}`;
    const startStr = t.start_date ? ` | Starts: ${new Date(t.start_date).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}` : '';
    return `- [${t.done ? 'DONE' : 'PENDING'}] "${t.title}" | ${t.priority.toUpperCase()} priority | ${when}${startStr}${t.notes ? ' | Notes: ' + t.notes : ''}`;
  }).join('\n');
}

function appendMsg(text, type) {
  const msgs = document.getElementById('chat-msgs');
  const div  = document.createElement('div');
  div.className   = 'msg ' + type;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop  = msgs.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';

  const btn = document.getElementById('send-btn');
  btn.disabled = true;

  appendMsg(msg, 'user');
  const typing = appendMsg('Thinking...', 'ai typing');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `You are a personal task management assistant. The user's current tasks:\n\n${buildTaskContext()}\n\nToday: ${TODAY.toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}.\n\nBe concise and practical. Max 120 words. Help with prioritization, deadlines, and what to work on next.`,
        messages: [{ role: 'user', content: msg }]
      })
    });

    const data  = await res.json();
    const reply = data.content?.map(c => c.text || '').join('') || 'Sorry, no response received.';
    typing.textContent = reply;
    typing.classList.remove('typing');
  } catch (e) {
    typing.textContent = 'Connection error. Check your internet connection.';
    typing.classList.remove('typing');
  }

  btn.disabled = false;
  input.focus();
}

function quickPrompt(text) {
  document.getElementById('chat-input').value = text;
  sendChat();
}

// Enter key to send
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });
}); 