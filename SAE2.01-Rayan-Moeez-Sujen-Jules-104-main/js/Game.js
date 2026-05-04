import { imageCollections } from './ImageCollection.js';
import { ApiService } from './ApiService.js';

export class Game {
  constructor(gestionnaireDOM) {
    this.dom = gestionnaireDOM; // Lien vers le manipulateur d'interface
    
    // Identifiant de la partie
    this._id = null;
    
    // État du plateau
    this.cartes = [];
    this.cartesRetournees = [];
    this.pairesTrouvees = 0;
    this.totalPaires = 0;
    
    // Variables de suivi du score
    this.secondes = 0;
    this.mouvements = 0; 
    this.intervalleChrono = null;
    
    // Verrou de sécurité : Empêche le joueur de cliquer partout pendant une animation
    this.estVerrouille = false; 
    
    // Configuration de la partie
    this.nomJoueur = '';
    this.difficulte = '';
    this.modeJeu = 'normal'; 
    
    // Fonction appelée (callback) lorsque la partie se termine
    this.auFini = null; 
  }

  /**
   * Initialise et lance une nouvelle partie de Memory.
   */
  demarrerPartie(id, nomJoueur, difficulte, nomCollection, imagesPersonnalisees, modeJeu) {
    this._id = id;
    this.nomJoueur = nomJoueur;
    this.difficulte = difficulte;
    this.modeJeu = modeJeu;
    
    // Remise à zéro de l'état
    this.cartesRetournees = [];
    this.pairesTrouvees = 0;
    this.estVerrouille = false;
    this.secondes = 0;
    this.mouvements = 0;

    // Définition de la taille du plateau selon la difficulté
    const nombreDePaires = { easy: 4, medium: 6, hard: 8 };
    this.totalPaires = nombreDePaires[difficulte];

    // On prépare le paquet de cartes
    this.cartes = this.genererPaquet(nomCollection, this.totalPaires, imagesPersonnalisees);
    
    // On met à jour l'interface
    this.dom.afficherJeu();
    this.dom.mettreAJourPairesRestantes(this.totalPaires);
    this.dom.mettreAJourChrono(this.secondes);
    this.dom.mettreAJourMouvements(this.mouvements); 
    this.dom.creerCartes(this.cartes, this.gererClicCarte.bind(this));
    
    // Lancement de la boucle du chronomètre
    this.intervalleChrono = setInterval(() => {
      this.secondes++;
      this.dom.mettreAJourChrono(this.secondes);
    }, 1000);
  }

  /**
   * Prépare le paquet de cartes on duplique les images et les mélange.
   */
  genererPaquet(nomCollection, nombrePairesDemande, imagesPersonnalisees) {
    let imagesDeBase = [];
    
    // Choix de la source d'images
    if (nomCollection === 'personnalisee' && imagesPersonnalisees.length > 0) {
      imagesDeBase = imagesPersonnalisees.slice(0, nombrePairesDemande);
    } else {
      imagesDeBase = imageCollections[nomCollection].slice(0, nombrePairesDemande);
    }

    let paquetDeCartes = [...imagesDeBase, ...imagesDeBase]; 
    
    // Mélange des cartes
    for (let i = paquetDeCartes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [paquetDeCartes[i], paquetDeCartes[j]] = [paquetDeCartes[j], paquetDeCartes[i]];
    }
    
    // On ajoute un ID unique à chaque instance de carte pour faciliter le ciblage dans le HTML
    return paquetDeCartes.map((element, index) => ({ ...element, identifiantUnique: index }));
  }

