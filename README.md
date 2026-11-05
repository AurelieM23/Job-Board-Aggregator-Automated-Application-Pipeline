# 🚀 Job Board Aggregator & Automated Application Pipeline

Un pipeline ETL (Extract, Transform, Load) de bout en bout construit avec n8n, automatisant la veille concurrentielle d'offres d'emploi, le nettoyage des données, et la génération de documents de candidature via LLM.

## 📝 Description du projet
Ce projet automatise l'extraction de données depuis les principaux sites d'emploi français (APEC, Welcome to the Jungle, HelloWork, LinkedIn). Il résout les problèmes classiques du web scraping (HTML dynamique, doublons, données manquantes) pour alimenter une base de données centralisée et générer automatiquement les documents de candidature (CV, Lettres de motivation) via l'IA.

## 🛠️ Stack Technique
* **Orchestration :** [n8n](https://n8n.io/)
* **Scripting :** JavaScript (Regex avancé, manipulation DOM, manipulation JSON)
* **APIs & Intégrations :** Google Drive API, Google Docs API, Google Sheets API
* **IA :** Basic LLM Chain (Prompt Engineering) via OpenAI API

## ✨ Fonctionnalités Clés & Défis Techniques Relevés

### 1. Extraction asynchrone robuste (No-DOM Scraping)
Pour éviter la casse liée aux mises à jour d'UI (React/Angular), les scripts ciblent directement les balises `<script type="application/ld+json">` (Schema.org) et le `dataLayer` (GTM). Fiabilité d'extraction portée à 100%.

### 2. Algorithme de Déduplication Avancé
Création d'un système de clé unique stricte (`entreprise_titre_lieu`) pour croiser les données de 5 plateformes différentes.
* **Gestion des cabinets anonymes :** Fallback intelligent pour générer des IDs valides même si le champ entreprise est vide.
* **Fenêtre temporelle :** Algorithme comparant la date de publication avec l'historique (fenêtre glissante de 21 jours) pour détecter les remises en ligne d'offres (re-posting) sans créer de faux doublons.

### 3. Résilience et Error Handling
Implémentation de sécurités pour éviter les crashs de l'API Google Drive en cas de données manquantes ou d'hallucination du LLM (utilisation de fallbacks systématiques ex: `{{ $json.email.CORPS_MESSAGE || 'Erreur LLM' }}`).

### 4. Génération de Documents Automatisée
Pour chaque offre inédite validée :
1. Analyse de l'offre par un LLM.
2. Création d'un dossier structuré dans Google Drive.
3. Duplication de templates Google Docs (CV / Lettre).
4. Remplacement dynamique des variables par l'IA.

## 🧠 Aperçu du Code : 
### Génération d'ID Strict
```javascript
// Fonction pour la création stricte de l'ID Unique
function createStrictId(entreprise, titre, lieu) {
    function cleanCompany(text) {
        if (!text || String(text).trim() === "") return "";
        let t = String(text);
      // Supprime les notions de service ou direction
        t = t.replace(/\s*-\s*(service|departement|division|direction|international|supply|management|secteur|pole|pôle).*/i, "");
      // Supprime les points (ex: s.a.s. devient sas)
        t = t.replace(/\./g, "");
      // Supprime les codes agences (le "gi" à la fin ignore la casse)
        t = t.replace(/\bfr[0-9]+\b/gi, " ");
      // Normalise, supprime les accents et passe tout en minuscules
        t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      // Supprime les statuts et mots de liaison
        t = t.replace(/\b(sarl|sas|sa|snc|eurl|spa|inc|llc|groupe|group|le|la|les|a|au|aux|de|des|du|et|en|pour|chez)\b/g, ' ');
        return t.replace(/[^a-z0-9]/g, '');
    }

    function cleanStandard(text) {
        if (!text || String(text).trim() === "") return "";
        let t = String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        t = t.replace(/\b(le|la|les|a|au|aux|de|des|du|et|en|pour|chez)\b/g, ' ');
        return t.replace(/[^a-z0-9]/g, '');
    }

    function cleanLocation(text) {
        if (!text || String(text).trim() === "") return "";
        let t = String(text).toLowerCase();
        t = t.replace(/\barr(?:ondissement|\.)?\b/gi, "");
        t = t.replace(/\b\d+(?:er|ème|eme|e)\b/gi, "");
        t = t.replace(/(?:^|\s|-)\d{2}(?:\s|-|$)/g, " ");
        t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        t = t.replace(/[^a-z]/g, '');
        return t.substring(0, 15);
    }
```

## 📈 Statut
En production. Gère plus de 300 offres par mois avec un taux de doublons de 3%.
