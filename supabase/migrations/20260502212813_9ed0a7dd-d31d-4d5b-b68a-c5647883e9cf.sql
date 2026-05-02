
-- Scenarios table
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL DEFAULT 'mixed',
  threat_level TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts (live tactical picture)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  domain TEXT NOT NULL, -- air | surface | subsurface | electronic
  classification TEXT NOT NULL DEFAULT 'unknown', -- friend | hostile | neutral | unknown | suspect
  platform_type TEXT, -- e.g. fast-jet, frigate, submarine, missile, helo
  bearing NUMERIC,
  range_nm NUMERIC,
  speed_kts NUMERIC,
  altitude_ft NUMERIC,
  heading NUMERIC,
  lat NUMERIC,
  lon NUMERIC,
  ai_confidence NUMERIC DEFAULT 0,
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'tracking',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_scenario ON public.contacts(scenario_id);
CREATE INDEX idx_contacts_domain ON public.contacts(domain);

-- Tactical events / engagement log
CREATE TABLE public.tactical_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- detection, classification, engagement, jamming, sonar_ping
  domain TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_scenario ON public.tactical_events(scenario_id);

-- Enable RLS - public demo (read+write open since no auth in demo)
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo open scenarios" ON public.scenarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo open contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "demo open events" ON public.tactical_events FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tactical_events;

-- Seed scenarios
INSERT INTO public.scenarios (name, description, domain, threat_level) VALUES
('Patrulla Caribe', 'Patrulla rutinaria en el Caribe colombiano, baja amenaza, contactos comerciales mixtos.', 'mixed', 'low'),
('Ataque Saturado AAW', 'Múltiples vampiros entrantes, misiles antibuque a baja altura desde diferentes ejes.', 'air', 'critical'),
('Caza Submarina ASW', 'Contacto submarino sospechoso a 8nm, requiere clasificación sonar y helicóptero embarcado.', 'subsurface', 'high'),
('Guerra Electrónica EW', 'Ambiente denso con jamming, emisores hostiles y deception en banda X y S.', 'electronic', 'high'),
('Enfrentamiento Superficie', 'Grupo de superficie hostil a 25nm, intercambio de fuego anti-superficie inminente.', 'surface', 'high');
