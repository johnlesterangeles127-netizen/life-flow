// ============================================
// TaskFlow — Task CRUD (Supabase)
// ============================================

const Tasks = (() => {

  async function getAll() {
    const { data, error } = await sb
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function create(payload) {
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('tasks')
      .insert({ ...payload, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function update(id, payload) {
    const { data, error } = await sb
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function toggleDone(id, currentDone) {
    const payload = {
      done: !currentDone,
      done_at: !currentDone ? new Date().toISOString() : null
    };
    return update(id, payload);
  }

  async function remove(id) {
    const { error } = await sb
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  return { getAll, create, update, toggleDone, remove };
})();