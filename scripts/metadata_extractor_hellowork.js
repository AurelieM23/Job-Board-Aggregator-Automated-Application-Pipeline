// ==========================================
// 1. FONCTIONS UTILITAIRES GLOBALES
// ==========================================

function cleanHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/<\/(div|p|li|h[1-6])>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>?/gm, '')
        .replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

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

function formatDate(dStr) {
    if (!dStr) return "";
    try { 
        // HelloWork renvoie parfois "20261012" au lieu de "2026-10-12" dans le dataLayer
        if (dStr.length === 8 && !dStr.includes("-")) {
            return `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
        }
        const dateObj = new Date(dStr);
        if (isNaN(dateObj.getTime())) return "";
        return dateObj.toISOString().split('T')[0];
    } catch(e) { 
        return ""; 
    }
}

function cleanEmpty(val) {
    if (val === null || val === undefined || String(val).trim() === "Non spécifié") return "";
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

// Fonction pour la création stricte de l'ID Unique
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
const result = [];

for (const item of $input.all()) {
    const html = typeof item.json.data === 'string' ? item.json.data : JSON.stringify(item.json);
    
    // Variables par défaut
    let titre = "", entreprise = "", lieu_brut = "", type_contrat = "", salaire = "";
    let date_pub = "", url_offre = "", url_apply = "", description_complete = "";
    let profil_recherche = "", domaine = "", entreprise_details = "";

    // ---------------------------------------------------------
    // ETAPE 1 : EXTRACTION VIA DATA-LAYER
    // ---------------------------------------------------------
    const matchDataLayer = html.match(/window\.dataLayer\.push\((\{.*?\})\);/);
    if (matchDataLayer) {
        try {
            const dl = JSON.parse(matchDataLayer[1]);
            titre = "Poste introuvable"; 
            entreprise = dl["Nom-Entreprise"] || "";
            lieu_brut = dl["Ville"] || ""; 
            type_contrat = dl["contrat"] || "";
            date_pub = formatDate(dl["datePublicationOffre"] || "");
            domaine = dl["Domaine"] || "";
            
            if (dl["idOffre"]) {
                url_offre = `https://www.hellowork.com/fr-fr/emplois/${dl["idOffre"]}.html`;
            }
        } catch(e) {}
    }

    // ---------------------------------------------------------
    // ETAPE 2 : EXTRACTION VIA JSON-LD
    // ---------------------------------------------------------
    const regexJsonLd = /<script type="application\/ld(?:&#x2B;|\+)json">\s*([\s\S]*?)\s*<\/script>/gi;
    let match;
    while ((match = regexJsonLd.exec(html)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            
            if (parsed["@type"] === "JobPosting") {
                titre = parsed.title || titre;
                if (parsed.hiringOrganization && parsed.hiringOrganization.name) entreprise = parsed.hiringOrganization.name;
                if (parsed.jobLocation && parsed.jobLocation.address && parsed.jobLocation.address.addressLocality) lieu_brut = parsed.jobLocation.address.addressLocality;
                
                if (parsed.employmentType) {
                    const types = Array.isArray(parsed.employmentType) ? parsed.employmentType : [parsed.employmentType];
                    type_contrat = types.join(", ").replace("TEMPORARY", "CDD / Intérim").replace("FULL_TIME", "CDI").replace("CONTRACTOR", "Freelance").replace("INTERN", "Stage");
                }

                if (parsed.baseSalary && parsed.baseSalary.value) {
                    const val = parsed.baseSalary.value;
                    const unit = val.unitText ? ` / ${val.unitText}` : "";
                    if (val.minValue && val.maxValue) salaire = `${val.minValue}€ - ${val.maxValue}€${unit}`;
                    else if (val.value) salaire = `${val.value}€${unit}`;
                }
                
                description_complete = parsed.description || "";
                profil_recherche = cleanEmpty(cleanHtml(parsed.qualifications));

                if (parsed.skills && Array.isArray(parsed.skills) && parsed.skills.length > 0) {
                    let skillsStr = "Compétences identifiées : " + parsed.skills.join(", ");
                    profil_recherche = profil_recherche ? profil_recherche + "\n\n" + skillsStr : skillsStr;
                }
            }
            
            if (parsed["@type"] === "BreadcrumbList" && parsed.itemListElement) {
                const lastItem = parsed.itemListElement[parsed.itemListElement.length - 1];
                if (lastItem && lastItem.name && (titre === "Poste introuvable" || !titre)) {
                    titre = lastItem.name;
                }
            }
        } catch (e) {}
    }

    // ---------------------------------------------------------
    // ETAPE 3 : EXTRACTION DANS LE HTML BRUT & FORMATAGE
    // ---------------------------------------------------------
    
    if (!titre || titre === "Poste introuvable") {
        const matchTitle = html.match(/<title>([^<]+)<\/title>/i);
        if (matchTitle) titre = matchTitle[1].split(" - ")[0].replace(/Offre Emploi \w+ /i, "").trim();
    }

    const matchPres = html.match(/<h2[^>]*>Bienvenue chez[^<]*<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    if (matchPres) entreprise_details = cleanHtml(matchPres[1]);

    if (description_complete) {
        description_complete = description_complete.replace(/<h2>Le profil recherché<\/h2>[\s\S]*?(?=<h2>|$)/i, "");
        description_complete = description_complete.replace(/<h2>Bienvenue chez[^<]*<\/h2>[\s\S]*?(?=<h2>|$)/i, "");
        description_complete = cleanHtml(description_complete);
    } else {
        const matchDesc = html.match(/<h2[^>]*>[\s\S]*?Détail du poste[\s\S]*?<\/h2>[\s\S]*?data-truncate-text-target="content"[^>]*>([\s\S]*?)<\/div>/i);
        if (matchDesc) description_complete = cleanHtml(matchDesc[1]);
    }

    const matchApply1 = html.match(/data-modal-redirect-on-close-param="([^"]+)"/);
    if (matchApply1) {
        url_apply = matchApply1[1].replace(/&amp;/g, '&');
    } else {
        const matchApply2 = html.match(/href="([^"]+)"[^>]*target="_blank"[^>]*role="button"/i);
        if (matchApply2) url_apply = matchApply2[1].replace(/&amp;/g, '&');
    }

    if (!url_offre) {
        const ogUrlMatch = html.match(/<meta property="og:url" content="([^"]+)">/);
        if (ogUrlMatch) url_offre = ogUrlMatch[1];
    }

    // ---------------------------------------------------------
    // ETAPE 4 : GÉNÉRATION ID UNIQUE & ENVOI
    // ---------------------------------------------------------
    
    // Nettoyage visuel de la ville avant ajout
    let lieu = formatLieuVisuel(lieu_brut);
    
    // Nettoyage du titre avant ID
    titre = cleanTitle(titre);
    
    // Génération ID strict
    let id_unique = createStrictId(entreprise, titre, lieu);
    
    // Fallback si l'ID a planté et qu'on a au moins l'URL pour le sauver
    if (id_unique.startsWith("erreur_id_")) {
        let rawId = url_offre ? url_offre.split('/').pop().replace(".html", "") : "";
        if (rawId) id_unique = `ERREUR_ID_${rawId}`;
    }

    result.push({
        json: {
            id_unique: id_unique,
            source: "HelloWork",
            titre: cleanEmpty(titre),
            entreprise: cleanEmpty(entreprise),
            lieu: cleanEmpty(lieu),
            type_contrat: cleanEmpty(type_contrat),
            salaire: cleanEmpty(salaire),
            date_publication: date_pub,
            url_offre: url_offre,
            url_apply: url_apply,
            description_complete: description_complete,
            profil_recherche: profil_recherche,
            domaine_activite: cleanEmpty(domaine),
            entreprise_details: entreprise_details
        }
    });
}

return result;