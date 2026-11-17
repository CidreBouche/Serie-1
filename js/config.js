// config.js — réglages de déploiement.
//
// Identifiant client OAuth Google (« ID client » de type Application Web), créé
// dans la console Google Cloud — voir README, section « Synchronisation Google
// Drive ». Ce n'est pas un secret : il est visible dans toute app web, et Google
// ne l'accepte que depuis les adresses (origines) autorisées dans la console.
//
// Laisse vide pour désactiver la synchro. On peut aussi le coller dans
// Réglages → Synchronisation (stocké alors sur l'appareil, prioritaire sur ce fichier).
export const GOOGLE_CLIENT_ID = '1080694250860-47p62i9ugmi4tvdrkl686c0tu56jjdj8.apps.googleusercontent.com';
