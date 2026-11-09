using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Lightweight articulated procedural rig. The arm and leg pivots match
    /// the operator shoulder/hip hierarchy and preserve each operator's gait.
    /// </summary>
    public sealed class OperatorAnimationRig : MonoBehaviour
    {
        private Transform _leftArm;
        private Transform _rightArm;
        private Transform _leftHip;
        private Transform _rightHip;
        private OperatorProfile _profile;
        private Quaternion _leftArmRest;
        private Quaternion _rightArmRest;
        private float _walkPhase;
        private float _attackRemaining;

        public void Initialize(
            Transform leftArm,
            Transform rightArm,
            Transform leftHip,
            Transform rightHip,
            OperatorProfile profile)
        {
            _leftArm = leftArm;
            _rightArm = rightArm;
            _leftHip = leftHip;
            _rightHip = rightHip;
            _profile = profile;
            if (_leftArm != null) _leftArmRest = _leftArm.localRotation;
            if (_rightArm != null) _rightArmRest = _rightArm.localRotation;
        }

        public void TriggerAttack()
        {
            if (_profile == null) return;
            _attackRemaining = Mathf.Max(0.1f, _profile.AttackDurationSeconds);
        }

        public void Tick(float movementStrength, bool grounded, float deltaTime)
        {
            if (_profile == null) return;
            float movement = Mathf.Clamp01(movementStrength);
            if (movement > 0.03f && grounded)
                _walkPhase += deltaTime * _profile.GaitFrequency;

            float gait = Mathf.Sin(_walkPhase) * movement;
            if (_leftHip != null)
                _leftHip.localRotation = Quaternion.Euler(gait * _profile.Stride * 52f, 0f, 0f);
            if (_rightHip != null)
                _rightHip.localRotation = Quaternion.Euler(-gait * _profile.Stride * 52f, 0f, 0f);

            float armSwing = -gait * _profile.ArmSwing * 40f;
            if (!grounded) armSwing -= 14f;

            Quaternion leftPose = _leftArmRest * Quaternion.Euler(armSwing, 0f, _profile.ArmSwing * movement * 8f);
            Quaternion rightPose = _rightArmRest * Quaternion.Euler(-armSwing, 0f, -_profile.ArmSwing * movement * 8f);

            if (_attackRemaining > 0f)
            {
                float duration = Mathf.Max(0.1f, _profile.AttackDurationSeconds);
                float progress = Mathf.Clamp01(1f - _attackRemaining / duration);
                float strike = Mathf.Pow(Mathf.Max(0f, Mathf.Sin(progress * Mathf.PI)), 0.9f);
                rightPose *= Quaternion.Euler(-92f * strike, 0f, -18f * strike);
                leftPose *= Quaternion.Euler(-22f * strike, 0f, 12f * strike);
                _attackRemaining = Mathf.Max(0f, _attackRemaining - deltaTime);
            }

            if (_leftArm != null) _leftArm.localRotation = Quaternion.Slerp(_leftArm.localRotation, leftPose, 1f - Mathf.Exp(-18f * deltaTime));
            if (_rightArm != null) _rightArm.localRotation = Quaternion.Slerp(_rightArm.localRotation, rightPose, 1f - Mathf.Exp(-18f * deltaTime));
        }
    }
}
