-- Kerala numbers its years (Kollavarsham / Malayalam Era) rather than naming
-- them from the 60-year Samvatsara cycle, and rolls over at Chingam 1 - a
-- different boundary from the samvatsara rollover at Mesha Sankranti. The
-- existing varsham_name column cannot express both, so a genuine Malayalam
-- view of a day needs this alongside it.
--
-- Nullable on add so the existing 365 rows stay valid; the accompanying
-- regenerated dataset backfills every row, after which it is set NOT NULL.
alter table public.panchangam_days
  add column kollavarsham_year int;

comment on column public.panchangam_days.kollavarsham_year is
  'Malayalam Era year. Rolls over at Chingam 1, not at Mesha Sankranti.';
