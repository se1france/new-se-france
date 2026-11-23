const SHEET_ID = "1psgCsVLe9RTBDlVXufydXNr6LF2LpdyZnH70v88xacI";
const ROLES = ["admin", "ministre", "responsable"];
const DOMAINE = "@spiritembassyfrance.fr";
const ENTETE_INV = ["ID", "Objet", "Catégorie", "Quantité", "État", "Lieu", "Notes", "Modifié"];

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Espace responsables · Spirit Embassy France")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

const classeur = () => SpreadsheetApp.openById(SHEET_ID);
const onglet = n => classeur().getSheetByName(n);

function inventaireFeuille() {
  let f = onglet("Inventaire");
  if (!f) { f = classeur().insertSheet("Inventaire"); f.appendRow(ENTETE_INV); }
  return f;
}

/* ---------- Sécurité ---------- */
function acces() {
  const email = String(Session.getActiveUser().getEmail() || "").toLowerCase();
  if (!email) return null;
  const v = onglet("Accès").getDataRange().getValues().slice(1);
  const l = v.find(r => String(r[0]).trim().toLowerCase() === email);
  if (!l) return null;
  const role = String(l[1]).trim().toLowerCase();
  return ROLES.includes(role) ? { email, role } : null;
}
function exiger(rolesOk) {
  const a = acces();
  if (!a || (rolesOk && !rolesOk.includes(a.role))) throw new Error("Accès refusé");
  return a;
}
function journal(email, action) {
  onglet("Journal").appendRow([new Date(), email, action]);
}
function verrou(f) {
  const l = LockService.getScriptLock();
  l.waitLock(10000);
  try { return f(); } finally { l.releaseLock(); }
}

