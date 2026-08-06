// ============================================
// TaskFlow — Budget CRUD (Supabase)
// Semi-monthly budgets: each category can have an allotted
// amount for the 1st half (1-15) and 2nd half (16-end) of a month
// ============================================

const Budget = (() => {

  async function getAll() {
    const { data, error } = await sb
      .from('budgets')
      .select('*')
      .order('month', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function create(payload) {
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('budgets')
      .upsert({ ...payload, user_id: user.id }, { onConflict: 'user_id,category,month,period' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function update(id, payload) {
    const { data, error } = await sb
      .from('budgets')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function remove(id) {
    const { error } = await sb.from('budgets').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Period helpers ----
  // Splits every month into two cycles: 1st–15th, and 16th–end of month.

  function pad(n) { return String(n).padStart(2, '0'); }

  function monthStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

  function periodOf(d) { return d.getDate() <= 15 ? 'first_half' : 'second_half'; }

  // Returns { month, period, label, start, end } for a given date (defaults to today)
  function currentPeriod(d = new Date()) {
    const month  = monthStr(d);
    const period = periodOf(d);
    const [y, m] = month.split('-').map(Number);
    const start  = period === 'first_half' ? new Date(y, m - 1, 1) : new Date(y, m - 1, 16);
    const end    = period === 'first_half' ? new Date(y, m - 1, 15) : new Date(y, m, 0); // day 0 of next month = last day of this month
    const label  = period === 'first_half'
      ? `${start.toLocaleDateString('en-PH', { month: 'long' })} 1–15`
      : `${start.toLocaleDateString('en-PH', { month: 'long' })} 16–${end.getDate()}`;
    return { month, period, label, start, end };
  }

  // Given a month + period, returns the { start, end } Date range
  function rangeOf(month, period) {
    if (month === 'all' || period === 'all') return { start: null, end: null };
    const [y, m] = month.split('-').map(Number);
    const start = period === 'first_half' ? new Date(y, m - 1, 1) : new Date(y, m - 1, 16);
    const end   = period === 'first_half' ? new Date(y, m - 1, 15) : new Date(y, m, 0);
    return { start, end };
  }

  // Filters an expenses array down to a given month + period
  function expensesInPeriod(expenses, month, period) {
    if (month === 'all' || period === 'all') return expenses.slice();
    const { start, end } = rangeOf(month, period);
    const startStr = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
    const endStr   = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`;
    return expenses.filter(e => e.date >= startStr && e.date <= endStr);
  }

  // Given a month (YYYY-MM) and period, shift by s half-month periods (s can be negative)
  function shiftPeriod(month, period, s) {
    const [y, m] = month.split('-').map(Number);
    // base half-index since year 0
    const baseHalfIndex = ((y * 12) + (m - 1)) * 2 + (period === 'first_half' ? 0 : 1);
    const newHalfIndex = baseHalfIndex + s;
    const totalMonths = Math.floor(newHalfIndex / 2);
    const newYear = Math.floor(totalMonths / 12);
    const newMonth = (totalMonths % 12) + 1;
    const newPeriod = (newHalfIndex % 2 === 0) ? 'first_half' : 'second_half';
    return { month: `${newYear}-${String(newMonth).padStart(2,'0')}`, period: newPeriod };
  }

  // Friendly label for a given month+period (matches currentPeriod format)
  function labelFor(month, period) {
    if (month === 'all' || period === 'all') return 'All time';
    const { start, end } = rangeOf(month, period);
    if (period === 'first_half') {
      return `${start.toLocaleDateString('en-PH', { month: 'long' })} 1–15`;
    } else {
      return `${start.toLocaleDateString('en-PH', { month: 'long' })} 16–${end.getDate()}`;
    }
  }

  return { getAll, create, update, remove, currentPeriod, rangeOf, expensesInPeriod, monthStr, periodOf, shiftPeriod, labelFor };
})();