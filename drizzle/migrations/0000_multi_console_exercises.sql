CREATE TYPE public.app_role AS ENUM ('instructor', 'operator');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Operador',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'instructor'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'instructor') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'instructor');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'instructor') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
END;
$$;

ALTER TABLE public.scenarios ADD COLUMN threats jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.scenarios ADD COLUMN is_template boolean NOT NULL DEFAULT true;
ALTER TABLE public.scenarios ADD COLUMN created_by uuid;

CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'planning',
  created_by uuid NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises read" ON public.exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercises instructor write" ON public.exercises FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'instructor')) WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE TABLE public.exercise_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  name text NOT NULL,
  scenario_id uuid REFERENCES public.scenarios(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  hull_integrity numeric NOT NULL DEFAULT 100,
  propulsion numeric NOT NULL DEFAULT 100,
  power numeric NOT NULL DEFAULT 100,
  alert_level text NOT NULL DEFAULT 'yellow',
  kills integer NOT NULL DEFAULT 0,
  impacts integer NOT NULL DEFAULT 0,
  shots integer NOT NULL DEFAULT 0,
  ammo_pct numeric NOT NULL DEFAULT 100,
  weapons jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_units TO authenticated;
GRANT ALL ON public.exercise_units TO service_role;
ALTER TABLE public.exercise_units ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.unit_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.exercise_units(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  station text NOT NULL DEFAULT 'command',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_members TO authenticated;
GRANT ALL ON public.unit_members TO service_role;
ALTER TABLE public.unit_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.unit_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members self join" ON public.unit_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "members self update" ON public.unit_members FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members self leave" ON public.unit_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'instructor'));

CREATE OR REPLACE FUNCTION public.is_unit_member(_unit_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.unit_members WHERE unit_id = _unit_id AND user_id = _user_id)
$$;

CREATE POLICY "units read" ON public.exercise_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units instructor write" ON public.exercise_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'instructor')) WITH CHECK (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "units member update" ON public.exercise_units FOR UPDATE TO authenticated
  USING (public.is_unit_member(id, auth.uid())) WITH CHECK (public.is_unit_member(id, auth.uid()));

CREATE TABLE public.exercise_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.exercise_units(id) ON DELETE CASCADE,
  command_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.exercise_commands TO authenticated;
GRANT ALL ON public.exercise_commands TO service_role;
ALTER TABLE public.exercise_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commands read" ON public.exercise_commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "commands instructor insert" ON public.exercise_commands FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'instructor') AND created_by = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.exercises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_members;