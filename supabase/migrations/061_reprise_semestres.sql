-- Reprise de la répartition semestrielle réelle (PRD §4.13bis).
--
-- La migration précédente a mis toutes les heures en S1, valeur de départ
-- neutre. La vraie répartition vient du tableau de service 2025/2026 signé,
-- reproduit ici ligne par ligne.
--
-- Elle ne s'écrit pas à l'aveugle : pour chaque ligne, la somme des quatre
-- valeurs doit retomber sur la masse horaire déjà en base et la somme des
-- deux parts à distance sur les heures FAD déjà en base. Une seule divergence
-- interrompt la migration — mieux vaut ne rien reprendre que reprendre faux.
--
-- Le rapprochement se fait sur le nom du groupe et le code opérationnel du
-- module : sur une base qui n'a pas ces lignes, la migration ne fait rien.

do $$
declare
  ligne record;
  cible record;
  ecart_total numeric := 0;
begin
  create temp table reprise_tds (
    groupe text, code text,
    p1 numeric, f1 numeric, p2 numeric, f2 numeric,
    mutualisee boolean
  ) on commit drop;

  insert into reprise_tds values
    ('DES101',   'M104', 75, 15,  0,  0, false),
    ('DES101',   'M106',  0,  0, 95, 25, false),
    -- Tronc commun partagé avec DES101 : le document officiel laisse les
    -- cellules FAD de ce groupe vides, la charge ne les compte qu'une fois.
    ('DES102',   'M104', 75, 15,  0,  0, true),
    ('DES102',   'M106',  0,  0, 95, 25, true),
    ('DDOUX201', 'M202', 75, 15,  0,  0, false),
    ('DDOUX201', 'M203', 85, 20,  0,  0, false),
    ('DDOUX201', 'M204', 60, 15,  0,  0, false),
    ('DDOUX201', 'M205', 55, 15, 40, 10, false),
    ('DDOUX201', 'M206',  0,  0, 50, 10, false),
    ('DDOUX201', 'M207',  0,  0, 75, 15, false);

  for ligne in select * from reprise_tds loop
    select gm.groupe_id, gm.module_id,
           gm.masse_horaire_allouee as mh, gm.heures_fad as fad
      into cible
      from public.groupe_modules gm
      join public.groupes g on g.id = gm.groupe_id
      join public.modules m on m.id = gm.module_id
      join public.competences c on c.id = m.competence_id
     where g.nom = ligne.groupe and c.code_operationnel = ligne.code;

    -- Base sans ces lignes : rien à reprendre, on passe.
    if not found then
      continue;
    end if;

    if ligne.p1 + ligne.f1 + ligne.p2 + ligne.f2 <> cible.mh then
      raise exception
        'Reprise refusée : % / % totalise % h par semestre contre % h en base',
        ligne.groupe, ligne.code,
        ligne.p1 + ligne.f1 + ligne.p2 + ligne.f2, cible.mh;
    end if;

    if ligne.f1 + ligne.f2 <> cible.fad then
      raise exception
        'Reprise refusée : % / % totalise % h à distance contre % h en base',
        ligne.groupe, ligne.code, ligne.f1 + ligne.f2, cible.fad;
    end if;

    update public.groupe_modules
       set presentiel_s1 = ligne.p1,
           fad_s1 = ligne.f1,
           presentiel_s2 = ligne.p2,
           fad_s2 = ligne.f2,
           fad_mutualisee = ligne.mutualisee
     where groupe_id = cible.groupe_id and module_id = cible.module_id;

    if ligne.mutualisee then
      ecart_total := ecart_total + ligne.f1 + ligne.f2;
    end if;
  end loop;

  raise notice 'Reprise semestrielle appliquée. FAD mutualisée écartée de la charge : % h', ecart_total;
end $$;
