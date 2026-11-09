using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>Applies the platform safe area to all HUD controls and labels.</summary>
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeAreaLayout : MonoBehaviour
    {
        private RectTransform _rect;
        private Rect _lastSafeArea;
        private int _lastWidth;
        private int _lastHeight;

        private void Awake()
        {
            _rect = GetComponent<RectTransform>();
            ApplySafeArea();
        }

        private void Update()
        {
            if (_lastSafeArea != Screen.safeArea || _lastWidth != Screen.width || _lastHeight != Screen.height)
                ApplySafeArea();
        }

        private void ApplySafeArea()
        {
            if (_rect == null || Screen.width <= 0 || Screen.height <= 0) return;
            Rect safe = Screen.safeArea;
            _rect.anchorMin = new Vector2(safe.xMin / Screen.width, safe.yMin / Screen.height);
            _rect.anchorMax = new Vector2(safe.xMax / Screen.width, safe.yMax / Screen.height);
            _rect.offsetMin = Vector2.zero;
            _rect.offsetMax = Vector2.zero;
            _lastSafeArea = safe;
            _lastWidth = Screen.width;
            _lastHeight = Screen.height;
        }
    }
}
