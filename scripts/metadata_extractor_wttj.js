const newItems = [];

// ==========================================
// 1. FONCTIONS UTILITAIRES GLOBALES
// ==========================================

// Fonction pour nettoyer les titres (H/F, codes internes, niveaux d'études)
function cleanTitle(title) {
    if (!title) return "";
    let t = String(title);

    // Supprime les codes internes sans tiret (ex: "Vp 110 Bis ")
    t = t.replace(/^(?:ref|req|id|offre|vp|poste|job)?\s*#?[A-Z0-9_]*\d{2,10}[A-Z0-9_]*\s*(?:bis|ter)?\s*[-_:/|]?\s*/i, "");
    // Supprime les codes avec tiret (ex: "CS27- ")
    t = t.replace(/^[A-Z0-9]{2,10}\s*[-_:/|]+\s*/i, "");
    // Supprime les mentions H/F, F/H/X, (H/F/NB) etc.
    t = t.replace(/[-\(\s]*\b([HhFfNnBbXx]\s*[\/\vert{}&,-]\s*)+[HhFfNnBbXx]+\b[\)\s]*/g, '');
    t = t.replace(/[-\(\s]*\b[HhFf]\s*[\/\vert{}&,-]\s*[HhFf]\b[\)\s]*/g, '');
    // Supprime les mentions de diplômes
    t = t.replace(/\bBac\s*\+\s*\d(?:[\/-]\d)?\b/gi, '');
    // Supprime les hashtags et codes à la fin
    t = t.replace(/(?:#\w+|\b[A-Z]*\d+[A-Z0-9]*\b)\s*$/i, '');

    return t.replace(/^[- \t]+|[- \t]+$/g, '').replace(/\s{2,}/g, " ").trim();
}

// Fonction pour formater la date en YYYY-MM-DD
function formatDate(dStr) {
    if (!dStr) return "";
    try { 
        const dateObj = new Date(dStr);
        if (isNaN(dateObj.getTime())) return "";
        return dateObj.toISOString().split('T')[0]; 
    } catch(e) { return ""; }
}

// Fonction pour purger les null, undefined ou vides
function cleanEmpty(val) {
    if (val === null || val === undefined || String(val).trim() === "") return "";
    return String(val).trim();
}

// Fonction de formatage visuel du lieu (Pour le CSV)
function formatLieuVisuel(locationStr) {
    if (!locationStr) return "";
    let loc = String(locationStr);
    loc = loc.split(',')[0].split('(')[0];
    loc = loc.split(' -')[0].split('- ')[0];
    loc = loc.replace(/\b\d+(?:er|ème|eme|e)\b/gi, "");
    loc = loc.replace(/\barr(?:ondissement|\.)?\b/gi, "");
    loc = loc.replace(/\b\d+\b/g, "");
    return loc.replace(/^[- \t,]+|[- \t,]+$/g, '').replace(/\s{2,}/g, " ").trim();
}

// --- GÉNÉRATION STRICTE DE L'ID UNIQUE ---
function createStrictId(entreprise, titre, lieu) {
    function cleanCompany(text) {
        if (!text || String(text).trim() === "") return "";
        let t = String(text);
        t = t.replace(/\s*-\s*(service|departement|division|direction|international|supply|management|secteur|pole|pôle).*/i, "");
        t = t.replace(/\./g, "");
        t = t.replace(/\bfr[0-9]+\b/gi, " ");
        t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

    const cleanComp = cleanCompany(entreprise);
    const cleanTitle = cleanStandard(titre);
    const cleanLoc = cleanLocation(lieu);

    if (cleanTitle) {
        return `${cleanComp}_${cleanTitle}_${cleanLoc}`;
    }
    return "erreur_id_" + Math.floor(Math.random() * 100000);
}


// ==========================================
// 2. BOUCLE DE TRAITEMENT DES OFFRES
// ==========================================

for (const item of $input.all()) {
    const data = item.json;
    
    // Extraction des données de base selon le format WTTJ Apify
    let titre = cleanTitle(data.name);
    let entreprise = data.organization ? cleanEmpty(data.organization.name) : "";
    let lieu_brut = data.office ? cleanEmpty(data.office.city) : "";
    
    // Nettoyage visuel de la ville
    let lieu = formatLieuVisuel(lieu_brut);

    // Génération de l'ID unique
    let id_unique = createStrictId(entreprise, titre, lieu);
    
    // Fallback si plantage de l'ID (on garde la réf WTTJ par sécurité)
    if (id_unique.startsWith("erreur_id_") && data.reference) {
        id_unique = "WTTJ_" + data.reference;
    }

    // Type de contrat
    let contrat = "";
    if (data.contract_type_names && data.contract_type_names.fr) {
        contrat = data.contract_type_names.fr;
    } else if (data.contract_type) {
        contrat = data.contract_type;
    }

    // Salaire
    let salaire = "";
    if (data.salary_min && data.salary_max) {
        salaire = `${data.salary_min} - ${data.salary_max} ${data.salary_currency || "€"}`;
    }

    let date = formatDate(data.published_at);
    let url_offre = cleanEmpty(data.publicUrl);
    let url_apply = cleanEmpty(data.apply_url);
    
    // ==========================================
    // 3. ENRICHISSEMENTS : DESCRIPTION & PROFIL
    // ==========================================
    
    let description_complete = cleanEmpty(data.description_text); 
    let profil_recherche = "";

    // A. ENRICHISSEMENT DU PROFIL RECHERCHÉ (Expérience au début)

    let experienceString = "";
    if (data.has_experience_level_minimum && data.experience_level_minimum) {
        experienceString = `Niveau d'expérience requis : Minimum ${data.experience_level_minimum} ans`;
    }
    if (data.experience_level) {
        // Ajoute la tranche si elle existe (ex: "5_TO_7_YEARS")
        experienceString += experienceString ? ` (${data.experience_level})` : `Niveau d'expérience requis : ${data.experience_level}`;
    }
    
    // On met l'expérience tout en haut, suivie du profil texte brut
    if (experienceString) {
        profil_recherche = experienceString + "\n\n" + cleanEmpty(data.profile_text);
    } else {
        profil_recherche = cleanEmpty(data.profile_text);
    }

    // Ajout des compétences WTTJ à la fin du profil (Skills)
    if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
        let skills = data.skills.map(s => s.name.fr || s.name.en || "").filter(Boolean).join(", ");
        if (skills) profil_recherche += "\n\n[Tags Skills] : " + skills;
    }

    // Ajout des outils techs (Tools)
    if (data.tools && Array.isArray(data.tools) && data.tools.length > 0) {
        let tools = data.tools.map(t => t.name).filter(Boolean).join(", ");
        if (tools) profil_recherche += "\n\n[Tags Tools] : " + tools;
    }

    // B. ENRICHISSEMENT DE LA DESCRIPTION (Missions clés)
    
    // Ajout des missions clés (Les fameuses étiquettes invisibles)
    // On gère le cas où c'est un objet (m.name.fr) OU une simple chaîne de texte (m)
    if (data.key_missions && Array.isArray(data.key_missions) && data.key_missions.length > 0) {
        let missions = data.key_missions.map(m => {
            if (typeof m === 'string') return m;
            return m.name?.fr || m.name?.en || "";}).filter(Boolean).join(" | ");
        
        if (missions) {
            description_complete += "\n\n[Tags Missions Clés] : " + missions;
        }
    }
    
    // C. Domaine d'activité (Sectors)
    let domaine = "";
    if (data.organization && data.organization.industry) {
        domaine = data.organization.industry;
    } else if (data.sectors && Array.isArray(data.sectors)) {
        domaine = data.sectors.map(s => s.name.fr || s.name.en).join(", ");
    }
    
    let detailsEntreprise = data.organization ? cleanEmpty(data.organization.description_text) : "";

    // ==========================================
    // 4. OBJET FINAL FORMATÉ
    // ==========================================

    newItems.push({
        json: {
            id_unique: id_unique,
            source: "WTTJ",
            titre: titre,
            entreprise: entreprise,
            lieu: lieu,
            type_contrat: cleanEmpty(contrat),
            salaire: salaire,
            date_publication: date,
            url_offre: url_offre,
            url_apply: url_apply,
            description_complete: description_complete,
            profil_recherche: profil_recherche,
            domaine_activite: domaine,
            entreprise_details: detailsEntreprise
        }
    });
}

return newItems;