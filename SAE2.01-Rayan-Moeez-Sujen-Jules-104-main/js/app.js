import { DOMManager } from './DOMManager.js';
import { Game } from './Game.js';
import { ApiService } from './ApiService.js';

// ============================================================================
// 1. INITIALISATION FIREBASE (Pour le Classement Mondial en ligne)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let baseDeDonnees = null;
let utilisateurActuel = null;
let identifiantApp = 'memory-sae-201'; 

/**
 * Tente de se connecter à Firebase. 
 * Si le réseau bloque ou qu'on est hors-ligne, le jeu continue de 
 * fonctionner en s'appuyant sur le LocalStorage du navigateur.
 */
const initialiserFirebase = async () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      const configFirebase = JSON.parse(__firebase_config);
      const app = initializeApp(configFirebase);
      const authentification = getAuth(app);
      baseDeDonnees = getFirestore(app);
      identifiantApp = typeof __app_id !== 'undefined' ? __app_id : identifiantApp;

      // Authentification requise par Firebase avant toute lecture/écriture
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(authentification, __initial_auth_token);
      } else {
        await signInAnonymously(authentification);
      }
      onAuthStateChanged(authentification, (utilisateur) => { utilisateurActuel = utilisateur; });
    }
  } catch (erreur) {
    console.log("Firebase hors-ligne, basculement sur la sauvegarde locale.");
  }
};
initialiserFirebase();


// ============================================================================
// 2. SYSTÈME DE RANKED : MATHÉMATIQUES ELO
// ============================================================================

/**
 * Convertit un score numérique Elo en un palier lisible (ex: "Bronze 3").
 * Le fonctionnement est inspiré des systèmes compétitifs classiques (LoL, Valorant).
 * @param {number} elo Le score Elo du joueur
 * @returns {string} Le palier correspondant avec son emoji
 */
function calculerRangElo(elo) {
  if (elo <= 500) return "🟤 Bronze 3";
  const paliers = ["🟤 Bronze", "⚪ Argent", "🟡 Or", "🟢 Platine", "🔵 Diamant", "🟣 Master", "🔴 Challenger"];
  
  // Chaque palier complet représente 300 Elo
  const indexPalier = Math.floor((elo - 500) / 300);
  if (indexPalier >= paliers.length - 1) return "🔴 Challenger 👑";
  
  // Il y a 3 sous-niveaux par palier (ex: 3, 2, 1)
  const sousNiveau = 3 - Math.floor(((elo - 500) % 300) / 100);
  return `${paliers[indexPalier]} ${sousNiveau}`;
}

/**
 * Détermine combien d'Elo le joueur gagne ou perd après une partie.
 * Se base sur le "Par" (le temps et les mouvements idéaux attendus selon la difficulté).
 * @returns {number}
 */
function calculerVariationElo(difficulte, temps, mouvements) {
  let baseGain = 0;
  let tempsMax, mouvementsMax;

  // Définition des "Scores Parfaits" selon la difficulté
  if (difficulte === 'easy') { baseGain = 15; tempsMax = 25; mouvementsMax = 12; }
  else if (difficulte === 'medium') { baseGain = 25; tempsMax = 50; mouvementsMax = 20; }
  else { baseGain = 35; tempsMax = 80; mouvementsMax = 30; } 

  // Bonus/Malus si on est plus rapide ou plus économe en mouvements
  let bonusTemps = (tempsMax - temps) * 0.5; 
  let bonusMouv = (mouvementsMax - mouvements) * 1.5; 

  let variation = Math.round(baseGain + bonusTemps + bonusMouv);

  // Application de limites strictes pour éviter l'inflation d'Elo
  if (variation > 50) variation = 50;
  if (variation < -30) variation = -30;
  
  return variation;
}


// ============================================================================
// 3. CONTRÔLEURS DE L'INTERFACE ET LOGIQUE DU JEU
// ============================================================================

const gestionnaireDOM = new DOMManager();
const jeu = new Game(gestionnaireDOM);

// Récupération des éléments du DOM
const formulaireJeu = document.getElementById('formulaireJeu');
const boutonSoumettre = document.getElementById('boutonSoumettre');
const selectCollection = document.getElementById('collectionImages');
const zoneUploadImages = document.getElementById('zoneUploadImages');
const inputUploadImages = document.getElementById('uploadImages');
const selectModeJeu = document.getElementById('modeJeu');

// Affiche la zone d'upload uniquement si "Personnalisée" est sélectionné
selectCollection.addEventListener('change', (evenement) => {
  if (evenement.target.value === 'personnalisee') {
    zoneUploadImages.classList.remove('hidden');
  } else {
    zoneUploadImages.classList.add('hidden');
  }
});

