using UnityEngine;
using UnityEngine.EventSystems;

namespace MaxFlix.Unity.Runtime
{
    public sealed class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        [SerializeField] private RectTransform handle;
        [SerializeField] private float movementRadius = 64f;

        private RectTransform _root;
        private Vector2 _value;
        private int _activePointerId = int.MinValue;

        public Vector2 Value { get { return _value; } }

        public void ConfigureHandle(RectTransform value)
        {
            handle = value;
        }

        public void ConfigureMovementRadius(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value)) return;
            movementRadius = Mathf.Clamp(value, 1f, 256f);
            if (handle != null && _value.sqrMagnitude > 0.0001f)
                handle.anchoredPosition = _value * movementRadius;
        }

        private void Awake()
        {
            _root = transform as RectTransform;
            if (movementRadius <= 0f) movementRadius = 64f;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            // Lock the joystick to the first finger. Additional touch pointers
            // can operate jump/attack/ability without stealing or resetting it.
            if (_activePointerId != int.MinValue) return;
            _activePointerId = eventData.pointerId;
            OnDrag(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (_activePointerId != eventData.pointerId || _root == null || handle == null) return;

            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    _root, eventData.position, eventData.pressEventCamera, out Vector2 localPoint))
            {
                return;
            }

            _value = Vector2.ClampMagnitude(localPoint / movementRadius, 1f);
            handle.anchoredPosition = _value * movementRadius;
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (_activePointerId != eventData.pointerId) return;
            ResetStick();
        }

        private void OnDisable()
        {
            ResetStick();
        }

        private void ResetStick()
        {
            _activePointerId = int.MinValue;
            _value = Vector2.zero;
            if (handle != null) handle.anchoredPosition = Vector2.zero;
        }
    }
}
