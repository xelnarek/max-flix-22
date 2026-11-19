/**
 * User-authored enemy models from the Absurd Enemy Asset Lab in Base44.
 * The build script mirrors these public source files into public/assets/base44-enemies
 * so the Android/Web build can load them locally. The runtime URL remains a CDN
 * fallback for development previews where the asset preparation step was skipped.
 */
export const BASE44_ENEMY_ASSETS = Object.freeze({
  pierogowy_kolos: {
    file: "Pierogowy_Kolos.glb",
    url: "https://media.base44.com/files/public/6afe90bbe1413d39425726f1/cf5a4bd40_Pierogowy_Kolos.glb",
    label: "Pierogowy Kolos",
  },
  ksiegowy_otchlani: {
    file: "Ksiegowy_Otchlani.glb",
    url: "https://media.base44.com/files/public/6afe90bbe1413d39425726f1/c727adac2_Ksiegowy_Otchlani.glb",
    label: "Księgowy Otchłani",
  },
  turbo_golab: {
    file: "Turbo_Golab.glb",
    url: "https://media.base44.com/files/public/6afe90bbe1413d39425726f1/2114d6ff9_Turbo_Golab.glb",
    label: "Turbo Gołąb",
  },
  janusz_rakietnik: {
    file: "Janusz_Rakietnik.glb",
    url: "https://media.base44.com/files/public/6afe90bbe1413d39425726f1/fd164ab2a_Janusz_Rakietnik.glb",
    label: "Janusz Rakietnik",
  },
  kapibara_mafioso: {
    file: "Kapibara_Mafioso.glb",
    url: "https://media.base44.com/files/public/6afe90bbe1413d39425726f1/80c3f7e49_Kapibara_Mafioso.glb",
    label: "Kapibara Mafioso",
  },
  parowkowy_berserker: {
    file: "Parowkowy_Berserker.glb",
    url: "https://media.base44.com/files/public/6afe90bbe1413d39425726f1/e486dd164_Parowkowy_Berserker.glb",
    label: "Parówkowy Berserker",
  },
});

export const BASE44_ENEMY_MODEL_IDS = Object.freeze(Object.keys(BASE44_ENEMY_ASSETS));
