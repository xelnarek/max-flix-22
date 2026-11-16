using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Independent, screen-space 2D secret encounters. The connected 3D world
    /// remains loaded underneath but is paused; encounter simulation uses
    /// unscaled time and its own deterministic state.
    /// </summary>
    public sealed class SurvivalSecretEncounterController : MonoBehaviour
    {
        private enum EncounterMode { RabbitHole, Necronomicon }
        private enum BossAttack { Slam, Lash, Grab }

        private sealed class Platform
        {
            public float X;
            public float Y;
            public float Width;
            public float Height;
            public RectTransform Visual;
        }

        private sealed class Watch
        {
            public float X;
            public float Y;
            public bool Collected;
            public RectTransform Visual;
        }

        private sealed class Shockwave
        {
            public float X;
            public float Delay;
            public RectTransform Visual;
        }

        private sealed class Projectile
        {
            public float X;
            public float Y;
            public float VerticalSpeed;
            public RectTransform Visual;
        }

        private static SurvivalSecretEncounterController _active;
        private const float RabbitScale = 0.64f;
        private const float RabbitWorldWidth = 2720f;
        private const float RabbitViewWidth = 900f / RabbitScale;
        private const float RabbitViewHeight = 540f;
        private const float RabbitGoalX = 2580f;
        private static readonly Color PanelInk = new Color(0.035f, 0.045f, 0.075f, 0.98f);

        private EncounterMode _mode;
        private PlayerController _player;
        private Canvas _canvas;
        private RectTransform _stage;
        private GameObject _resultPanel;
        private Text _title;
        private Text _subtitle;
        private Text _primaryHud;
        private Text _secondaryHud;
        private Text _statusHud;
        private Image _playerHealthBar;
        private Image _bossHealthBar;
        private RectTransform _rabbitPlayerVisual;
        private RectTransform _cthulhuPlayerVisual;
        private RectTransform _cthulhuCoreVisual;
        private RectTransform _cthulhuBossVisual;
        private readonly List<Platform> _platforms = new List<Platform>();
        private readonly List<Watch> _watches = new List<Watch>();
        private readonly List<RectTransform> _hazards = new List<RectTransform>();
        private readonly List<Shockwave> _shockwaves = new List<Shockwave>();
        private readonly List<Projectile> _projectiles = new List<Projectile>();

        private bool _leftHeld;
        private bool _rightHeld;
        private bool _actionHeld;
        private bool _actionPointerHeld;
        private bool _attackHeld;
        private bool _attackPointerHeld;
        private bool _actionPressed;
        private bool _closed;
        private bool _resultShown;
        private bool _won;
        private bool _rewardGranted;

        // Rabbit-hole 2D platformer state (source coordinates: positive Y down).
        private float _rabbitX = 76f;
        private float _rabbitY = 410f;
        private float _rabbitVx;
        private float _rabbitVy;
        private bool _rabbitGrounded = true;
        private float _rabbitTime = 68f;
        private float _rabbitInvulnerable;
        private float _rabbitJumpBuffer;
        private float _rabbitCoyote;
        private float _rabbitCheckpointX = 76f;
        private float _rabbitCheckpointY = 456f;
        private int _rabbitLives = 3;
        private int _rabbitCollected;
        private float _rabbitCameraX;
        private RectTransform[] _rabbitWatchVisuals;

        // R'lyeh boss encounter state (screen coordinates: positive Y up).
        private float _cthulhuPlayerX = 112f;
        private float _cthulhuJumpHeight;
        private float _cthulhuJumpVelocity;
        private float _cthulhuPlayerHp = 100f;
        private float _cthulhuPlayerInvulnerability;
        private float _cthulhuDodgeRemaining;
        private float _cthulhuDodgeCooldown;
        private float _cthulhuAttackCooldown;
        private float _cthulhuBossHp = 180f;
        private float _cthulhuBossOpen;
        private float _cthulhuBossWindup = 2.2f;
        private float _cthulhuStrikeWindup;
        private RectTransform _cthulhuGrabMarker;
        private float _cthulhuBossDeath;
        private float _encounterElapsed;
        private BossAttack _bossAttack = BossAttack.Slam;
        private BossAttack _nextBossAttack = BossAttack.Lash;
        private float _bossGrabX;
        private int _cthulhuPhase = 1;
        private float _rabbitAnimation;

        public static void Open(PlayerController player, SurvivalSecretStyle style)
        {
            if (_active != null || player == null || player.IsDefeated
                || GameSession.Current == null || GameSession.Current.Mode != GameMode.Survival)
                return;

            GameSession.SetState(GameFlowState.LevelUp);
            Time.timeScale = 0f;
            GameObject host = new GameObject("SEKRET • osobna arena 2D");
            _active = host.AddComponent<SurvivalSecretEncounterController>();
            _active.Initialize(player, style == SurvivalSecretStyle.Necronomicon
                ? EncounterMode.Necronomicon : EncounterMode.RabbitHole);
        }

        private void Initialize(PlayerController player, EncounterMode mode)
        {
            _player = player;
            _mode = mode;
            UiEventSystemInstaller.Ensure();
            BuildShell();
            if (_mode == EncounterMode.RabbitHole) BuildRabbitHole();
            else BuildNecronomicon();
            SetHud();
        }

        private void BuildShell()
        {
            GameObject canvasHost = new GameObject("Secret encounter canvas",
                typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasHost.transform.SetParent(transform, false);
            _canvas = canvasHost.GetComponent<Canvas>();
            _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            _canvas.sortingOrder = 1200;
            CanvasScaler scaler = canvasHost.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(960f, 540f);
            scaler.matchWidthOrHeight = 0.5f;
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;

            RectTransform canvasRect = canvasHost.GetComponent<RectTransform>();
            GameObject safeObject = new GameObject("Secret safe area", typeof(RectTransform));
            RectTransform safe = safeObject.GetComponent<RectTransform>();
            safe.SetParent(canvasRect, false);
            safe.anchorMin = Vector2.zero;
            safe.anchorMax = Vector2.one;
            safe.offsetMin = Vector2.zero;
            safe.offsetMax = Vector2.zero;
            safeObject.AddComponent<SafeAreaLayout>();

            Image dim = CreateImage(safe, "Dark secret backdrop", Vector2.zero,
                new Vector2(960f, 540f), new Color(0.008f, 0.012f, 0.025f, 0.98f));
            dim.raycastTarget = true;

            Color accent = _mode == EncounterMode.RabbitHole
                ? new Color(0.84f, 0.39f, 0.96f)
                : new Color(0.23f, 0.94f, 0.75f);
            Image frame = CreateImage(safe, "Secret encounter frame", Vector2.zero,
                new Vector2(940f, 522f), PanelInk);
            frame.raycastTarget = false;
            CreateImage(safe, "Header accent", new Vector2(0f, 252f),
                new Vector2(900f, 3f), accent).raycastTarget = false;

            _title = CreateText(safe, "Secret title", new Vector2(0f, 222f),
                new Vector2(860f, 42f), 26, TextAnchor.MiddleCenter, Color.white);
            _subtitle = CreateText(safe, "Secret subtitle", new Vector2(0f, 190f),
                new Vector2(860f, 25f), 13, TextAnchor.MiddleCenter, accent);
            _statusHud = CreateText(safe, "Secret status", new Vector2(0f, 157f),
                new Vector2(860f, 22f), 13, TextAnchor.MiddleCenter, new Color(0.82f, 0.88f, 0.94f));

            GameObject stageObject = new GameObject("Independent 2D encounter viewport",
                typeof(RectTransform), typeof(Image), typeof(Mask));
            _stage = stageObject.GetComponent<RectTransform>();
            _stage.SetParent(safe, false);
            _stage.anchorMin = _stage.anchorMax = new Vector2(0.5f, 0.5f);
            _stage.pivot = new Vector2(0.5f, 0.5f);
            _stage.anchoredPosition = new Vector2(0f, -5f);
            _stage.sizeDelta = new Vector2(900f, 350f);
            Image stageImage = stageObject.GetComponent<Image>();
            stageImage.color = Color.white;
            stageObject.GetComponent<Mask>().showMaskGraphic = true;

            CreateButton(safe, "Back to warehouse", "WRÓĆ DO MAGAZYNU",
                new Vector2(0.5f, 1f), new Vector2(0.5f, 0.5f),
                new Vector2(380f, 222f), new Vector2(180f, 40f),
                new Color(0.18f, 0.23f, 0.32f), 13, CloseWithoutReward);

            CreateHoldButton(safe, "Left", "◀", new Vector2(-335f, -222f),
                new Vector2(76f, 58f), new Color(0.15f, 0.25f, 0.38f),
                pressed => _leftHeld = pressed);
            CreateHoldButton(safe, "Right", "▶", new Vector2(-245f, -222f),
                new Vector2(76f, 58f), new Color(0.15f, 0.25f, 0.38f),
                pressed => _rightHeld = pressed);

            if (_mode == EncounterMode.RabbitHole)
            {
                CreateHoldButton(safe, "Jump", "SKOK ↑", new Vector2(230f, -222f),
                    new Vector2(124f, 58f), new Color(0.47f, 0.18f, 0.62f), pressed =>
                    {
                        if (pressed) _actionPressed = true;
                        _actionPointerHeld = pressed;
                    });
                _primaryHud = CreateText(safe, "Rabbit HUD", new Vector2(-260f, 155f),
                    new Vector2(300f, 24f), 14, TextAnchor.MiddleLeft, Color.white);
                _secondaryHud = CreateText(safe, "Rabbit timer", new Vector2(260f, 155f),
                    new Vector2(260f, 24f), 14, TextAnchor.MiddleRight, Color.white);
            }
            else
            {
                CreateHoldButton(safe, "Dodge", "UNIK ↑", new Vector2(160f, -222f),
                    new Vector2(118f, 58f), new Color(0.13f, 0.43f, 0.40f), pressed =>
                    {
                        if (pressed) _actionPressed = true;
                        _actionPointerHeld = pressed;
                    });
                CreateHoldButton(safe, "Attack", "ATAK ●", new Vector2(300f, -222f),
                    new Vector2(124f, 58f), new Color(0.55f, 0.15f, 0.28f),
                    pressed => _attackPointerHeld = pressed);
                _primaryHud = CreateText(safe, "Operator health", new Vector2(-270f, 155f),
                    new Vector2(310f, 22f), 13, TextAnchor.MiddleLeft, Color.white);
                _secondaryHud = CreateText(safe, "Boss health", new Vector2(270f, 155f),
                    new Vector2(310f, 22f), 13, TextAnchor.MiddleRight, Color.white);
                _playerHealthBar = CreateProgressBar(safe, "Operator health bar",
                    new Vector2(-270f, 135f), new Vector2(280f, 7f), new Color(0.24f, 0.85f, 0.61f));
                _bossHealthBar = CreateProgressBar(safe, "Cthulhu health bar",
                    new Vector2(270f, 135f), new Vector2(280f, 7f), new Color(0.86f, 0.18f, 0.48f));
            }

            _resultPanel = new GameObject("Secret encounter result", typeof(RectTransform),
                typeof(Image));
            RectTransform resultRect = _resultPanel.GetComponent<RectTransform>();
            resultRect.SetParent(safe, false);
            resultRect.anchorMin = resultRect.anchorMax = new Vector2(0.5f, 0.5f);
            resultRect.pivot = new Vector2(0.5f, 0.5f);
            resultRect.anchoredPosition = new Vector2(0f, -5f);
            resultRect.sizeDelta = new Vector2(610f, 245f);
            _resultPanel.GetComponent<Image>().color = new Color(0.018f, 0.025f, 0.05f, 0.97f);
            CreateText(resultRect, "Result heading", new Vector2(0f, 72f),
                new Vector2(560f, 54f), 26, TextAnchor.MiddleCenter, Color.white);
            CreateText(resultRect, "Result details", new Vector2(0f, 22f),
                new Vector2(540f, 42f), 14, TextAnchor.MiddleCenter, new Color(0.72f, 0.82f, 0.90f));
            CreateButton(resultRect, "Retry", "SPRÓBUJ PONOWNIE", new Vector2(-142f, 1f),
                new Vector2(0.5f, 0.5f), new Vector2(-142f, -78f), new Vector2(220f, 48f),
                new Color(0.18f, 0.35f, 0.48f), 14, RetryEncounter);
            CreateButton(resultRect, "Return", "WRÓĆ DO MAGAZYNU", new Vector2(142f, 1f),
                new Vector2(0.5f, 0.5f), new Vector2(142f, -78f), new Vector2(220f, 48f),
                new Color(0.15f, 0.51f, 0.40f), 14, ReturnWithReward);
            _resultPanel.SetActive(false);
        }

        private void BuildRabbitHole()
        {
            _title.text = "NORKA KRÓLIKA";
            _subtitle.text = "ZA LUSTREM • OSOBNA PLATFORMA 2D • 3 ZEGARKI • 68 SEKUND";
            _statusHud.text = "Przytrzymaj kierunek. Krótki skok jest niski, dłuższy skok daje większy zasięg.";

            CreateImage(_stage, "Rabbit dream sky", Vector2.zero, new Vector2(900f, 350f),
                new Color(0.055f, 0.028f, 0.12f)).raycastTarget = false;
            for (int i = 0; i < 34; i++)
            {
                float x = -438f + (i * 97f) % 876;
                float y = -154f + (i * 53f) % 300;
                CreateImage(_stage, "Dream star", new Vector2(x, y),
                    new Vector2(i % 4 == 0 ? 4f : 2f, i % 4 == 0 ? 4f : 2f),
                    new Color(0.88f, 0.72f, 1f, 0.8f)).raycastTarget = false;
            }
            CreateImage(_stage, "Rabbit far skyline", new Vector2(0f, -90f),
                new Vector2(900f, 125f), new Color(0.13f, 0.065f, 0.19f)).raycastTarget = false;
            CreateImage(_stage, "Rabbit moon", new Vector2(325f, 95f),
                new Vector2(72f, 72f), new Color(0.92f, 0.78f, 0.98f)).raycastTarget = false;

            float[,] values =
            {
                { 0f, 456f, 350f, 100f },
                { 430f, 390f, 150f, 22f },
                { 650f, 318f, 160f, 22f },
                { 900f, 440f, 260f, 116f },
                { 1230f, 370f, 160f, 22f },
                { 1450f, 298f, 160f, 22f },
                { 1720f, 430f, 220f, 126f },
                { 2010f, 358f, 160f, 22f },
                { 2220f, 286f, 160f, 22f },
                { 2450f, 440f, 330f, 116f }
            };
            for (int i = 0; i < values.GetLength(0); i++)
            {
                Platform platform = new Platform
                {
                    X = values[i, 0], Y = values[i, 1],
                    Width = values[i, 2], Height = values[i, 3],
                    Visual = CreateImage(_stage, "Dream platform " + i, Vector2.zero,
                        Vector2.one, i % 2 == 0 ? new Color(0.30f, 0.18f, 0.43f) : new Color(0.19f, 0.34f, 0.42f)).rectTransform
                };
                _platforms.Add(platform);
            }

            float[,] watchPositions = { { 500f, 350f }, { 1305f, 330f }, { 2292f, 246f } };
            _rabbitWatchVisuals = new RectTransform[3];
            for (int i = 0; i < 3; i++)
            {
                Watch watch = new Watch
                {
                    X = watchPositions[i, 0], Y = watchPositions[i, 1],
                    Visual = CreateImage(_stage, "Pocket watch " + (i + 1), Vector2.zero,
                        new Vector2(26f, 26f), new Color(1f, 0.78f, 0.22f)).rectTransform
                };
                _watches.Add(watch);
                _rabbitWatchVisuals[i] = watch.Visual;
                CreateImage(watch.Visual, "Watch hand", new Vector2(2f, 2f),
                    new Vector2(3f, 12f), new Color(0.20f, 0.10f, 0.20f)).raycastTarget = false;
            }

            float[,] hazards = { { 1015f, 405f, 34f, 35f }, { 1810f, 394f, 34f, 35f } };
            for (int i = 0; i < 2; i++)
            {
                RectTransform cup = CreateImage(_stage, "Dream cup hazard " + i, Vector2.zero,
                    Vector2.one, new Color(0.93f, 0.36f, 0.53f)).rectTransform;
                _hazards.Add(cup);
            }
            CreateImage(_stage, "White rabbit invitation guide", new Vector2(-270f, -105f),
                new Vector2(25f, 46f), new Color(0.95f, 0.94f, 0.89f)).raycastTarget = false;
            CreateImage(_stage, "Rabbit invitation sign", new Vector2(-220f, -112f),
                new Vector2(38f, 50f), new Color(0.23f, 0.12f, 0.29f)).raycastTarget = false;
            _rabbitPlayerVisual = CreateImage(_stage, "Rabbit-hole operator", Vector2.zero,
                new Vector2(26f, 40f), new Color(0.26f, 0.75f, 0.91f)).rectTransform;
            CreateImage(_rabbitPlayerVisual, "Operator helmet", new Vector2(0f, 16f),
                new Vector2(31f, 10f), new Color(0.98f, 0.70f, 0.16f)).raycastTarget = false;
            RenderRabbitHole();
        }

        private void BuildNecronomicon()
        {
            _title.text = "R’LYEH — MIASTO POD CZARNĄ WODĄ";
            _subtitle.text = "NECRONOMICON • 8-BIT ELDER GOD RAID • 2 FAZY";
            _statusHud.text = "Rdzeń Cthulhu otwiera się po ataku. Strzelaj tylko w oknie podatności (2,15 s).";

            CreateImage(_stage, "Rlyeh ocean sky", Vector2.zero, new Vector2(900f, 350f),
                new Color(0.012f, 0.075f, 0.085f)).raycastTarget = false;
            CreateImage(_stage, "Rlyeh violet moon", new Vector2(285f, 104f),
                new Vector2(86f, 86f), new Color(0.41f, 0.24f, 0.62f)).raycastTarget = false;
            for (int i = 0; i < 8; i++)
            {
                float x = -390f + i * 112f;
                CreateImage(_stage, "Drowned city obelisk " + i,
                    new Vector2(x, -74f + (i % 3) * 15f),
                    new Vector2(34f + (i % 2) * 17f, 160f + (i % 3) * 24f),
                    new Color(0.055f, 0.12f, 0.15f)).raycastTarget = false;
                CreateImage(_stage, "Obelisk highlight " + i, new Vector2(x + 11f, -56f),
                    new Vector2(4f, 95f), new Color(0.26f, 0.19f, 0.38f)).raycastTarget = false;
            }
            CreateImage(_stage, "Rlyeh sea floor", new Vector2(0f, -155f),
                new Vector2(900f, 40f), new Color(0.025f, 0.085f, 0.10f)).raycastTarget = false;
            CreateImage(_stage, "Rlyeh stone combat lane", new Vector2(0f, -133f),
                new Vector2(900f, 22f), new Color(0.16f, 0.20f, 0.24f)).raycastTarget = false;

            // Low-poly pixel boss silhouette built from flat, crisp UI slabs.
            _cthulhuBossVisual = CreateImage(_stage, "Cthulhu elder silhouette",
                new Vector2(284f, -39f), new Vector2(160f, 190f),
                new Color(0.08f, 0.34f, 0.31f)).rectTransform;
            CreateImage(_cthulhuBossVisual, "Cthulhu head", new Vector2(0f, 72f),
                new Vector2(126f, 72f), new Color(0.12f, 0.49f, 0.43f)).raycastTarget = false;
            CreateImage(_cthulhuBossVisual, "Cthulhu crown", new Vector2(0f, 111f),
                new Vector2(120f, 9f), new Color(0.30f, 0.72f, 0.58f)).raycastTarget = false;
            for (int side = -1; side <= 1; side += 2)
            {
                for (int tendril = 0; tendril < 3; tendril++)
                    CreateImage(_cthulhuBossVisual, "Cthulhu face tentacle",
                        new Vector2(side * (28f + tendril * 16f), 35f - tendril * 10f),
                        new Vector2(11f, 58f + tendril * 8f),
                        new Color(0.09f, 0.45f, 0.41f)).rectTransform.localRotation =
                            Quaternion.Euler(0f, 0f, side * (12f + tendril * 8f));
            }
            for (int side = -1; side <= 1; side += 2)
            {
                CreateImage(_cthulhuBossVisual, "Cthulhu glowing eye",
                    new Vector2(side * 25f, 82f), new Vector2(16f, 11f),
                    new Color(0.50f, 1f, 0.72f)).raycastTarget = false;
                CreateImage(_stage, "Cthulhu wing",
                    new Vector2(284f + side * 104f, -21f),
                    new Vector2(88f, 138f), new Color(0.08f, 0.20f, 0.24f)).raycastTarget = false;
            }
            _cthulhuCoreVisual = CreateImage(_cthulhuBossVisual, "Elder core",
                new Vector2(-4f, 22f), new Vector2(35f, 35f),
                new Color(0.23f, 0.95f, 0.72f)).rectTransform;
            _cthulhuGrabMarker = CreateImage(_stage, "Grab target warning",
                new Vector2(-300f, -133f), new Vector2(42f, 5f),
                new Color(1f, 0.25f, 0.43f, 0.9f)).rectTransform;
            _cthulhuGrabMarker.gameObject.SetActive(false);
            CreateImage(_cthulhuCoreVisual, "Core pupil", Vector2.zero,
                new Vector2(12f, 20f), new Color(0.025f, 0.10f, 0.075f)).raycastTarget = false;

            _cthulhuPlayerVisual = CreateImage(_stage, "Rlyeh operator",
                new Vector2(-338f, -112f), new Vector2(27f, 55f),
                new Color(0.18f, 0.71f, 0.85f)).rectTransform;
            CreateImage(_cthulhuPlayerVisual, "Operator hardhat",
                new Vector2(0f, 29f), new Vector2(33f, 10f),
                new Color(0.98f, 0.68f, 0.16f)).raycastTarget = false;
            CreateImage(_cthulhuPlayerVisual, "Operator visor",
                new Vector2(4f, 14f), new Vector2(17f, 5f),
                new Color(0.08f, 0.16f, 0.23f)).raycastTarget = false;
            CreateImage(_stage, "Cthulhu boss floor shadow",
                new Vector2(284f, -128f), new Vector2(235f, 20f),
                new Color(0.018f, 0.035f, 0.04f)).raycastTarget = false;
            _cthulhuBossVisual.SetAsLastSibling();
            _cthulhuCoreVisual.SetAsLastSibling();
        }

        private void Update()
        {
            if (_closed || _resultShown) return;
            Keyboard keyboard = Keyboard.current;
            bool keyboardActionPressed = keyboard != null && (_mode == EncounterMode.RabbitHole
                ? keyboard.spaceKey.wasPressedThisFrame
                : keyboard.spaceKey.wasPressedThisFrame || keyboard.leftShiftKey.wasPressedThisFrame);
            bool keyboardActionHeld = keyboard != null && (_mode == EncounterMode.RabbitHole
                ? keyboard.spaceKey.isPressed
                : keyboard.spaceKey.isPressed || keyboard.leftShiftKey.isPressed);
            bool keyboardAttackHeld = keyboard != null && (keyboard.jKey.isPressed || keyboard.enterKey.isPressed);
            _actionPressed = _actionPressed || keyboardActionPressed;
            _actionHeld = _actionPointerHeld || keyboardActionHeld;
            _attackHeld = _attackPointerHeld || keyboardAttackHeld;

            float deltaTime = Mathf.Clamp(Time.unscaledDeltaTime, 0f, 1f / 30f);
            if (deltaTime <= 0f) return;
            _encounterElapsed += deltaTime;

            if (_mode == EncounterMode.RabbitHole) UpdateRabbitHole(deltaTime);
            else UpdateNecronomicon(deltaTime);

            _actionPressed = false;
        }

        private void UpdateRabbitHole(float dt)
        {
            _rabbitTime = Mathf.Max(0f, _rabbitTime - dt);
            _rabbitInvulnerable = Mathf.Max(0f, _rabbitInvulnerable - dt);
            float direction = GetHorizontalInput();
            float targetSpeed = direction * 300f;
            float blend = 1f - Mathf.Exp(-(Mathf.Abs(direction) < 0.01f ? 22f : 18f) * dt);
            _rabbitVx += (targetSpeed - _rabbitVx) * blend;
            if (Mathf.Abs(direction) < 0.01f && Mathf.Abs(_rabbitVx) < 3f) _rabbitVx = 0f;

            _rabbitJumpBuffer = _actionPressed ? 0.14f : Mathf.Max(0f, _rabbitJumpBuffer - dt);
            _rabbitCoyote = _rabbitGrounded ? 0.11f : Mathf.Max(0f, _rabbitCoyote - dt);
            if (_rabbitJumpBuffer > 0f && (_rabbitGrounded || _rabbitCoyote > 0f))
            {
                _rabbitVy = -560f;
                _rabbitGrounded = false;
                _rabbitJumpBuffer = 0f;
                _rabbitCoyote = 0f;
            }

            float previousBottom = _rabbitY + 46f;
            float gravity = _actionHeld && _rabbitVy < 0f ? 900f : 1420f;
            _rabbitVy = Mathf.Min(860f, _rabbitVy + gravity * dt);
            if (!_actionHeld && _rabbitVy < -455f) _rabbitVy = -455f;
            _rabbitX = Mathf.Clamp(_rabbitX + _rabbitVx * dt, 0f, RabbitWorldWidth - 30f);
            _rabbitY += _rabbitVy * dt;
            _rabbitGrounded = false;

            for (int i = 0; i < _platforms.Count; i++)
            {
                Platform platform = _platforms[i];
                bool overlap = _rabbitX + 30f > platform.X + 2f && _rabbitX < platform.X + platform.Width - 2f;
                bool crossed = previousBottom <= platform.Y + 9f
                    && _rabbitY + 46f >= platform.Y && _rabbitVy >= 0f;
                if (!overlap || !crossed) continue;
                _rabbitY = platform.Y - 46f;
                _rabbitVy = 0f;
                _rabbitGrounded = true;
                break;
            }

            if (_rabbitY > 630f) LoseRabbitLife();
            if (_rabbitInvulnerable <= 0f && (HitsHazard(1015f, 405f, 34f, 35f)
                || HitsHazard(1810f, 394f, 34f, 35f)))
                LoseRabbitLife();

            for (int i = 0; i < _watches.Count; i++)
            {
                Watch watch = _watches[i];
                if (watch.Collected) continue;
                if (Overlaps(_rabbitX - 8f, _rabbitY - 8f, 46f, 62f,
                    watch.X - 15f, watch.Y - 15f, 30f, 30f))
                {
                    watch.Collected = true;
                    _rabbitCollected++;
                }
            }

            if (_rabbitGrounded)
            {
                if (_rabbitX >= 930f && _rabbitCheckpointX < 930f) { _rabbitCheckpointX = 930f; _rabbitCheckpointY = 440f; }
                if (_rabbitX >= 1320f && _rabbitCheckpointX < 1320f) { _rabbitCheckpointX = 1320f; _rabbitCheckpointY = 370f; }
                if (_rabbitX >= 1800f && _rabbitCheckpointX < 1800f) { _rabbitCheckpointX = 1800f; _rabbitCheckpointY = 430f; }
                if (_rabbitX >= 2090f && _rabbitCheckpointX < 2090f) { _rabbitCheckpointX = 2090f; _rabbitCheckpointY = 358f; }
            }

            _rabbitAnimation += dt * (Mathf.Abs(_rabbitVx) > 12f ? 9f : 2f);
            _rabbitCameraX = Mathf.Clamp(_rabbitX - 350f, 0f, RabbitWorldWidth - RabbitViewWidth);
            RenderRabbitHole();

            if (_rabbitCollected == 3 && _rabbitX + 30f >= RabbitGoalX)
            {
                ShowResult(true, "NORKA ZDOBYTA", "Zebrano wszystkie trzy zegarki. Królik wskazuje drogę powrotną.");
                return;
            }
            if (_rabbitTime <= 0f || _rabbitLives <= 0)
                ShowResult(false, "CZAS MINĄŁ", "Nie udało się dotrzeć na drugą stronę. Możesz powtórzyć etap.");
            else SetHud();
        }

        private void LoseRabbitLife()
        {
            if (_rabbitInvulnerable > 0f) return;
            _rabbitLives = Mathf.Max(0, _rabbitLives - 1);
            _rabbitInvulnerable = 1.5f;
            _rabbitX = _rabbitCheckpointX;
            _rabbitY = _rabbitCheckpointY - 46f;
            _rabbitVx = 0f;
            _rabbitVy = 0f;
            _rabbitGrounded = true;
            _rabbitJumpBuffer = 0f;
            _rabbitCoyote = 0f;
        }

        private bool HitsHazard(float x, float y, float width, float height)
        {
            return Overlaps(_rabbitX + 4f, _rabbitY + 7f, 22f, 38f, x, y, width, height);
        }

        private static bool Overlaps(float ax, float ay, float aw, float ah,
            float bx, float by, float bw, float bh)
        {
            return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
        }

        private void RenderRabbitHole()
        {
            for (int i = 0; i < _platforms.Count; i++)
            {
                Platform platform = _platforms[i];
                float px = (platform.X + platform.Width * 0.5f - _rabbitCameraX) * RabbitScale - 450f;
                float py = (270f - platform.Y - platform.Height * 0.5f) * RabbitScale;
                platform.Visual.anchoredPosition = new Vector2(px, py);
                platform.Visual.sizeDelta = new Vector2(platform.Width * RabbitScale, platform.Height * RabbitScale);
            }

            for (int i = 0; i < _watches.Count; i++)
            {
                Watch watch = _watches[i];
                float px = (watch.X - _rabbitCameraX) * RabbitScale - 450f;
                float py = (270f - watch.Y) * RabbitScale;
                watch.Visual.anchoredPosition = new Vector2(px, py);
                watch.Visual.gameObject.SetActive(!watch.Collected);
            }

            for (int i = 0; i < _hazards.Count; i++)
            {
                float hx = i == 0 ? 1015f : 1810f;
                float hy = i == 0 ? 405f : 394f;
                float px = (hx + 17f - _rabbitCameraX) * RabbitScale - 450f;
                float py = (270f - hy - 17.5f) * RabbitScale;
                _hazards[i].anchoredPosition = new Vector2(px, py);
                _hazards[i].sizeDelta = new Vector2(34f * RabbitScale, 35f * RabbitScale);
            }

            float playerX = (_rabbitX + 15f - _rabbitCameraX) * RabbitScale - 450f;
            float playerY = (270f - _rabbitY - 23f) * RabbitScale;
            _rabbitPlayerVisual.anchoredPosition = new Vector2(playerX, playerY);
            _rabbitPlayerVisual.localScale = new Vector3(_rabbitVx < -3f ? -1f : 1f, 1f, 1f);
            Image body = _rabbitPlayerVisual.GetComponent<Image>();
            Color tint = _rabbitInvulnerable > 0f && Mathf.FloorToInt(_rabbitInvulnerable * 12f) % 2 == 0
                ? new Color(1f, 1f, 1f, 0.35f) : new Color(0.26f, 0.75f, 0.91f, 1f);
            if (body != null) body.color = tint;
        }

        private void UpdateNecronomicon(float dt)
        {
            _cthulhuPlayerInvulnerability = Mathf.Max(0f, _cthulhuPlayerInvulnerability - dt);
            _cthulhuDodgeRemaining = Mathf.Max(0f, _cthulhuDodgeRemaining - dt);
            _cthulhuDodgeCooldown = Mathf.Max(0f, _cthulhuDodgeCooldown - dt);
            _cthulhuAttackCooldown = Mathf.Max(0f, _cthulhuAttackCooldown - dt);
            _cthulhuBossOpen = Mathf.Max(0f, _cthulhuBossOpen - dt);

            float direction = GetHorizontalInput();
            _cthulhuPlayerX = Mathf.Clamp(_cthulhuPlayerX + direction * (_cthulhuDodgeRemaining > 0f ? 245f : 170f) * dt,
                34f, 620f);

            if (_actionPressed && _cthulhuDodgeCooldown <= 0f)
            {
                _cthulhuDodgeRemaining = 0.42f;
                _cthulhuDodgeCooldown = 1.35f;
                if (_cthulhuJumpHeight <= 0.5f) _cthulhuJumpVelocity = 205f;
            }
            _cthulhuJumpVelocity -= 520f * dt;
            _cthulhuJumpHeight = Mathf.Max(0f, _cthulhuJumpHeight + _cthulhuJumpVelocity * dt);
            if (_cthulhuJumpHeight <= 0f) _cthulhuJumpVelocity = 0f;

            if (_attackHeld && _cthulhuAttackCooldown <= 0f)
            {
                float startX = _cthulhuPlayerX + 18f;
                float startY = -143f + _cthulhuJumpHeight + 45f;
                const float coreScreenY = -17f;
                float travelSeconds = Mathf.Max(0.12f, (735f - startX) / 330f);
                Projectile shot = new Projectile
                {
                    X = startX,
                    Y = startY,
                    VerticalSpeed = (coreScreenY - startY) / travelSeconds
                };
                shot.Visual = CreateImage(_stage, "Elder-god counter projectile", Vector2.zero,
                    new Vector2(15f, 7f), new Color(0.45f, 1f, 0.74f)).rectTransform;
                _projectiles.Add(shot);
                _cthulhuAttackCooldown = 0.36f;
            }

            if (_cthulhuStrikeWindup > 0f)
            {
                _cthulhuStrikeWindup = Mathf.Max(0f, _cthulhuStrikeWindup - dt);
                if (_cthulhuStrikeWindup <= 0f && _cthulhuBossHp > 0f)
                {
                    ResolveBossAttack();
                    _cthulhuBossWindup = _cthulhuPhase == 2 ? 1.55f : 2.55f;
                    if (_cthulhuGrabMarker != null) _cthulhuGrabMarker.gameObject.SetActive(false);
                }
            }
            else if (_cthulhuBossHp > 0f)
            {
                _cthulhuBossWindup -= dt;
                if (_cthulhuBossWindup <= 0f) BeginBossTelegraph();
            }

            UpdateShockwaves(dt);
            UpdateProjectiles(dt);
            if (_cthulhuBossHp <= 0f)
            {
                _cthulhuBossDeath += dt;
                if (_cthulhuBossDeath >= 2.25f)
                    ShowResult(true, "CTHULHU POKONANY", "Necronomicon milknie. R’lyeh znika pod czarną wodą.");
            }
            else if (_cthulhuPlayerHp <= 0f)
            {
                ShowResult(false, "R’LYEH CIĘ POCHŁONĘŁO", "Cthulhu utrzymał kontrolę nad zatopionym miastem.");
            }

            if (_cthulhuBossHp <= 90f) _cthulhuPhase = 2;
            if (_cthulhuGrabMarker != null && _cthulhuStrikeWindup > 0f)
                _cthulhuGrabMarker.anchoredPosition = new Vector2(_bossGrabX - 450f, -133f);
            if (_cthulhuCoreVisual != null)
            {
                _cthulhuCoreVisual.localScale = Vector3.one * (0.88f + Mathf.Sin(_encounterElapsed * 4f) * 0.12f);
                Image coreImage = _cthulhuCoreVisual.GetComponent<Image>();
                if (coreImage != null)
                    coreImage.color = _cthulhuBossOpen > 0f
                        ? new Color(0.40f, 1f, 0.78f)
                        : new Color(0.09f, 0.30f, 0.27f);
            }
            if (_cthulhuBossVisual != null)
                _cthulhuBossVisual.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(_encounterElapsed * 1.3f) * 1.8f);
            if (_cthulhuPlayerVisual != null)
                _cthulhuPlayerVisual.anchoredPosition = new Vector2(_cthulhuPlayerX - 450f,
                    -143f + _cthulhuJumpHeight);
            SetHud();
        }

        private void BeginBossTelegraph()
        {
            _bossAttack = _nextBossAttack;
            _nextBossAttack = _nextBossAttack == BossAttack.Slam
                ? BossAttack.Lash : _nextBossAttack == BossAttack.Lash ? BossAttack.Grab : BossAttack.Slam;
            _cthulhuStrikeWindup = _cthulhuPhase == 2 ? 0.62f : 0.82f;
            if (_bossAttack == BossAttack.Grab)
            {
                _bossGrabX = Mathf.Clamp(_cthulhuPlayerX + Random.Range(-150f, 150f), 60f, 590f);
                if (_cthulhuGrabMarker != null)
                {
                    _cthulhuGrabMarker.anchoredPosition = new Vector2(_bossGrabX - 450f, -133f);
                    _cthulhuGrabMarker.gameObject.SetActive(true);
                }
                _statusHud.text = "TELEGRAPH CHWYTU • WYJDŹ Z CZERWONEJ STREFY";
            }
            else if (_bossAttack == BossAttack.Slam)
                _statusHud.text = "TELEGRAPH FALI • PRZYGOTUJ SKOK";
            else
                _statusHud.text = "TELEGRAPH MACEK • SKOK LUB UNIK";
        }

        private void ResolveBossAttack()
        {
            _cthulhuBossOpen = 2.15f;

            switch (_bossAttack)
            {
                case BossAttack.Slam:
                    AddShockwave(640f, 0f);
                    if (_cthulhuPhase == 2) AddShockwave(760f, 0.95f);
                    _statusHud.text = _cthulhuPhase == 2
                        ? "PODWÓJNA FALA UDERZENIOWA • SKOCZ DWUKROTNIE"
                        : "FALA UDERZENIOWA • PRZESKOCZ NISKĄ FALĘ";
                    break;
                case BossAttack.Lash:
                    if (_cthulhuJumpHeight < 43f && _cthulhuDodgeRemaining <= 0f
                        && _cthulhuPlayerX < 590f)
                        DamageCthulhuPlayer(_cthulhuPhase == 2 ? 38f : 32f);
                    _statusHud.text = "CIĘCIE MACEK • SKOK LUB UNIK";
                    break;
                default:
                    if (_cthulhuJumpHeight < 12f && _cthulhuDodgeRemaining <= 0f
                        && Mathf.Abs(_cthulhuPlayerX - _bossGrabX) < 34f)
                        DamageCthulhuPlayer(_cthulhuPhase == 2 ? 46f : 40f);
                    _statusHud.text = "CHWYT STAREGO BOGA • STREFA ZAMKNIĘTA";
                    break;
            }
        }

        private void AddShockwave(float x, float delay)
        {
            Shockwave wave = new Shockwave { X = x, Delay = delay };
            wave.Visual = CreateImage(_stage, "R’lyeh ground shockwave", Vector2.zero,
                new Vector2(40f, 22f), new Color(0.93f, 0.34f, 0.62f)).rectTransform;
            _shockwaves.Add(wave);
        }

        private void UpdateShockwaves(float dt)
        {
            for (int i = _shockwaves.Count - 1; i >= 0; i--)
            {
                Shockwave wave = _shockwaves[i];
                if (wave.Delay > 0f)
                {
                    wave.Delay = Mathf.Max(0f, wave.Delay - dt);
                    continue;
                }
                float previousX = wave.X;
                wave.X -= (_cthulhuPhase == 2 ? 224f : 190f) * dt;
                wave.Visual.anchoredPosition = new Vector2(wave.X - 450f, -135f);
                bool crossed = previousX >= _cthulhuPlayerX - 6f && wave.X <= _cthulhuPlayerX + 6f;
                if (crossed && _cthulhuJumpHeight < 38f && _cthulhuDodgeRemaining <= 0f)
                {
                    DamageCthulhuPlayer(30f);
                    Destroy(wave.Visual.gameObject);
                    _shockwaves.RemoveAt(i);
                    continue;
                }
                if (wave.X < -30f)
                {
                    Destroy(wave.Visual.gameObject);
                    _shockwaves.RemoveAt(i);
                }
            }
        }

        private void UpdateProjectiles(float dt)
        {
            for (int i = _projectiles.Count - 1; i >= 0; i--)
            {
                Projectile shot = _projectiles[i];
                shot.X += 330f * dt;
                shot.Y += shot.VerticalSpeed * dt;
                shot.Visual.anchoredPosition = new Vector2(shot.X - 450f, shot.Y);
                if (shot.X >= 735f)
                {
                    if (_cthulhuBossOpen > 0f && _cthulhuBossHp > 0f
                        && Mathf.Abs(shot.Y - -17f) <= 20f)
                    {
                        float damage = 22.5f;
                        _cthulhuBossHp = Mathf.Max(0f, _cthulhuBossHp - damage);
                        _statusHud.text = "RDZEŃ TRAFIONY • +" + damage.ToString("0.0") + " OBRAŻEŃ";
                    }
                    Destroy(shot.Visual.gameObject);
                    _projectiles.RemoveAt(i);
                }
            }
        }

        private void DamageCthulhuPlayer(float amount)
        {
            if (_cthulhuPlayerInvulnerability > 0f || _cthulhuDodgeRemaining > 0f) return;
            _cthulhuPlayerHp = Mathf.Max(0f, _cthulhuPlayerHp - amount);
            _cthulhuPlayerInvulnerability = 0.92f;
            _statusHud.text = "TRAFIENIE • -" + amount.ToString("0") + " HP";
        }

        private float GetHorizontalInput()
        {
            float direction = (_rightHeld ? 1f : 0f) - (_leftHeld ? 1f : 0f);
            Keyboard keyboard = Keyboard.current;
            if (keyboard != null)
            {
                if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) direction -= 1f;
                if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) direction += 1f;
            }
            return Mathf.Clamp(direction, -1f, 1f);
        }

        private void SetHud()
        {
            if (_mode == EncounterMode.RabbitHole)
            {
                if (_primaryHud != null)
                    _primaryHud.text = "⌚ ZEGARKI  " + _rabbitCollected + "/3     ♥ ŻYCIA  " + _rabbitLives;
                if (_secondaryHud != null)
                    _secondaryHud.text = "CZAS  " + _rabbitTime.ToString("0.0") + " s";
            }
            else
            {
                if (_primaryHud != null) _primaryHud.text = "OPERATOR  " + _cthulhuPlayerHp.ToString("0") + " / 100 HP";
                if (_secondaryHud != null) _secondaryHud.text = "CTHULHU  " + _cthulhuBossHp.ToString("0") + " / 180 HP  •  FAZA " + _cthulhuPhase;
                if (_playerHealthBar != null) _playerHealthBar.fillAmount = Mathf.Clamp01(_cthulhuPlayerHp / 100f);
                if (_bossHealthBar != null) _bossHealthBar.fillAmount = Mathf.Clamp01(_cthulhuBossHp / 180f);
            }
        }

        private void ShowResult(bool won, string heading, string details)
        {
            if (_resultShown) return;
            _resultShown = true;
            _won = won;
            _resultPanel.SetActive(true);
            _leftHeld = _rightHeld = _actionHeld = _actionPointerHeld = _attackHeld = _attackPointerHeld = false;
            Transform resultTransform = _resultPanel.transform;
            Text[] texts = resultTransform.GetComponentsInChildren<Text>(true);
            foreach (Text text in texts)
            {
                if (text.gameObject.name == "Result heading") text.text = heading;
                else if (text.gameObject.name == "Result details") text.text = details;
            }
            if (won)
            {
                _statusHud.text = "SEKRET UKOŃCZONY • NAGRODA CZEKA NA ODBIÓR";
            }
            else
            {
                _statusHud.text = "SEKRET NIEUKOŃCZONY • MOŻESZ SPRÓBOWAĆ PONOWNIE";
            }
        }

        private void RetryEncounter()
        {
            _resultShown = false;
            _resultPanel.SetActive(false);
            _won = false;
            _rewardGranted = false;
            _leftHeld = _rightHeld = _actionHeld = _actionPointerHeld = _attackHeld = _attackPointerHeld = _actionPressed = false;
            _platforms.Clear();
            _watches.Clear();
            _hazards.Clear();
            _shockwaves.Clear();
            _projectiles.Clear();
            for (int i = _stage.childCount - 1; i >= 0; i--)
                Destroy(_stage.GetChild(i).gameObject);

            if (_mode == EncounterMode.RabbitHole)
            {
                _rabbitX = 76f; _rabbitY = 410f; _rabbitVx = _rabbitVy = 0f;
                _rabbitGrounded = true; _rabbitTime = 68f; _rabbitInvulnerable = 0f;
                _rabbitJumpBuffer = _rabbitCoyote = 0f; _rabbitCheckpointX = 76f;
                _rabbitCheckpointY = 456f; _rabbitLives = 3; _rabbitCollected = 0;
                BuildRabbitHole();
            }
            else
            {
                _cthulhuPlayerX = 112f; _cthulhuJumpHeight = _cthulhuJumpVelocity = 0f;
                _cthulhuPlayerHp = 100f; _cthulhuPlayerInvulnerability = 0f;
                _cthulhuDodgeRemaining = _cthulhuDodgeCooldown = _cthulhuAttackCooldown = 0f;
                _cthulhuBossHp = 180f; _cthulhuBossOpen = 0f; _cthulhuBossWindup = 2.2f;
                _cthulhuStrikeWindup = 0f; _cthulhuBossDeath = 0f; _cthulhuPhase = 1;
                _bossAttack = BossAttack.Slam; _nextBossAttack = BossAttack.Lash;
                _encounterElapsed = 0f;
                BuildNecronomicon();
            }
            SetHud();
        }

        private void ReturnWithReward()
        {
            if (!_rewardGranted && _won && GameSession.Current != null && _player != null)
            {
                if (_mode == EncounterMode.RabbitHole)
                {
                    GameSession.Current.Score += 1200 + _rabbitCollected * 250;
                    _player.IncreaseMaxHealth(1);
                    _player.RestoreHealth(1f);
                    FindFirstObjectByType<HudController>()?.SetStatus("NORKA KRÓLIKA • NAGRODA +1 ŻYCIE");
                }
                else
                {
                    GameSession.Current.Score += 6000;
                    FindFirstObjectByType<HudController>()?.SetStatus("NECRONOMICON • CTHULHU POKONANY • +6000 PKT");
                }
                _rewardGranted = true;
            }
            CloseWithoutReward();
        }

        private void CloseWithoutReward()
        {
            if (_closed) return;
            _closed = true;
            Time.timeScale = 1f;
            if (GameSession.Current != null && GameSession.Current.State == GameFlowState.LevelUp)
                GameSession.SetState(GameFlowState.Playing);
            if (_active == this) _active = null;
            Destroy(gameObject);
        }

        private Image CreateProgressBar(RectTransform parent, string name, Vector2 position,
            Vector2 size, Color color)
        {
            Image background = CreateImage(parent, name + " background", position, size,
                new Color(0.12f, 0.16f, 0.20f));
            Image fill = CreateImage(background.rectTransform, name + " fill", Vector2.zero, size, color);
            fill.type = Image.Type.Filled;
            fill.fillMethod = Image.FillMethod.Horizontal;
            fill.fillOrigin = (int)Image.OriginHorizontal.Left;
            fill.fillAmount = 1f;
            fill.rectTransform.anchorMin = Vector2.zero;
            fill.rectTransform.anchorMax = Vector2.one;
            fill.rectTransform.offsetMin = Vector2.zero;
            fill.rectTransform.offsetMax = Vector2.zero;
            return fill;
        }

        private Image CreateImage(Transform parent, string name, Vector2 position,
            Vector2 size, Color color)
        {
            GameObject obj = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Image image = obj.GetComponent<Image>();
            image.color = color;
            image.raycastTarget = false;
            return image;
        }

        private Text CreateText(Transform parent, string name, Vector2 position,
            Vector2 size, int fontSize, TextAnchor alignment, Color color)
        {
            GameObject obj = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Text text = obj.GetComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = color;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.raycastTarget = false;
            return text;
        }

        private void CreateButton(Transform parent, string name, string label, Vector2 unusedAnchor,
            Vector2 unusedPivot, Vector2 position, Vector2 size, Color color, int fontSize,
            UnityEngine.Events.UnityAction action)
        {
            GameObject obj = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer),
                typeof(Image), typeof(Button));
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Image image = obj.GetComponent<Image>();
            image.color = color;
            Button button = obj.GetComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(action);
            CreateText(rect, name + " label", Vector2.zero, size - new Vector2(12f, 8f),
                fontSize, TextAnchor.MiddleCenter, Color.white);
        }

        private void CreateHoldButton(Transform parent, string name, string label,
            Vector2 position, Vector2 size, Color color, System.Action<bool> callback)
        {
            GameObject obj = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer),
                typeof(Image), typeof(Button), typeof(EventTrigger));
            RectTransform rect = obj.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            Image image = obj.GetComponent<Image>();
            image.color = color;
            Button button = obj.GetComponent<Button>();
            button.targetGraphic = image;
            CreateText(rect, name + " label", Vector2.zero, size - new Vector2(8f, 8f),
                16, TextAnchor.MiddleCenter, Color.white);
            EventTrigger trigger = obj.GetComponent<EventTrigger>();
            AddPointerEvent(trigger, EventTriggerType.PointerDown, _ => callback(true));
            AddPointerEvent(trigger, EventTriggerType.PointerUp, _ => callback(false));
            AddPointerEvent(trigger, EventTriggerType.PointerExit, _ => callback(false));
        }

        private static void AddPointerEvent(EventTrigger trigger, EventTriggerType type,
            System.Action<BaseEventData> callback)
        {
            EventTrigger.Entry entry = new EventTrigger.Entry { eventID = type };
            entry.callback.AddListener(data => callback(data));
            trigger.triggers.Add(entry);
        }

        private void OnDestroy()
        {
            if (_closed) return;
            _closed = true;
            Time.timeScale = 1f;
            if (GameSession.Current != null && GameSession.Current.State == GameFlowState.LevelUp)
                GameSession.SetState(GameFlowState.Playing);
            if (_active == this) _active = null;
        }
    }
}
