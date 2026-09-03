-- Seed the senior-school pathways, tracks, strands, combinations and learning-area rules
-- so the Grade 9 transition screen loads options from the database.

INSERT INTO public.senior_pathways (school_id, name, code, description)
SELECT s.id, pathway.name, pathway.code, pathway.description
FROM public.schools s
CROSS JOIN (
  VALUES
    ('STEM', 'STEM', 'Science, Technology, Engineering and Mathematics'),
    ('Social Sciences', 'SOCIAL_SCIENCES', 'Languages, humanities, business and social studies'),
    ('Arts and Sports Science', 'ARTS_SPORTS', 'Creative, performing and sports sciences')
) AS pathway(name, code, description)
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO public.pathway_tracks (school_id, pathway_id, name, code, description)
SELECT p.school_id, p.id, track.name, track.code, track.description
FROM public.senior_pathways p
JOIN (
  VALUES
    ('STEM', 'PURE_SCIENCES', 'Pure Sciences', 'Mathematics and natural sciences'),
    ('STEM', 'APPLIED_SCIENCES', 'Applied Sciences', 'Technology and applied sciences'),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'Humanities and Business', 'Humanities, languages and business'),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'Arts and Sports', 'Creative, performing arts and sports')
) AS track(pathway_code, code, name, description)
  ON track.pathway_code = p.code
ON CONFLICT (pathway_id, code) DO NOTHING;

INSERT INTO public.pathway_strands (school_id, track_id, name, code, description)
SELECT t.school_id, t.id, strand.name, strand.code, strand.description
FROM public.pathway_tracks t
JOIN (
  VALUES
    ('PURE_SCIENCES', 'MATHEMATICS', 'Mathematics and Physical Sciences', 'A strong mathematics and physics pathway'),
    ('PURE_SCIENCES', 'LIFE_SCIENCES', 'Life Sciences', 'Biology and applied life-science studies'),
    ('APPLIED_SCIENCES', 'AGRI_FOOD', 'Agricultural and Food Sciences', 'Agriculture, food and nutrition studies'),
    ('APPLIED_SCIENCES', 'DIGITAL_APPLIED', 'Digital and Applied Sciences', 'Computer science, technology and applied science'),
    ('HUMANITIES_BUSINESS', 'HUMANITIES', 'Humanities', 'History, civics and religion'),
    ('HUMANITIES_BUSINESS', 'LANGUAGES_BUSINESS', 'Languages and Business', 'Languages, literature and business'),
    ('ARTS_SPORTS', 'ARTS', 'Arts', 'Creative arts, music and design'),
    ('ARTS_SPORTS', 'SPORTS', 'Sports Science', 'Physical performance and sports management')
) AS strand(track_code, code, name, description)
  ON strand.track_code = t.code
ON CONFLICT (track_id, code) DO NOTHING;

INSERT INTO public.subject_combinations (school_id, pathway_id, track_id, name, code, description, minimum_subjects, maximum_subjects, status)
SELECT p.school_id, p.id, t.id, combo.name, combo.code, combo.description, combo.minimum_subjects, combo.maximum_subjects, 'active'
FROM public.senior_pathways p
JOIN public.pathway_tracks t
  ON t.pathway_id = p.id
JOIN (
  VALUES
    ('STEM', 'PURE_SCIENCES', 'PURE_SCIENCE_1', 'Pure Science Pathway', 'Science-heavy subjects including Maths, Physics, Chemistry and Biology', 3, 4),
    ('STEM', 'APPLIED_SCIENCES', 'APPLIED_SCIENCE_1', 'Applied Science Pathway', 'Applied sciences and technology-based subject choices', 2, 3),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'SOCIAL_HUMANITIES_1', 'Humanities and Business Pathway', 'Subjects focused on humanities, languages and commerce', 3, 4),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'ARTS_SPORT_1', 'Arts and Sports Pathway', 'Creative and performance-oriented subject choices', 2, 3)
) AS combo(pathway_code, track_code, code, name, description, minimum_subjects, maximum_subjects)
  ON combo.pathway_code = p.code
 AND combo.track_code = t.code
ON CONFLICT (school_id, code) DO NOTHING;

