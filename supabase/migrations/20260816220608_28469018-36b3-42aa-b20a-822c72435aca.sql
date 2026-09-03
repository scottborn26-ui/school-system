-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin','principal','deputy','teacher','class_teacher','registrar','bursar','parent','student');
CREATE TYPE public.cbe_level AS ENUM ('pre_primary','lower_primary','upper_primary','junior_school','senior_school');
CREATE TYPE public.cbe_grade AS ENUM ('PP1','PP2','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10','G11','G12');
CREATE TYPE public.learner_status AS ENUM ('applicant','admitted','enrolled','active','promoted','repeated','transferred_out','withdrawn','completed','alumni','archived');
CREATE TYPE public.school_status AS ENUM ('active','suspended','archived');

-- UTIL
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SCHOOLS
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  logo_url text,
  motto text,
  category text,
  ownership text,
  boarding_type text,
  gender_composition text,
  knec_centre_code text,
  nemis_code text,
  county text,
  sub_county text,
  ward text,
  physical_address text,
  postal_address text,
  email text,
  phone text,
  alt_phone text,
  website text,
  headteacher_name text,
  headteacher_phone text,
  headteacher_email text,
  admission_number_format text NOT NULL DEFAULT 'ADM-{YYYY}-{SEQ:4}',
  admission_number_seq integer NOT NULL DEFAULT 0,
  status public.school_status NOT NULL DEFAULT 'active',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_school_memberships TO authenticated;
GRANT ALL ON public.user_school_memberships TO service_role;
ALTER TABLE public.user_school_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_unique ON public.user_roles (user_id, COALESCE(school_id,'00000000-0000-0000-0000-000000000000'::uuid), role);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY HELPERS
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active);
$$;

CREATE OR REPLACE FUNCTION public.is_school_member(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_school_memberships m
    WHERE m.user_id = auth.uid() AND m.school_id = _school_id AND m.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.has_school_role(_school_id uuid, _roles public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.school_id = _school_id AND r.is_active AND r.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_school_role(_school_id, ARRAY['principal','deputy']::public.app_role[]);
$$;

-- PROFILE / MEMBERSHIP / ROLE POLICIES
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin() OR EXISTS (
  SELECT 1 FROM public.user_school_memberships a
  JOIN public.user_school_memberships b ON a.school_id = b.school_id
  WHERE a.user_id = auth.uid() AND b.user_id = profiles.id AND a.is_active AND b.is_active
));
CREATE POLICY "profiles_self_write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "schools_read" ON public.schools FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_school_member(id));
CREATE POLICY "schools_insert" ON public.schools FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "schools_update" ON public.schools FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.has_school_role(id, ARRAY['principal']::public.app_role[]))
WITH CHECK (public.is_super_admin() OR public.has_school_role(id, ARRAY['principal']::public.app_role[]));

CREATE POLICY "memberships_read" ON public.user_school_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin() OR public.is_school_admin(school_id));
CREATE POLICY "memberships_insert" ON public.user_school_memberships FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_super_admin() OR public.is_school_admin(school_id));
CREATE POLICY "memberships_update" ON public.user_school_memberships FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id))
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin() OR public.is_school_admin(school_id));
CREATE POLICY "roles_insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (role <> 'super_admin' AND (public.is_super_admin() OR public.is_school_admin(school_id) OR (user_id = auth.uid() AND role = 'principal' AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = school_id AND s.created_by = auth.uid()))));
CREATE POLICY "roles_update" ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id))
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

