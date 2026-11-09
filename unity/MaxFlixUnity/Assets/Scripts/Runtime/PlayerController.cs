using UnityEngine;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class PlayerController : MonoBehaviour
    {
        [SerializeField] private float gravity = -24f;
        [SerializeField] private float turnSharpness = 14f;
        [SerializeField] private float attackInterval = 0.42f;
        [SerializeField] private float projectileSpeed = 17f;

        private CharacterController _controller;
        private OperatorProfile _profile;
        private VirtualJoystick _joystick;
        private HudController _hud;
        private OperatorAnimationRig _animationRig;
        private float _verticalSpeed;
        private float _attackCooldown;
        private float _currentHealth;
        private bool _jumpRequested;
        private bool _attackRequested;
        private bool _defeated;

        public float CurrentHealth { get { return _currentHealth; } }
        public float MaxHealth { get { return _profile != null ? _profile.MaxHealth : 5f; } }
        public bool IsDefeated { get { return _defeated; } }
        public OperatorId OperatorId { get { return _profile != null ? _profile.Id : OperatorId.Marcin; } }

        public void Initialize(OperatorProfile profile, VirtualJoystick joystick, HudController hud)
        {
            _controller = GetComponent<CharacterController>();
            _profile = profile ?? OperatorCatalog.Get(OperatorId.Marcin);
            _animationRig = GetComponent<OperatorAnimationRig>();
            _joystick = joystick;
            _hud = hud;
            _currentHealth = _profile.MaxHealth;
            _hud?.SetHealth(_currentHealth, _profile.MaxHealth);
        }

        public void RequestJump()
        {
            if (!_defeated) _jumpRequested = true;
        }

        public void RequestAttack()
        {
            if (!_defeated) _attackRequested = true;
        }

        public void ApplyDamage(float amount)
        {
            if (_defeated || float.IsNaN(amount) || float.IsInfinity(amount) || amount <= 0f) return;
            _currentHealth = Mathf.Max(0f, _currentHealth - amount * _profile.DamageTakenMultiplier);
            _hud?.SetHealth(_currentHealth, _profile.MaxHealth);
            if (_currentHealth <= 0f)
            {
                _defeated = true;
                GameSession.SetState(GameFlowState.GameOver);
                _hud?.SetStatus("KONIEC ZMIANY — operator wyeliminowany");
            }
        }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            if (_controller == null || _defeated) return;

            GameSession.AddElapsedTime(Time.deltaTime);
            _attackCooldown = Mathf.Max(0f, _attackCooldown - Time.deltaTime);

            Vector2 moveInput = ReadMovement();
            Vector3 move = new Vector3(moveInput.x, 0f, moveInput.y);
            if (move.sqrMagnitude > 1f) move.Normalize();

            if (_controller.isGrounded && _verticalSpeed < 0f) _verticalSpeed = -2f;
            if (_jumpRequested && _controller.isGrounded) _verticalSpeed = _profile.JumpForce;
            _jumpRequested = false;
            _verticalSpeed += gravity * Time.deltaTime;

            Vector3 velocity = move * _profile.MoveSpeed;
            velocity.y = _verticalSpeed;
            _controller.Move(velocity * Time.deltaTime);
            _animationRig?.Tick(move.magnitude, _controller.isGrounded, Time.deltaTime);

            if (move.sqrMagnitude > 0.02f)
            {
                Quaternion facing = Quaternion.LookRotation(move, Vector3.up);
                transform.rotation = Quaternion.Slerp(
                    transform.rotation,
                    facing,
                    1f - Mathf.Exp(-turnSharpness * Time.deltaTime)
                );
            }

            bool attackKey = Input.GetKeyDown(KeyCode.J) ||
                             Input.GetKeyDown(KeyCode.K) ||
                             Input.GetMouseButtonDown(0);
            if ((_attackRequested || attackKey) && _attackCooldown <= 0f)
                FirePrimaryAttack();

            _attackRequested = false;
        }

        private Vector2 ReadMovement()
        {
            Vector2 keyboard = Vector2.zero;
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) keyboard.x -= 1f;
            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) keyboard.x += 1f;
            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) keyboard.y += 1f;
            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) keyboard.y -= 1f;

            if (_joystick != null && _joystick.Value.sqrMagnitude > 0.01f)
                return _joystick.Value;

            return Vector2.ClampMagnitude(keyboard, 1f);
        }

        private void FirePrimaryAttack()
        {
            _attackCooldown = attackInterval;
            _animationRig?.TriggerAttack();
            Vector3 direction = transform.forward;
            Vector3 origin = transform.position + Vector3.up * 1.0f + direction * 0.65f;

            GameObject projectile = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            projectile.name = "B4 ERP energy bolt";
            projectile.transform.position = origin;
            projectile.transform.localScale = Vector3.one * 0.24f;

            Renderer renderer = projectile.GetComponent<Renderer>();
            if (renderer != null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null) shader = Shader.Find("Standard");
                Material material = new Material(shader);
                material.color = _profile.SecondaryColor;
                if (material.HasProperty("_EmissionColor"))
                {
                    material.EnableKeyword("_EMISSION");
                    material.SetColor("_EmissionColor", _profile.SecondaryColor * 1.5f);
                }
                renderer.sharedMaterial = material;
            }

            SphereCollider collider = projectile.GetComponent<SphereCollider>();
            collider.isTrigger = true;
            Rigidbody body = projectile.AddComponent<Rigidbody>();
            body.useGravity = false;
            body.isKinematic = false;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            body.velocity = direction * projectileSpeed;

            CombatProjectile impact = projectile.AddComponent<CombatProjectile>();
            impact.Initialize(_profile.BasicAttackDamageMultiplier, 2.5f);
        }
    }
}
