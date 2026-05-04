import { DOMManager } from './DOMManager.js';
import { Game } from './Game.js';
import { ApiService } from './ApiService.js';

// --- INITIALISATION FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let baseDeDonnees = null;
let utilisateurActuel = null;
let identifiantApp = 'memory-sae-201'; 

const initialiserFirebase = async () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      const configFirebase = JSON.parse(__firebase_config);
      const app = initializeApp(configFirebase);
      const authentification = getAuth(app);
      baseDeDonnees = getFirestore(app);
      identifiantApp = typeof __app_id !== 'undefined' ? __app_id : identifiantApp;

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

// --- MATHÉMATIQUES ELO ---
function calculerRangElo(elo) {
  if (elo < 500) elo = 500;
  const paliers = ["🟤 Bronze", "⚪ Argent", "🟡 Or", "🟢 Platine", "🔵 Diamant", "🟣 Master", "🔴 Challenger"];
  const indexPalier = Math.floor((elo - 500) / 300);
  if (indexPalier >= paliers.length - 1) return "🔴 Challenger 👑";
  const sousNiveau = 3 - Math.floor(((elo - 500) % 300) / 100);
  return `${paliers[indexPalier]} ${sousNiveau}`;
}

function calculerVariationElo(difficulte, temps, mouvements) {
  let parTemps, parMouvements;
  if (difficulte === 'easy') { parTemps = 20; parMouvements = 10; }
  else if (difficulte === 'medium') { parTemps = 45; parMouvements = 18; }
  else { parTemps = 75; parMouvements = 26; } 

  let diffTemps = parTemps - temps;
  let diffMouvements = parMouvements - mouvements;

  let variation = Math.round((diffTemps * 0.5) + (diffMouvements * 1.5));

  if (difficulte === 'easy') variation -= 15; 
  if (difficulte === 'hard') variation += 15; 

  if (variation > 50) variation = 50;
  if (variation < -30) variation = -30;
  return variation;
}

// --- LOGIQUE DU JEU ---
const gestionnaireDOM = new DOMManager();
const jeu = new Game(gestionnaireDOM);

const formulaireJeu = document.getElementById('formulaireJeu');
const boutonSoumettre = document.getElementById('boutonSoumettre');
const selectCollection = document.getElementById('collectionImages');
const zoneUploadImages = document.getElementById('zoneUploadImages');
const inputUploadImages = document.getElementById('uploadImages');
const selectModeJeu = document.getElementById('modeJeu');

selectCollection.addEventListener('change', (evenement) => {
  if (evenement.target.value === 'personnalisee') {
    zoneUploadImages.classList.remove('hidden');
  } else {
    zoneUploadImages.classList.add('hidden');
  }
});

formulaireJeu.addEventListener('submit', async function (evenement) {
  evenement.preventDefault(); 
  
  const pseudo = document.getElementById('nomJoueur').value;
  const difficulte = document.getElementById('difficulte').value;
  const nomCollection = selectCollection.value;
  const mode = selectModeJeu.value;

  let imagesPersonnalisees = [];
  if (nomCollection === 'personnalisee') {
    const fichiers = inputUploadImages.files;
    const pairesRequises = difficulte === 'easy' ? 4 : (difficulte === 'medium' ? 6 : 8);
    if (fichiers.length < pairesRequises) {
      alert(`Veuillez uploader au moins ${pairesRequises} images pour cette difficulté.`);
      return; 
    }
    for (let i = 0; i < pairesRequises; i++) {
      imagesPersonnalisees.push({ id: i + 1, nom: fichiers[i].name, url: URL.createObjectURL(fichiers[i]) });
    }
  }

  boutonSoumettre.textContent = 'Connexion...';
  boutonSoumettre.disabled = true;

  try {
    const donnees = await ApiService.creerPartie(pseudo, difficulte);
    jeu.demarrerPartie(donnees.id, pseudo, difficulte, nomCollection, imagesPersonnalisees, mode);
  } catch (erreur) {
    jeu.demarrerPartie(Math.floor(Math.random() * 10000), pseudo, difficulte, nomCollection, imagesPersonnalisees, mode);
  } finally {
    boutonSoumettre.textContent = 'Démarrer la partie';
    boutonSoumettre.disabled = false;
  }
});

document.getElementById('abandon').addEventListener('click', () => {
  if (confirm("Es-tu sûr de vouloir abandonner cette partie ?")) {
    jeu.terminerPartie(false); 
  }
});

document.getElementById('boutonIndice').addEventListener('click', () => {
  jeu.utiliserIndice();
});

document.getElementById('boutonRejouer').addEventListener('click', () => {
  gestionnaireDOM.afficherFormulaire();
});

