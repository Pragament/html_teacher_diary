-- ==========================================
-- SLOW LEARNER ENTRIES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.slow_learner_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  class_name TEXT DEFAULT '',
  section TEXT DEFAULT '',
  student_id TEXT DEFAULT '',
  student_name TEXT NOT NULL,
  subject TEXT DEFAULT '',
  learning_gap TEXT DEFAULT '',
  strategy TEXT DEFAULT '',
  progress TEXT DEFAULT '',
  next_step TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slow_learner_entries_teacher_date ON public.slow_learner_entries(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_slow_learner_entries_class_section ON public.slow_learner_entries(class_name, section);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_slow_learner_entries_updated_at
BEFORE UPDATE ON public.slow_learner_entries
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.slow_learner_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own slow learner entries" ON public.slow_learner_entries FOR SELECT 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert own slow learner entries" ON public.slow_learner_entries FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own slow learner entries" ON public.slow_learner_entries FOR UPDATE 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own slow learner entries" ON public.slow_learner_entries FOR DELETE 
  USING (auth.uid() = teacher_id);

CREATE POLICY "Principals/Admins can view slow learner entries" ON public.slow_learner_entries FOR SELECT 
  USING (
    public.get_my_role() IN ('principal', 'admin', 'super_admin', 'vice_principal', 'hod')
  );
