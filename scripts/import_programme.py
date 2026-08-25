#!/usr/bin/env python3
"""Import semi-automatique d'un programme de formation OFPPT (.docx).

Deux étapes volontairement séparées, pour qu'aucune donnée n'entre en base
sans relecture humaine (atome 1.4) :

  1. extraire     .docx  ->  programme.json + rapport-relecture.md
  2. generer-sql  programme.json  ->  programme.sql   (refuse tant que le JSON
                  n'est pas marqué relu)

L'étape 2 ne touche pas la base : elle produit un fichier SQL idempotent, que
l'on applique ensuite explicitement avec `supabase db query -f`.

Dépendances : bibliothèque standard uniquement (zipfile + ElementTree).
"""

import argparse
import json
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
RE_CODE = re.compile(r"[A-Z]{2,}[_A-Z0-9]*\s*[-–]\s*(\d{1,2})\b")
RE_COMP = re.compile(r"comp[ée]tence\s*n?°?\s*(\d{1,2})", re.I)
RE_APPR = re.compile(r"^([A-Z])\.\s*(\d+)\s*")
RE_TIRET = re.compile(r"^\s*[-–—]\s*")
RE_LETTRE_ELEM = re.compile(r"^([A-Z])\s*[.)]\s+")
ESPACES = re.compile(r"[ \t ]+")


# ---------------------------------------------------------------- lecture docx

def _texte(p):
    return ESPACES.sub(" ", "".join(t.text or "" for t in p.iter(f"{W}t"))).strip()


def lire_blocs(chemin):
    """Retourne [(type, contenu)] ; une cellule est une LISTE de paragraphes."""
    try:
        racine = ET.fromstring(zipfile.ZipFile(chemin).read("word/document.xml"))
    except ImportError as e:
        sys.exit(
            f"Analyseur XML indisponible dans cet interpréteur ({e}).\n"
            "Relancez avec un python3 dont pyexpat fonctionne, p. ex. /usr/bin/python3."
        )
    blocs = []
    for el in racine.find(f"{W}body"):
        nom = el.tag.split("}")[1]
        if nom == "p":
            t = _texte(el)
            if t:
                blocs.append(("p", t))
        elif nom == "tbl":
            lignes = []
            for tr in el.findall(f"{W}tr"):
                cells = [[x for x in (_texte(p) for p in tc.findall(f"{W}p")) if x]
                         for tc in tr.findall(f"{W}tc")]
                if any(cells):
                    lignes.append(cells)
            if lignes:
                blocs.append(("tbl", lignes))
    return blocs


def aplati(bloc):
    kind, v = bloc
    if kind == "p":
        return v
    return " | ".join(" ".join(" ".join(c) for c in r) for r in v)


def normalise_code(brut):
    return re.sub(r"\s*[-–]\s*", "-", ESPACES.sub("", brut)).upper()


# ------------------------------------------------------------------ extraction

def table_synthese(blocs, alertes):
    for kind, v in blocs:
        if kind != "tbl" or not v:
            continue
        entete = " ".join(" ".join(c) for c in v[0]).lower()
        if "code" in entete and "numéro" in entete and "durée" in entete:
            comps = []
            for r in v[1:]:
                col = lambda i: " ".join(r[i]).strip() if i < len(r) else ""
                code, num, nom, duree = col(0), col(1), col(2), col(3)
                if not code or not num:
                    continue
                h = re.search(r"(\d+)", duree.replace(" ", ""))
                comps.append({
                    "numero": int(re.sub(r"\D", "", num)),
                    "code_officiel": normalise_code(code),
                    "nom": nom,
                    "duree_nationale_heures": int(h.group(1)) if h else None,
                    # Hors référentiel : le document ne porte ni code court ni cycle.
                    "code_operationnel": "M1%02d" % int(re.sub(r"\D", "", num)),
                    "cycle": None,
                    "fiche_prescrite": None,
                    "suggestions": [],
                })
            return comps
    alertes.append("BLOQUANT : tableau synthèse introuvable (en-tête Code/Numéro/Durée).")
    return []


def numero_du_bloc(bloc):
    """Numéro de compétence déduit d'un bloc, par son code puis par « Compétence N »."""
    txt = aplati(bloc)
    m = RE_CODE.search(txt)
    par_code = int(m.group(1)) if m else None
    m2 = RE_COMP.search(txt)
    par_libelle = int(m2.group(1)) if m2 else None
    return par_libelle or par_code, par_code, par_libelle


def est_fiche_prescrite(bloc):
    if bloc[0] != "tbl":
        return False
    txt = aplati(bloc).lower()
    return "contexte de réalisation" in txt and "critères généraux de performance" in txt


