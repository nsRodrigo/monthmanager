
-- IRPF documents
CREATE TABLE public.irpf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  kind text NOT NULL DEFAULT 'extrato',
  file_path text NOT NULL,
  original_name text NOT NULL,
  mime text,
  size integer,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.irpf_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own irpf_docs select" ON public.irpf_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own irpf_docs insert" ON public.irpf_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own irpf_docs update" ON public.irpf_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own irpf_docs delete" ON public.irpf_documents FOR DELETE USING (auth.uid() = user_id);

-- IRPF entries (lines extracted from documents)
CREATE TABLE public.irpf_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid REFERENCES public.irpf_documents(id) ON DELETE CASCADE,
  date date,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  source text,
  category text NOT NULL DEFAULT 'nao_classificado',
  subcategory text,
  year integer NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.irpf_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own irpf_entries select" ON public.irpf_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own irpf_entries insert" ON public.irpf_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own irpf_entries update" ON public.irpf_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own irpf_entries delete" ON public.irpf_entries FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_irpf_entries_user_year ON public.irpf_entries(user_id, year);

-- IRPF year snapshots (saldos em 31/12)
CREATE TABLE public.irpf_year_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  account_id uuid,
  investment_id uuid,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.irpf_year_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own irpf_snap select" ON public.irpf_year_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own irpf_snap insert" ON public.irpf_year_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own irpf_snap update" ON public.irpf_year_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own irpf_snap delete" ON public.irpf_year_snapshots FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_irpf_snap_updated_at
  BEFORE UPDATE ON public.irpf_year_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('irpf-docs', 'irpf-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "irpf-docs own select" ON storage.objects FOR SELECT
  USING (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "irpf-docs own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "irpf-docs own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "irpf-docs own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'irpf-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
