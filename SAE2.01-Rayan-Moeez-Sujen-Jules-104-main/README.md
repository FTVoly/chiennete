Membres :

* 104 MOHAMED Rayan
* 104 BIENVENU Jules
* 104 MOHAMED AKRAM Moeez
* 104 RASAKUMARAN Sujen

Fonctionalité ajoutés:

* Mode classé avec un leaderboard
* Compteur de mouvement
* Possibilité de jouer avec ces propres images
* Bouton d'indice montrant toutes les cartes qui ne sont toujours pas retournné et rajoute 15s au chrono
* Système d'elo

### Système d'elo ###

**Fonctionnement de l'algorithme :**
* Évaluation dynamique : À l'issue d'une partie classée, le système calcule une variation de points d'Elo. L'algorithme compare le temps écoulé et le nombre de mouvements effectués par le joueur par rapport à un score parfait théorique, qui s'adapte selon la difficulté choisie.
* Progression et Paliers : Tout nouveau joueur débute avec 500 points d'Elo, ce qui correspond au rang Bronze 3. En optimisant sa mémoire et sa vitesse, le joueur accumule des points pour gravir les échelons tous les 100 points (Argent, Or, Platine, Diamant, etc., jusqu'à Challenger). À l'inverse, une partie trop lente ou avec trop d'erreurs entraîne une perte de points.
* Intégrité compétitive : Quitter une partie classée en cours de route à l'aide du bouton "Abandonner" est considéré comme une fuite et est sanctionné par une perte sèche de 30 points d'Elo.
* Persistance des données : L'historique, les rangs et le classement sont sauvegardés en temps réel.