// Fin de Partie
jeu.auFini = async (resultat) => {
  let joueursElo = JSON.parse(localStorage.getItem('memory_elos')) || {};
  let eloActuel = joueursElo[resultat.nomJoueur] || 500;

  if (!resultat.estVictoire) {
    if (resultat.mode === 'classe') {
      eloActuel -= 30;
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

  if (resultat.mode === 'normal') {
    alert(`🎉 Victoire ${resultat.nomJoueur} !\n\n⏱️ Temps : ${resultat.temps}s\n🔄 Mouvements : ${resultat.mouvements}`);
    gestionnaireDOM.afficherFormulaire();
  } else {
    let variation = calculerVariationElo(resultat.difficulte, resultat.temps, resultat.mouvements);
    eloActuel += variation;
    if (eloActuel < 500) eloActuel = 500;
    
    joueursElo[resultat.nomJoueur] = eloActuel;
    localStorage.setItem('memory_elos', JSON.stringify(joueursElo));

    let rangActuel = calculerRangElo(eloActuel);
    let signe = variation >= 0 ? '+' : '';
    alert(`🏆 VICTOIRE CLASSÉE !\n\n⏱️ Temps : ${resultat.temps}s\n🔄 Mouvements : ${resultat.mouvements}\n\n📈 Variation Elo : ${signe}${variation}\nTon nouveau rang : ${rangActuel} (${eloActuel} Elo)`);

    let historique = JSON.parse(localStorage.getItem('memory_historique_elo')) || [];
    let gameData = {
      name: resultat.nomJoueur,
      difficulty: resultat.difficulte,
      time: resultat.temps,
      moves: resultat.mouvements,
      elo: eloActuel,
      rank: rangActuel,
      date: new Date().toISOString()
    };
    historique.push(gameData);
    localStorage.setItem('memory_historique_elo', JSON.stringify(historique));

    if (baseDeDonnees && utilisateurActuel) {
      try {
        const refCollection = collection(baseDeDonnees, 'artifacts', identifiantApp, 'public', 'data', 'classement_elo');
        await addDoc(refCollection, gameData);
      } catch (e) {
        console.error("Erreur d'enregistrement:", e);
      }
    }

    afficherClassement(resultat.difficulte);
  }
};

// --- AFFICHAGE DU CLASSEMENT ---
function afficherClassement(difficulteActuelle) {
  const libelleDifficulte = difficulteActuelle === 'easy' ? 'Facile' : (difficulteActuelle === 'medium' ? 'Moyen' : 'Difficile');
  
  // Affiche temporairement le panneau de chargement
  gestionnaireDOM.afficherClassement(libelleDifficulte, '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Chargement du réseau mondial...</td></tr>');

  if (baseDeDonnees && utilisateurActuel) {
    const refCollection = collection(baseDeDonnees, 'artifacts', identifiantApp, 'public', 'data', 'classement_elo');
    onSnapshot(refCollection, (instantané) => {
      let meilleursScoresParJoueur = {};

      instantané.forEach(document => {
        let data = document.data();
        if (data.difficulty === difficulteActuelle) {
          if (!meilleursScoresParJoueur[data.name] || meilleursScoresParJoueur[data.name].elo < data.elo) {
            meilleursScoresParJoueur[data.name] = data;
          }
        }
      });
      
      let scores = Object.values(meilleursScoresParJoueur);
      scores.sort((a, b) => b.elo - a.elo);
      rendreTableauHTML(scores.slice(0, 10), libelleDifficulte);
    }, (erreur) => {
      chargerClassementLocal(difficulteActuelle, libelleDifficulte);
    });
  } else {
    chargerClassementLocal(difficulteActuelle, libelleDifficulte);
  }
}

function chargerClassementLocal(difficulteActuelle, libelleDifficulte) {
  let historiques = JSON.parse(localStorage.getItem('memory_historique_elo')) || [];
  let scoresFiltres = historiques.filter(s => s.difficulty === difficulteActuelle);
  
  let meilleursScoresParJoueur = {};
  scoresFiltres.forEach(d => {
    if (!meilleursScoresParJoueur[d.name] || meilleursScoresParJoueur[d.name].elo < d.elo) {
      meilleursScoresParJoueur[d.name] = d;
    }
  });
  
  let listeScores = Object.values(meilleursScoresParJoueur);
  listeScores.sort((a, b) => b.elo - a.elo);
  rendreTableauHTML(listeScores.slice(0, 10), libelleDifficulte);
}

function rendreTableauHTML(scores, libelleDifficulte) {
  let html = '';
  if (scores.length === 0) {
    html = '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Aucun score classé. Prends la 1ère place !</td></tr>';
  } else {
    scores.forEach((score, index) => {
      const min = Math.floor(score.time / 60).toString().padStart(2, '0');
      const sec = (score.time % 60).toString().padStart(2, '0');
      const medaille = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
      
      html += `
        <tr>
          <td style="padding: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">${index + 1} ${medaille}</td>
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