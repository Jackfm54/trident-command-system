DROP POLICY IF EXISTS "commands member fire" ON public.exercise_commands;
CREATE POLICY "commands member station" ON public.exercise_commands FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND command_type IN ('fire', 'kill', 'alert') AND unit_id IS NOT NULL AND public.is_unit_member(unit_id, auth.uid()));