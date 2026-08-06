// ============================================
// TaskFlow — Auth (login / signup / logout)
// ============================================

const Auth = (() => {

  async function getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  function onAuthChange(callback) {
    sb.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }

  return { getUser, signUp, signIn, signOut, onAuthChange };
})();