def ligne_entete_suggestions(v):
    """Indice de la ligne d'en-tête du tableau de suggestions, ou None.

    Certaines compétences fusionnent l'en-tête de compétence dans la même table
    que les suggestions : l'en-tête utile peut alors se trouver plusieurs lignes
    plus bas (jusqu'à la ligne 4 dans le programme UX Designer).
    """
    for i, r in enumerate(v[:6]):
        entete = " ".join(" ".join(c) for c in r).lower()
        if "éléments de la compétence" in entete and "apprentissages de base" in entete:
            return i
    return None


def est_suggestions(bloc):
    return bloc[0] == "tbl" and bool(bloc[1]) and ligne_entete_suggestions(bloc[1]) is not None


def parse_fiche(v, alertes, num):
    fiche = {"contexte_realisation": [], "criteres_generaux_performance": [], "elements": []}
    i_ctx = i_elem = None
    for i, r in enumerate(v):
        tete = " ".join(r[0]).strip().lower() if r else ""
        if tete.startswith("contexte de réalisation"):
            i_ctx = i
        elif tete.startswith("éléments de la compétence"):
            i_elem = i
    if i_ctx is not None and i_ctx + 1 < len(v):
        ligne = v[i_ctx + 1]
        fiche["contexte_realisation"] = ligne[0] if len(ligne) > 0 else []
        fiche["criteres_generaux_performance"] = ligne[1] if len(ligne) > 1 else []
    else:
        alertes.append(f"Compétence {num} : contexte de réalisation introuvable dans la fiche prescrite.")
    if i_elem is None:
        alertes.append(f"Compétence {num} : bloc « Éléments de la compétence » introuvable.")
        return fiche
    ordre = 0
    for r in v[i_elem + 1:]:
        intitule = " ".join(r[0]).strip() if r else ""
        if not intitule:
            continue
        ordre += 1
        # Le référentiel lettre parfois ses éléments explicitement, et il lui arrive
        # de sauter une lettre (compétence 15 : A, B, D). Sa lettre fait foi ;
        # on ne dérive de l'ordre que lorsqu'elle est absente.
        m = RE_LETTRE_ELEM.match(intitule)
        fiche["elements"].append({
            "lettre": m.group(1) if m else chr(64 + ordre),
            "lettre_derivee": not m,
            "intitule": RE_LETTRE_ELEM.sub("", intitule).strip(),
            "ordre": ordre,
            "criteres": r[1] if len(r) > 1 else [],
        })
    return fiche


def parse_suggestions(v, alertes, num):
    sugg, courant, ordre, orphelines = [], None, 0, 0
    debut = (ligne_entete_suggestions(v) or 0) + 1
    for r in v[debut:]:
        col = lambda i: r[i] if i < len(r) else []
        elem = " ".join(col(0)).strip()
        appr = " ".join(col(1)).strip()
        if elem:
            m = re.match(r"^([A-Z])[.\s]", elem)
            courant = m.group(1) if m else None
            ordre = 0
        if not appr:
            if " ".join(col(3)).strip() and sugg:
                for s in reversed(sugg):
                    if s["lettre"] == courant:
                        s["activites_apprentissage"] += "\n" + "\n".join(col(3))
                        break
                orphelines += 1
            continue
        ordre += 1
        m = RE_APPR.match(appr)
        code = f"{m.group(1)}.{m.group(2)}" if m else None
        pct = ESPACES.sub("", " ".join(col(4))).replace("%", "").replace(",", ".")
        sugg.append({
            "lettre": courant,
            "code": code,
            "code_incoherent": bool(code and courant and code[0] != courant),
            "apprentissage_base": RE_TIRET.sub("", RE_APPR.sub("", appr)).strip(),
            "elements_contenu": "\n".join(col(2)),
            "activites_apprentissage": "\n".join(col(3)),
            "duree_suggeree_pourcent": float(pct) if pct else None,
            "ordre": ordre,
        })
    if orphelines:
        alertes.append(
            f"Compétence {num} : {orphelines} cellule(s) d'activités sans apprentissage associé, "
            "recollée(s) aux activités du dernier apprentissage de leur élément.")
    for s in sugg:
        if s["code_incoherent"]:
            alertes.append(
                f"Compétence {num} : l'apprentissage « {s['code']} » figure dans le groupe de "
                f"l'élément {s['lettre']}. Rattaché à {s['lettre']} par sa position ; "
                "le libellé d'origine est conservé.")
    total = sum(s["duree_suggeree_pourcent"] or 0 for s in sugg)
    if sugg and abs(total - 100) > 0.01:
        alertes.append(f"Compétence {num} : somme des durées suggérées = {total:g} % (attendu 100 %).")
    return sugg


