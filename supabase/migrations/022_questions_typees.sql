-- 022_questions_typees.sql
--
-- Une question ne savait porter qu'un `enonce` en texte libre. Conséquence
-- observée sur un contrôle réel : le modèle produisait un « QCM » unique
-- contenant quatre sous-questions (a, b, c, d) et douze propositions, le tout
-- aplati dans une seule chaîne. Ni l'éditeur ni le PDF ne pouvaient le
-- présenter correctement, et la correction ne pouvait pas noter les
-- sous-questions séparément.
--
-- Les propositions deviennent donc une donnée à part entière.

alter table public.questions_controle
  add column if not exists type text not null default 'ouverte',
  add column if not exists options jsonb;

alter table public.questions_controle drop constraint if exists questions_type_check;
alter table public.questions_controle
  add constraint questions_type_check
  check (type in ('qcm', 'ouverte', 'exercice'));

-- Un QCM sans propositions n'est pas un QCM.
alter table public.questions_controle drop constraint if exists questions_qcm_options_check;
alter table public.questions_controle
  add constraint questions_qcm_options_check
  check (
    type <> 'qcm'
    or (
      options is not null
      and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) >= 2
    )
  );

comment on column public.questions_controle.type is
  'qcm : propositions a cocher, portees par `options`. ouverte : reponse '
  'redigee courte. exercice : mise en application, reponse longue.';
comment on column public.questions_controle.options is
  'QCM uniquement. Tableau [{"texte": "...", "correcte": true|false}]. '
  'Plusieurs propositions correctes sont autorisees : la question est alors a '
  'reponses multiples, ce qui se deduit du nombre de `correcte` a vrai.';
comment on column public.questions_controle.enonce is
  'Intitule de la question SEULE. Ne contient jamais les propositions d un QCM, '
  'ni plusieurs sous-questions : une sous-question = une ligne de cette table.';
