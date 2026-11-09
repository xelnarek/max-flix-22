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
        private Button _jumpButton;
        private Button _attackButton;
        private Button _cameraModeButton;
        private Text _cameraModeLabel;
        private Slider _cameraZoomSlider;
        private CameraFollowRig _cameraRig;
        private RectTransform _safeAreaRoot;
        private RectTransform _joystickRect;
        private RectTransform _joystickHandleRect;
        private float _lastControlWidth = -1f;
        private float _lastControlHeight = -1f;
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
            ApplyResponsiveTouchLayout(false);
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
            _safeAreaRoot = root;
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

            if (GameSession.Current != null && GameSession.Current.Mode == GameMode.Survival)
            {
                _cameraRig = FindFirstObjectByType<CameraFollowRig>();
                if (_cameraRig != null)
                {
                    _cameraModeButton = CreateAnchoredButton(root, "KAMERA 3D",
                        new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                        new Vector2(0f, -158f), new Vector2(124f, 40f),
                        new Color(0.13f, 0.27f, 0.38f, 0.94f), 15, ToggleCameraView);
                    _cameraModeLabel = _cameraModeButton.GetComponentInChildren<Text>();
                    _cameraZoomSlider = CreateCameraZoomSlider(root, _cameraRig);
                    RefreshCameraModeLabel();
                    // The mobile camera controls occupy the central top rail.
                    // The general help line is hidden in Survival to keep the playfield clear.
                    _helpText.gameObject.SetActive(false);
                }
            }

            _pauseButton = CreateAnchoredButton(root, "PAUZA", new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(1f, 1f), new Vector2(-28f, -102f), new Vector2(156f, 72f),
                new Color(0.14f, 0.21f, 0.30f, 0.94f), 18, TogglePause);

            GameObject stick = CreateImage(root, "Virtual joystick", Vector2.zero, new Vector2(210f, 210f), new Color(0.07f, 0.12f, 0.18f, 0.54f));
            _joystickRect = stick.GetComponent<RectTransform>();
            Joystick = stick.AddComponent<VirtualJoystick>();

            GameObject knob = CreateImage(_joystickRect, "Joystick handle", Vector2.zero, new Vector2(82f, 82f), new Color(0.52f, 0.72f, 0.86f, 0.82f));
            _joystickHandleRect = knob.GetComponent<RectTransform>();
            _joystickHandleRect.anchorMin = new Vector2(0.5f, 0.5f);
            _joystickHandleRect.anchorMax = new Vector2(0.5f, 0.5f);
            _joystickHandleRect.anchoredPosition = Vector2.zero;
            knob.GetComponent<Image>().raycastTarget = false;
            Joystick.ConfigureHandle(_joystickHandleRect);

            _jumpButton = CreateActionButton(root, "SKOK", Vector2.zero, new Vector2(170f, 112f),
                new Color(0.18f, 0.42f, 0.58f, 0.88f), player.RequestJump, 20);
            _attackButton = CreateActionButton(root, "ATAK", Vector2.zero, new Vector2(190f, 126f),
                new Color(0.76f, 0.36f, 0.12f, 0.92f), player.RequestAttack, 20);
            _abilityButton = CreateActionButton(root, "SPECJALNA", Vector2.zero, new Vector2(190f, 126f),
                new Color(0.22f, 0.56f, 0.42f, 0.96f), player.RequestAbility, 18);
            _abilityButtonLabel = _abilityButton.GetComponentInChildren<Text>();

            Canvas.ForceUpdateCanvases();
            ApplyResponsiveTouchLayout(true);
        }

        /// <summary>
        /// Positions the thumbstick and action cluster from the live safe-area size.
        /// This avoids hard-coded offsets pushing the special button off-screen on
        /// narrow Android layouts and reflows again after rotation or split-screen resize.
        /// </summary>
        private void ApplyResponsiveTouchLayout(bool force)
        {
            if (_safeAreaRoot == null || _joystickRect == null
                || _jumpButton == null || _attackButton == null || _abilityButton == null) return;

            Rect safeRect = _safeAreaRoot.rect;
            float width = safeRect.width;
            float height = safeRect.height;
            if (width < 1f || height < 1f) return;
            if (!force && Mathf.Abs(width - _lastControlWidth) < 1f
                && Mathf.Abs(height - _lastControlHeight) < 1f) return;

            _lastControlWidth = width;
            _lastControlHeight = height;
            bool portrait = height > width * 1.12f;
            float edgeX = Mathf.Clamp(width * 0.035f, 18f, 58f);
            float edgeY = Mathf.Clamp(height * 0.045f, 18f, 54f);
            float stickSize = portrait
                ? Mathf.Clamp(Mathf.Min(width * 0.28f, height * 0.17f), 124f, 190f)
                : Mathf.Clamp(Mathf.Min(width * 0.12f, height * 0.24f), 140f, 210f);
            // Keep the joystick origin at the visual center. The pointer vector is
            // measured in root-local coordinates, so a bottom-left pivot would
            // otherwise shift the neutral point and make movement drift diagonally.
            SetControlRect(_joystickRect, Vector2.zero, new Vector2(0.5f, 0.5f),
                new Vector2(edgeX + stickSize * 0.5f, edgeY + stickSize * 0.5f),
                new Vector2(stickSize, stickSize));
            float handleSize = stickSize * 0.40f;
            if (_joystickHandleRect != null)
                _joystickHandleRect.sizeDelta = new Vector2(handleSize, handleSize);
            Joystick?.ConfigureMovementRadius(Mathf.Max(1f, (stickSize - handleSize) * 0.5f));

            float buttonWidth = portrait
                ? Mathf.Clamp(Mathf.Min(width * 0.30f, height * 0.105f), 112f, 148f)
                : Mathf.Clamp(Mathf.Min(width * 0.095f, height * 0.17f), 136f, 176f);
            float buttonHeight = buttonWidth * 0.64f;
            float gap = Mathf.Clamp(buttonWidth * 0.14f, 14f, 24f);
            float right = Mathf.Clamp(width * 0.035f, 18f, 58f);

            SetControlRect(_attackButton.GetComponent<RectTransform>(), new Vector2(1f, 0f), new Vector2(1f, 0f),
                new Vector2(-right, edgeY), new Vector2(buttonWidth, buttonHeight));
            if (portrait)
            {
                SetControlRect(_abilityButton.GetComponent<RectTransform>(), new Vector2(1f, 0f), new Vector2(1f, 0f),
                    new Vector2(-right, edgeY + buttonHeight + gap), new Vector2(buttonWidth, buttonHeight));
                SetControlRect(_jumpButton.GetComponent<RectTransform>(), new Vector2(1f, 0f), new Vector2(1f, 0f),
                    new Vector2(-right, edgeY + (buttonHeight + gap) * 2f), new Vector2(buttonWidth, buttonHeight * 0.82f));
            }
            else
            {
                SetControlRect(_abilityButton.GetComponent<RectTransform>(), new Vector2(1f, 0f), new Vector2(1f, 0f),
                    new Vector2(-(right + buttonWidth + gap), edgeY), new Vector2(buttonWidth, buttonHeight));
                SetControlRect(_jumpButton.GetComponent<RectTransform>(), new Vector2(1f, 0f), new Vector2(1f, 0f),
                    new Vector2(-right, edgeY + buttonHeight + gap), new Vector2(buttonWidth * 0.90f, buttonHeight * 0.82f));
            }

            int fontSize = Mathf.RoundToInt(Mathf.Clamp(buttonWidth * 0.12f, 14f, 20f));
            SetButtonFont(_attackButton, fontSize);
            SetButtonFont(_abilityButton, fontSize);
            SetButtonFont(_jumpButton, fontSize);

            if (_helpText != null)
            {
                _helpText.gameObject.SetActive(!portrait && height > 480f);
                _helpText.rectTransform.sizeDelta = new Vector2(Mathf.Min(1040f, width * 0.62f), 42f);
            }
            if (_statusText != null)
            {
                _statusText.rectTransform.sizeDelta = new Vector2(Mathf.Min(690f, width * 0.46f), 62f);
                _statusText.fontSize = Mathf.RoundToInt(Mathf.Clamp(width * 0.014f, 16f, 24f));
            }
            if (_healthText != null)
            {
                _healthText.rectTransform.sizeDelta = new Vector2(Mathf.Min(280f, width * 0.25f), 62f);
                _healthText.fontSize = Mathf.RoundToInt(Mathf.Clamp(width * 0.016f, 18f, 26f));
            }

            if (_cameraZoomSlider != null)
            {
                RectTransform sliderRect = _cameraZoomSlider.GetComponent<RectTransform>();
                float sliderWidth = Mathf.Clamp(width * 0.25f, 150f, 250f);
                SetControlRect(sliderRect, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(0f, -108f), new Vector2(sliderWidth, 22f));
                if (_cameraModeButton != null)
                {
                    RectTransform modeRect = _cameraModeButton.GetComponent<RectTransform>();
                    SetControlRect(modeRect, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                        new Vector2(0f, -154f), new Vector2(Mathf.Clamp(width * 0.14f, 104f, 132f), 38f));
                }
            }
        }

        private void ToggleCameraView()
        {
            if (_cameraRig == null) return;
            _cameraRig.ToggleViewMode();
            RefreshCameraModeLabel();
        }

        private void RefreshCameraModeLabel()
        {
            if (_cameraModeLabel == null || _cameraRig == null) return;
            _cameraModeLabel.text = _cameraRig.IsTopDown ? "KAMERA 2D" : "KAMERA 3D";
        }

        private static Slider CreateCameraZoomSlider(RectTransform parent, CameraFollowRig cameraRig)
        {
            GameObject sliderObject = new GameObject("Camera zoom slider", typeof(RectTransform), typeof(Slider));
            RectTransform sliderRect = sliderObject.GetComponent<RectTransform>();
            sliderRect.SetParent(parent, false);
            sliderRect.anchorMin = new Vector2(0.5f, 1f);
            sliderRect.anchorMax = new Vector2(0.5f, 1f);
            sliderRect.pivot = new Vector2(0.5f, 1f);
            sliderRect.anchoredPosition = new Vector2(0f, -108f);
            sliderRect.sizeDelta = new Vector2(220f, 22f);

            GameObject track = CreateImage(sliderRect, "Zoom track", Vector2.zero,
                new Vector2(220f, 8f), new Color(0.04f, 0.08f, 0.12f, 0.92f));
            RectTransform trackRect = track.GetComponent<RectTransform>();
            trackRect.anchorMin = Vector2.zero;
            trackRect.anchorMax = Vector2.one;
            trackRect.offsetMin = Vector2.zero;
            trackRect.offsetMax = Vector2.zero;
            trackRect.sizeDelta = Vector2.zero;
            trackRect.anchoredPosition = Vector2.zero;

            GameObject fillArea = new GameObject("Fill Area", typeof(RectTransform));
            RectTransform fillAreaRect = fillArea.GetComponent<RectTransform>();
            fillAreaRect.SetParent(sliderRect, false);
            fillAreaRect.anchorMin = new Vector2(0f, 0.25f);
            fillAreaRect.anchorMax = new Vector2(1f, 0.75f);
            fillAreaRect.offsetMin = new Vector2(5f, 0f);
            fillAreaRect.offsetMax = new Vector2(-5f, 0f);

            GameObject fill = CreateImage(fillAreaRect, "Zoom fill", Vector2.zero,
                Vector2.zero, new Color(0.20f, 0.72f, 0.86f, 1f));
            RectTransform fillRect = fill.GetComponent<RectTransform>();
            fillRect.anchorMin = Vector2.zero;
            fillRect.anchorMax = Vector2.one;
            fillRect.offsetMin = Vector2.zero;
            fillRect.offsetMax = Vector2.zero;
            fillRect.sizeDelta = Vector2.zero;

            GameObject handleArea = new GameObject("Handle Slide Area", typeof(RectTransform));
            RectTransform handleAreaRect = handleArea.GetComponent<RectTransform>();
            handleAreaRect.SetParent(sliderRect, false);
            handleAreaRect.anchorMin = Vector2.zero;
            handleAreaRect.anchorMax = Vector2.one;
            handleAreaRect.offsetMin = new Vector2(10f, 0f);
            handleAreaRect.offsetMax = new Vector2(-10f, 0f);

            GameObject handle = CreateImage(handleAreaRect, "Zoom handle", Vector2.zero,
                new Vector2(22f, 30f), new Color(0.88f, 0.95f, 1f, 1f));
            RectTransform handleRect = handle.GetComponent<RectTransform>();
            handleRect.anchorMin = new Vector2(0.5f, 0.5f);
            handleRect.anchorMax = new Vector2(0.5f, 0.5f);
            handleRect.pivot = new Vector2(0.5f, 0.5f);

            Slider slider = sliderObject.GetComponent<Slider>();
            slider.direction = Slider.Direction.LeftToRight;
            slider.minValue = 0f;
            slider.maxValue = 1f;
            slider.wholeNumbers = false;
            slider.fillRect = fillRect;
            slider.handleRect = handleRect;
            slider.targetGraphic = handle.GetComponent<Image>();
            slider.SetValueWithoutNotify(cameraRig.ZoomNormalized);
            slider.onValueChanged.AddListener(cameraRig.SetZoomNormalized);
            return slider;
        }

        private static void SetControlRect(RectTransform rect, Vector2 anchor, Vector2 pivot, Vector2 position, Vector2 size)
        {
            if (rect == null) return;
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = pivot;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
        }

        private static void SetButtonFont(Button button, int fontSize)
        {
            if (button == null) return;
            Text label = button.GetComponentInChildren<Text>();
            if (label != null) label.fontSize = fontSize;
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

        public void PresentCampaignVictory(int vipCount, int requiredVip)
        {
            if (_gameOverPresented) return;
            _gameOverPresented = true;
            Time.timeScale = 0f;
            RunSnapshot run = GameSession.Current;
            int minutes = Mathf.FloorToInt(run.ElapsedSeconds / 60f);
            int seconds = Mathf.FloorToInt(run.ElapsedSeconds % 60f);
            string summary = "Czas: " + minutes.ToString("00") + ":" + seconds.ToString("00")
                + "\nZebrane zamówienia VIP: " + vipCount + "/" + requiredVip
                + "\nEliminacje: " + run.Kills + "  •  Bossowie: " + run.BossesDefeated
                + "\nWynik końcowy: " + run.Score
                + "\nOperator: " + OperatorCatalog.Get(run.SelectedOperator).DisplayName
                + "\nWszystkie sektory zabezpieczone. Dostawa została zakończona.";
            ShowModal("KAMPANIA UKOŃCZONA", summary,
                "ZAGRAJ PONOWNIE", RetryRun, "MENU GŁÓWNE", ReturnToMenu);
        }

        private void PresentGameOver()
        {
            _gameOverPresented = true;
            Time.timeScale = 0f;
            RunSnapshot run = GameSession.Current;
            int minutes = Mathf.FloorToInt(run.ElapsedSeconds / 60f);
            int seconds = Mathf.FloorToInt(run.ElapsedSeconds % 60f);
            string wave = run.Mode == GameMode.Survival ? "\nNajdalsza fala: " + Mathf.Max(1, run.HighestWave) : string.Empty;
            string damageReport = run.Mode == GameMode.Survival
                ? "\n\n" + SurvivalDamageTracker.BuildSummary(5)
                : string.Empty;
            string summary = "Czas: " + minutes.ToString("00") + ":" + seconds.ToString("00")
                + "\nEliminacje: " + run.Kills + "    •    Bossowie: " + run.BossesDefeated
                + "\nWynik: " + run.Score
                + wave + "\nOperator: " + OperatorCatalog.Get(run.SelectedOperator).DisplayName
                + damageReport;
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
            Canvas rootCanvas = GetComponent<Canvas>();
            float scaleFactor = rootCanvas != null ? Mathf.Max(0.35f, rootCanvas.scaleFactor) : 1f;
            float availableWidth = Screen.width / scaleFactor - 36f;
            float availableHeight = Screen.height / scaleFactor - 36f;
            float panelWidth = Mathf.Min(820f, availableWidth);
            float panelHeight = Mathf.Min(520f, availableHeight);
            panelRect.sizeDelta = new Vector2(Mathf.Max(300f, panelWidth), Mathf.Max(310f, panelHeight));
            panel.GetComponent<Image>().color = new Color(0.055f, 0.085f, 0.12f, 0.99f);
            Outline border = panel.GetComponent<Outline>();
            border.effectColor = new Color(0.20f, 0.49f, 0.64f, 0.95f);
            border.effectDistance = new Vector2(2f, -2f);

            Text titleText = CreateText(panelRect, title, new Vector2(0f, -30f), new Vector2(590f, 58f), 30, TextAnchor.MiddleCenter);
            titleText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            titleText.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            titleText.rectTransform.pivot = new Vector2(0.5f, 1f);
            bool isDamageReport = body.Contains("OBRAŻENIA WG ŹRÓDŁA");
            Text bodyText = CreateText(panelRect, body, new Vector2(0f, -112f),
                new Vector2(panelWidth - 64f, isDamageReport ? panelHeight - 230f : panelHeight - 245f),
                isDamageReport ? 16 : 20, TextAnchor.MiddleCenter);
            bodyText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            bodyText.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            bodyText.rectTransform.pivot = new Vector2(0.5f, 1f);
            CreateAnchoredButton(panelRect, primaryLabel, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(1f, 0.5f), new Vector2(-8f, 54f), new Vector2(Mathf.Min(270f, panelWidth * 0.39f), 68f),
                new Color(0.10f, 0.52f, 0.40f, 1f), 18, primaryAction);
            CreateAnchoredButton(panelRect, secondaryLabel, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 0.5f), new Vector2(8f, 54f), new Vector2(Mathf.Min(270f, panelWidth * 0.39f), 68f),
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
            ColorBlock buttonColors = button.colors;
            buttonColors.normalColor = color;
            buttonColors.highlightedColor = Color.Lerp(color, Color.white, 0.16f);
            buttonColors.pressedColor = Color.Lerp(color, Color.black, 0.12f);
            button.colors = buttonColors;
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
