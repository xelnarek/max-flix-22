using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Runtime-built, responsive front end for the staged Unity port.
    /// Only modes with an implemented runtime path can be started.
    /// </summary>
    public sealed class MainMenuController : MonoBehaviour
    {
        private MainGameBootstrap _owner;
        private Canvas _canvas;
        private Text _selectionSummary;
        private Button _startButton;
        private GameMode _selectedMode = GameMode.Survival;
        private OperatorId _selectedOperator = OperatorId.Marcin;
        private WarehouseMapId _selectedMap = WarehouseMapId.WarehouseB4;
        private readonly Dictionary<GameMode, Button> _modeButtons = new Dictionary<GameMode, Button>();
        private readonly Dictionary<OperatorId, Button> _operatorButtons = new Dictionary<OperatorId, Button>();
        private readonly Dictionary<WarehouseMapId, Button> _mapButtons = new Dictionary<WarehouseMapId, Button>();

        public static MainMenuController Create(MainGameBootstrap owner)
        {
            EnsureEventSystem();

            GameObject canvasObject = new GameObject("Max Flix Main Menu", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;
            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1440f, 900f);
            scaler.matchWidthOrHeight = 0.5f;

            MainMenuController menu = canvasObject.AddComponent<MainMenuController>();
            menu._owner = owner;
            menu._canvas = canvas;
            menu.Build();
            return menu;
        }

        private void Build()
        {
            RectTransform root = (RectTransform)transform;
            Image background = gameObject.AddComponent<Image>();
            background.color = new Color(0.025f, 0.045f, 0.075f, 1f);

            CreateBackdropPanel(root, new Vector2(0f, 0.42f), new Vector2(1f, 1f),
                new Color(0.08f, 0.18f, 0.28f, 0.48f));
            CreateText(root, "MAX FLIX", new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0.5f, 1f), new Vector2(0f, -28f), new Vector2(900f, 66f),
                46, TextAnchor.MiddleCenter, new Color(0.97f, 0.98f, 1f));
            CreateText(root, "UNITY EDITION  •  MAGAZYN PRZETRWANIA", new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0.5f, 1f), new Vector2(0f, -93f), new Vector2(900f, 36f),
                18, TextAnchor.MiddleCenter, new Color(0.48f, 0.78f, 0.92f));

            GameObject scrollObject = new GameObject("Menu scroll viewport", typeof(RectTransform), typeof(Image), typeof(Mask), typeof(ScrollRect));
            RectTransform viewport = scrollObject.GetComponent<RectTransform>();
            viewport.SetParent(root, false);
            viewport.anchorMin = new Vector2(0.055f, 0.145f);
            viewport.anchorMax = new Vector2(0.945f, 0.83f);
            viewport.offsetMin = Vector2.zero;
            viewport.offsetMax = Vector2.zero;
            Image viewportImage = scrollObject.GetComponent<Image>();
            viewportImage.color = new Color(0.03f, 0.06f, 0.10f, 0.35f);
            scrollObject.GetComponent<Mask>().showMaskGraphic = false;

            GameObject contentObject = new GameObject("Menu content", typeof(RectTransform), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
            RectTransform content = contentObject.GetComponent<RectTransform>();
            content.SetParent(viewport, false);
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.anchoredPosition = Vector2.zero;
            content.sizeDelta = Vector2.zero;

            VerticalLayoutGroup vertical = contentObject.GetComponent<VerticalLayoutGroup>();
            vertical.padding = new RectOffset(18, 18, 22, 24);
            vertical.spacing = 17f;
            vertical.childAlignment = TextAnchor.UpperCenter;
            vertical.childControlWidth = true;
            vertical.childControlHeight = true;
            vertical.childForceExpandWidth = true;
            vertical.childForceExpandHeight = false;
            ContentSizeFitter fitter = contentObject.GetComponent<ContentSizeFitter>();
            fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            ScrollRect scroll = scrollObject.GetComponent<ScrollRect>();
            scroll.content = content;
            scroll.viewport = viewport;
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 42f;

            bool portrait = Screen.height > Screen.width;
            AddSectionTitle(content, "01  •  WYBIERZ TRYB");
            AddModeGrid(content, portrait);
            AddSectionTitle(content, "02  •  OPERATOR");
            AddOperatorGrid(content, portrait);
            AddSectionTitle(content, "03  •  MAPA");
            AddMapGrid(content, portrait);

            _selectionSummary = CreateText(root, string.Empty, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0.5f, 0f), new Vector2(0f, 118f), new Vector2(900f, 30f),
                16, TextAnchor.MiddleCenter, new Color(0.65f, 0.78f, 0.88f));

            _startButton = CreateButton(root, "ROZPOCZNIJ SURVIVAL", new Vector2(0.5f, 0f),
                new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 52f),
                new Vector2(520f, 92f), new Color(0.10f, 0.55f, 0.40f, 1f), 28,
                StartSelectedRun);
            CreateText(root, "PC: WASD • J ATAK • E SPECJALNA     |     DOTYK: JOYSTICK + PRZYCISKI",
                new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 10f), new Vector2(1000f, 24f), 13, TextAnchor.MiddleCenter,
                new Color(0.40f, 0.52f, 0.62f));

            RefreshSelection();
        }

        private void AddModeGrid(RectTransform content, bool portrait)
        {
            int columns = portrait ? 1 : 3;
            GridLayoutGroup grid = CreateGrid(content, "Game modes", columns, portrait ? 116f : 128f);
            AddGridButton(grid, GameMode.Survival, "SURVIVAL\nFale, elity i bossowie", new Color(0.10f, 0.34f, 0.31f),
                delegate { _selectedMode = GameMode.Survival; RefreshSelection(); }, true, _modeButtons);
            AddGridButton(grid, GameMode.Campaign, "KAMPANIA / B4\nObecnie: arena testowa", new Color(0.18f, 0.25f, 0.36f),
                delegate { _selectedMode = GameMode.Campaign; RefreshSelection(); }, true, _modeButtons);
            AddGridButton(grid, GameMode.PvP, "PVP ARENA\nKlient sieciowy w migracji", new Color(0.15f, 0.17f, 0.22f),
                null, false, _modeButtons);
        }

        private void AddOperatorGrid(RectTransform content, bool portrait)
        {
            int columns = portrait ? 2 : 5;
            GridLayoutGroup grid = CreateGrid(content, "Operator selection", columns, 128f);
            foreach (OperatorProfile profile in OperatorCatalog.All)
            {
                OperatorId id = profile.Id;
                string label = profile.DisplayName + "\n" + profile.ClassName + "\n" + profile.Role;
                AddGridButton(grid, id, label, profile.PrimaryColor,
                    delegate { _selectedOperator = id; RefreshSelection(); }, true, _operatorButtons);
            }
        }

        private void AddMapGrid(RectTransform content, bool portrait)
        {
            int columns = portrait ? 2 : 4;
            GridLayoutGroup grid = CreateGrid(content, "Survival map selection", columns, 144f);
            Array values = Enum.GetValues(typeof(WarehouseMapId));
            foreach (WarehouseMapId id in values)
            {
                SurvivalMapProfile map = GameContentCatalog.GetMap(id);
                string modifiers = string.Format("HP ×{0:0.00}  •  SPD ×{1:0.00}  •  XP ×{2:0.00}",
                    map.EnemyHealthMultiplier, map.EnemySpeedMultiplier, map.XpMultiplier);
                AddGridButton(grid, id, map.DisplayName + "\n" + map.Subtitle + "\n" + modifiers,
                    Color.Lerp(map.WallColor, map.AccentColor, 0.52f),
                    delegate { _selectedMap = id; RefreshSelection(); }, true, _mapButtons);
            }
        }

        private GridLayoutGroup CreateGrid(RectTransform parent, string name, int columns, float cellHeight)
        {
            GameObject gridObject = new GameObject(name, typeof(RectTransform), typeof(GridLayoutGroup));
            RectTransform rect = gridObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            GridLayoutGroup grid = gridObject.GetComponent<GridLayoutGroup>();
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = Mathf.Max(1, columns);
            grid.spacing = new Vector2(12f, 12f);
            grid.padding = new RectOffset(4, 4, 4, 4);
            grid.childAlignment = TextAnchor.MiddleCenter;
            float scale = Mathf.Max(0.5f, _canvas.scaleFactor);
            float available = Screen.width / scale - 160f;
            float cellWidth = Mathf.Max(230f, (available - (columns - 1) * grid.spacing.x) / columns);
            grid.cellSize = new Vector2(cellWidth, cellHeight);
            return grid;
        }

        private void AddSectionTitle(RectTransform parent, string label)
        {
            Text heading = CreateText(parent, label, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0f, 1f), Vector2.zero, new Vector2(0f, 46f),
                20, TextAnchor.MiddleLeft, new Color(0.92f, 0.96f, 1f));
            LayoutElement layout = heading.gameObject.AddComponent<LayoutElement>();
            layout.minHeight = 46f;
            layout.preferredHeight = 46f;
        }

        private void AddGridButton<T>(
            GridLayoutGroup grid, T id, string label, Color accent,
            UnityEngine.Events.UnityAction action, bool enabled, Dictionary<T, Button> registry)
        {
            GameObject buttonObject = new GameObject(label, typeof(RectTransform), typeof(Image), typeof(Button));
            RectTransform rect = buttonObject.GetComponent<RectTransform>();
            rect.SetParent(grid.transform, false);
            Image image = buttonObject.GetComponent<Image>();
            image.color = Color.Lerp(new Color(0.07f, 0.11f, 0.17f, 0.98f), accent, 0.23f);
            Button button = buttonObject.GetComponent<Button>();
            button.targetGraphic = image;
            button.interactable = enabled;
            button.transition = Selectable.Transition.ColorTint;
            ColorBlock colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 1f, 1f, 1f);
            colors.pressedColor = new Color(0.78f, 0.86f, 0.94f, 1f);
            colors.disabledColor = new Color(0.48f, 0.50f, 0.54f, 0.55f);
            colors.fadeDuration = 0.08f;
            button.colors = colors;
            if (action != null) button.onClick.AddListener(action);

            Text text = CreateText(rect, label, Vector2.zero, Vector2.zero,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero,
                grid.cellSize.y > 135f ? 17 : 19, TextAnchor.MiddleCenter,
                enabled ? Color.white : new Color(0.66f, 0.69f, 0.73f));
            text.rectTransform.anchorMin = Vector2.zero;
            text.rectTransform.anchorMax = Vector2.one;
            text.rectTransform.offsetMin = new Vector2(10f, 7f);
            text.rectTransform.offsetMax = new Vector2(-10f, -7f);
            text.raycastTarget = false;

            registry[id] = button;
        }

        private void RefreshSelection()
        {
            RefreshButtons(_modeButtons, _selectedMode);
            RefreshButtons(_operatorButtons, _selectedOperator);
            RefreshButtons(_mapButtons, _selectedMap);

            SurvivalMapProfile map = GameContentCatalog.GetMap(_selectedMap);
            OperatorProfile op = OperatorCatalog.Get(_selectedOperator);
            _selectionSummary.text = op.DisplayName + "  •  " + map.DisplayName + "  •  " + _selectedMode.ToString().ToUpperInvariant();
            bool canStart = _selectedMode == GameMode.Survival || _selectedMode == GameMode.Campaign;
            _startButton.interactable = canStart;
            Text startText = _startButton.GetComponentInChildren<Text>();
            if (startText != null)
                startText.text = _selectedMode == GameMode.Survival ? "ROZPOCZNIJ SURVIVAL" :
                    _selectedMode == GameMode.Campaign ? "URUCHOM TRENING B4" : "PVP NIEDOSTĘPNE";
            Image startImage = _startButton.GetComponent<Image>();
            if (startImage != null)
                startImage.color = _selectedMode == GameMode.Survival
                    ? new Color(0.10f, 0.55f, 0.40f, 1f)
                    : new Color(0.17f, 0.39f, 0.58f, 1f);
        }

        private static void RefreshButtons<T>(Dictionary<T, Button> buttons, T selected)
        {
            foreach (KeyValuePair<T, Button> item in buttons)
            {
                if (item.Value == null) continue;
                Image image = item.Value.GetComponent<Image>();
                if (image == null) continue;
                bool active = EqualityComparer<T>.Default.Equals(item.Key, selected);
                image.color = active
                    ? new Color(0.10f, 0.42f, 0.39f, 1f)
                    : new Color(0.08f, 0.13f, 0.20f, 0.96f);
                Outline outline = item.Value.GetComponent<Outline>();
                if (active && outline == null) outline = item.Value.gameObject.AddComponent<Outline>();
                if (outline != null)
                {
                    outline.effectColor = active ? new Color(0.27f, 0.92f, 0.74f, 0.95f) : new Color(0f, 0f, 0f, 0f);
                    outline.effectDistance = new Vector2(2f, -2f);
                }
            }
        }

        private void StartSelectedRun()
        {
            if (_owner == null) return;
            _owner.StartRun(_selectedMode, _selectedOperator, _selectedMap);
        }

        private static void CreateBackdropPanel(RectTransform parent, Vector2 anchorMin, Vector2 anchorMax, Color color)
        {
            GameObject panel = new GameObject("Menu atmosphere panel", typeof(RectTransform), typeof(Image));
            RectTransform rect = panel.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            panel.GetComponent<Image>().color = color;
            panel.transform.SetAsFirstSibling();
        }

        private static Text CreateText(
            RectTransform parent, string value, Vector2 anchorMin, Vector2 anchorMax,
            Vector2 pivot, Vector2 anchoredPosition, Vector2 size,
            int fontSize, TextAnchor alignment, Color color)
        {
            GameObject textObject = new GameObject("Text • " + value, typeof(RectTransform), typeof(Text), typeof(Outline));
            RectTransform rect = textObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = pivot;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            Text text = textObject.GetComponent<Text>();
            text.text = value;
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.fontSize = fontSize;
            text.fontStyle = FontStyle.Bold;
            text.color = color;
            text.alignment = alignment;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            Outline outline = textObject.GetComponent<Outline>();
            outline.effectColor = new Color(0f, 0f, 0f, 0.82f);
            outline.effectDistance = new Vector2(1.3f, -1.3f);
            return text;
        }

        private static Button CreateButton(
            RectTransform parent, string label, Vector2 anchorMin, Vector2 anchorMax,
            Vector2 pivot, Vector2 anchoredPosition, Vector2 size, Color color,
            int fontSize, UnityEngine.Events.UnityAction onClick)
        {
            GameObject buttonObject = new GameObject(label, typeof(RectTransform), typeof(Image), typeof(Button));
            RectTransform rect = buttonObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = pivot;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            Image image = buttonObject.GetComponent<Image>();
            image.color = color;
            Button button = buttonObject.GetComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(onClick);
            Text text = CreateText(rect, label, Vector2.zero, Vector2.zero,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero,
                fontSize, TextAnchor.MiddleCenter, Color.white);
            text.rectTransform.anchorMin = Vector2.zero;
            text.rectTransform.anchorMax = Vector2.one;
            text.rectTransform.offsetMin = Vector2.zero;
            text.rectTransform.offsetMax = Vector2.zero;
            return button;
        }

        private static void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            GameObject eventSystem = new GameObject("EventSystem", typeof(EventSystem));
            InputSystemUIInputModule module = eventSystem.AddComponent<InputSystemUIInputModule>();
            module.pointerBehavior = UIPointerBehavior.SingleMouseOrPenButMultiTouchAndTrack;
        }
    }
}
