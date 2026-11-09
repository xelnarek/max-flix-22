using UnityEngine;
using UnityEngine.InputSystem;

namespace MaxFlix.Unity.Runtime
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class PlayerController : MonoBehaviour
    {
        [SerializeField] private float gravity = -24f;
        [SerializeField] private float turnSharpness = 14f;

        private CharacterController _controller;
        private OperatorProfile _profile;
        private VirtualJoystick _joystick;
        private HudController _hud;
        private OperatorAnimationRig _animationRig;
        private OperatorCombatKit _combatKit;
        private float _verticalSpeed;
        private float _attackCooldown;
        private float _currentHealth;
        private float _hitInvulnerabilityRemaining;
        private bool _jumpRequested;
        private bool _airJumpUsed;
        private bool _attackRequested;
        private bool _abilityRequested;
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
            _combatKit = GetComponent<OperatorCombatKit>();
            if (_combatKit == null) _combatKit = gameObject.AddComponent<OperatorCombatKit>();
            _combatKit.Initialize(this, hud, _profile);
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

        public void RequestAbility()
        {
            if (!_defeated) _abilityRequested = true;
        }

        public void ApplyDamage(float amount)
        {
            if (_defeated || (_combatKit != null && _combatKit.IsInvulnerable)
                || _hitInvulnerabilityRemaining > 0f
                || float.IsNaN(amount) || float.IsInfinity(amount) || amount <= 0f) return;

            GameMode currentMode = GameSession.Current != null ? GameSession.Current.Mode : GameMode.Campaign;
            float scaledIncomingDamage = CombatBalanceCatalog.ScaleIncomingDamage(amount, currentMode);
            float damageMultiplier = _combatKit != null
                ? _combatKit.DamageTakenMultiplier
                : _profile.DamageTakenMultiplier;
            _currentHealth = Mathf.Max(0f, _currentHealth - scaledIncomingDamage * damageMultiplier);
            if (currentMode == GameMode.Survival)
                _hitInvulnerabilityRemaining = CombatBalanceCatalog.SurvivalHitInvulnerabilitySeconds;
            _hud?.SetHealth(_currentHealth, _profile.MaxHealth);
            if (_currentHealth <= 0f)
            {
                _defeated = true;
                GameSession.SetState(GameFlowState.GameOver);
                _hud?.SetStatus("KONIEC ZMIANY — operator wyeliminowany");
            }
        }

        public void RecordPrimaryHit()
        {
            _combatKit?.OnPrimaryHit();
        }

        public void RestoreHealth(float amount)
        {
            if (_defeated || float.IsNaN(amount) || float.IsInfinity(amount) || amount <= 0f) return;
            _currentHealth = Mathf.Min(_profile.MaxHealth, _currentHealth + amount);
            _hud?.SetHealth(_currentHealth, _profile.MaxHealth);
        }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            if (_controller == null || _defeated || _profile == null) return;

            float deltaTime = Time.deltaTime;
            _hitInvulnerabilityRemaining = Mathf.Max(0f, _hitInvulnerabilityRemaining - deltaTime);
            GameSession.AddElapsedTime(deltaTime);
            _combatKit?.Tick(deltaTime);
            _attackCooldown = Mathf.Max(0f, _attackCooldown - deltaTime);

            Vector2 moveInput = ReadMovement();
            Vector3 move = new Vector3(moveInput.x, 0f, moveInput.y);
            if (move.sqrMagnitude > 1f) move.Normalize();

            if (_controller.isGrounded)
            {
                if (_verticalSpeed < 0f) _verticalSpeed = -2f;
                _airJumpUsed = false;
            }

            if (_jumpRequested)
            {
                if (_controller.isGrounded)
                {
                    _verticalSpeed = _profile.JumpForce;
                }
                else if (_profile.Id == OperatorId.Piotr && !_airJumpUsed)
                {
                    _verticalSpeed = _profile.JumpForce * 0.86f;
                    _airJumpUsed = true;
                }
            }
            _jumpRequested = false;
            _verticalSpeed += gravity * deltaTime;

            float movementMultiplier = _combatKit != null ? _combatKit.MovementMultiplier : 1f;
            Vector3 velocity = move * (_profile.MoveSpeed * movementMultiplier);
            velocity.y = _verticalSpeed;
            _controller.Move(velocity * deltaTime);
            _animationRig?.Tick(move.magnitude, _controller.isGrounded, deltaTime);

            if (move.sqrMagnitude > 0.02f)
            {
                Quaternion facing = Quaternion.LookRotation(move, Vector3.up);
                transform.rotation = Quaternion.Slerp(
                    transform.rotation,
                    facing,
                    1f - Mathf.Exp(-turnSharpness * deltaTime)
                );
            }

            Keyboard keyboard = Keyboard.current;
            Mouse mouse = Mouse.current;
            Gamepad gamepad = Gamepad.current;
            bool attackKey =
                (keyboard != null && (keyboard.jKey.wasPressedThisFrame || keyboard.kKey.wasPressedThisFrame)) ||
                (mouse != null && mouse.leftButton.wasPressedThisFrame) ||
                (gamepad != null && gamepad.rightTrigger.wasPressedThisFrame);
            bool abilityKey = keyboard != null && keyboard.eKey.wasPressedThisFrame;

            if ((_attackRequested || attackKey) && _attackCooldown <= 0f)
            {
                GameMode currentMode = GameSession.Current != null ? GameSession.Current.Mode : GameMode.Campaign;
                _attackCooldown = CombatBalanceCatalog.GetPrimaryAttackCooldown(_profile.Id, currentMode);
                _animationRig?.TriggerAttack();
                _combatKit?.FirePrimaryAttack();
            }

            if (_abilityRequested || abilityKey)
                _combatKit?.TryActivateAbility(GameSession.Current != null ? GameSession.Current.Mode : GameMode.Campaign);

            _attackRequested = false;
            _abilityRequested = false;
        }

        private Vector2 ReadMovement()
        {
            Vector2 keyboardInput = Vector2.zero;
            Keyboard keyboard = Keyboard.current;
            if (keyboard != null)
            {
                if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) keyboardInput.x -= 1f;
                if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) keyboardInput.x += 1f;
                if (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed) keyboardInput.y += 1f;
                if (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed) keyboardInput.y -= 1f;
            }

            Gamepad gamepad = Gamepad.current;
            if (gamepad != null && gamepad.leftStick.ReadValue().sqrMagnitude > 0.01f)
                keyboardInput = gamepad.leftStick.ReadValue();

            if (_joystick != null && _joystick.Value.sqrMagnitude > 0.01f)
                return _joystick.Value;

            return Vector2.ClampMagnitude(keyboardInput, 1f);
        }
    }
}