// Écouteur principal : Démarrage d'une partie
formulaireJeu.addEventListener('submit', async function (evenement) {
  evenement.preventDefault(); // Empêche le rechargement brutal de la page
  
  const pseudo = document.getElementById('nomJoueur').value;
  const difficulte = document.getElementById('difficulte').value;
  const nomCollection = selectCollection.value;
  const mode = selectModeJeu.value;

  // Gestion des IMAGES PERSONNALISÉES (Upload local)
  let imagesPersonnalisees = [];
  if (nomCollection === 'personnalisee') {
    const fichiers = inputUploadImages.files;
    const pairesRequises = difficulte === 'easy' ? 4 : (difficulte === 'medium' ? 6 : 8);
    
    // Sécurité : On vérifie que l'utilisateur a envoyé assez d'images
    if (fichiers.length < pairesRequises) {
      alert(`Veuillez uploader au moins ${pairesRequises} images pour cette difficulté.`);
      return; 
    }
    
    // Conversion des fichiers image en URL temporaires utilisables par le navigateur
    for (let i = 0; i < pairesRequises; i++) {
      imagesPersonnalisees.push({ id: i + 1, nom: fichiers[i].name, url: URL.createObjectURL(fichiers[i]) });
    }
  }

  boutonSoumettre.textContent = 'Connexion API...';
  boutonSoumettre.disabled = true;

  try {
    // Étape 1 : On tente de créer la partie sur le serveur de l'IUT
    const donnees = await ApiService.creerPartie(pseudo, difficulte);
    jeu.demarrerPartie(donnees.id, pseudo, difficulte, nomCollection, imagesPersonnalisees, mode);
  } catch (erreur) {
    // Fallback : Si l'API IUT est éteinte, on lance le jeu avec un ID local aléatoire
    jeu.demarrerPartie(Math.floor(Math.random() * 10000), pseudo, difficulte, nomCollection, imagesPersonnalisees, mode);
  } finally {
    boutonSoumettre.textContent = 'Démarrer la partie';
    boutonSoumettre.disabled = false;
  }
});

// Bouton Abandonner : Demande confirmation avant de quitter
document.getElementById('abandon').addEventListener('click', () => {
  if (confirm("Es-tu sûr de vouloir abandonner cette partie ? (En classé, tu perdras des points !)")) {
    jeu.terminerPartie(false); 
  }
});

// Bouton Indice (Joker) : Appelle la méthode triche de la classe Game
document.getElementById('boutonIndice').addEventListener('click', () => {
  jeu.utiliserIndice();
});

// Bouton Rejouer (Fin de partie) : Relance la boucle de jeu
document.getElementById('boutonRejouer').addEventListener('click', () => {
  gestionnaireDOM.afficherFormulaire();
});

// Callback déclenché par Game.js lorsque la partie se termine
jeu.auFini = async (resultat) => {
  // Récupération de l'Elo du joueur depuis le cache du navigateur
  let joueursElo = JSON.parse(localStorage.getItem('memory_elos')) || {};
  let eloActuel = joueursElo[resultat.nomJoueur] || 500;

  // SCÉNARIO 1 : Le joueur a abandonné
  if (!resultat.estVictoire) {
    if (resultat.mode === 'classe') {
      eloActuel -= 30; // Pénalité stricte
      if (eloActuel < 500) eloActuel = 500;
      joueursElo[resultat.nomJoueur] = eloActuel;
      localStorage.setItem('memory_elos', JSON.stringify(joueursElo));
      alert(`⚠️ Abandon !\nTu perds 30 points d'Elo.\nTon nouvel Elo : ${eloActuel} (${calculerRangElo(eloActuel)})`);
    } else {
      alert("Partie abandonnée. Retour au menu principal !");
    }
    gestionnaireDOM.afficherFormulaire();
    return;
  }

  // SCÉNARIO 2 : Victoire en Mode Normal
  if (resultat.mode === 'normal') {
    alert(`🎉 Victoire ${resultat.nomJoueur} !\n\n⏱️ Temps : ${resultat.temps}s\n🔄 Mouvements : ${resultat.mouvements}\n\n(Mode Normal : Aucun impact sur ton Elo)`);
    gestionnaireDOM.afficherFormulaire();
  } 
  
  // SCÉNARIO 3 : Victoire en Mode Classé
  else {
    // Calcul de la montée/descente d'Elo
    let variation = calculerVariationElo(resultat.difficulte, resultat.temps, resultat.mouvements);
    eloActuel += variation;
    if (eloActuel < 500) eloActuel = 500; 
    
    // Sauvegarde de l'Elo mis à jour
    joueursElo[resultat.nomJoueur] = eloActuel;
    localStorage.setItem('memory_elos', JSON.stringify(joueursElo));

    let rangActuel = calculerRangElo(eloActuel);
    let signe = variation >= 0 ? '+' : '';
    alert(`🏆 VICTOIRE CLASSÉE !\n\n⏱️ Temps : ${resultat.temps}s\n🔄 Mouvements : ${resultat.mouvements}\n\n📈 Variation Elo : ${signe}${variation}\nTon nouveau rang : ${rangActuel} (${eloActuel} Elo)`);

    // Préparation des données pour le classement
    let gameData = {
      name: resultat.nomJoueur,
      difficulty: resultat.difficulte,
      time: resultat.temps,
      moves: resultat.mouvements,
      elo: eloActuel,
      rank: rangActuel,
      date: new Date().toISOString()
    };

    // Sauvegarde en mémoire locale (Fallback de sécurité)
    let historique = JSON.parse(localStorage.getItem('memory_historique_elo')) || [];
    historique.push(gameData);
    localStorage.setItem('memory_historique_elo', JSON.stringify(historique));

    // Sauvegarde sur le serveur Cloud (Si disponible)
    if (baseDeDonnees && utilisateurActuel) {
      try {
        const refCollection = collection(baseDeDonnees, 'artifacts', identifiantApp, 'public', 'data', 'classement_elo');
        await addDoc(refCollection, gameData);
      } catch (e) {
        console.error("Erreur d'enregistrement Cloud:", e);
      }
    }

    // On bascule sur l'écran du classement global
    afficherClassement(resultat.difficulte);
  }
};