/* ---------- Utilitaires ---------- */
function texteDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Europe/Paris", "yyyy-MM-dd");
  return String(v || "").trim();
}
function lireMembres() {
  const v = onglet("Membres").getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v.shift().map(c => String(c).trim());
  return v.map(r => { const o = {}; h.forEach((c, i) => o[c] = r[i]); return o; });
}
function compter(liste, f) {
  const c = {};
  liste.forEach(m => { const k = f(m); if (k) c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
const sur = s => String(s || "").trim().replace(/^[=+\-@]/, "'$&").slice(0, 300);

/* ---------- Données du tableau de bord ---------- */
function donnees() {
  const a = acces();
  if (!a) return { refuse: true };
  const contacts = a.role !== "responsable";
  const tous = lireMembres();
  const mois = Utilities.formatDate(new Date(), "Europe/Paris", "yyyy-MM");
  const moisNum = mois.slice(5, 7);

  const fiches = tous.map(m => {
    const o = {
      nom: (String(m["Prénom"]) + " " + String(m["Nom"])).trim(),
      ville: String(m["Ville"] || ""), genre: String(m["Genre"] || ""),
      baptise: String(m["Baptisé"] || ""), interet: String(m["Intérêt baptême"] || ""),
      rebapteme: String(m["Rebaptême"] || ""), servir: String(m["Servir"] || ""),
      domaine: String(m["Domaine"] || ""), jours: String(m["Jours"] || ""),
      inscrit: texteDate(m["Date"])
    };
    if (contacts) {
      o.email = String(m["E-mail"] || "");
      o.tel = (String(m["Indicatif"] || "") + " " + String(m["Téléphone"] || "").replace(/^'/, "")).trim();
    }
    return o;
  });

  journal(a.email, "Consultation");
  return {
    role: a.role, email: a.email, contacts,
    total: fiches.length,
    nouveaux: fiches.filter(f => f.inscrit.slice(0, 7) === mois).length,
    genres: compter(fiches, f => f.genre),
    villes: compter(fiches, f => f.ville).slice(0, 8),
    domaines: compter(fiches.filter(f => f.servir.startsWith("Oui")), f => f.domaine.toLowerCase()),
    aBaptiser: fiches.filter(f => (f.baptise === "Non" && /^Oui/.test(f.interet)) || (f.baptise === "Oui" && f.rebapteme === "Oui")),
    infoBapteme: fiches.filter(f => f.baptise === "Non" && f.interet === "Je souhaite en savoir plus"),
    volontaires: fiches.filter(f => f.servir === "Oui, je souhaite servir"),
    anniversaires: tous.filter(m => texteDate(m["Naissance"]).slice(5, 7) === moisNum)
      .map(m => ({ nom: (String(m["Prénom"]) + " " + String(m["Nom"])).trim(), jour: texteDate(m["Naissance"]).slice(8, 10) }))
      .sort((x, y) => x.jour.localeCompare(y.jour)),
    membres: fiches
  };
}

/* ---------- Export CSV (admin) ---------- */
function exporterCSV() {
  const a = exiger(["admin"]);
  const v = onglet("Membres").getDataRange().getValues();
  const csv = v.map(r => r.map(c => {
    let t = c instanceof Date ? Utilities.formatDate(c, "Europe/Paris", "yyyy-MM-dd HH:mm") : String(c);
    if (/^[=+\-@]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }).join(";")).join("\n");
  journal(a.email, "Export CSV (" + (v.length - 1) + " membres)");
  return csv;
}

/* ---------- Administration des accès (admin) ---------- */
function listeAcces() {
  exiger(["admin"]);
  return onglet("Accès").getDataRange().getValues().slice(1)
    .filter(r => String(r[0]).trim())
    .map(r => ({ email: String(r[0]).trim().toLowerCase(), role: String(r[1]).trim().toLowerCase() }));
}

function ajouterAcces(email, role) {
  const a = exiger(["admin"]);
  email = String(email || "").trim().toLowerCase();
  role = String(role || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) throw new Error("E-mail invalide");
  if (!email.endsWith(DOMAINE)) throw new Error("Seules les adresses " + DOMAINE + " sont autorisées");
  if (!ROLES.includes(role)) throw new Error("Rôle invalide");
  return verrou(() => {
    const f = onglet("Accès");
    const v = f.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      if (String(v[i][0]).trim().toLowerCase() === email) {
        f.getRange(i + 1, 2).setValue(role);
        journal(a.email, "Rôle modifié : " + email + " → " + role);
        return listeAcces();
      }
    }
    f.appendRow([email, role]);
    journal(a.email, "Accès ajouté : " + email + " (" + role + ")");
    return listeAcces();
  });
}

function retirerAcces(email) {
  const a = exiger(["admin"]);
  email = String(email || "").trim().toLowerCase();
  if (email === a.email) throw new Error("Vous ne pouvez pas retirer votre propre accès");
  return verrou(() => {
    const f = onglet("Accès");
    const v = f.getDataRange().getValues();
    for (let i = v.length - 1; i >= 1; i--) {
      if (String(v[i][0]).trim().toLowerCase() === email) f.deleteRow(i + 1);
    }
    journal(a.email, "Accès retiré : " + email);
    return listeAcces();
  });
}

/* ---------- Inventaire (lecture : admin et ministre ; écriture : admin) ---------- */
function listeInventaire() {
  exiger(["admin", "ministre"]);
  const v = inventaireFeuille().getDataRange().getValues().slice(1);
  return v.filter(r => r[0]).map(r => ({
    id: String(r[0]), objet: String(r[1]), categorie: String(r[2]), quantite: Number(r[3]) || 0,
    etat: String(r[4]), lieu: String(r[5]), notes: String(r[6]), modifie: texteDate(r[7])
  }));
}

function enregistrerObjet(o) {
  const a = exiger(["admin"]);
  const objet = sur(o.objet);
  if (!objet) throw new Error("Nom de l'objet obligatoire");
  const ligne = [
    o.id || Utilities.getUuid().slice(0, 8), objet, sur(o.categorie),
    Math.max(0, Math.min(100000, Number(o.quantite) || 0)),
    sur(o.etat), sur(o.lieu), sur(o.notes), new Date()
  ];
  return verrou(() => {
    const f = inventaireFeuille();
    const v = f.getDataRange().getValues();
    if (o.id) {
      for (let i = 1; i < v.length; i++) {
        if (String(v[i][0]) === String(o.id)) {
          f.getRange(i + 1, 1, 1, ligne.length).setValues([ligne]);
          journal(a.email, "Inventaire modifié : " + objet);
          return listeInventaire();
        }
      }
    }
    f.appendRow(ligne);
    journal(a.email, "Inventaire ajouté : " + objet);
    return listeInventaire();
  });
}

function supprimerObjet(id) {
  const a = exiger(["admin"]);
  return verrou(() => {
    const f = inventaireFeuille();
    const v = f.getDataRange().getValues();
    for (let i = v.length - 1; i >= 1; i--) {
      if (String(v[i][0]) === String(id)) {
        journal(a.email, "Inventaire supprimé : " + v[i][1]);
        f.deleteRow(i + 1);
      }
    }
    return listeInventaire();
  });
}