export class DOMManager {
  constructor() {
    // Sélecteurs de la zone de jeu
    this.plateauJeu = document.querySelector('.game-board');
    this.affichageChrono = document.getElementById('affichageChrono');
    this.affichagePaires = document.getElementById('compteurPaires');
    this.affichageMouvements = document.getElementById('affichageMouvements'); 
    
    // Sélecteurs des différents panneaux pour faire la transition (Menu -> Jeu -> Score)
    this.panneauFormulaire = document.getElementById('panneauFormulaire');
    this.zoneJeu = document.getElementById('zoneJeu');
    this.panneauClassement = document.getElementById('panneauClassement');
  }

  /**
   * Génère le HTML pour chaque carte et les injecte dans le plateau.
   */
  creerCartes(images, auClicSurCarte) {
    this.plateauJeu.innerHTML = ''; // Nettoyage de l'ancien plateau

    images.forEach((image, index) => {
      const carte = document.createElement('div');
      carte.className = 'card'; 
      carte.dataset.index = index; // Pour identifier la carte facilement

      // Construction de la carte en 2 faces
      carte.innerHTML = `
        <div class="card-inner">
          <!-- Face Cachée (Le logo de l'équipe KC) -->
          <div class="card-front">
            <img src="./assets/images/ARRIERE/logokc.png" alt="Logo KC" 
                 style="width: 100%; height: 100%; object-fit: contain; padding: 0.5rem; border-radius: 0.5rem; display: block;" 
                 onerror="this.style.display='none'; this.parentNode.innerHTML='<span style=\\'font-size:3rem; color:rgba(255,255,255,0.4); display:flex; justify-content:center; align-items:center; width:100%; height:100%\\'>?</span>'">
          </div>
          
          <!-- Face Visible (Le fruit, l'animal ou l'image uploadée) -->
          <!-- La classe hidden est utilisée par le style.css de base fourni -->
          <div class="card-back hidden">
            <img src="${image.url}" alt="${image.name}" 
                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.5rem; display: block;">
          </div>
        </div>
      `;

      // On attache l'écouteur d'événement pour que Game.js sache qu'on a cliqué
      carte.addEventListener('click', () => auClicSurCarte(carte, image));
      
      this.plateauJeu.appendChild(carte);
    });
  }

  // --- MÉTHODES DE MISE À JOUR EN DIRECT (HUD) ---

  mettreAJourChrono(secondes) {
    // Formatage classique en MM:SS
    const min = Math.floor(secondes / 60).toString().padStart(2, '0');
    const sec = (secondes % 60).toString().padStart(2, '0');
    this.affichageChrono.textContent = `${min}:${sec}`;
  }

  mettreAJourPairesRestantes(compte) {
    this.affichagePaires.textContent = compte;
  }

  mettreAJourMouvements(compte) {
    if (this.affichageMouvements) {
      this.affichageMouvements.textContent = compte;
    }
  }

  // --- SYSTÈME DE NAVIGATION (SPA - Single Page Application) ---
  // On utilise la classe utilitaire '.hidden' du CSS pour masquer les blocs.

  afficherJeu() {
    this.panneauFormulaire.classList.add('hidden');
    this.panneauClassement.classList.add('hidden');
    this.zoneJeu.classList.remove('hidden');
  }

  afficherFormulaire() {
    this.zoneJeu.classList.add('hidden');
    this.panneauClassement.classList.add('hidden');
    this.panneauFormulaire.classList.remove('hidden');
  }

  afficherClassement(difficulte, contenuHtml) {
    this.zoneJeu.classList.add('hidden');
    this.panneauFormulaire.classList.add('hidden');
    this.panneauClassement.classList.remove('hidden');
    
    // Injection des données dynamiques calculées par app.js
    const etiquette = document.getElementById('etiquetteDifficulte');
    if (etiquette && difficulte) {
      etiquette.textContent = difficulte;
    }

    const corps = document.getElementById('corpsClassement');
    if (corps && contenuHtml) {
      corps.innerHTML = contenuHtml;
    }
  }
}