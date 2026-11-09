using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Lightweight runtime governor for Survival. It samples unscaled frame time,
    /// changes quality only after sustained pressure and feeds the existing
    /// device-aware horde/enemy cap. The original settings are restored when
    /// the run world is destroyed.
    /// </summary>
    public sealed class SurvivalPerformanceGovernor : MonoBehaviour
    {
        private const float SampleWindowSeconds = 2.5f;
        private const int SlowWindowsBeforeDowngrade = 2;
        private const int FastWindowsBeforeUpgrade = 4;

        private static bool _baselineCaptured;
        private static int _baselineTargetFrameRate;
        private static int _baselineVsyncCount;
        private static float _baselineLodBias;
        private static float _baselineShadowDistance;
        private static ShadowResolution _baselineShadowResolution;

        private SurvivalWaveDirector _director;
        private HudController _hud;
        private float _windowSeconds;
        private int _windowFrames;
        private int _slowWindows;
        private int _fastWindows;
        private int _tier;
        private bool _initialized;

        public int CurrentTier { get { return _tier; } }
        public float LastMeasuredFps { get; private set; }

        public void Initialize(SurvivalWaveDirector director, HudController hud)
        {
            if (_initialized) return;
            _director = director;
            _hud = hud;
            if (!_baselineCaptured)
            {
                _baselineTargetFrameRate = Application.targetFrameRate;
                _baselineVsyncCount = QualitySettings.vSyncCount;
                _baselineLodBias = QualitySettings.lodBias;
                _baselineShadowDistance = QualitySettings.shadowDistance;
                _baselineShadowResolution = QualitySettings.shadowResolution;
                _baselineCaptured = true;
            }

            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            _tier = 0;
            _director?.SetAdaptivePerformanceTier(_tier);
            ApplyQualityTier();
            _initialized = true;
        }

        private void Update()
        {
            if (!_initialized || _director == null || GameSession.Current == null
                || GameSession.Current.Mode != GameMode.Survival
                || GameSession.Current.State != GameFlowState.Playing) return;

            float delta = Time.unscaledDeltaTime;
            if (delta <= 0f || float.IsNaN(delta) || float.IsInfinity(delta)) return;
            _windowSeconds += delta;
            _windowFrames++;

            if (_windowSeconds < SampleWindowSeconds) return;
            LastMeasuredFps = _windowFrames / Mathf.Max(0.001f, _windowSeconds);
            _windowFrames = 0;
            _windowSeconds = 0f;

            if (LastMeasuredFps < 46f)
            {
                _slowWindows++;
                _fastWindows = 0;
                if (_slowWindows >= SlowWindowsBeforeDowngrade && _tier < 2)
                    SetTier(_tier + 1, "STABILIZACJA FPS");
            }
            else if (LastMeasuredFps > 57f)
            {
                _fastWindows++;
                _slowWindows = 0;
                if (_fastWindows >= FastWindowsBeforeUpgrade && _tier > 0)
                    SetTier(_tier - 1, "JAKOŚĆ GRAFIKI PRZYWRÓCONA");
            }
            else
            {
                _slowWindows = 0;
                _fastWindows = 0;
            }
        }

        private void SetTier(int nextTier, string reason)
        {
            int safeTier = Mathf.Clamp(nextTier, 0, 2);
            if (safeTier == _tier) return;
            _tier = safeTier;
            _slowWindows = 0;
            _fastWindows = 0;
            _director?.SetAdaptivePerformanceTier(_tier);
            ApplyQualityTier();

            string quality = _tier == 0 ? "WYSOKA" : _tier == 1 ? "ZBALANSOWANA" : "WYDAJNOŚCIOWA";
            _hud?.SetStatus(reason + " • " + quality + " • " + LastMeasuredFps.ToString("0") + " FPS");
        }

        private void ApplyQualityTier()
        {
            if (_tier == 0)
            {
                QualitySettings.lodBias = _baselineLodBias;
                QualitySettings.shadowDistance = _baselineShadowDistance;
                QualitySettings.shadowResolution = _baselineShadowResolution;
                return;
            }

            if (_tier == 1)
            {
                QualitySettings.lodBias = Mathf.Max(0.8f, _baselineLodBias * 0.86f);
                QualitySettings.shadowDistance = Mathf.Min(_baselineShadowDistance, 30f);
                QualitySettings.shadowResolution = ShadowResolution.Medium;
                return;
            }

            QualitySettings.lodBias = Mathf.Max(0.6f, _baselineLodBias * 0.68f);
            QualitySettings.shadowDistance = Mathf.Min(_baselineShadowDistance, 16f);
            QualitySettings.shadowResolution = ShadowResolution.Low;
        }

        private void OnDestroy()
        {
            if (!_initialized) return;
            Application.targetFrameRate = _baselineTargetFrameRate;
            QualitySettings.vSyncCount = _baselineVsyncCount;
            QualitySettings.lodBias = _baselineLodBias;
            QualitySettings.shadowDistance = _baselineShadowDistance;
            QualitySettings.shadowResolution = _baselineShadowResolution;
        }
    }
}
