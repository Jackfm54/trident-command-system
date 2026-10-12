ALTER TABLE public.exercises ADD COLUMN mode text NOT NULL DEFAULT 'independent';
ALTER TABLE public.exercises ADD COLUMN scenario_id uuid REFERENCES public.scenarios(id) ON DELETE SET NULL;
ALTER TABLE public.exercise_units ADD COLUMN pos_x_nm numeric NOT NULL DEFAULT 0;
ALTER TABLE public.exercise_units ADD COLUMN pos_y_nm numeric NOT NULL DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN target_unit_id uuid;