CREATE OR REPLACE FUNCTION public.create_school(
  _school jsonb,
  _year jsonb,
  _grades jsonb,
  _settings jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_school_id uuid;
  new_year_id uuid;
  grade_row jsonb;
BEGIN
  INSERT INTO public.schools (
    name, short_name, motto, category, ownership, boarding_type,
    gender_composition, knec_centre_code, nemis_code, county, sub_county,
    ward, physical_address, postal_address, email, phone, website,
    headteacher_name, headteacher_phone, headteacher_email,
    admission_number_format, onboarding_completed, created_by
  )
  VALUES (
    _school->>'name', _school->>'short_name', _school->>'motto',
    _school->>'category', _school->>'ownership', _school->>'boarding_type',
    _school->>'gender_composition', _school->>'knec_centre_code',
    _school->>'nemis_code', _school->>'county', _school->>'sub_county',
    _school->>'ward', _school->>'physical_address', _school->>'postal_address',
    _school->>'email', _school->>'phone', _school->>'website',
    _school->>'headteacher_name', _school->>'headteacher_phone',
    _school->>'headteacher_email',
    COALESCE(_school->>'admission_number_format', 'ADM-{YYYY}-{SEQ:4}'),
    COALESCE((_school->>'onboarding_completed')::boolean, false), auth.uid()
  )
  RETURNING id INTO new_school_id;

  INSERT INTO public.user_school_memberships (user_id, school_id, is_active)
  VALUES (auth.uid(), new_school_id, true);

  INSERT INTO public.user_roles (user_id, school_id, role, is_active)
  VALUES (auth.uid(), new_school_id, 'principal', true);

  INSERT INTO public.academic_years (school_id, name, start_date, end_date, is_current)
  VALUES (
    new_school_id, _year->>'name', (_year->>'start_date')::date,
    (_year->>'end_date')::date, true
  )
  RETURNING id INTO new_year_id;

  INSERT INTO public.terms (school_id, academic_year_id, name, term_number, is_current)
  VALUES
    (new_school_id, new_year_id, 'Term 1', 1, true),
    (new_school_id, new_year_id, 'Term 2', 2, false),
    (new_school_id, new_year_id, 'Term 3', 3, false);

  FOR grade_row IN SELECT value FROM jsonb_array_elements(_grades)
  LOOP
    INSERT INTO public.school_grade_offerings (school_id, grade, level, pathway)
    VALUES (
      new_school_id,
      (grade_row->>'grade')::public.cbe_grade,
      (grade_row->>'level')::public.cbe_level,
      NULLIF(grade_row->>'pathway', '')
    );
  END LOOP;

  INSERT INTO public.school_settings (school_id, show_ranking, show_raw_scores, report_footer)
  VALUES (
    new_school_id,
    COALESCE((_settings->>'show_ranking')::boolean, false),
    COALESCE((_settings->>'show_raw_scores')::boolean, true),
    NULLIF(_settings->>'report_footer', '')
  );

  RETURN new_school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_school(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_school(jsonb, jsonb, jsonb, jsonb) TO authenticated;
