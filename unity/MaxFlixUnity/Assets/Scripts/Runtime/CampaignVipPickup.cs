using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(SphereCollider), typeof(Rigidbody))]
    public sealed class CampaignVipPickup : MonoBehaviour
    {
        private CampaignMissionDirector _mission;
        private Rigidbody _body;
        private bool _collected;
        private float _phase;
        private Vector3 _basePosition;
        private Quaternion _baseRotation;

        public void Initialize(CampaignMissionDirector mission)
        {
            _mission = mission;
            _basePosition = transform.position;
            _baseRotation = transform.rotation;

            SphereCollider trigger = GetComponent<SphereCollider>();
            trigger.isTrigger = true;
            trigger.radius = 0.9f;

            // A kinematic body makes trigger delivery reliable with a CharacterController player.
            _body = GetComponent<Rigidbody>();
            _body.isKinematic = true;
            _body.useGravity = false;
            _body.detectCollisions = true;
            _body.interpolation = RigidbodyInterpolation.Interpolate;
        }

        private void FixedUpdate()
        {
            if (_collected || _body == null) return;
            _phase += Time.fixedDeltaTime;
            _body.MovePosition(_basePosition + Vector3.up * (Mathf.Sin(_phase * 2.4f) * 0.14f));
            _body.MoveRotation(_baseRotation * Quaternion.Euler(0f, 85f * _phase, 0f));
        }

        private void OnTriggerEnter(Collider other)
        {
            if (_collected || _mission == null) return;
            if (other.GetComponent<PlayerController>() == null
                && other.GetComponentInParent<PlayerController>() == null) return;

            _collected = true;
            _mission.CollectVipOrder();
            Destroy(gameObject);
        }
    }
}
