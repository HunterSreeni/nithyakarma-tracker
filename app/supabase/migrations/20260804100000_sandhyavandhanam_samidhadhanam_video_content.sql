-- Sandhyavandhanam and Samidhadhanam get a watch-along video on the
-- Learning tab rather than reading content - unlike every other practice
-- with has_learning_content, both genuinely differ mantra-for-mantra across
-- Rigveda/Yajurveda/Samaveda/Atharvaveda (researched, not assumed), and no
-- single text can stand in for all four without being wrong for most
-- readers. A real per-Veda switcher is future work (docs/ROADMAP.md).
-- has_learning_content just gates the Learning-tab card; LearningPage.jsx
-- renders these two as video-only (no `languages`, no verse fetch at all).
update public.practices set has_learning_content = true
where slug in ('sandhyavandhanam', 'samidhadhanam');
