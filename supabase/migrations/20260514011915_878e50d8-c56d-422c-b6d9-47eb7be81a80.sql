
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.task_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  show_on_card boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own task_property all"
ON public.task_properties FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_task_properties_user ON public.task_properties(user_id, position);

CREATE TABLE public.task_property_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.task_properties(id) ON DELETE CASCADE,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, property_id)
);

ALTER TABLE public.task_property_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own task_property_value all"
ON public.task_property_values FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_task_property_values_task ON public.task_property_values(task_id);
CREATE INDEX idx_task_property_values_property ON public.task_property_values(property_id);

CREATE TRIGGER trg_task_properties_updated_at
BEFORE UPDATE ON public.task_properties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_task_property_values_updated_at
BEFORE UPDATE ON public.task_property_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
