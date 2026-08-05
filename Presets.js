// ============================================
// TaskFlow — Expense Presets CRUD (Supabase)
// One-tap "quick add" buttons for recurring expenses
// (e.g. daily commute fares)
// ============================================

const Presets = (() => {

  async function getAll() {
    const { data, error } = await sb
      .from('expense_presets')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async function create(payload) {
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('expense_presets')
      .insert({ ...payload, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function update(id, payload) {
    const { data, error } = await sb
      .from('expense_presets')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function remove(id) {
    const { error } = await sb.from('expense_presets').delete().eq('id', id);
    if (error) throw error;
  }

  return { getAll, create, update, remove };
})();