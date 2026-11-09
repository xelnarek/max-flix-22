using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace MaxFlix.Unity.Runtime
{
    public sealed class HudController : MonoBehaviour
    {
        private Text _statusText;
        private Text _healthText;
        private Text _helpText;
        private Text _abilityButtonLabel;
        private Button _abilityButton;
        private Button _pauseButton;
        private GameObject _modalOverlay;
        private Action _retryAction;
        private Action _returnToMenuAction;
        private bool _gameOverPresented;

        public VirtualJoystick Joystick { get; private set; }

        public static HudController Create(PlayerController player)
        {
            return Create(player, null, null);
        }

        public static HudController Create(PlayerController player, Action retryAction, Action returnToMenuAction)
        {
            EnsureEventSystem();

            GameObject canvasObject = new GameObject("Max Flix HUD", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 50;
            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            GameObject safeAreaObject = new GameObject("Safe Area Content", typeof(RectTransform));
            RectTransform safeArea = safeAreaObject.GetComponent<RectTransform>();
            safeArea.SetParent(canvasObject.transform, false);
            safeArea.anchorMin = Vector2.zero;
            safeArea.anchorMax = Vector2.one;
            safeArea.offsetMin = Vector2.zero;
            safeArea.offsetMax = Vector2.zero;
            safeAreaObject.AddComponent<SafeAreaLayout>();

            HudController hud = canvasObject.AddComponent<HudController>();
            hud._retryAction = retryAction;
            hud._returnToMenuAction = returnToMenuAction;
            hud.Build(safeArea, player);
            return hud;
        }

        public void SetHealth(float current, float maximum)
        {
            if (_healthText != null) _healthText.text = string.Format("HP  {0:0}/{1:0}", current, maximum);
        }

        public void SetStatus(string status)
        {
            if (_statusText != null) _statusText.text = status;
        }

        public void SetAbilityState(float remaining, float maximum)
        {
            if (_abilityButton == null || _abilityButtonLabel == null) return;
            bool ready = remaining <= 0.05f;
            _abilityButton.interactable = ready;
            _abilityButtonLabel.text = ready
                ? "SPECJALNA\nGOTOWA"
                : string.Format("SPECJALNA\n{0:0.0} s", remaining);
            ColorBlock colors = _abilityButton.colors;
            colors.normalColor = ready ? new Color(0.22f, 0.56f, 0.42f, 0.96f) : new Color(0.27f, 0.31f, 0.36f, 0.90f);
            colors.highlightedColor = ready ? new Color(0.30f, 0.68f, 0.50f, 1f) : colors.normalColor;
            _abilityButton.colors = colors;
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            if (_modalOverlay != null)
            {
                if (GameSession.Current != null && GameSession.Current.State == GameFlowState.Paused
                    && keyboard != null && keyboard.escapeKey.wasPressedThisFrame)
                    ResumeGame();
                return;
            }

            if (keyboard != null && keyboard.escapeKey.wasPressedThisFrame)
            {
                TogglePause();
                return;
            }

            if (!_gameOverPresented && GameSession.Current != null
                && GameSession.Current.State == GameFlowState.GameOver)
                PresentGameOver();
        }

        private void Build(RectTransform root, PlayerController player)
        {
            _statusText = CreateText(root, "SURVIVAL • ZMIANA 01", new Vector2(24f, -24f), new Vector2(690f, 62f), 25, TextAnchor.MiddleLeft);
            _healthText = CreateText(root, "HP  5/5", new Vector2(-24f, -24f), new Vector2(280f, 62f), 29, TextAnchor.MiddleRight);
            _healthText.rectTransform.anchorMin = new Vector2(1f, 1f);
            _healthText.rectTransform.anchorMax = new Vector2(1f, 1f);
            _healthText.rectTransform.pivot = new Vector2(1f, 1f);

            _helpText = CreateText(root, "PC: WASD / SPACE / J / E   •   EKRAN: joystick + SKOK + ATAK + SPECJALNA",
                new Vector2(0f, -98f), new Vector2(1040f, 42f), 17, TextAnchor.MiddleCenter);
            _helpText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            _helpText.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            _helpText.rectTransform.pivot = new Vector2(0.5f, 1f);

            _pauseButton = CreateAnchoredButton(root, "PAUZA", new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(1f, 1f), new Vector2(-28f, -102f), new Vector2(156f, 72f),
                new Color(0.14f, 0.21f, 0.30f, 0.94f), 18, TogglePause);

            GameObject stick = CreateImage(root, "Virtual joystick", new Vector2(165f, 165f), new Vector2(210f, 210f), new Color(0.07f, 0.12f, 0.18f, 0.54f));
            stick.GetComponent<RectTransform>().anchorMin = Vector2.zero;
            stick.GetComponent<RectTransform>().anchorMax = Vector2.zero;
            Joystick = stick.AddComponent<VirtualJoystick>();

            GameObject knob = CreateImage(stick.GetComponent<RectTransform>(), "Joystick handle", Vector2.zero, new Vector2(82f, 82f), new Color(0.52f, 0.72f, 0.86f, 0.82f));
            knob.GetComponent<Image>().raycastTarget = false;
            Joystick.ConfigureHandle(knob.GetComponent<RectTransform>());

            CreateActionButton(root, "SKOK", new Vector2(-150f, 245f), new Vector2(170f, 112f), new Color(0.18f, 0.42f, 0.58f, 0.88f), player.RequestJump, 25);
            CreateActionButton(root, "ATAK", new Vector2(-150f, 105f), new Vector2(190f, 126f), new Color(0.76f, 0.36f, 0.12f, 0.92f), player.RequestAttack, 25);
            _abilityButton = CreateActionButton(root, "SPECJALNA", new Vector2(-390f, 105f), new Vector2(190f, 126f),
                new Color(0.22f, 0.56f, 0.42f, 0.96f), player.RequestAbility, 20);
            _abilityButtonLabel = _abilityButton.GetComponentInChildren<Text>();
        }

        private void TogglePause()
        {
            if (GameSession.Current == null || GameSession.Current.State == GameFlowState.GameOver) return;
            if (GameSession.Current.State == GameFlowState.Paused)
            {
                ResumeGame();
                return;
            }
            if (GameSession.Current.State != GameFlowState.Playing) return;

            GameSession.SetState(GameFlowState.Paused);
            Time.timeScale = 0f;
            ShowModal("GRA WSTRZYMANA", "Postęp zmiany jest zatrzymany. Możesz wrócić do gry albo zakończyć podejście.",
                "WRÓĆ DO GRY", ResumeGame, "MENU GŁÓWNE", ReturnToMenu);
        }

        private void ResumeGame()
        {
            if (_modalOverlay != null) Destroy(_modalOverlay);
            _modalOverlay = null;
            Time.timeScale = 1f;
            GameSession.SetState(GameFlowState.Playing);
        }

        private void PresentGameOver()
        {
            _gameOverPresented = true;
            Time.timeScale = 0f;
            RunSnapshot run = GameSession.Current;
            int minutes = Mathf.FloorToInt(run.ElapsedSeconds / 60f);
            int seconds = Mathf.FloorToInt(run.ElapsedSeconds % 60f);
            string wave = run.Mode == GameMode.Survival ? "\nNajdalsza fala: " + Mathf.Max(1, run.HighestWave) : string.Empty;
            string summary = "Czas: " + minutes.ToString("00") + ":" + seconds.ToString("00")
                + "\nEliminacje: " + run.Kills + "    •    Wynik: " + run.Score
                + wave + "\nOperator: " + OperatorCatalog.Get(run.SelectedOperator).DisplayName;
            ShowModal("ZMIANA ZAKOŃCZONA", summary,
                "ZAGRAJ PONOWNIE", RetryRun, "MENU GŁÓWNE", ReturnToMenu);
        }

        private void RetryRun()
        {
            Time.timeScale = 1f;
            if (_retryAction != null) _retryAction.Invoke();
            else ResumeGame();
        }

        private void ReturnToMenu()
        {
            Time.timeScale = 1f;
            if (_returnToMenuAction != null) _returnToMenuAction.Invoke();
            else ResumeGame();
        }

        private void ShowModal(string title, string body, string primaryLabel, Action primaryAction, string secondaryLabel, Action secondaryAction)
        {
            if (_modalOverlay != null) Destroy(_modalOverlay);
            _modalOverlay = new GameObject("Game modal overlay", typeof(RectTransform), typeof(Image));
            RectTransform overlayRect = _modalOverlay.GetComponent<RectTransform>();
            overlayRect.SetParent(transform, false);
            overlayRect.anchorMin = Vector2.zero;
            overlayRect.anchorMax = Vector2.one;
            overlayRect.offsetMin = Vector2.zero;
            overlayRect.offsetMax = Vector2.zero;
            _modalOverlay.GetComponent<Image>().color = new Color(0.01f, 0.025f, 0.045f, 0.82f);

            GameObject panel = new GameObject("Modal panel", typeof(RectTransform), typeof(Image), typeof(Outline));
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.SetParent(overlayRect, false);
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.anchoredPosition = Vector2.zero;
            panelRect.sizeDelta = new Vector2(660f, 390f);
            panel.GetComponent<Image>().color = new Color(0.055f, 0.085f, 0.12f, 0.99f);
            Outline border = panel.GetComponent<Outline>();
            border.effectColor = new Color(0.20f, 0.49f, 0.64f, 0.95f);
            border.effectDistance = new Vector2(2f, -2f);

            Text titleText = CreateText(panelRect, title, new Vector2(0f, -30f), new Vector2(590f, 58f), 30, TextAnchor.MiddleCenter);
            titleText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            titleText.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            titleText.rectTransform.pivot = new Vector2(0.5f, 1f);
            Text bodyText = CreateText(panelRect, body, new Vector2(0f, -112f), new Vector2(560f, 136f), 20, TextAnchor.MiddleCenter);
            bodyText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            bodyText.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            bodyText.rectTransform.pivot = new Vector2(0.5f, 1f);
            CreateAnchoredButton(panelRect, primaryLabel, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(1f, 0.5f), new Vector2(-8f, 88f), new Vector2(270f, 78f),
                new Color(0.10f, 0.52f, 0.40f, 1f), 18, primaryAction);
            CreateAnchoredButton(panelRect, secondaryLabel, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 0.5f), new Vector2(8f, 88f), new Vector2(270f, 78f),
                new Color(0.19f, 0.27f, 0.37f, 1f), 18, secondaryAction);
        }

        private static Text CreateText(RectTransform parent, string value, Vector2 anchoredPosition, Vector2 size, int fontSize, TextAnchor alignment)
        {
            GameObject textObject = new GameObject(value, typeof(RectTransform), typeof(Text), typeof(Outline));
            RectTransform rect = textObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            Text text = textObject.GetComponent<Text>();
            text.text = value;
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.fontSize = fontSize;
            text.fontStyle = FontStyle.Bold;
            text.color = Color.white;
            text.raycastTarget = false;
            text.alignment = alignment;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            textObject.GetComponent<Outline>().effectColor = new Color(0f, 0f, 0f, 0.72f);
            textObject.GetComponent<Outline>().effectDistance = new Vector2(1.5f, -1.5f);
            return text;
        }

        private static GameObject CreateImage(RectTransform parent, string objectName, Vector2 anchoredPosition, Vector2 size, Color color)
        {
            GameObject imageObject = new GameObject(objectName, typeof(RectTransform), typeof(Image));
            RectTransform rect = imageObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = new Vector2(0f, 0f);
            rect.anchorMax = new Vector2(0f, 0f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            imageObject.GetComponent<Image>().color = color;
            return imageObject;
        }

        private Button CreateActionButton(
            RectTransform root, string label, Vector2 anchoredPosition, Vector2 size,
            Color color, UnityEngine.Events.UnityAction onClick, int fontSize)
        {
            return CreateAnchoredButton(root, label, new Vector2(1f, 0f), new Vector2(1f, 0f),
                new Vector2(1f, 0f), anchoredPosition, size, color, fontSize, onClick);
        }

        private static Button CreateAnchoredButton(
            RectTransform parent, string label, Vector2 anchorMin, Vector2 anchorMax,
            Vector2 pivot, Vector2 anchoredPosition, Vector2 size, Color color,
            int fontSize, UnityEngine.Events.UnityAction onClick)
        {
            GameObject buttonObject = new GameObject(label + " button", typeof(RectTransform), typeof(Image), typeof(Button));
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
            Text labelText = CreateText(rect, label, Vector2.zero, size, fontSize, TextAnchor.MiddleCenter);
            labelText.rectTransform.anchorMin = Vector2.zero;
            labelText.rectTransform.anchorMax = Vector2.one;
            labelText.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            labelText.rectTransform.anchoredPosition = Vector2.zero;
            labelText.rectTransform.sizeDelta = Vector2.zero;
            return button;
        }

        private static void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            GameObject eventSystem = new GameObject("EventSystem", typeof(EventSystem));
            InputSystemUIInputModule inputModule = eventSystem.AddComponent<InputSystemUIInputModule>();
            inputModule.pointerBehavior = UIPointerBehavior.SingleMouseOrPenButMultiTouchAndTrack;
        }

        private void OnDestroy()
        {
            if (GameSession.Current != null && GameSession.Current.State == GameFlowState.Paused)
            {
                Time.timeScale = 1f;
                GameSession.SetState(GameFlowState.Playing);
            }
        }
    }
}
