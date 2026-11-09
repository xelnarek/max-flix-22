using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(SphereCollider), typeof(Rigidbody))]
    public sealed class CampaignVipPickup : MonoBehaviour
    {
        private CampaignMissionDirector _mission;
        private bool _collected;
        private float _phase;
        private Vector3 _basePosition;

        public void Initialize(CampaignMissionDirector mission)
        {
            _mission = mission;
            _basePosition = transform.position;

            SphereCollider trigger = GetComponent<SphereCollider>();
            trigger.isTrigger = true;
            trigger.radius = 0.9f;

            // A kinematic body makes trigger delivery reliable with a CharacterController player.
            Rigidbody body = GetComponent<Rigidbody>();
            body.isKinematic = true;
            body.useGravity = false;
            body.detectCollisions = true;
            body.interpolation = RigidbodyInterpolation.Interpolate;
        }

        private void Update()
        {
            if (_collected) return;
            _phase += Time.deltaTime;
            transform.Rotate(Vector3.up, 85f * Time.deltaTime, Space.World);
            transform.position = _basePosition + Vector3.up * (Mathf.Sin(_phase * 2.4f) * 0.14f);
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