def extraire(chemin):
    alertes = []
    blocs = lire_blocs(chemin)
    comps = table_synthese(blocs, alertes)
    par_num = {c["numero"]: c for c in comps}

    for i, bloc in enumerate(blocs):
        if est_fiche_prescrite(bloc):
            num, par_code, par_lib = numero_du_bloc(bloc)
            if num is None:
                for j in range(i - 1, max(-1, i - 3), -1):
                    num, par_code, par_lib = numero_du_bloc(blocs[j])
                    if num:
                        break
            if num not in par_num:
                alertes.append(f"Fiche prescrite non rattachable (bloc {i}, numéro déduit : {num}).")
                continue
            if par_code and par_lib and par_code != par_lib:
                alertes.append(
                    f"Compétence {par_lib} : sa fiche prescrite porte un code se terminant "
                    f"par {par_code:02d}. Rattachement fait sur le numéro annoncé.")
            if par_num[num]["fiche_prescrite"]:
                alertes.append(f"Compétence {num} : plusieurs fiches prescrites trouvées, la première est retenue.")
                continue
            par_num[num]["fiche_prescrite"] = parse_fiche(bloc[1], alertes, num)

        elif est_suggestions(bloc):
            num = None
            for j in range(i, max(-1, i - 4), -1):
                n, _, _ = numero_du_bloc(blocs[j])
                if n:
                    num = n
                    break
            if num not in par_num:
                alertes.append(f"Tableau de suggestions non rattachable (bloc {i}, numéro déduit : {num}).")
                continue
            if par_num[num]["suggestions"]:
                alertes.append(f"Compétence {num} : plusieurs tableaux de suggestions, le premier est retenu.")
                continue
            par_num[num]["suggestions"] = parse_suggestions(bloc[1], alertes, num)

    if comps:
        alertes.append(
            "Les codes courts (M101, M102...) ne figurent pas dans le document : ils sont "
            "DÉRIVÉS du numéro. Vérifier qu'ils correspondent à l'usage réel du centre.")
        alertes.append(
            "Le cycle (tronc_commun / specialisation) n'est pas dans le document et n'est pas "
            "déductible du code officiel. Le renseigner dans programme.json avant génération : "
            "laissé à null, il ne sera pas écrasé en base mais restera vide pour un nouvel import.")

    for c in comps:
        lettres = {e["lettre"] for e in (c["fiche_prescrite"] or {}).get("elements", [])}
        orphelines = [s for s in c["suggestions"] if s["lettre"] not in lettres]
        if orphelines:
            details = ", ".join(f"{s['code'] or '?'} ({s['lettre']})" for s in orphelines)
            perdu = sum(s["duree_suggeree_pourcent"] or 0 for s in orphelines)
            alertes.append(
                f"BLOQUANT — Compétence {c['numero']} : {len(orphelines)} apprentissage(s) "
                f"rattaché(s) à un élément absent de la fiche prescrite : {details}. "
                f"Éléments existants : {sorted(lettres) or 'aucun'}. "
                f"Ces lignes NE SERONT PAS importées ({perdu:g} % de durée suggérée perdue). "
                "Corriger la fiche prescrite dans programme.json, ou réaffecter ces "
                "apprentissages à un élément existant.")

    for c in comps:
        if not c["fiche_prescrite"]:
            alertes.append(f"Compétence {c['numero']} ({c['code_officiel']}) : aucune fiche prescrite dans le document.")
        if not c["suggestions"]:
            alertes.append(f"Compétence {c['numero']} ({c['code_officiel']}) : aucune suggestion pédagogique dans le document.")

    plat = " ".join(aplati(b) for b in blocs)
    m = re.search(r"dur[ée]e\s+(?:totale|du programme[^.]*?)\D{0,20}(\d{3,4})", plat, re.I)
    duree_annoncee = int(m.group(1)) if m else None
    somme = sum(c["duree_nationale_heures"] or 0 for c in comps)
    if duree_annoncee and duree_annoncee != somme:
        alertes.append(
            f"Le document annonce {duree_annoncee} h de durée totale, mais la somme des "
            f"{len(comps)} compétences vaut {somme} h (écart {duree_annoncee - somme} h). "
            "Les deux valeurs sont conservées sans arbitrage.")

    m = re.search(r"ann[ée]e\s+d.approbation\s*:?\s*(\d{4})", plat, re.I)
    m2 = re.search(r"code\s+du\s+programme\s*:?\s*([A-Z][_A-Z0-9]+)", plat, re.I)
    m3 = re.search(r"fili[èe]re\s*:\s*([^|]{5,80}?)\s*(?:Code|Ann[ée]e|\|)", plat, re.I)

    return {
        "source": os.path.basename(chemin),
        "valide_par_humain": False,
        "specialite": {
            "nom": (m3.group(1).strip().strip("«».\"' ") if m3 else "À COMPLÉTER"),
            "code": (m2.group(1) if m2 else "À COMPLÉTER"),
            "duree_totale_heures": duree_annoncee,
        },
        "programme": {"annee_approbation": int(m.group(1)) if m else None},
        "competences": comps,
        "alertes": alertes,
    }


