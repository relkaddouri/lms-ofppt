alter table public.seances add column if not exists updated_at timestamptz;

update public.seances set updated_at = created_at where updated_at is null;
