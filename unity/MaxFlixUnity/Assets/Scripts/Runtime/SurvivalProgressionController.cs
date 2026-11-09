using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// XP pickups, Archero-style three-card draft, named rank promotions,
    /// weapon unlocks/upgrades/evolutions and a small set of run passives.
    /// XP is collected in-world; a draft freezes simulation until a choice.
    /// </summary>
    public sealed class SurvivalProgressionController : MonoBehaviour
    {
        private sealed class XpOrb
        {
            public GameObject Root;
            public int Value;
            public float Life;
            public float Phase;
        }

        private sealed class CardButton
        {
            public SurvivalUpgradeCard Card;
            public Button Button;
        }

        private static Material _orbMaterial;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int ColorId = Shader.PropertyToID("_Color");

        private readonly List<XpOrb> _orbs = new List<XpOrb>();
        private readonly List<GameObject> _orbPool = new List<GameObject>();
        private readonly Dictionary<string, int> _passiveStacks = new Dictionary<string, int>();
        private readonly List<SurvivalUpgradeCard> _currentCards = new List<SurvivalUpgradeCard>();
        private readonly MaterialPropertyBlock _orbProperties = new MaterialPropertyBlock();

        private PlayerController _player;
        private HudController _hud;
        private SurvivalWeaponController _weapons;
        private GameObject _draftCanvas;
        private Text _draftTitle;
        private Text _draftSubtitle;
        private Button _rerollButton;
        private Text _rerollLabel;
        private int _level = 1;
        private int _xp;
        private int _xpToNext = 9;
        private int _kills;
        private int _rerolls;
        private float _xpGrowthMultiplier = 1f;
        private float _magnetMultiplier = 1f;
        private bool _isBossReward;
        private bool _isPromotion;

        public int Level { get { return _level; } }
        public int CurrentXp { get { return _xp; } }
        public int XpToNext { get { return _xpToNext; } }
        public string RankName { get { return SurvivalWeaponCatalog.GetRankName(_level); } }
        public int Rerolls { get { return _rerolls; } }

        public void Initialize(PlayerController player, HudController hud, SurvivalWeaponController weapons)
        {
            _player = player;
            _hud = hud;
            _weapons = weapons;
            _level = 1;
            _xp = 0;
            _xpToNext = SurvivalWeaponCatalog.GetXpRequirement(_level);
            _kills = 0;
            _rerolls = 0;
            _xpGrowthMultiplier = 1f;
            _magnetMultiplier = 1f;
            _passiveStacks.Clear();
            _orbs.Clear();
            _currentCards.Clear();
            UpdateHud();
        }

        public void OnEnemyDefeated(EnemyAgent enemy)
        {
            if (enemy == null || _player == null || GameSession.Current == null
                || GameSession.Current.Mode != GameMode.Survival) return;

            _kills = Mathf.Max(_kills + 1, GameSession.Current.Kills);
            EnemyArchetypeProfile profile = EnemyArchetypeCatalog.Get(enemy.Kind);
            bool mutatedElite = enemy.Kind == EnemyKind.MutantGammaForklift
                || enemy.Kind == EnemyKind.RadioactivePip
                || enemy.Kind == EnemyKind.CyberSalesman;
            int baseXp = profile.IsBoss ? 8 : mutatedElite ? 6 : profile.BaseHealth >= 4 ? 3 : 1;
            if (_kills > 0 && _kills % 8 == 0) baseXp += 2;
            SpawnXpOrb(enemy.transform.position + Vector3.up * 0.45f, baseXp);

            if (profile.IsBoss)
                OpenBossReward();
        }

        private void Update()
        {
            if (_player == null || GameSession.Current == null
                || GameSession.Current.Mode != GameMode.Survival
                || GameSession.Current.State != GameFlowState.Playing)
                return;

            float deltaTime = Time.deltaTime;
            Vector3 playerPosition = _player.transform.position;
            float pickupRadius = 1.6f * _magnetMultiplier;

            for (int i = _orbs.Count - 1; i >= 0; i--)
            {
                XpOrb orb = _orbs[i];
                if (orb.Root == null)
                {
                    _orbs.RemoveAt(i);
                    continue;
                }

                orb.Life -= deltaTime;
                orb.Phase += deltaTime * 2.8f;
                orb.Root.transform.Rotate(Vector3.up, deltaTime * 105f, Space.Self);
                Vector3 position = orb.Root.transform.position;
                position.y += Mathf.Sin(orb.Phase) * deltaTime * 0.12f;

                float distance = Vector3.Distance(playerPosition, position);
                if (distance < pickupRadius)
                {
                    Vector3 target = playerPosition + Vector3.up * 0.72f;
                    position = Vector3.MoveTowards(position, target, 7.5f * deltaTime);
                }
                orb.Root.transform.position = position;

                if (distance < 1.25f)
                {
                    CollectOrb(orb);
                    _orbs.RemoveAt(i);
                    continue;
                }

                if (orb.Life <= 0f)
                {
                    orb.Root.SetActive(false);
                    _orbs.RemoveAt(i);
                }
            }
        }

        private void SpawnXpOrb(Vector3 position, int value)
        {
            if (value <= 0) return;
            XpOrb orb = new XpOrb
            {
                Root = AcquireOrb(),
                Value = Mathf.Max(1, value),
                Life = 32f,
                Phase = UnityEngine.Random.value * 6.2831853f
            };
            if (orb.Root == null)
            {
                XpOrb closest = FindClosestOrb(position);
                if (closest != null) closest.Value = Mathf.Min(40, closest.Value + value);
                return;
            }
            orb.Root.transform.position = position;
            orb.Root.transform.localScale = Vector3.one * 0.34f;
            orb.Root.SetActive(true);
            _orbs.Add(orb);
        }

        private XpOrb FindClosestOrb(Vector3 position)
        {
            // At the visual cap, merge a new reward into an existing crystal instead
            // of allocating more scene objects during a dense horde.
            XpOrb best = null;
            float bestDistance = float.MaxValue;
            foreach (XpOrb orb in _orbs)
            {
                if (orb.Root == null) continue;
                float distance = (orb.Root.transform.position - position).sqrMagnitude;
                if (distance >= bestDistance) continue;
                bestDistance = distance;
                best = orb;
            }
            return best;
        }

        private GameObject AcquireOrb()
        {
            foreach (GameObject orb in _orbPool)
                if (orb != null && !orb.activeSelf) return orb;

            if (_orbPool.Count >= 48) return null;
            GameObject created = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            created.name = "Survival XP crystal";
            created.transform.SetParent(transform, false);
            Collider collider = created.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;

            Renderer renderer = created.GetComponent<Renderer>();
            if (renderer != null)
            {
                if (_orbMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    _orbMaterial = new Material(shader) { enableInstancing = true };
                }
                renderer.sharedMaterial = _orbMaterial;
                renderer.GetPropertyBlock(_orbProperties);
                _orbProperties.SetColor(BaseColorId, new Color(0.22f, 0.88f, 0.95f));
                _orbProperties.SetColor(ColorId, new Color(0.22f, 0.88f, 0.95f));
                renderer.SetPropertyBlock(_orbProperties);
            }
            created.SetActive(false);
            _orbPool.Add(created);
            return created;
        }

        private void CollectOrb(XpOrb orb)
        {
            SurvivalMapProfile map = GameContentCatalog.GetMap(GameSession.Current.SelectedMap);
            float mapXp = Mathf.Clamp(map.XpMultiplier, 0.65f, 1.75f);
            int amount = Mathf.Max(1, Mathf.RoundToInt(orb.Value * mapXp * _xpGrowthMultiplier));
            _xp += amount;
            GameSession.Current.Score += amount * 12;
            GameSession.Current.Coins += Mathf.Max(0, amount / 3);
            if (orb.Root != null) orb.Root.SetActive(false);
            UpdateHud();

            if (_xp >= _xpToNext && GameSession.Current.State == GameFlowState.Playing)
                BeginLevelUp(false);
        }

        private void BeginLevelUp(bool bossReward)
        {
            if (_draftCanvas != null || GameSession.Current == null
                || GameSession.Current.State != GameFlowState.Playing) return;

            _isBossReward = bossReward;
            if (!bossReward)
            {
                _xp = Mathf.Max(0, _xp - _xpToNext);
                _level++;
                _xpToNext = SurvivalWeaponCatalog.GetXpRequirement(_level);
                _isPromotion = SurvivalWeaponCatalog.IsPromotion(_level);
                if (_isPromotion) _rerolls = Mathf.Min(3, _rerolls + 1);
            }
            else
            {
                _isPromotion = false;
            }

            _currentCards.Clear();
            RollCards(null);
            GameSession.SetState(GameFlowState.LevelUp);
            Time.timeScale = 0f;
            BuildDraftUi();
            UpdateHud();
        }

        private void OpenBossReward()
        {
            if (_draftCanvas != null || GameSession.Current == null
                || GameSession.Current.State != GameFlowState.Playing) return;
            BeginLevelUp(true);
        }

        private void RollCards(HashSet<string> excluded)
        {
            List<SurvivalUpgradeCard> pool = new List<SurvivalUpgradeCard>();
            float elapsed = GameSession.Current != null ? GameSession.Current.ElapsedSeconds : 0f;

            foreach (SurvivalWeaponProfile definition in SurvivalWeaponCatalog.GetAll())
            {
                SurvivalWeaponController.WeaponState owned = _weapons != null ? _weapons.GetWeapon(definition.Id) : null;
                if (owned == null && elapsed >= definition.UnlockAfterSeconds)
                {
                    pool.Add(new SurvivalUpgradeCard
                    {
                        Id = "weapon_unlock:" + definition.Id,
                        Title = "NOWA BROŃ • " + definition.DisplayName.ToUpperInvariant(),
                        Description = definition.Description,
                        Icon = definition.Icon,
                        Weapon = definition.Id,
                        HasWeapon = true
                    });
                }
                else if (owned != null && owned.Level < 5)
                {
                    pool.Add(new SurvivalUpgradeCard
                    {
                        Id = "weapon_upgrade:" + definition.Id,
                        Title = definition.DisplayName.ToUpperInvariant() + " • POZIOM " + (owned.Level + 1),
                        Description = "Ulepsza obrażenia i stopniowo skraca przeładowanie. Poziom maksymalny: 5.",
                        Icon = definition.Icon,
                        Weapon = definition.Id,
                        HasWeapon = true
                    });
                }
                else if (owned != null && owned.Level >= 5 && !owned.Evolved && elapsed >= 210f
                    && GetPassiveStacks(definition.EvolutionPassive) > 0)
                {
                    pool.Add(new SurvivalUpgradeCard
                    {
                        Id = "weapon_evolve:" + definition.Id,
                        Title = "EWOLUCJA • " + definition.EvolvedName,
                        Description = "Wymagania spełnione: poziom 5, moduł synergii i 3,5 minuty podejścia.",
                        Icon = "✦",
                        Weapon = definition.Id,
                        HasWeapon = true,
                        Rarity = SurvivalUpgradeRarity.Legendary
                    });
                }
            }

            AddPassive(pool, "damage", "WZMOCNIONA AMUNICJA", "+12% obrażeń broni Survival.", "◆", 8);
            AddPassive(pool, "rapid", "RYTM ATAKU", "Skrócenie przeładowania broni o 3%.", "⚡", 8);
            AddPassive(pool, "critical", "PRECYZYJNE TRAFIENIE", "+4 punkty procentowe szansy na trafienie krytyczne.", "◎", 5);
            AddPassive(pool, "critical_damage", "MOC KRYTYCZNA", "+0,20× do mnożnika obrażeń krytycznych.", "✦", 3);
            AddPassive(pool, "boots", "BUTY SPRINTU", "+6% prędkości poruszania się.", "➤", 5);
            AddPassive(pool, "magnet", "MAGNES XP", "Zwiększa zasięg przyciągania kryształów XP.", "⌖", 4);
            AddPassive(pool, "reinforced", "WZMOCNIONY KASK", "+1 maksymalny punkt zdrowia i natychmiastowe uzupełnienie.", "⛑", 5);
            AddPassive(pool, "medkit", "ZESTAW RATUNKOWY", "Odzyskaj punkt zdrowia i zyskaj osłonę na jedno trafienie.", "+", 3);
            AddPassive(pool, "range", "ZASIĘG AUDYTU", "+8% zasięgu automatycznego namierzania broni.", "◎", 4);
            AddPassive(pool, "growth", "PREMIA ZA NORMĘ", "+18% doświadczenia z kryształów.", "↗", 3);
            AddPassive(pool, "armor", "PALETA OCHRONNA", "Osłona pochłania następne trafienie.", "▤", 4);

            if (excluded != null) pool.RemoveAll(card => excluded.Contains(card.Id));
            if (pool.Count == 0)
            {
                AddPassive(pool, "damage", "WZMOCNIONA AMUNICJA", "+12% obrażeń broni Survival.", "◆", 12, true);
                AddPassive(pool, "rapid", "RYTM ATAKU", "Skrócenie przeładowania broni o 3%.", "⚡", 12, true);
                AddPassive(pool, "boots", "BUTY SPRINTU", "+6% prędkości poruszania się.", "➤", 12, true);
            }

            Shuffle(pool);
            int count = Mathf.Min(3, pool.Count);
            for (int i = 0; i < count; i++)
            {
                SurvivalUpgradeCard card = pool[i];
                SurvivalUpgradeRarity rarity = card.Rarity == SurvivalUpgradeRarity.Legendary
                    ? SurvivalUpgradeRarity.Legendary
                    : SurvivalWeaponCatalog.RollRarity(UnityEngine.Random.value, _level);
                if (_isBossReward) rarity = SurvivalUpgradeRarity.Legendary;
                if (_isPromotion && i == 0)
                    rarity = SurvivalWeaponCatalog.ApplyRarityFloor(rarity, SurvivalWeaponCatalog.GetPromotionRarityFloor(_level));

                card.Rarity = rarity;
                card.Strength = SurvivalWeaponCatalog.GetRarityStrength(rarity);
                string baseTitle = card.Title;
                card.Title = SurvivalWeaponCatalog.GetRarityLabel(rarity) + " • " + baseTitle;
                if (card.Id.StartsWith("weapon_unlock:", StringComparison.Ordinal))
                {
                    int initialLevel = SurvivalWeaponCatalog.GetInitialLevel(rarity);
                    card.Description += " Poziom startowy karty: " + initialLevel + "/5.";
                }
                if (card.Id.StartsWith("weapon_evolve:", StringComparison.Ordinal))
                    card.Description = SurvivalWeaponCatalog.Get(card.Weapon).EvolvedName + " osiąga swoją pełną formę.";
                _currentCards.Add(card);
            }
        }

        private void AddPassive(List<SurvivalUpgradeCard> pool, string id, string title,
            string description, string icon, int maxStacks, bool ignoreMax = false)
        {
            int stacks = GetPassiveStacks(id);
            if (!ignoreMax && stacks >= maxStacks) return;
            pool.Add(new SurvivalUpgradeCard
            {
                Id = id,
                Title = title + (maxStacks > 1 ? " • " + (stacks + 1) + "/" + maxStacks : string.Empty),
                Description = description,
                Icon = icon,
                HasWeapon = false
            });
        }

        private static void Shuffle<T>(IList<T> values)
        {
            for (int i = values.Count - 1; i > 0; i--)
            {
                int j = UnityEngine.Random.Range(0, i + 1);
                T value = values[i];
                values[i] = values[j];
                values[j] = value;
            }
        }

        private int GetPassiveStacks(string id)
        {
            return _passiveStacks.TryGetValue(id, out int value) ? value : 0;
        }

        private void BuildDraftUi()
        {
            EnsureEventSystem();
            _draftCanvas = new GameObject("Survival level-up draft", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Canvas canvas = _draftCanvas.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 120;
            CanvasScaler scaler = _draftCanvas.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1440f, 900f);
            scaler.matchWidthOrHeight = 0.5f;

            RectTransform root = (RectTransform)_draftCanvas.transform;
            Image shade = _draftCanvas.AddComponent<Image>();
            shade.color = new Color(0.01f, 0.02f, 0.04f, 0.86f);

            GameObject panel = new GameObject("Draft panel", typeof(RectTransform), typeof(Image), typeof(Outline));
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.SetParent(root, false);
            panelRect.anchorMin = new Vector2(0.04f, 0.07f);
            panelRect.anchorMax = new Vector2(0.96f, 0.93f);
            panelRect.offsetMin = Vector2.zero;
            panelRect.offsetMax = Vector2.zero;
            panel.GetComponent<Image>().color = new Color(0.045f, 0.075f, 0.11f, 0.99f);
            Outline outline = panel.GetComponent<Outline>();
            outline.effectColor = new Color(0.20f, 0.58f, 0.73f, 0.9f);
            outline.effectDistance = new Vector2(2f, -2f);

            string title = _isBossReward ? "NAGRODA BOSS-A" : _isPromotion
                ? "AWANS RANGI • " + RankName
                : "ROZWÓJ OPERATORA • POZIOM " + _level;
            _draftTitle = CreateText(panelRect, title, new Vector2(0.5f, 1f), new Vector2(0f, -24f),
                new Vector2(980f, 62f), 34, TextAnchor.MiddleCenter, Color.white);
            _draftSubtitle = CreateText(panelRect,
                _isBossReward ? "Pokonanie bossa daje wybór legendarnego ulepszenia." :
                "Wybierz jeden moduł. Symulacja jest wstrzymana do podjęcia decyzji.",
                new Vector2(0.5f, 1f), new Vector2(0f, -88f), new Vector2(1000f, 42f),
                18, TextAnchor.MiddleCenter, new Color(0.65f, 0.78f, 0.88f));

            CreateCardGrid(panelRect);
            CreateBottomControls(panelRect);
        }

        private void CreateCardGrid(RectTransform panelRect)
        {
            GameObject gridObject = new GameObject("Upgrade cards", typeof(RectTransform), typeof(GridLayoutGroup));
            RectTransform gridRect = gridObject.GetComponent<RectTransform>();
            gridRect.SetParent(panelRect, false);
            gridRect.anchorMin = new Vector2(0.04f, 0.18f);
            gridRect.anchorMax = new Vector2(0.96f, 0.78f);
            gridRect.offsetMin = Vector2.zero;
            gridRect.offsetMax = Vector2.zero;

            bool portrait = Screen.height > Screen.width;
            int columns = portrait ? 1 : Mathf.Min(3, Mathf.Max(1, _currentCards.Count));
            GridLayoutGroup grid = gridObject.GetComponent<GridLayoutGroup>();
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = columns;
            grid.spacing = new Vector2(14f, 14f);
            grid.padding = new RectOffset(3, 3, 3, 3);
            float scale = Mathf.Max(0.5f, _draftCanvas.GetComponent<Canvas>().scaleFactor);
            float availableWidth = Screen.width / scale * 0.88f - 30f;
            float width = portrait ? availableWidth : (availableWidth - (columns - 1) * 14f) / columns;
            float availableHeight = Screen.height / scale * 0.60f;
            float height = portrait ? Mathf.Clamp(availableHeight / Mathf.Max(1, _currentCards.Count), 108f, 154f) : Mathf.Clamp(availableHeight, 210f, 300f);
            grid.cellSize = new Vector2(Mathf.Max(210f, width), height);

            foreach (SurvivalUpgradeCard card in _currentCards)
                CreateUpgradeButton(gridRect, grid, card);
        }

        private void CreateUpgradeButton(RectTransform parent, GridLayoutGroup grid, SurvivalUpgradeCard card)
        {
            GameObject buttonObject = new GameObject(card.Title, typeof(RectTransform), typeof(Image), typeof(Button), typeof(Outline));
            RectTransform rect = buttonObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            Image image = buttonObject.GetComponent<Image>();
            Color accent = GetRarityColor(card.Rarity);
            image.color = Color.Lerp(new Color(0.05f, 0.09f, 0.14f, 0.99f), accent, 0.22f);
            Button button = buttonObject.GetComponent<Button>();
            button.targetGraphic = image;
            ColorBlock colors = button.colors;
            colors.normalColor = image.color;
            colors.highlightedColor = Color.Lerp(image.color, Color.white, 0.16f);
            colors.pressedColor = Color.Lerp(image.color, Color.black, 0.13f);
            button.colors = colors;
            button.onClick.AddListener(delegate { ChooseCard(card); });
            Outline outline = buttonObject.GetComponent<Outline>();
            outline.effectColor = accent;
            outline.effectDistance = new Vector2(2f, -2f);

            Text title = CreateText(rect, card.Icon + "  " + card.Title,
                new Vector2(0.5f, 1f), new Vector2(0f, -14f),
                new Vector2(0f, 58f), grid.cellSize.y > 180f ? 24 : 21,
                TextAnchor.MiddleCenter, accent);
            title.rectTransform.anchorMin = new Vector2(0f, 1f);
            title.rectTransform.anchorMax = new Vector2(1f, 1f);
            title.rectTransform.offsetMin = new Vector2(10f, -66f);
            title.rectTransform.offsetMax = new Vector2(-10f, -8f);

            Text description = CreateText(rect, card.Description,
                new Vector2(0.5f, 0.5f), Vector2.zero,
                new Vector2(0f, 0f), new Vector2(0f, 0f),
                grid.cellSize.y > 180f ? new Vector2(0f, 112f) : new Vector2(0f, 70f),
                17, TextAnchor.MiddleCenter, new Color(0.88f, 0.92f, 0.96f));
            description.rectTransform.anchorMin = new Vector2(0f, 0f);
            description.rectTransform.anchorMax = new Vector2(1f, 1f);
            description.rectTransform.offsetMin = new Vector2(14f, 12f);
            description.rectTransform.offsetMax = new Vector2(-14f, -70f);
            description.fontStyle = FontStyle.Normal;
            description.alignment = TextAnchor.MiddleCenter;
            description.raycastTarget = false;
        }

        private void CreateBottomControls(RectTransform panelRect)
        {
            Text progress = CreateText(panelRect,
                "XP  " + _xp + "/" + _xpToNext + "    •    " + RankName + "    •    PRZERZUTY " + _rerolls,
                new Vector2(0.5f, 0f), new Vector2(0f, 20f),
                new Vector2(900f, 34f), 16, TextAnchor.MiddleCenter, new Color(0.66f, 0.80f, 0.90f));

            _rerollButton = CreateButton(panelRect,
                _rerolls > 0 ? "PRZERZUĆ (" + _rerolls + ")" : "BRAK PRZERZUTÓW",
                new Vector2(0.5f, 0f), new Vector2(0f, 66f), new Vector2(280f, 62f),
                new Color(0.18f, 0.27f, 0.37f, 1f), delegate { RerollCards(); }, _rerolls > 0);
            _rerollLabel = _rerollButton.GetComponentInChildren<Text>();
            if (_rerollLabel != null) _rerollLabel.text = _rerolls > 0 ? "PRZERZUĆ (" + _rerolls + ")" : "BRAK PRZERZUTÓW";
        }

        private void ChooseCard(SurvivalUpgradeCard card)
        {
            if (_draftCanvas == null || card == null) return;
            ApplyCard(card);
            CloseDraft();
        }

        private void ApplyCard(SurvivalUpgradeCard card)
        {
            if (card.Id.StartsWith("weapon_unlock:", StringComparison.Ordinal))
            {
                if (SurvivalWeaponCatalog.TryParse(card.Id.Substring("weapon_unlock:".Length), out SurvivalWeaponKind weapon))
                    _weapons.UnlockWeapon(weapon, SurvivalWeaponCatalog.GetInitialLevel(card.Rarity));
            }
            else if (card.Id.StartsWith("weapon_upgrade:", StringComparison.Ordinal))
            {
                if (SurvivalWeaponCatalog.TryParse(card.Id.Substring("weapon_upgrade:".Length), out SurvivalWeaponKind weapon))
                    _weapons.UpgradeWeapon(weapon, SurvivalWeaponCatalog.GetUpgradeSteps(card.Rarity));
            }
            else if (card.Id.StartsWith("weapon_evolve:", StringComparison.Ordinal))
            {
                if (SurvivalWeaponCatalog.TryParse(card.Id.Substring("weapon_evolve:".Length), out SurvivalWeaponKind weapon))
                    _weapons.EvolveWeapon(weapon);
            }
            else
            {
                int stacks = GetPassiveStacks(card.Id) + 1;
                _passiveStacks[card.Id] = stacks;
                float strength = card.Strength;
                _weapons.ApplyPassive(card.Id, strength);
                switch (card.Id)
                {
                    case "boots":
                        _player.SetSurvivalMoveMultiplier(Mathf.Min(1.38f,
                            _player.SurvivalMoveMultiplier * (1f + 0.06f * strength)));
                        break;
                    case "magnet":
                        _magnetMultiplier = Mathf.Min(4.2f, _magnetMultiplier * (1f + 0.65f * strength));
                        break;
                    case "growth":
                        _xpGrowthMultiplier = Mathf.Min(3.2f, _xpGrowthMultiplier * (1f + 0.18f * strength));
                        break;
                    case "reinforced":
                        _player.IncreaseMaxHealth(Mathf.Max(1, Mathf.RoundToInt(strength)));
                        break;
                    case "medkit":
                        _player.RestoreHealth(Mathf.Max(1f, strength));
                        _player.GrantSurvivalShield(1);
                        break;
                    case "armor":
                        _player.GrantSurvivalShield(1);
                        break;
                }
            }

            _hud?.SetStatus(card.Title);
        }

        private void RerollCards()
        {
            if (_rerolls <= 0 || _isBossReward) return;
            _rerolls--;
            HashSet<string> excluded = new HashSet<string>();
            foreach (SurvivalUpgradeCard card in _currentCards) excluded.Add(card.Id);
            _currentCards.Clear();
            RollCards(excluded);
            if (_draftCanvas != null) Destroy(_draftCanvas);
            _draftCanvas = null;
            BuildDraftUi();
        }

        private void CloseDraft()
        {
            bool wasBossReward = _isBossReward;
            if (_draftCanvas != null) Destroy(_draftCanvas);
            _draftCanvas = null;
            _isBossReward = false;
            _isPromotion = false;
            Time.timeScale = 1f;
            GameSession.SetState(GameFlowState.Playing);
            UpdateHud();

            if (!wasBossReward && _xp >= _xpToNext)
                BeginLevelUp(false);
        }

        private void UpdateHud()
        {
            if (_hud == null) return;
            _hud.SetSurvivalProgress(_level, _xp, _xpToNext, RankName);
            _hud.SetWeaponsSummary(_weapons != null ? _weapons.GetWeaponSummary() : string.Empty);
        }

        private static Color GetRarityColor(SurvivalUpgradeRarity rarity)
        {
            switch (rarity)
            {
                case SurvivalUpgradeRarity.Rare: return new Color(0.22f, 0.65f, 0.98f);
                case SurvivalUpgradeRarity.Epic: return new Color(0.72f, 0.42f, 0.98f);
                case SurvivalUpgradeRarity.Legendary: return new Color(1f, 0.70f, 0.17f);
                default: return new Color(0.72f, 0.81f, 0.89f);
            }
        }

        private static Text CreateText(RectTransform parent, string value, Vector2 anchor, Vector2 position,
            Vector2 size, int fontSize, TextAnchor alignment, Color color)
        {
            GameObject obj = new GameObject("Text • " + value, typeof(RectTransform), typeof(Text), typeof(Outline));
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Text text = obj.GetComponent<Text>();
            text.text = value;
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.fontSize = fontSize;
            text.fontStyle = FontStyle.Bold;
            text.color = color;
            text.alignment = alignment;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            Outline outline = obj.GetComponent<Outline>();
            outline.effectColor = new Color(0f, 0f, 0f, 0.86f);
            outline.effectDistance = new Vector2(1.2f, -1.2f);
            return text;
        }

        private static Button CreateButton(RectTransform parent, string label, Vector2 anchor, Vector2 position,
            Vector2 size, Color color, UnityEngine.Events.UnityAction action, bool enabled)
        {
            GameObject obj = new GameObject(label, typeof(RectTransform), typeof(Image), typeof(Button));
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Image image = obj.GetComponent<Image>();
            image.color = color;
            Button button = obj.GetComponent<Button>();
            button.targetGraphic = image;
            button.interactable = enabled;
            ColorBlock colors = button.colors;
            colors.normalColor = color;
            colors.highlightedColor = Color.Lerp(color, Color.white, 0.18f);
            colors.pressedColor = Color.Lerp(color, Color.black, 0.12f);
            button.colors = colors;
            if (action != null) button.onClick.AddListener(action);
            Text text = CreateText(rect, label, new Vector2(0.5f, 0.5f), Vector2.zero, size, 17, TextAnchor.MiddleCenter, Color.white);
            text.rectTransform.anchorMin = Vector2.zero;
            text.rectTransform.anchorMax = Vector2.one;
            text.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            text.rectTransform.anchoredPosition = Vector2.zero;
            text.rectTransform.sizeDelta = Vector2.zero;
            return button;
        }

        private static void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            GameObject eventSystem = new GameObject("EventSystem", typeof(EventSystem));
            InputSystemUIInputModule module = eventSystem.AddComponent<InputSystemUIInputModule>();
            module.pointerBehavior = UIPointerBehavior.SingleMouseOrPenButMultiTouchAndTrack;
        }

        private void OnDestroy()
        {
            if (_draftCanvas != null) Destroy(_draftCanvas);
            for (int i = 0; i < _orbs.Count; i++)
                if (_orbs[i].Root != null) _orbs[i].Root.SetActive(false);
            _orbs.Clear();
            if (GameSession.Current != null && GameSession.Current.State == GameFlowState.LevelUp)
            {
                Time.timeScale = 1f;
                GameSession.SetState(GameFlowState.Playing);
            }
        }
    }
}
