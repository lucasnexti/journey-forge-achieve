import { createClient } from '@supabase/supabase-js';

// Client dedicated to the Playbook Revenue Nexti project (read-only, anon key)
const PLAYBOOK_URL = "https://zjydqpzplwxkcbjdmdrq.supabase.co";
const PLAYBOOK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqeWRxcHpwbHd4a2NiamRtZHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDg5NjMsImV4cCI6MjA4Nzc4NDk2M30.MYem7R2x8f2V1oe7i3uMB8-UpfjLT-AkR_-ittGXHt0";

export const playbookSupabase = createClient(PLAYBOOK_URL, PLAYBOOK_ANON_KEY);
