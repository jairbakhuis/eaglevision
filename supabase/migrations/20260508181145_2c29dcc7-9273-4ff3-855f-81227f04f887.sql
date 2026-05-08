CREATE TABLE public.filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  icon text,
  color text NOT NULL DEFAULT '#8b5cf6',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own filter all" ON public.filters
  FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX filters_user_position_idx ON public.filters (user_id, position);