INSERT INTO public.subject_combination_learning_areas (subject_combination_id, learning_area_id, is_core, is_optional)
SELECT sc.id, la.id,
       CASE WHEN combo_map.is_core THEN true ELSE false END,
       CASE WHEN combo_map.is_core THEN false ELSE true END
FROM public.subject_combinations sc
JOIN public.learning_areas la
  ON la.school_id = sc.school_id
JOIN (
  VALUES
    ('PURE_SCIENCE_1', 'Mathematics', true),
    ('PURE_SCIENCE_1', 'English', true),
    ('PURE_SCIENCE_1', 'Physics', false),
    ('PURE_SCIENCE_1', 'Chemistry', false),
    ('PURE_SCIENCE_1', 'Biology', false),
    ('APPLIED_SCIENCE_1', 'Mathematics', true),
    ('APPLIED_SCIENCE_1', 'English', true),
    ('APPLIED_SCIENCE_1', 'Computer Science', false),
    ('APPLIED_SCIENCE_1', 'Agriculture', false),
    ('APPLIED_SCIENCE_1', 'Foods and Nutrition', false),
    ('SOCIAL_HUMANITIES_1', 'English', true),
    ('SOCIAL_HUMANITIES_1', 'Kiswahili', true),
    ('SOCIAL_HUMANITIES_1', 'History and Citizenship', false),
    ('SOCIAL_HUMANITIES_1', 'Geography', false),
    ('SOCIAL_HUMANITIES_1', 'Business Studies', false),
    ('ARTS_SPORT_1', 'English', true),
    ('ARTS_SPORT_1', 'Music', false),
    ('ARTS_SPORT_1', 'Sports Science', false),
    ('ARTS_SPORT_1', 'Visual Arts', false),
    ('ARTS_SPORT_1', 'Physical Education', false)
) AS combo_map(combination_code, area_name, is_core)
  ON combo_map.combination_code = sc.code
 AND combo_map.area_name = la.name
ON CONFLICT (subject_combination_id, learning_area_id) DO NOTHING;

INSERT INTO public.senior_learning_area_rules (school_id, learning_area_id, pathway_id, track_id, strand_id, is_compulsory, min_selections, max_selections, assessment_type, grading_system, weighting, is_active)
SELECT la.school_id,
       la.id,
       p.id,
       t.id,
       NULL,
       rule_data.is_compulsory,
       rule_data.min_selections,
       rule_data.max_selections,
       'numeric',
       'percentage',
       1,
       true
FROM public.learning_areas la
JOIN public.senior_pathways p
  ON p.school_id = la.school_id
JOIN public.pathway_tracks t
  ON t.pathway_id = p.id
JOIN (
  VALUES
    ('STEM', 'PURE_SCIENCES', 'Mathematics', true, 1, 1),
    ('STEM', 'PURE_SCIENCES', 'English', true, 1, 1),
    ('STEM', 'PURE_SCIENCES', 'Physics', false, 0, 1),
    ('STEM', 'PURE_SCIENCES', 'Chemistry', false, 0, 1),
    ('STEM', 'PURE_SCIENCES', 'Biology', false, 0, 1),
    ('STEM', 'APPLIED_SCIENCES', 'Mathematics', true, 1, 1),
    ('STEM', 'APPLIED_SCIENCES', 'English', true, 1, 1),
    ('STEM', 'APPLIED_SCIENCES', 'Computer Science', false, 0, 1),
    ('STEM', 'APPLIED_SCIENCES', 'Agriculture', false, 0, 1),
    ('STEM', 'APPLIED_SCIENCES', 'Foods and Nutrition', false, 0, 1),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'English', true, 1, 1),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'Kiswahili', true, 1, 1),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'History and Citizenship', false, 0, 1),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'Geography', false, 0, 1),
    ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'Business Studies', false, 0, 1),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'English', true, 1, 1),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'Music', false, 0, 1),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'Sports Science', false, 0, 1),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'Visual Arts', false, 0, 1),
    ('ARTS_SPORTS', 'ARTS_SPORTS', 'Physical Education', false, 0, 1)
) AS rule_data(pathway_code, track_code, area_name, is_compulsory, min_selections, max_selections)
  ON rule_data.pathway_code = p.code
 AND rule_data.track_code = t.code
 AND rule_data.area_name = la.name
ON CONFLICT (learning_area_id, pathway_id, track_id, strand_id) DO NOTHING;
