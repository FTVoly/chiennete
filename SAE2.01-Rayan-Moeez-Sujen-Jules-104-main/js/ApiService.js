import { MEMORY_URL } from './config.js';

export class ApiService {
  
  /**
   * Crée une nouvelle partie sur le serveur de l'Université.
   * * @param {string} pseudo Le nom du joueur saisi dans le formulaire
   * @param {string} niveauDifficulte Le niveau (easy, medium, hard)
   * @returns {Promise<Object>} Un objet contenant l'id de la partie créée
   */
  static async creerPartie(pseudo, niveauDifficulte) {
    const reponse = await fetch(`${MEMORY_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: pseudo,
        difficulty: niveauDifficulte
      })
    });

    if (!reponse.ok) {
      throw new Error('Erreur création API : Le serveur IUT est probablement injoignable.');
    }

    // Le serveur renvoie { id: 1234 }
    return reponse.json();
  }

  /**
   * Ferme la partie sur le serveur en envoyant le score final.
   * * @param {number} idPartie L'identifiant généré lors du createGame
   * @param {number} pairesRestantes Doit être 0 si la partie est gagnée
   * @returns {Promise<Object>} La réponse du serveur
   */
  static async mettreAJourResultat(idPartie, pairesRestantes) {
    const reponse = await fetch(`${MEMORY_URL}/${idPartie}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nombreCoupsRestant: pairesRestantes,
      })
    });

    if (!reponse.ok) {
      throw new Error('Erreur mise à jour API : Score non sauvegardé sur le serveur IUT.');
    }

    return reponse;
  }
}