  /**
   * Fonctionnalité Joker on révèle les cartes pendant un court instant.
   * Contrepartie on ajoute +15 secondes de pénalité au timer.
   */
  utiliserIndice() {
    // Sécurité on bloque l'indice si la partie est déjà finie ou en cours d'animation
    if (this.estVerrouille || this.pairesTrouvees === this.totalPaires) return;

    this.estVerrouille = true; // On fige le jeu

    // Application de la pénalité de temps
    this.secondes += 15;
    this.dom.mettreAJourChrono(this.secondes);

    // On sélectionne uniquement les cartes qui ne sont ni déjà trouvées, ni déjà retournées
    const cartesMasquees = Array.from(this.dom.plateauJeu.querySelectorAll('.card:not(.trouvee):not(.flip)'));

    // On révèle les cartes visuellement
    cartesMasquees.forEach(carteEl => {
      carteEl.classList.add('flip');
      carteEl.querySelector('.card-back').classList.remove('hidden');
    });

    // On les masque à nouveau au bout de 1.5 secondes
    setTimeout(() => {
      cartesMasquees.forEach(carteEl => {
        carteEl.classList.remove('flip');
        carteEl.querySelector('.card-back').classList.add('hidden');
      });
      this.estVerrouille = false; // On débloque le jeu
    }, 1500);
  }

  /**
   * Méthode appelée lorsque le joueur clique sur une carte.
   */
  gererClicCarte(elementCarte, donneesCarte) {
    // Sécurité : Ignorer le clic si le jeu est verrouillé ou si la carte est déjà face visible
    if (this.estVerrouille || elementCarte.classList.contains('flip') || elementCarte.classList.contains('trouvee')) {
      return;
    }

    // On retourne visuellement la carte
    elementCarte.classList.add('flip');
    elementCarte.querySelector('.card-back').classList.remove('hidden');

    // On ajoute la carte dans le tableau temporaire des cartes à analyser
    this.cartesRetournees.push({ element: elementCarte, donnees: donneesCarte });

    // Si on a retourné 2 cartes, on lance la vérification
    if (this.cartesRetournees.length === 2) {
      this.verifierCorrespondance();
    }
  }

  /**
   * Logique métier on vérifie si les 2 cartes retournées sont identiques.
   */
  verifierCorrespondance() {
    this.estVerrouille = true; // On empêche un 3ème clic
    
    this.mouvements++;
    this.dom.mettreAJourMouvements(this.mouvements);

    const [carte1, carte2] = this.cartesRetournees;

    // CAS 1 : Les cartes correspondent
    if (carte1.donnees.id === carte2.donnees.id) {
      setTimeout(() => {
        // Animation : surbrillance verte pour valider
        carte1.element.style.boxShadow = "0 0 10px #4ade80"; 
        carte2.element.style.boxShadow = "0 0 10px #4ade80";
        carte1.element.classList.add('trouvee');
        carte2.element.classList.add('trouvee');
        
        this.pairesTrouvees++;
        this.dom.mettreAJourPairesRestantes(this.totalPaires - this.pairesTrouvees);
        this.cartesRetournees = [];
        this.estVerrouille = false; // On déverrouille pour le prochain tour

        // Condition de victoire
        if (this.pairesTrouvees === this.totalPaires) {
          this.terminerPartie(true);
        }
      }, 500); // Pause de 500ms pour laisser le temps de voir la paire
    } 
    // CAS 2 : Les cartes sont différentes
    else {
      setTimeout(() => {
        // On remet les cartes face cachée
        carte1.element.classList.remove('flip');
        carte2.element.classList.remove('flip');
        carte1.element.querySelector('.card-back').classList.add('hidden');
        carte2.element.querySelector('.card-back').classList.add('hidden');
        
        this.cartesRetournees = [];
        this.estVerrouille = false; // On déverrouille
      }, 1000); // On laisse 1 seconde de mémorisation avant de cacher
    }
  }

  /**
   * Arrête le jeu proprement et déclenche le callback de fin.
   */
  async terminerPartie(estVictoire = false) {
    clearInterval(this.intervalleChrono); // Arrêt du timer
    const pairesRestantes = this.totalPaires - this.pairesTrouvees;

    
    try {
      await ApiService.mettreAJourResultat(this._id, pairesRestantes);
    } catch (erreur) {
      console.warn('Erreur API lors de la fin de partie (Mode Local probable) :', erreur);
    }

    // On passe le relais à app.js pour afficher les résultats et gérer l'Elo
    if (this.auFini) {
      this.auFini({
        estVictoire: estVictoire,
        temps: this.secondes,
        mouvements: this.mouvements, 
        difficulte: this.difficulte,
        nomJoueur: this.nomJoueur,
        mode: this.modeJeu 
      });
    }
  }
}