-- SETTINGS + OFFERINGS + YEARS
CREATE TABLE public.school_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'KES',
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  locale text NOT NULL DEFAULT 'en-KE',
  show_ranking boolean NOT NULL DEFAULT false,
  show_raw_scores boolean NOT NULL DEFAULT true,
  report_footer text,
  grading_scheme_key text NOT NULL DEFAULT 'kjsea_8',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.school_grade_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade public.cbe_grade NOT NULL,
  level public.cbe_level NOT NULL,
  pathway text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grade)
);
CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name text NOT NULL,
  term_number integer NOT NULL,
  opening_date date,
  closing_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, term_number)
);
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer,
  room_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  head_staff_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE TABLE public.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  grade public.cbe_grade NOT NULL,
  name text NOT NULL,
  display_name text,
  class_teacher_id uuid,
  assistant_teacher_id uuid,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  capacity integer NOT NULL DEFAULT 45,
  color_label text NOT NULL DEFAULT 'navy',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, grade, name)
);

-- STAFF
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_number text NOT NULL,
  full_name text NOT NULL,
  photo_url text,
  national_id text,
  tsc_number text,
  gender text,
  email text,
  phone text,
  job_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  employment_type text,
  qualified_learning_areas text[] NOT NULL DEFAULT '{}',
  employment_date date,
  status text NOT NULL DEFAULT 'active',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_number)
);

-- LEARNERS
CREATE TABLE public.learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admission_number text NOT NULL,
  upi_number text,
  assessment_number text,
  birth_certificate_no text,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  gender text,
  date_of_birth date,
  photo_url text,
  nationality text DEFAULT 'Kenyan',
  county text,
  sub_county text,
  religion text,
  current_grade public.cbe_grade,
  current_stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  admission_date date,
  boarding_status text DEFAULT 'day',
  transport_route text,
  medical_alerts text,
  emergency_contact_name text,
  emergency_contact_phone text,
  status public.learner_status NOT NULL DEFAULT 'active',
  exit_date date,
  exit_reason text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, admission_number)
);
CREATE INDEX learners_school_grade_idx ON public.learners (school_id, current_grade, status);

CREATE TABLE public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  national_id text,
  relationship text,
  phone text,
  alt_phone text,
  email text,
  occupation text,
  address text,
  portal_access boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.learner_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  fee_responsibility_percent numeric(5,2) NOT NULL DEFAULT 100,
  pickup_authorized boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, guardian_id)
);
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  grade public.cbe_grade NOT NULL,
  stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  boarding_status text,
  is_active boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX enrollments_one_active ON public.enrollments (learner_id, academic_year_id) WHERE is_active;

CREATE TABLE public.learner_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_status public.learner_status,
  new_status public.learner_status,
  previous_grade public.cbe_grade,
  new_grade public.cbe_grade,
  previous_stream_id uuid,
  new_stream_id uuid,
  academic_year_id uuid,
  term_id uuid,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_school_idx ON public.audit_logs (school_id, created_at DESC);

-- GRANTS + RLS for tenant tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_settings','school_grade_offerings','academic_years','terms','rooms','departments','streams','staff','learners','guardians','learner_guardians','enrollments','learner_status_history','audit_logs']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s_member_read" ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin() OR public.is_school_member(school_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_member_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR public.is_school_member(school_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_admin_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_super_admin() OR public.is_school_member(school_id)) WITH CHECK (public.is_super_admin() OR public.is_school_member(school_id))', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admission number generator
CREATE OR REPLACE FUNCTION public.next_admission_number(_school_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fmt text; seq integer; out_txt text;
BEGIN
  IF NOT (public.is_school_member(_school_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorized for this school';
  END IF;
  UPDATE public.schools SET admission_number_seq = admission_number_seq + 1
  WHERE id = _school_id RETURNING admission_number_format, admission_number_seq INTO fmt, seq;
  out_txt := replace(COALESCE(fmt,'ADM-{YYYY}-{SEQ:4}'), '{YYYY}', to_char(now(),'YYYY'));
  out_txt := replace(out_txt, '{SEQ:4}', lpad(seq::text, 4, '0'));
  out_txt := replace(out_txt, '{SEQ}', seq::text);
  RETURN out_txt;
END; $$;
GRANT EXECUTE ON FUNCTION public.next_admission_number(uuid) TO authenticated;