# --------------------------------------------------------------------- rapport

def rapport(d):
    L = [f"# Rapport de relecture — {d['source']}", "",
         "Relire ce rapport, corriger si besoin `programme.json`, puis y passer",
         "`\"valide_par_humain\": true` avant de lancer `generer-sql`.", "",
         "## Spécialité", "",
         f"- Nom : **{d['specialite']['nom']}**",
         f"- Code : `{d['specialite']['code']}`",
         f"- Durée totale annoncée : {d['specialite']['duree_totale_heures']} h",
         f"- Année d'approbation : {d['programme']['annee_approbation']}", "",
         "## Compétences", "",
         "| N° | Code officiel | M1XX (dérivé) | Cycle (à relire) | Durée | Fiche prescrite | Éléments | Suggestions | Σ % | Intitulé |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for c in d["competences"]:
        f = c["fiche_prescrite"]
        nb_el = len(f["elements"]) if f else 0
        nb_cr = sum(len(e["criteres"]) for e in f["elements"]) if f else 0
        tot = sum(s["duree_suggeree_pourcent"] or 0 for s in c["suggestions"])
        L.append("| {n} | `{c}` | `{op}` | {cy} | {h} h | {fp} | {el} ({cr} critères) | {sg} | {t} | {nom} |".format(
            n=c["numero"], c=c["code_officiel"], op=c.get("code_operationnel") or "—",
            cy=c.get("cycle") or "**à renseigner**", h=c["duree_nationale_heures"],
            fp="oui" if f else "**absente**", el=nb_el, cr=nb_cr,
            sg=len(c["suggestions"]) or "**aucune**",
            t=(f"{tot:g} %" if c["suggestions"] else "—"), nom=c["nom"]))
    L += ["", f"## Points à vérifier ({len(d['alertes'])})", ""]
    L += [f"{i}. {a}" for i, a in enumerate(d["alertes"], 1)] or ["Aucun."]
    return "\n".join(L) + "\n"


# ------------------------------------------------------------------ génération

def sql(d):
    if not d.get("valide_par_humain"):
        sys.exit("Refus : programme.json n'est pas marqué relu.\n"
                 "Relisez rapport-relecture.md, puis passez \"valide_par_humain\": true.")
    q = lambda s: "null" if s in (None, "") else "'" + str(s).replace("'", "''") + "'"
    sp, pr = d["specialite"], d["programme"]
    L = [f"-- Généré par scripts/import_programme.py depuis {d['source']}.",
         "-- Ne pas éditer à la main : régénérer après correction de programme.json.",
         "-- Idempotent.", "",
         f"insert into public.specialites (nom, code, duree_totale_heures) values "
         f"({q(sp['nom'])}, {q(sp['code'])}, {sp['duree_totale_heures'] or 'null'})",
         "on conflict (code) do update set nom = excluded.nom, "
         "duree_totale_heures = excluded.duree_totale_heures;", "",
         f"insert into public.programmes (specialite_id, annee_approbation) "
         f"select id, {pr['annee_approbation'] or 'null'} from public.specialites where code = {q(sp['code'])}",
         "on conflict (specialite_id, annee_approbation) do nothing;", ""]
    PROG = (f"(select p.id from public.programmes p join public.specialites s on s.id = p.specialite_id "
            f"where s.code = {q(sp['code'])} and p.annee_approbation = {pr['annee_approbation'] or 'null'})")
    for c in d["competences"]:
        L.append(f"""insert into public.competences (programme_id, numero, code_officiel, code_operationnel, nom, duree_nationale_heures, cycle)
values ({PROG}, {c['numero']}, {q(c['code_officiel'])}, {q(c.get('code_operationnel'))}, {q(c['nom'])}, {c['duree_nationale_heures'] or 'null'}, {q(c.get('cycle'))})
on conflict (programme_id, numero) do update set code_officiel = excluded.code_officiel,
  nom = excluded.nom, duree_nationale_heures = excluded.duree_nationale_heures,
  -- coalesce : un champ hors référentiel laissé vide dans le JSON ne doit jamais
  -- effacer une valeur déjà saisie en base.
  code_operationnel = coalesce(excluded.code_operationnel, public.competences.code_operationnel),
  cycle = coalesce(excluded.cycle, public.competences.cycle);""")
        f = c["fiche_prescrite"]
        if not f:
            L.append(f"-- Compétence {c['numero']} : aucune fiche prescrite dans le document.\n")
            continue
        emis = set()
        COMP = f"(select id from public.competences where code_officiel = {q(c['code_officiel'])})"
        L.append(f"""insert into public.fiches_prescrites (competence_id, contexte_realisation, criteres_generaux_performance)
values ({COMP}, {q(chr(10).join(f['contexte_realisation']))}, {q(chr(10).join(f['criteres_generaux_performance']))})
on conflict (competence_id) do update set contexte_realisation = excluded.contexte_realisation,
  criteres_generaux_performance = excluded.criteres_generaux_performance;""")
        FICHE = f"(select f.id from public.fiches_prescrites f where f.competence_id = {COMP})"
        for e in f["elements"]:
            L.append(f"""insert into public.elements_competence (fiche_prescrite_id, lettre, intitule, ordre)
values ({FICHE}, {q(e['lettre'])}, {q(e['intitule'])}, {e['ordre']})
on conflict (fiche_prescrite_id, ordre) do update set lettre = excluded.lettre, intitule = excluded.intitule;""")
            ELEM = f"(select e.id from public.elements_competence e where e.fiche_prescrite_id = {FICHE} and e.ordre = {e['ordre']})"
            for j, cr in enumerate(e["criteres"], 1):
                L.append(f"""insert into public.criteres_particuliers_performance (element_competence_id, texte, ordre)
values ({ELEM}, {q(cr)}, {j})
on conflict (element_competence_id, ordre) do update set texte = excluded.texte;""")
            emis.update(id(s) for s in c["suggestions"] if s["lettre"] == e["lettre"])
            for s in [s for s in c["suggestions"] if s["lettre"] == e["lettre"]]:
                L.append(f"""insert into public.suggestions_pedagogiques (element_competence_id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, ordre)
values ({ELEM}, {q(s['code'])}, {q(s['apprentissage_base'])}, {q(s['elements_contenu'])}, {q(s['activites_apprentissage'])}, {s['duree_suggeree_pourcent'] if s['duree_suggeree_pourcent'] is not None else 'null'}, {s['ordre']})
on conflict (element_competence_id, ordre) do update set code = excluded.code,
  apprentissage_base = excluded.apprentissage_base, elements_contenu = excluded.elements_contenu,
  activites_apprentissage = excluded.activites_apprentissage,
  duree_suggeree_pourcent = excluded.duree_suggeree_pourcent;""")
        for s in c["suggestions"]:
            if id(s) not in emis:
                L.append(f"-- NON IMPORTÉ — compétence {c['numero']}, apprentissage "
                         f"{s['code'] or '?'} : l'élément « {s['lettre']} » n'existe pas dans "
                         "la fiche prescrite. Voir rapport-relecture.md.")
        L.append("")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("extraire", help="docx -> programme.json + rapport-relecture.md")
    a.add_argument("docx")
    a.add_argument("--sortie", default="supabase/seed/import")
    b = sub.add_parser("generer-sql", help="programme.json -> programme.sql (exige la relecture)")
    b.add_argument("--sortie", default="supabase/seed/import")
    args = ap.parse_args()

    os.makedirs(args.sortie, exist_ok=True)
    pj = os.path.join(args.sortie, "programme.json")

    if args.cmd == "extraire":
        d = extraire(args.docx)
        json.dump(d, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        rp = os.path.join(args.sortie, "rapport-relecture.md")
        open(rp, "w", encoding="utf-8").write(rapport(d))
        print(f"{pj}\n{rp}")
        print(f"\n{len(d['competences'])} compétence(s), "
              f"{sum(1 for c in d['competences'] if c['fiche_prescrite'])} fiche(s) prescrite(s), "
              f"{len(d['alertes'])} point(s) à vérifier.")
        print("\nAucune donnée n'a été écrite en base. Relisez le rapport, puis passez "
              "\"valide_par_humain\": true dans programme.json avant `generer-sql`.")
    else:
        d = json.load(open(pj, encoding="utf-8"))
        ps = os.path.join(args.sortie, "programme.sql")
        open(ps, "w", encoding="utf-8").write(sql(d))
        print(f"{ps}\n\nAppliquer explicitement :\n  npx supabase db query --linked -f {ps}")


if __name__ == "__main__":
    main()
