using UnityEngine;
using UnityEngine.InputSystem;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Third-person perspective camera with a switchable orthographic top-down view.
    /// Zoom is normalized so touch sliders and the desktop mouse wheel share one range.
    /// </summary>
    public sealed class CameraFollowRig : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 offset = new Vector3(0f, 7.8f, -9.5f);
        [SerializeField] private float followSharpness = 8f;
        [SerializeField] private float lookHeight = 1.0f;
        [SerializeField] private float minDistance = 6.0f;
        [SerializeField] private float maxDistance = 15.0f;
        [SerializeField] private float minTopDownSize = 5.5f;
        [SerializeField] private float maxTopDownSize = 10.5f;

        private readonly Vector3 _perspectiveDirection = new Vector3(0f, 7.8f, -9.5f).normalized;
        private float _distance;
        private float _zoomNormalized = 0.70f;
        private bool _topDown;
        private Camera _camera;

        public float ZoomNormalized { get { return _zoomNormalized; } }
        public bool IsTopDown { get { return _topDown; } }

        public void SetTarget(Transform value)
        {
            target = value;
            _camera = GetComponent<Camera>();
            _distance = offset.magnitude;
            _zoomNormalized = Mathf.InverseLerp(minDistance, maxDistance, _distance);
            ApplyViewConfiguration();
        }

        public void SetZoomNormalized(float value)
        {
            if (float.IsNaN(value) || float.IsInfinity(value)) return;
            _zoomNormalized = Mathf.Clamp01(value);
            ApplyViewConfiguration();
        }

        public void ToggleViewMode()
        {
            _topDown = !_topDown;
            ApplyViewConfiguration();
        }

        public void SetTopDownView(bool enabled)
        {
            if (_topDown == enabled) return;
            _topDown = enabled;
            ApplyViewConfiguration();
        }

        private void ApplyViewConfiguration()
        {
            _distance = Mathf.Lerp(minDistance, maxDistance, _zoomNormalized);
            if (_camera == null) _camera = GetComponent<Camera>();

            if (_topDown)
            {
                offset = Vector3.up * _distance;
                if (_camera != null)
                {
                    _camera.orthographic = true;
                    _camera.orthographicSize = Mathf.Lerp(minTopDownSize, maxTopDownSize, _zoomNormalized);
                }
            }
            else
            {
                offset = _perspectiveDirection * _distance;
                if (_camera != null) _camera.orthographic = false;
            }
        }

        private void LateUpdate()
        {
            if (target == null) return;

            float wheel = Mouse.current != null ? Mouse.current.scroll.ReadValue().y / 120f : 0f;
            if (Mathf.Abs(wheel) > 0.01f)
                SetZoomNormalized(_zoomNormalized - wheel * 0.035f);

            Vector3 desiredPosition = target.position + offset;
            Vector3 lookAt = target.position + Vector3.up * lookHeight;
            Quaternion desiredRotation = _topDown
                ? Quaternion.LookRotation(Vector3.down, Vector3.forward)
                : Quaternion.LookRotation(lookAt - desiredPosition, Vector3.up);
            float blend = 1f - Mathf.Exp(-followSharpness * Time.unscaledDeltaTime);
            transform.position = Vector3.Lerp(transform.position, desiredPosition, blend);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, blend);
        }
    }
}
