// 1. Récupérer les nouvelles offres 
const nouvellesOffres = $('Title_Filter').all();

// 2. Récupérer l'historique CSV (le flux d'entrée actuel venant du Google Sheets Read)
const offresExistantes = $('Get Master CSV').all();

// 3. Seuil de jours pour définir un "nouveau cycle de recrutement"
const SEUIL_JOURS = 8; 
const offresInedites = [];

// 4. Fonction pour parser les dates de manière blindée (gère le YYYY-MM-DD et le DD/MM/YYYY)
function parseSafeDate(dateStr) {
    if (!dateStr) return new Date(0);
    let str = String(dateStr).trim();
    // Si format JJ/MM/AAAA ou JJ/MM/AA
    if (str.includes('/')) {
        let parts = str.split('/');
        if (parts.length === 3) {
            let year = parts[2].length === 2 ? "20" + parts[2] : parts[2];
            return new Date(`${year}-${parts[1]}-${parts[0]}T12:00:00Z`);
        }
    }
    // Format standard YYYY-MM-DD
    let parsed = new Date(str);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

// 5. Boucle de comparaison robuste
for (const item of nouvellesOffres) {
    
    // TRÈS IMPORTANT : On "clone" l'offre pour que n8n laisse la modifier sans bloquer
    let offre = JSON.parse(JSON.stringify(item.json));
    
    let base_id = offre.id_unique; 
    if (!base_id) continue; // Sécurité si l'ID est vide
    
    let dateNouvelle = parseSafeDate(offre.date_publication);

    // 1. On vérifie dans le Sheets (historique)
    let versionsCSV = offresExistantes.filter(ex => {
        let idExist = ex.json.id_unique || "";
        return idExist === base_id || idExist.startsWith(base_id + "_");
    });

    // 2. On vérifie AUSSI dans les offres qu'on vient juste de traiter dans cette boucle ! (Anti doublon intra-batch)
    let versionsEnCours = offresInedites.filter(ex => {
        let idExist = ex.json.id_unique || "";
        return idExist === base_id || idExist.startsWith(base_id + "_");
    });

    // On fusionne les deux historiques pour la comparaison
    let toutesVersions = versionsCSV.concat(versionsEnCours);

    // CAS 1 : Si l'offre est totalement inconnue, on l'ajoute directement à la liste finale
    if (toutesVersions.length === 0) {
        offresInedites.push({ json: offre });
        continue;
    }

    // CAS 2 & 3 : Recherche de la date la plus récente de cette offre dans l'historique
    let maxDateExistante = new Date(0); 
    for (const ex of toutesVersions) {
        let d = parseSafeDate(ex.json.date_publication);
        if (d > maxDateExistante) {
            maxDateExistante = d;
        }
    }

    // Calcul de la différence temporelle
    let diffTime = Math.abs(dateNouvelle - maxDateExistante);
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Prise de décision
    if (diffDays <= SEUIL_JOURS) {
        // CAS 2 (Doublon) : L'offre est déjà dans le CSV pour ce cycle. On passe à la suivante (continue).
        continue;
    } else {
        // CAS 3 (Nouveau cycle) : Plus que SEUIL_JOURS d'écart. On accepte et on suffixe au format YYMMDD.
        let annee = dateNouvelle.getFullYear().toString().slice(2, 4); // "26" pour 2026
        let mois = (dateNouvelle.getMonth() + 1).toString().padStart(2, '0'); // "11"
        let jour = dateNouvelle.getDate().toString().padStart(2, '0'); // "05"

        let idPropose = base_id + "_" + annee + mois + jour;
        
        // Sécurité anti-collision : si deux recruteurs postent LA MÊME JOURNÉE une offre qu'on n'avait pas vue depuis SEUIL_JOURS
        let conflit = toutesVersions.some(ex => ex.json.id_unique === idPropose);
        if (conflit) {
            continue;
        } else {
            offre.id_unique = idPropose;
            // On sauvegarde l'offre modifiée
            offresInedites.push({ json: offre });
        }
    }
}

// On renvoie proprement la liste à n8n
return offresInedites;