// ============================================================================
// 4. GESTION DU LEADERBOARD (Mondial ou Local)
// ============================================================================

/**
 * Gère la logique pour récupérer les scores et construire le tableau HTML.
 * Essaie d'abord Firebase, puis bascule sur le LocalStorage en cas d'échec.
 */
function afficherClassement(difficulteActuelle) {
  const libelleDifficulte = difficulteActuelle === 'easy' ? 'Facile' : (difficulteActuelle === 'medium' ? 'Moyen' : 'Difficile');
  
  // Affiche un écran de chargement pour rassurer l'utilisateur
  gestionnaireDOM.afficherClassement(libelleDifficulte, '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Chargement des données...</td></tr>');

  // Si on est connecté au Cloud
  if (baseDeDonnees && utilisateurActuel) {
    const refCollection = collection(baseDeDonnees, 'artifacts', identifiantApp, 'public', 'data', 'classement_elo');
    
    // onSnapshot permet d'écouter la base de données en temps réel !
    onSnapshot(refCollection, (instantané) => {
      let allDocs = [];
      instantané.forEach(document => allDocs.push(document.data()));
      
      // On trie par date pour s'assurer que le score qu'on garde est bien le plus récent
      allDocs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // On écrase les anciens scores d'un joueur pour n'afficher que son Elo actuel
      let derniersScoresParJoueur = {};
      allDocs.forEach(data => {
        if (data.difficulty === difficulteActuelle) {
          derniersScoresParJoueur[data.name] = data; 
        }
      });
      
      let scores = Object.values(derniersScoresParJoueur);
      scores.sort((a, b) => b.elo - a.elo); // On trie pour mettre le 1er mondial en haut
      rendreTableauHTML(scores.slice(0, 10), libelleDifficulte); // On ne prend que le Top 10
    }, (erreur) => {
      // Si la requête plante (ex: perte de co), on lance le mode Hors-ligne
      chargerClassementLocal(difficulteActuelle, libelleDifficulte);
    });
  } else {
    // Mode hors-ligne direct
    chargerClassementLocal(difficulteActuelle, libelleDifficulte);
  }
}

/**
 * Fonction de secours pour afficher le classement même sans connexion Internet,
 * en lisant les données sauvegardées dans le navigateur.
 */
function chargerClassementLocal(difficulteActuelle, libelleDifficulte) {
  let historiques = JSON.parse(localStorage.getItem('memory_historique_elo')) || [];
  
  historiques.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  let derniersScoresParJoueur = {};
  historiques.forEach(d => {
    if (d.difficulty === difficulteActuelle) {
      derniersScoresParJoueur[d.name] = d;
    }
  });
  
  let listeScores = Object.values(derniersScoresParJoueur);
  listeScores.sort((a, b) => b.elo - a.elo); 
  rendreTableauHTML(listeScores.slice(0, 10), libelleDifficulte);
}

/**
 * Génère le code HTML du tableau et l'envoie au DOMManager pour l'affichage.
 */
function rendreTableauHTML(scores, libelleDifficulte) {
  let html = '';
  if (scores.length === 0) {
    html = '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Aucun score classé. Prends la 1ère place !</td></tr>';
  } else {
    scores.forEach((score, index) => {
      // Formatage du temps en MM:SS
      const min = Math.floor(score.time / 60).toString().padStart(2, '0');
      const sec = (score.time % 60).toString().padStart(2, '0');
      
      // Attribution des médailles pour le Top 3
      const medaille = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
      
      html += `
        <tr>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">#${index + 1} ${medaille}</td>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight:bold;">${score.name}</td>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight:bold;">${score.rank}</td>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); color: gold; font-weight: bold;">${score.elo}</td>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); color:var(--color-timer); font-family:monospace;">${min}:${sec}</td>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">${score.moves}</td>
        </tr>
      `;
    });
  }
  gestionnaireDOM.afficherClassement(libelleDifficulte, html);
}