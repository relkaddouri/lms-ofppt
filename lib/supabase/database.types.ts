export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annees_scolaires: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string
          formateur_id: string
          id: string
          libelle: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin: string
          formateur_id?: string
          id?: string
          libelle: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string
          formateur_id?: string
          id?: string
          libelle?: string
        }
        Relationships: [
          {
            foreignKeyName: "annees_scolaires_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      annonces: {
        Row: {
          contenu: string | null
          created_at: string
          date: string | null
          groupe_id: string
          id: string
          titre: string
        }
        Insert: {
          contenu?: string | null
          created_at?: string
          date?: string | null
          groupe_id: string
          id?: string
          titre: string
        }
        Update: {
          contenu?: string | null
          created_at?: string
          date?: string | null
          groupe_id?: string
          id?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "annonces_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          ancienne_valeur: Json | null
          date: string
          id: string
          ligne_id: string | null
          nouvelle_valeur: Json | null
          table_name: string
          utilisateur: string | null
        }
        Insert: {
          action: string
          ancienne_valeur?: Json | null
          date?: string
          id?: string
          ligne_id?: string | null
          nouvelle_valeur?: Json | null
          table_name: string
          utilisateur?: string | null
        }
        Update: {
          action?: string
          ancienne_valeur?: Json | null
          date?: string
          id?: string
          ligne_id?: string | null
          nouvelle_valeur?: Json | null
          table_name?: string
          utilisateur?: string | null
        }
        Relationships: []
      }
      commentaires_annonce: {
        Row: {
          annonce_id: string
          auteur_id: string
          created_at: string
          id: string
          texte: string
        }
        Insert: {
          annonce_id: string
          auteur_id?: string
          created_at?: string
          id?: string
          texte: string
        }
        Update: {
          annonce_id?: string
          auteur_id?: string
          created_at?: string
          id?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "commentaires_annonce_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
        ]
      }
      competences: {
        Row: {
          code_officiel: string
          code_operationnel: string | null
          code_operationnel_surcharge: string | null
          competences_paralleles: string | null
          competences_prealables: string | null
          created_at: string
          cycle: string | null
          description_generale: string | null
          duree_nationale_heures: number | null
          enonce_competence: string | null
          id: string
          nom: string
          numero: number
          pct_evaluation: number | null
          pct_pratique: number | null
          pct_theorique: number | null
          programme_id: string
          rang_cycle: number
        }
        Insert: {
          code_officiel: string
          code_operationnel?: string | null
          code_operationnel_surcharge?: string | null
          competences_paralleles?: string | null
          competences_prealables?: string | null
          created_at?: string
          cycle?: string | null
          description_generale?: string | null
          duree_nationale_heures?: number | null
          enonce_competence?: string | null
          id?: string
          nom: string
          numero: number
          pct_evaluation?: number | null
          pct_pratique?: number | null
          pct_theorique?: number | null
          programme_id: string
          rang_cycle: number
        }
        Update: {
          code_officiel?: string
          code_operationnel?: string | null
          code_operationnel_surcharge?: string | null
          competences_paralleles?: string | null
          competences_prealables?: string | null
          created_at?: string
          cycle?: string | null
          description_generale?: string | null
          duree_nationale_heures?: number | null
          enonce_competence?: string | null
          id?: string
          nom?: string
          numero?: number
          pct_evaluation?: number | null
          pct_pratique?: number | null
          pct_theorique?: number | null
          programme_id?: string
          rang_cycle?: number
        }
        Relationships: [
          {
            foreignKeyName: "competences_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      controles: {
        Row: {
          consignes: string | null
          created_at: string
          date_administration: string | null
          date_envoi_propositions: string | null
          date_prevue: string | null
          duree_heures: number
          format: string
          groupe_id: string
          id: string
          module_id: string
          statut: string
          titre: string | null
          type: string
          type_efm: string | null
        }
        Insert: {
          consignes?: string | null
          created_at?: string
          date_administration?: string | null
          date_envoi_propositions?: string | null
          date_prevue?: string | null
          duree_heures?: number
          format?: string
          groupe_id: string
          id?: string
          module_id: string
          statut?: string
          titre?: string | null
          type?: string
          type_efm?: string | null
        }
        Update: {
          consignes?: string | null
          created_at?: string
          date_administration?: string | null
          date_envoi_propositions?: string | null
          date_prevue?: string | null
          duree_heures?: number
          format?: string
          groupe_id?: string
          id?: string
          module_id?: string
          statut?: string
          titre?: string | null
          type?: string
          type_efm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controles_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controles_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      corrections_tp: {
        Row: {
          contenu: Json
          created_at: string
          id: string
          partagee_avec_stagiaires: boolean
          seance_id: string
          version: number
        }
        Insert: {
          contenu: Json
          created_at?: string
          id?: string
          partagee_avec_stagiaires?: boolean
          seance_id: string
          version?: number
        }
        Update: {
          contenu?: Json
          created_at?: string
          id?: string
          partagee_avec_stagiaires?: boolean
          seance_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "corrections_tp_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      creneaux_motif: {
        Row: {
          created_at: string
          groupe_id: string
          heure_debut: string
          heure_fin: string
          id: string
          jour_semaine: number
          motif_id: string
        }
        Insert: {
          created_at?: string
          groupe_id: string
          heure_debut: string
          heure_fin: string
          id?: string
          jour_semaine: number
          motif_id: string
        }
        Update: {
          created_at?: string
          groupe_id?: string
          heure_debut?: string
          heure_fin?: string
          id?: string
          jour_semaine?: number
          motif_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creneaux_motif_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creneaux_motif_motif_id_fkey"
            columns: ["motif_id"]
            isOneToOne: false
            referencedRelation: "motifs_hebdomadaires"
            referencedColumns: ["id"]
          },
        ]
      }
      criteres_particuliers_performance: {
        Row: {
          created_at: string
          element_competence_id: string
          id: string
          ordre: number
          texte: string
        }
        Insert: {
          created_at?: string
          element_competence_id: string
          id?: string
          ordre: number
          texte: string
        }
        Update: {
          created_at?: string
          element_competence_id?: string
          id?: string
          ordre?: number
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "criteres_particuliers_performance_element_competence_id_fkey"
            columns: ["element_competence_id"]
            isOneToOne: false
            referencedRelation: "elements_competence"
            referencedColumns: ["id"]
          },
        ]
      }
      devoirs: {
        Row: {
          created_at: string
          date_echeance: string | null
          description: string | null
          groupe_id: string
          id: string
          module_id: string | null
          seance_id: string | null
          titre: string
          type_rendu: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_echeance?: string | null
          description?: string | null
          groupe_id: string
          id?: string
          module_id?: string | null
          seance_id?: string | null
          titre: string
          type_rendu?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_echeance?: string | null
          description?: string | null
          groupe_id?: string
          id?: string
          module_id?: string | null
          seance_id?: string | null
          titre?: string
          type_rendu?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoirs_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoirs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoirs_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      devoirs_rendus: {
        Row: {
          contenu: string | null
          created_at: string
          date_rendu: string | null
          devoir_id: string
          fichier_chemin: string | null
          fichier_nom: string | null
          fichier_taille: number | null
          id: string
          stagiaire_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          contenu?: string | null
          created_at?: string
          date_rendu?: string | null
          devoir_id: string
          fichier_chemin?: string | null
          fichier_nom?: string | null
          fichier_taille?: number | null
          id?: string
          stagiaire_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          contenu?: string | null
          created_at?: string
          date_rendu?: string | null
          devoir_id?: string
          fichier_chemin?: string | null
          fichier_nom?: string | null
          fichier_taille?: number | null
          id?: string
          stagiaire_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoirs_rendus_devoir_id_fkey"
            columns: ["devoir_id"]
            isOneToOne: false
            referencedRelation: "devoirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoirs_rendus_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: false
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_stage: {
        Row: {
          chemin: string
          created_at: string
          id: string
          nom_fichier: string
          stage_id: string
          taille_octets: number | null
          type: string
        }
        Insert: {
          chemin: string
          created_at?: string
          id?: string
          nom_fichier: string
          stage_id: string
          taille_octets?: number | null
          type: string
        }
        Update: {
          chemin?: string
          created_at?: string
          id?: string
          nom_fichier?: string
          stage_id?: string
          taille_octets?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_stage_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      elements_competence: {
        Row: {
          created_at: string
          fiche_prescrite_id: string
          id: string
          intitule: string
          lettre: string
          ordre: number
        }
        Insert: {
          created_at?: string
          fiche_prescrite_id: string
          id?: string
          intitule: string
          lettre: string
          ordre: number
        }
        Update: {
          created_at?: string
          fiche_prescrite_id?: string
          id?: string
          intitule?: string
          lettre?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "elements_competence_fiche_prescrite_id_fkey"
            columns: ["fiche_prescrite_id"]
            isOneToOne: false
            referencedRelation: "fiches_prescrites"
            referencedColumns: ["id"]
          },
        ]
      }
      elements_contenu: {
        Row: {
          created_at: string
          id: string
          intitule: string
          ordre: number
          suggestion_pedagogique_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intitule: string
          ordre: number
          suggestion_pedagogique_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intitule?: string
          ordre?: number
          suggestion_pedagogique_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elements_contenu_suggestion_pedagogique_id_fkey"
            columns: ["suggestion_pedagogique_id"]
            isOneToOne: false
            referencedRelation: "suggestions_pedagogiques"
            referencedColumns: ["id"]
          },
        ]
      }
      fiches_preparation: {
        Row: {
          contenu: string | null
          created_at: string
          id: string
          seance_id: string
          version: number
        }
        Insert: {
          contenu?: string | null
          created_at?: string
          id?: string
          seance_id: string
          version?: number
        }
        Update: {
          contenu?: string | null
          created_at?: string
          id?: string
          seance_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiches_preparation_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      fiches_prescrites: {
        Row: {
          competence_id: string
          contexte_realisation: string | null
          created_at: string
          criteres_generaux_performance: string | null
          id: string
        }
        Insert: {
          competence_id: string
          contexte_realisation?: string | null
          created_at?: string
          criteres_generaux_performance?: string | null
          id?: string
        }
        Update: {
          competence_id?: string
          contexte_realisation?: string | null
          created_at?: string
          criteres_generaux_performance?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiches_prescrites_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: true
            referencedRelation: "competences"
            referencedColumns: ["id"]
          },
        ]
      }
      groupe_modules: {
        Row: {
          created_at: string
          fad_mutualisee: boolean
          fad_s1: number
          fad_s2: number
          formateur_id: string | null
          groupe_id: string
          heures_fad: number | null
          masse_horaire_allouee: number | null
          module_id: string
          presentiel_s1: number
          presentiel_s2: number
          type_efm: string | null
        }
        Insert: {
          created_at?: string
          fad_mutualisee?: boolean
          fad_s1?: number
          fad_s2?: number
          formateur_id?: string | null
          groupe_id: string
          heures_fad?: number | null
          masse_horaire_allouee?: number | null
          module_id: string
          presentiel_s1?: number
          presentiel_s2?: number
          type_efm?: string | null
        }
        Update: {
          created_at?: string
          fad_mutualisee?: boolean
          fad_s1?: number
          fad_s2?: number
          formateur_id?: string | null
          groupe_id?: string
          heures_fad?: number | null
          masse_horaire_allouee?: number | null
          module_id?: string
          presentiel_s1?: number
          presentiel_s2?: number
          type_efm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groupe_modules_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupe_modules_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupe_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      groupes: {
        Row: {
          annee: number | null
          annee_scolaire_id: string | null
          created_at: string
          formateur_id: string | null
          id: string
          nom: string
          specialite_id: string | null
        }
        Insert: {
          annee?: number | null
          annee_scolaire_id?: string | null
          created_at?: string
          formateur_id?: string | null
          id?: string
          nom: string
          specialite_id?: string | null
        }
        Update: {
          annee?: number | null
          annee_scolaire_id?: string | null
          created_at?: string
          formateur_id?: string | null
          id?: string
          nom?: string
          specialite_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groupes_annee_scolaire_id_fkey"
            columns: ["annee_scolaire_id"]
            isOneToOne: false
            referencedRelation: "annees_scolaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupes_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupes_specialite_id_fkey"
            columns: ["specialite_id"]
            isOneToOne: false
            referencedRelation: "specialites"
            referencedColumns: ["id"]
          },
        ]
      }
      indisponibilites: {
        Row: {
          annee_scolaire_id: string | null
          created_at: string
          date_debut: string
          date_fin: string
          demi_journee: string | null
          formateur_id: string
          id: string
          libelle: string | null
          motif: string | null
          type: string
        }
        Insert: {
          annee_scolaire_id?: string | null
          created_at?: string
          date_debut: string
          date_fin: string
          demi_journee?: string | null
          formateur_id?: string
          id?: string
          libelle?: string | null
          motif?: string | null
          type: string
        }
        Update: {
          annee_scolaire_id?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string
          demi_journee?: string | null
          formateur_id?: string
          id?: string
          libelle?: string | null
          motif?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "indisponibilites_annee_scolaire_id_fkey"
            columns: ["annee_scolaire_id"]
            isOneToOne: false
            referencedRelation: "annees_scolaires"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          competence_id: string | null
          created_at: string
          description: string | null
          duree_reference: number
          formateur_id: string | null
          id: string
          nom: string
        }
        Insert: {
          competence_id?: string | null
          created_at?: string
          description?: string | null
          duree_reference?: number
          formateur_id?: string | null
          id?: string
          nom: string
        }
        Update: {
          competence_id?: string | null
          created_at?: string
          description?: string | null
          duree_reference?: number
          formateur_id?: string | null
          id?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_competence_id_fkey"
            columns: ["competence_id"]
            isOneToOne: false
            referencedRelation: "competences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      motifs_hebdomadaires: {
        Row: {
          annee_scolaire_id: string | null
          created_at: string
          date_debut: string
          date_fin: string | null
          formateur_id: string
          id: string
          libelle: string | null
        }
        Insert: {
          annee_scolaire_id?: string | null
          created_at?: string
          date_debut: string
          date_fin?: string | null
          formateur_id: string
          id?: string
          libelle?: string | null
        }
        Update: {
          annee_scolaire_id?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          formateur_id?: string
          id?: string
          libelle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motifs_hebdomadaires_annee_scolaire_id_fkey"
            columns: ["annee_scolaire_id"]
            isOneToOne: false
            referencedRelation: "annees_scolaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motifs_hebdomadaires_formateur_id_fkey"
            columns: ["formateur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres_formateur: {
        Row: {
          annee_scolaire: string | null
          annee_scolaire_courante: string | null
          code_secteur: string | null
          created_at: string
          etablissement: string | null
          formateur_id: string
          heures_annuelles: number
          heures_hebdomadaires: number
          heures_sup_actives: boolean
          id: string
          logo_etablissement: string | null
          matricule: string | null
          niveau_formation: string | null
          nom_formateur: string | null
          plafond_sup_annuel: number
          plafond_sup_mensuel: number
          updated_at: string
        }
        Insert: {
          annee_scolaire?: string | null
          annee_scolaire_courante?: string | null
          code_secteur?: string | null
          created_at?: string
          etablissement?: string | null
          formateur_id?: string
          heures_annuelles?: number
          heures_hebdomadaires?: number
          heures_sup_actives?: boolean
          id?: string
          logo_etablissement?: string | null
          matricule?: string | null
          niveau_formation?: string | null
          nom_formateur?: string | null
          plafond_sup_annuel?: number
          plafond_sup_mensuel?: number
          updated_at?: string
        }
        Update: {
          annee_scolaire?: string | null
          annee_scolaire_courante?: string | null
          code_secteur?: string | null
          created_at?: string
          etablissement?: string | null
          formateur_id?: string
          heures_annuelles?: number
          heures_hebdomadaires?: number
          heures_sup_actives?: boolean
          id?: string
          logo_etablissement?: string | null
          matricule?: string | null
          niveau_formation?: string | null
          nom_formateur?: string | null
          plafond_sup_annuel?: number
          plafond_sup_mensuel?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametres_formateur_annee_scolaire_courante_fkey"
            columns: ["annee_scolaire_courante"]
            isOneToOne: false
            referencedRelation: "annees_scolaires"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres_llm: {
        Row: {
          base_url: string | null
          cle_secret_id: string | null
          created_at: string
          formateur_id: string
          fournisseur: string
          id: string
          max_tokens: number
          modele: string
          temperature: number | null
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          cle_secret_id?: string | null
          created_at?: string
          formateur_id: string
          fournisseur: string
          id?: string
          max_tokens?: number
          modele: string
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          cle_secret_id?: string | null
          created_at?: string
          formateur_id?: string
          fournisseur?: string
          id?: string
          max_tokens?: number
          modele?: string
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      passations_controle: {
        Row: {
          controle_id: string
          created_at: string
          email: string | null
          id: string
          nom_complet: string
          note: number | null
          publie_le: string | null
          responses: Json | null
          stagiaire_id: string | null
          submitted_at: string | null
        }
        Insert: {
          controle_id: string
          created_at?: string
          email?: string | null
          id?: string
          nom_complet: string
          note?: number | null
          publie_le?: string | null
          responses?: Json | null
          stagiaire_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          controle_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nom_complet?: string
          note?: number | null
          publie_le?: string | null
          responses?: Json | null
          stagiaire_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passations_controle_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passations_controle_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: false
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      presences: {
        Row: {
          created_at: string
          id: string
          motif: string | null
          present: boolean
          seance_id: string
          stagiaire_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          motif?: string | null
          present?: boolean
          seance_id: string
          stagiaire_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          motif?: string | null
          present?: boolean
          seance_id?: string
          stagiaire_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presences_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: false
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      profils: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          annee_approbation: number | null
          created_at: string
          id: string
          specialite_id: string
        }
        Insert: {
          annee_approbation?: number | null
          created_at?: string
          id?: string
          specialite_id: string
        }
        Update: {
          annee_approbation?: number | null
          created_at?: string
          id?: string
          specialite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_specialite_id_fkey"
            columns: ["specialite_id"]
            isOneToOne: false
            referencedRelation: "specialites"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_controle: {
        Row: {
          bareme: number
          controle_id: string
          corrige: string | null
          difficulte: string | null
          enonce: string | null
          id: string
          justification_bareme: string | null
          options: Json | null
          position: number
          type: string
        }
        Insert: {
          bareme?: number
          controle_id: string
          corrige?: string | null
          difficulte?: string | null
          enonce?: string | null
          id?: string
          justification_bareme?: string | null
          options?: Json | null
          position?: number
          type?: string
        }
        Update: {
          bareme?: number
          controle_id?: string
          corrige?: string | null
          difficulte?: string | null
          enonce?: string | null
          id?: string
          justification_bareme?: string | null
          options?: Json | null
          position?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_controle_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_support: {
        Row: {
          annee_scolaire: string
          auteur_id: string
          created_at: string
          formateur_id: string
          groupe_id: string | null
          id: string
          module_id: string
          support_id: string | null
          support_titre: string
          texte: string
        }
        Insert: {
          annee_scolaire: string
          auteur_id: string
          created_at?: string
          formateur_id: string
          groupe_id?: string | null
          id?: string
          module_id: string
          support_id?: string | null
          support_titre: string
          texte: string
        }
        Update: {
          annee_scolaire?: string
          auteur_id?: string
          created_at?: string
          formateur_id?: string
          groupe_id?: string | null
          id?: string
          module_id?: string
          support_id?: string | null
          support_titre?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_support_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_support_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_support_support_id_fkey"
            columns: ["support_id"]
            isOneToOne: false
            referencedRelation: "supports_seance"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions_annonce: {
        Row: {
          annonce_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          annonce_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          annonce_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_annonce_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
        ]
      }
      remarques_seance: {
        Row: {
          created_at: string
          id: string
          seance_id: string
          texte: string
        }
        Insert: {
          created_at?: string
          id?: string
          seance_id: string
          texte: string
        }
        Update: {
          created_at?: string
          id?: string
          seance_id?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "remarques_seance_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      repartition_horaire: {
        Row: {
          created_at: string
          groupe_id: string
          heures_pratiques: number
          heures_theoriques: number
          id: string
          module_id: string
          suggestion_pedagogique_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          groupe_id: string
          heures_pratiques?: number
          heures_theoriques?: number
          id?: string
          module_id: string
          suggestion_pedagogique_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          groupe_id?: string
          heures_pratiques?: number
          heures_theoriques?: number
          id?: string
          module_id?: string
          suggestion_pedagogique_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repartition_horaire_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repartition_horaire_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repartition_horaire_suggestion_pedagogique_id_fkey"
            columns: ["suggestion_pedagogique_id"]
            isOneToOne: false
            referencedRelation: "suggestions_pedagogiques"
            referencedColumns: ["id"]
          },
        ]
      }
      reponses_question: {
        Row: {
          auteur_id: string
          created_at: string
          id: string
          question_id: string
          texte: string
        }
        Insert: {
          auteur_id: string
          created_at?: string
          id?: string
          question_id: string
          texte: string
        }
        Update: {
          auteur_id?: string
          created_at?: string
          id?: string
          question_id?: string
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "reponses_question_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_support"
            referencedColumns: ["id"]
          },
        ]
      }
      rythmes_hebdomadaires: {
        Row: {
          annee_scolaire_id: string | null
          created_at: string
          date_debut: string
          date_fin: string
          formateur_id: string
          heures_cible: number
          id: string
        }
        Insert: {
          annee_scolaire_id?: string | null
          created_at?: string
          date_debut: string
          date_fin: string
          formateur_id?: string
          heures_cible: number
          id?: string
        }
        Update: {
          annee_scolaire_id?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string
          formateur_id?: string
          heures_cible?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rythmes_hebdomadaires_annee_scolaire_id_fkey"
            columns: ["annee_scolaire_id"]
            isOneToOne: false
            referencedRelation: "annees_scolaires"
            referencedColumns: ["id"]
          },
        ]
      }
      seance_elements_contenu: {
        Row: {
          created_at: string
          element_contenu_id: string
          seance_id: string
        }
        Insert: {
          created_at?: string
          element_contenu_id: string
          seance_id: string
        }
        Update: {
          created_at?: string
          element_contenu_id?: string
          seance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seance_elements_contenu_element_contenu_id_fkey"
            columns: ["element_contenu_id"]
            isOneToOne: false
            referencedRelation: "elements_contenu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seance_elements_contenu_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      seance_groupes: {
        Row: {
          created_at: string
          groupe_id: string
          seance_id: string
        }
        Insert: {
          created_at?: string
          groupe_id: string
          seance_id: string
        }
        Update: {
          created_at?: string
          groupe_id?: string
          seance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seance_groupes_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seance_groupes_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
      seances: {
        Row: {
          a_prevoir_prochaine_seance: string | null
          contenu_prevu: string | null
          contenu_realise: string | null
          contenu_source_id: string | null
          created_at: string
          cree_par: string | null
          date: string | null
          duree_prevue: number | null
          duree_realisee: number | null
          est_fad: boolean
          heure_debut: string | null
          heure_fin: string | null
          id: string
          lien_teams: string | null
          module_id: string
          nature: string | null
          objectif_operationnel: string | null
          phase_courante: number
          statut: string
          suggestion_pedagogique_id: string | null
          updated_at: string | null
        }
        Insert: {
          a_prevoir_prochaine_seance?: string | null
          contenu_prevu?: string | null
          contenu_realise?: string | null
          contenu_source_id?: string | null
          created_at?: string
          cree_par?: string | null
          date?: string | null
          duree_prevue?: number | null
          duree_realisee?: number | null
          est_fad?: boolean
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          lien_teams?: string | null
          module_id: string
          nature?: string | null
          objectif_operationnel?: string | null
          phase_courante?: number
          statut?: string
          suggestion_pedagogique_id?: string | null
          updated_at?: string | null
        }
        Update: {
          a_prevoir_prochaine_seance?: string | null
          contenu_prevu?: string | null
          contenu_realise?: string | null
          contenu_source_id?: string | null
          created_at?: string
          cree_par?: string | null
          date?: string | null
          duree_prevue?: number | null
          duree_realisee?: number | null
          est_fad?: boolean
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          lien_teams?: string | null
          module_id?: string
          nature?: string | null
          objectif_operationnel?: string | null
          phase_courante?: number
          statut?: string
          suggestion_pedagogique_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seances_contenu_source_id_fkey"
            columns: ["contenu_source_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seances_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seances_suggestion_pedagogique_id_fkey"
            columns: ["suggestion_pedagogique_id"]
            isOneToOne: false
            referencedRelation: "suggestions_pedagogiques"
            referencedColumns: ["id"]
          },
        ]
      }
      specialites: {
        Row: {
          code: string
          created_at: string
          duree_totale_heures: number | null
          id: string
          nom: string
        }
        Insert: {
          code: string
          created_at?: string
          duree_totale_heures?: number | null
          id?: string
          nom: string
        }
        Update: {
          code?: string
          created_at?: string
          duree_totale_heures?: number | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          created_at: string
          date_debut: string | null
          date_fin: string | null
          date_soutenance: string | null
          entreprise: string | null
          id: string
          jury: string | null
          note_expose_fond: number | null
          note_expose_forme: number | null
          note_rapport_contenu: number | null
          note_rapport_presentation: number | null
          stagiaire_id: string
          tuteur_contact: string | null
          tuteur_nom: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_soutenance?: string | null
          entreprise?: string | null
          id?: string
          jury?: string | null
          note_expose_fond?: number | null
          note_expose_forme?: number | null
          note_rapport_contenu?: number | null
          note_rapport_presentation?: number | null
          stagiaire_id: string
          tuteur_contact?: string | null
          tuteur_nom?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_soutenance?: string | null
          entreprise?: string | null
          id?: string
          jury?: string | null
          note_expose_fond?: number | null
          note_expose_forme?: number | null
          note_rapport_contenu?: number | null
          note_rapport_presentation?: number | null
          stagiaire_id?: string
          tuteur_contact?: string | null
          tuteur_nom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: true
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      stagiaires: {
        Row: {
          cef: string | null
          created_at: string
          email: string | null
          groupe_id: string | null
          id: string
          nom: string
          prenom: string
          user_id: string | null
        }
        Insert: {
          cef?: string | null
          created_at?: string
          email?: string | null
          groupe_id?: string | null
          id?: string
          nom: string
          prenom: string
          user_id?: string | null
        }
        Update: {
          cef?: string | null
          created_at?: string
          email?: string | null
          groupe_id?: string | null
          id?: string
          nom?: string
          prenom?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stagiaires_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions_pedagogiques: {
        Row: {
          activites_apprentissage: string | null
          apprentissage_base: string
          asynchrone: boolean
          code: string | null
          created_at: string
          duree_suggeree_pourcent: number | null
          element_competence_id: string
          elements_contenu: string | null
          id: string
          ordre: number
          presentiel: boolean
          synchrone: boolean
        }
        Insert: {
          activites_apprentissage?: string | null
          apprentissage_base: string
          asynchrone?: boolean
          code?: string | null
          created_at?: string
          duree_suggeree_pourcent?: number | null
          element_competence_id: string
          elements_contenu?: string | null
          id?: string
          ordre: number
          presentiel?: boolean
          synchrone?: boolean
        }
        Update: {
          activites_apprentissage?: string | null
          apprentissage_base?: string
          asynchrone?: boolean
          code?: string | null
          created_at?: string
          duree_suggeree_pourcent?: number | null
          element_competence_id?: string
          elements_contenu?: string | null
          id?: string
          ordre?: number
          presentiel?: boolean
          synchrone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_pedagogiques_element_competence_id_fkey"
            columns: ["element_competence_id"]
            isOneToOne: false
            referencedRelation: "elements_competence"
            referencedColumns: ["id"]
          },
        ]
      }
      supports_seance: {
        Row: {
          contenu: Json
          created_at: string
          destinataire: string
          id: string
          seance_id: string
          type: string
          version: number
        }
        Insert: {
          contenu: Json
          created_at?: string
          destinataire?: string
          id?: string
          seance_id: string
          type: string
          version?: number
        }
        Update: {
          contenu?: Json
          created_at?: string
          destinataire?: string
          id?: string
          seance_id?: string
          type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supports_seance_seance_id_fkey"
            columns: ["seance_id"]
            isOneToOne: false
            referencedRelation: "seances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_mes_remises: {
        Row: {
          controle_id: string | null
          id: string | null
          resultat_publie: boolean | null
          stagiaire_id: string | null
          submitted_at: string | null
        }
        Insert: {
          controle_id?: string | null
          id?: string | null
          resultat_publie?: never
          stagiaire_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          controle_id?: string | null
          id?: string | null
          resultat_publie?: never
          stagiaire_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passations_controle_controle_id_fkey"
            columns: ["controle_id"]
            isOneToOne: false
            referencedRelation: "controles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passations_controle_stagiaire_id_fkey"
            columns: ["stagiaire_id"]
            isOneToOne: false
            referencedRelation: "stagiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      v_progression_module: {
        Row: {
          groupe_id: string | null
          heures_fad_prevues: number | null
          heures_fad_realisees: number | null
          heures_presentiel_prevues: number | null
          heures_presentiel_realisees: number | null
          heures_realisees: number | null
          masse_horaire_allouee: number | null
          module_id: string | null
          nb_seances: number | null
          nb_seances_faites: number | null
          nb_seances_sans_duree: number | null
        }
        Relationships: [
          {
            foreignKeyName: "groupe_modules_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupe_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      annee_scolaire: { Args: { p_date: string }; Returns: string }
      annee_scolaire_par_defaut: { Args: never; Returns: string }
      choisir_annee_scolaire: {
        Args: { p_annee_id: string }
        Returns: undefined
      }
      code_operationnel_derive: {
        Args: { p_cycle: string; p_rang: number }
        Returns: string
      }
      corriger_passation: {
        Args: { p_note: number; p_passation_id: string; p_responses: Json }
        Returns: undefined
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      dupliquer_annee: {
        Args: {
          p_annee_source: string
          p_groupe_ids: string[]
          p_libelle: string
        }
        Returns: string
      }
      email_du_cef: { Args: { p_cef: string }; Returns: string }
      enregistrer_parametres_llm: {
        Args: {
          p_base_url?: string
          p_cle?: string
          p_fournisseur: string
          p_max_tokens?: number
          p_modele: string
          p_temperature?: number
        }
        Returns: undefined
      }
      enregistrer_passation: {
        Args: { p_controle_id: string; p_details: Json }
        Returns: Json
      }
      est_mon_stagiaire: { Args: { p_stagiaire_id: string }; Returns: boolean }
      get_sujet_pour_passation: {
        Args: { p_controle_id: string }
        Returns: {
          bareme: number
          enonce: string
          id: string
          options: Json
          position: number
          type: string
        }[]
      }
      groupe_du_stagiaire: { Args: never; Returns: string }
      lire_cle_llm: {
        Args: { p_formateur: string }
        Returns: {
          base_url: string
          cle: string
          fournisseur: string
          max_tokens: number
          modele: string
          temperature: number
        }[]
      }
      lire_parametres_llm: {
        Args: never
        Returns: {
          base_url: string
          cle_definie: boolean
          fournisseur: string
          max_tokens: number
          modele: string
          temperature: number
          updated_at: string
        }[]
      }
      ouvrir_motif: {
        Args: { p_date_debut: string; p_libelle: string }
        Returns: string
      }
      peut_acceder_annonce: { Args: { p_annonce_id: string }; Returns: boolean }
      peut_acceder_audit: {
        Args: { p_ligne: string; p_table: string }
        Returns: boolean
      }
      peut_acceder_controle: {
        Args: { p_controle_id: string }
        Returns: boolean
      }
      peut_acceder_devoir: { Args: { p_devoir_id: string }; Returns: boolean }
      peut_acceder_groupe: { Args: { p_groupe_id: string }; Returns: boolean }
      peut_acceder_module: { Args: { p_module_id: string }; Returns: boolean }
      peut_acceder_question: {
        Args: { p_question_id: string }
        Returns: boolean
      }
      peut_acceder_seance: { Args: { p_seance_id: string }; Returns: boolean }
      peut_acceder_stage: { Args: { p_stage_id: string }; Returns: boolean }
      peut_lire_devoir: { Args: { p_devoir_id: string }; Returns: boolean }
      poser_question_support: {
        Args: { p_support_id: string; p_texte: string }
        Returns: string
      }
      repondre_question: {
        Args: { p_question_id: string; p_texte: string }
        Returns: string
      }
      supprimer_cle_llm: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
