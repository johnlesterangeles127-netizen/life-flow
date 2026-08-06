// ============================================
// TaskFlow — Expenses / Lifestyle Tracker CRUD
// ============================================

const Expenses = (() => {

  async function getAll() {
    const { data, error } = await sb
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function create(payload) {
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('expenses')
      .insert({ ...payload, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function update(id, payload) {
    const { data, error } = await sb
      .from('expenses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function remove(id) {
    const { error } = await sb.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }

  return { getAll, create, update, remove };
})();