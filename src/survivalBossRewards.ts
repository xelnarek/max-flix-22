import { getSurvivalUpgradeRarityMeta } from './survivalRarity.ts';

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
 * Boss rewards now reinforce the operator, not the retired autonomous-weapon
 * progression system. Each boss always offers damage, mobility or defence.
 */
export function createSurvivalBossRewardOptions(): SurvivalBossRewardOption[] {
  const legendary = { ...getSurvivalUpgradeRarityMeta('legendary'), rarity: 'legendary' as const };

  return [
    {
      id: 'boss_damage_core',
      icon: '🎯',
      title: 'RDZEŃ MOCY',
      description: '+24% obrażeń wszystkich ataków. Trwałe wzmocnienie tej rozgrywki.',
      ...legendary,
    },
    {
      id: 'boss_mobility_core',
      icon: '🏃',
      title: 'MOBILNOŚĆ TAKTYCZNA',
      description: '+8% szybkości ruchu i 8% krótszy czas odnowienia uniku. Trwałe wzmocnienie tej rozgrywki.',
      ...legendary,
    },
    {
      id: 'boss_bulwark',
      icon: '🛡️',
      title: 'BASTION HALI',
      description: '+2 maks. HP, natychmiastowe leczenie o 2 HP i osłona na jedno trafienie.',
      ...legendary,
    },
  ];
}
