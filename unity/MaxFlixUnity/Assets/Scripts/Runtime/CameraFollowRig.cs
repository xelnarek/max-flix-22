using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    public sealed class CameraFollowRig : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 offset = new Vector3(0f, 7.8f, -9.5f);
        [SerializeField] private float followSharpness = 8f;
        [SerializeField] private float lookHeight = 1.0f;
        [SerializeField] private float minDistance = 6.0f;
        [SerializeField] private float maxDistance = 15.0f;

        private float _distance;

        public void SetTarget(Transform value)
        {
            target = value;
            _distance = offset.magnitude;
        }

        private void LateUpdate()
        {
            if (target == null) return;
            if (_distance <= 0f) _distance = offset.magnitude;

            float wheel = Input.mouseScrollDelta.y;
            if (Mathf.Abs(wheel) > 0.01f)
            {
                _distance = Mathf.Clamp(_distance - wheel * 0.75f, minDistance, maxDistance);
                offset = offset.normalized * _distance;
            }

            Vector3 desiredPosition = target.position + offset;
            Vector3 lookAt = target.position + Vector3.up * lookHeight;
            Quaternion desiredRotation = Quaternion.LookRotation(lookAt - desiredPosition, Vector3.up);
            float blend = 1f - Mathf.Exp(-followSharpness * Time.unscaledDeltaTime);
            transform.position = Vector3.Lerp(transform.position, desiredPosition, blend);
            transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, blend);
        }
    }
}
