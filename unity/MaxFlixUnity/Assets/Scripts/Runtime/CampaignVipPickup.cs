using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(SphereCollider))]
    public sealed class CampaignVipPickup : MonoBehaviour
    {
        private CampaignMissionDirector _mission;
        private bool _collected;
        private float _phase;

        public void Initialize(CampaignMissionDirector mission)
        {
            _mission = mission;
            SphereCollider trigger = GetComponent<SphereCollider>();
            trigger.isTrigger = true;
            trigger.radius = 0.9f;
        }

        private void Update()
        {
            if (_collected) return;
            _phase += Time.deltaTime;
            transform.Rotate(Vector3.up, 85f * Time.deltaTime, Space.World);
            Vector3 position = transform.position;
            position.y += Mathf.Sin(_phase * 2.4f) * 0.0015f;
            transform.position = position;
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
