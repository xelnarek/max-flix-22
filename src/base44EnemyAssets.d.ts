export type Base44EnemyModelId =
  | 'pierogowy_kolos'
  | 'ksiegowy_otchlani'
  | 'turbo_golab'
  | 'janusz_rakietnik'
  | 'kapibara_mafioso'
  | 'parowkowy_berserker';

export interface Base44EnemyAsset {
  readonly file: string;
  readonly url: string;
  readonly label: string;
}

export const BASE44_ENEMY_ASSETS: Readonly<Record<Base44EnemyModelId, Base44EnemyAsset>>;
export const BASE44_ENEMY_MODEL_IDS: readonly Base44EnemyModelId[];
