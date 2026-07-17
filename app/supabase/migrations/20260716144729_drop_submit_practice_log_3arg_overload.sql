-- The prior migration's create-or-replace added a 4th parameter, which
-- Postgres treats as a distinct overload rather than replacing the function -
-- both (uuid,text,int) and (uuid,text,int,date) existed, making any 2-arg
-- call (e.g. submit_practice_log(id, 'morning')) ambiguous. Drop the old arity.
drop function if exists public.submit_practice_log(uuid, text, int);
