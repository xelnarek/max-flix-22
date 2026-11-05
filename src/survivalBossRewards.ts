import { getSurvivalUpgradeRarityMeta } from './survivalRarity.ts';

export interface SurvivalBossWeaponOffer {
  kind: 'unlock' | 'upgrade';
  id: string;
  name: string;
  icon: string;
  currentLevel?: number;
}

export interface SurvivalBossRewardOption {
  id: string;
  icon: string;
  title: string;
  description: string;
  rarity: 'legendary';
  rarityLabel: string;
  strengthMultiplier: number;
}

/**
 * A boss should always leave a meaningful three-way choice:
 * offensive module, weapon progression, or a defensive reset.
 * When every weapon has reached level five, the weapon slot becomes a
 * permanent arsenal tempo upgrade rather than a dead-end card.
 */
export function createSurvivalBossRewardOptions(
  weaponOffer?: SurvivalBossWeaponOffer,
): SurvivalBossRewardOption[] {
  const legendary = { ...getSurvivalUpgradeRarityMeta('legendary'), rarity: 'legendary' as const };
  let weaponReward: Omit<SurvivalBossRewardOption, 'rarity' | 'rarityLabel' | 'strengthMultiplier'>;

  if (weaponOffer?.kind === 'unlock') {
    weaponReward = {
      id: 'weapon_unlock:' + weaponOffer.id,
      icon: weaponOffer.icon,
      title: 'NOWA BROŃ: ' + weaponOffer.name.toUpperCase(),
      description: 'Odblokowujesz nową broń od razu na legendarnym poziomie startowym 3/5.',
    };
  } else if (weaponOffer?.kind === 'upgrade') {
    const currentLevel = Math.max(1, Math.min(4, Math.floor(weaponOffer.currentLevel || 1)));
    const targetLevel = Math.min(5, currentLevel + 2);
    weaponReward = {
      id: 'weapon_upgrade:' + weaponOffer.id,
      icon: weaponOffer.icon,
      title: weaponOffer.name.toUpperCase() + ' • POZIOM ' + targetLevel,
      description: 'Legendarny rozwój broni: poziom ' + currentLevel + ' → ' + targetLevel + '/5.',
    };
  } else {
    weaponReward = {
      id: 'boss_weapon_overdrive',
      icon: '⚙️',
      title: 'PRZECIĄŻENIE ARSENAŁU',
      description: 'Wszystkie ataki operatora i broń Survival odzyskują gotowość o 8% szybciej.',
    };
  }

  return [
    {
      id: 'boss_damage_core',
      icon: '🎯',
      title: 'RDZEŃ MOCY',
      description: '+24% obrażeń wszystkich ataków. Trwałe wzmocnienie tej rozgrywki.',
      ...legendary,
    },
    { ...weaponReward, ...legendary },
    {
      id: 'boss_bulwark',
      icon: '🛡️',
      title: 'BASTION HALI',
      description: '+2 maks. HP, natychmiastowe leczenie o 2 HP i osłona na jedno trafienie.',
      ...legendary,
    },
  ];
}
