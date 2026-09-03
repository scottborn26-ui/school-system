-- Read optional trigger fields through JSON because the hierarchy tables have different columns.
CREATE OR REPLACE FUNCTION public.validate_senior_school_tenant_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pathway_id_value uuid := NULLIF(to_jsonb(NEW)->>'pathway_id', '')::uuid;
  track_id_value uuid := NULLIF(to_jsonb(NEW)->>'track_id', '')::uuid;
  strand_id_value uuid := NULLIF(to_jsonb(NEW)->>'strand_id', '')::uuid;
BEGIN
  IF TG_TABLE_NAME = 'pathway_tracks' AND NOT EXISTS (
    SELECT 1 FROM public.senior_pathways
    WHERE id = pathway_id_value AND school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Pathway must belong to the same school';
  END IF;

  IF TG_TABLE_NAME = 'pathway_strands' AND NOT EXISTS (
    SELECT 1 FROM public.pathway_tracks
    WHERE id = track_id_value AND school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Track must belong to the same school';
  END IF;

  IF TG_TABLE_NAME = 'senior_learning_area_rules' AND (
    (pathway_id_value IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.senior_pathways WHERE id = pathway_id_value AND school_id = NEW.school_id
    )) OR
    (track_id_value IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pathway_tracks WHERE id = track_id_value AND school_id = NEW.school_id
    )) OR
    (strand_id_value IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pathway_strands WHERE id = strand_id_value AND school_id = NEW.school_id
    ))
  ) THEN
    RAISE EXCEPTION 'Senior School rule references another school';
  END IF;

  RETURN NEW;
END;
$$;