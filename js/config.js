// ============================================
// TaskFlow — Supabase Configuration
// Replace with your actual Supabase credentials
// ============================================

const SUPABASE_URL = 'https://rrrjmbigaloklptwsrtg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2tAVJ7JH0b2jWT-Ey7PtaQ_-vw6XxiO';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);