(() => {
  // ========================================================================
  // 1. FONCTIONS DE NETTOYAGE ET FORMATAGE
  // ========================================================================

  function cleanHtml(text) {
      if (!text) return "";
      let str = String(text)
          .replace(/<\/(div|p|li|h[1-6])>/gi, ' ')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]*>?/gm, '');

      // Décodage de TOUTES les entités HTML (&eacute;, &#39;, &amp;...)
      let doc = new DOMParser().parseFromString(str, "text/html");
      str = doc.documentElement.textContent;

      return str.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  function cleanTitle(title) {
      if (!title) return "";
      let t = String(title);
      t = t.replace(/^(?:ref|req|id|offre|vp|poste|job)?\s*#?[A-Z0-9_]*\d{2,10}[A-Z0-9_]*\s*(?:bis|ter)?\s*[-_:/|]?\s*/i, "");
      t = t.replace(/^[A-Z0-9]{2,10}\s*[-_:/|]+\s*/i, "");
      t = t.replace(/[-\(\s]*\b([HhFfNnBbXx]\s*[\/\vert{}&,-]\s*)+[HhFfNnBbXx]+\b[\)\s]*/g, '');
      t = t.replace(/[-\(\s]*\b[HhFf]\s*[\/\vert{}&,-]\s*[HhFf]\b[\)\s]*/g, '');
      t = t.replace(/\bBac\s*\+\s*\d(?:[\/-]\d)?\b/gi, '');
      t = t.replace(/(?:#\w+|\b[A-Z]*\d+[A-Z0-9]*\b)\s*$/i, '');
      return t.replace(/^[- \t]+|[- \t]+$/g, '').replace(/\s{2,}/g, " ").trim();
  }

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

  // ========================================================================
  // 2. EXTRACTION VIA JSON-LD
  // ========================================================================
  console.log("--- DÉBUT DE L'EXTRACTION APEC ---");

  let jobData = null;
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  scripts.forEach(script => {
      try {
          const json = JSON.parse(script.innerText);
          if (json["@type"] === "JobPosting") {
              jobData = json;
          }
      } catch(e) {}
  });

  if (!jobData) {
      console.error("❌ Impossible de trouver les données de l'offre (JSON-LD manquant).");
      return;
  }

  // ========================================================================
  // 3. FORMATAGE DES VARIABLES
  // ========================================================================

  const titreBrut = jobData.title || "";
  const titre = cleanTitle(titreBrut);
  
  const entreprise = jobData.hiringOrganization && jobData.hiringOrganization.name ? cleanHtml(jobData.hiringOrganization.name) : "";
  const entreprise_details = jobData.hiringOrganization && jobData.hiringOrganization.description ? cleanHtml(jobData.hiringOrganization.description) : "";
  
  const lieuBrut = jobData.jobLocation && jobData.jobLocation.address ? (jobData.jobLocation.address.addressLocality || "") : "";
  const lieu = formatLieuVisuel(lieuBrut);

  let contrat = "Non spécifié";
  if (jobData.employmentType) {
      const types = Array.isArray(jobData.employmentType) ? jobData.employmentType : [jobData.employmentType];
      contrat = types.join(", ").replace("FULL_TIME", "CDI").replace("TEMPORARY", "CDD / Intérim").replace("CONTRACTOR", "Freelance").replace("INTERN", "Stage");
  }

  let salaire = "";
  if (jobData.baseSalary && jobData.baseSalary.value) {
      const val = jobData.baseSalary.value;
      if (val.value) {
          salaire = val.value; 
      } else if (val.minValue && val.maxValue) {
          salaire = `${val.minValue} - ${val.maxValue}`;
      }
  }

  let datePub = "";
  if (jobData.datePosted) {
      datePub = jobData.datePosted.split(" ")[0]; 
  }

  const urlOffre = jobData.url || window.location.href.split('?')[0];

  let applyUrl = "";
  const btnPostuler = document.querySelector('a[href*="postuler-a-une-offre"]');
  if (btnPostuler) {
      const href = btnPostuler.getAttribute('href');
      applyUrl = href.startsWith('http') ? href : 'https://www.apec.fr' + href;
  }

  const description_complete = cleanHtml(jobData.description || "");
  const profil_recherche = cleanHtml(jobData.qualifications || "");
  const domaine_activite = cleanHtml(jobData.industry || "");

  const id_unique = createStrictId(entreprise, titre, lieu);

  // ========================================================================
  // 4. EXPORT FINAL
  // ========================================================================

  const dataExport = {
      id_unique: id_unique,
      source: "APEC",
      titre: titre,
      entreprise: entreprise,
      lieu: lieu,
      type_contrat: contrat,
      salaire: salaire,
      date_publication: datePub,
      url_offre: urlOffre,
      url_apply: applyUrl,
      description_complete: description_complete,
      profil_recherche: profil_recherche,
      domaine_activite: domaine_activite,
      entreprise_details: entreprise_details
  };

  console.log("%c[SUCCESS] Extraction APEC terminée :", "color: #00d8ff; font-size: 14px; font-weight: bold;");
  console.log(JSON.stringify(dataExport, null, 2));
  
  return dataExport;

})();