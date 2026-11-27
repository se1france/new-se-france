const CONFIG = {
  nom: "Spirit Embassy France",
  devise: "Superior Spirit",
  theme: "L'année de l'huile étrange",
  themeEn: "The Year of Strange Oil",
  adresse: "43 avenue de la Division Leclerc, 95200 Sarcelles",
  instagram: "https://www.instagram.com/spiritembassyparisofficial",
  instagramNom: "@spiritembassyparisofficial",
  egliseMere: "https://www.goodnewsworld.com/",
  cultes: [
    { jour: "Mardi", titre: "Culte de milieu de semaine", lieu: "Sur place à Sarcelles et sur Zoom" },
    { jour: "Mercredi", titre: "Culte d'enseignement", lieu: "Sur Zoom" }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-c]").forEach(el => {
    el.textContent = CONFIG[el.dataset.c];
  });
  document.querySelectorAll("[data-href]").forEach(el => {
    el.href = CONFIG[el.dataset.href];
  });
  const liste = document.getElementById("cultes-liste");
  if (liste) {
    liste.innerHTML = CONFIG.cultes.map(c =>
      `<div class="carte"><p class="carte-titre">${c.jour} · ${c.titre}</p><p>${c.lieu}</p></div>`
    ).join("");
  }
});