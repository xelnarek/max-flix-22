# Firebase account progression setup

The game currently uses Firebase project `round-tracker-6q6d2` and its named Firestore database
`ai-studio-maxflixvol2-938de3b7-0d7d-4164-9dae-7d99b2e46560`.

## Deploy the rules

The cloud profile path is:

`users/{firebaseUid}/gameData/accountProgression`

Reads and writes are restricted to the authenticated owner. The rule validator limits account level,
XP, talent IDs and rank values, prerequisites, point budget and statistics.

From the repository root, run:

```bash
npx firebase-tools login
npx firebase-tools use round-tracker-6q6d2
npm run firebase:deploy-rules
```

The CLI account must have permission to deploy Firestore rules to this Firebase project. This deploy
targets only the named database configured in `firebase.json`; it does not deploy Hosting, Functions,
or any other Firebase service. Inspect the target project and database before confirming the CLI prompt.

## Enable cross-device Google sign-in

In Firebase Console, open Authentication → Sign-in method and enable **Google**. Add
`xelnarek.github.io` to the authorized domains for Firebase Authentication.

In the game, open **DRZEWKO** or **RANGI**, use **SYNCHRONIZUJ**, and then **POŁĄCZ GOOGLE**.
The anonymous profile is saved before the identity is linked or switched. On another device, sign in
with the same Google account to load that Firebase UID's profile.

## Offline behaviour and limits

LocalStorage remains the immediate offline fallback. Cloud synchronization is attempted when a
progression panel opens and after run/match rewards or talent purchases. If Firebase is unreachable
or the rules have not been deployed, the game keeps the local profile and reports that the cloud is
unavailable.

A cloud sync does not make the game fully cheat-proof. PvP reconnect tokens protect room recovery;
they do not authenticate combat or prove that account XP was earned legitimately. Cross-device
sign-in uses Firebase Google Auth and depends on the provider and authorized domain being enabled.
