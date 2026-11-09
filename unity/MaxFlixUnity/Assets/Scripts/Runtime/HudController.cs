using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace MaxFlix.Unity.Runtime
{
    public sealed class HudController : MonoBehaviour
    {
        private Text _statusText;
        private Text _healthText;
        private Text _helpText;

        public VirtualJoystick Joystick { get; private set; }

        public static HudController Create(PlayerController player)
        {
            EnsureEventSystem();

            GameObject canvasObject = new GameObject("Max Flix HUD", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            Canvas canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            CanvasScaler scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            HudController hud = canvasObject.AddComponent<HudController>();
            hud.Build(canvasObject.GetComponent<RectTransform>(), player);
            return hud;
        }

        public void SetHealth(float current, float maximum)
        {
            if (_healthText != null) _healthText.text = string.Format("HP  {0:0}/{1:0}", current, maximum);
        }

        public void SetStatus(string status)
        {
            if (_statusText != null) _statusText.text = status;
        }

        private void Build(RectTransform root, PlayerController player)
        {
            _statusText = CreateText(root, "UNITY PORT • B4 TRAINING SLICE", new Vector2(24f, -24f), new Vector2(620f, 62f), 27, TextAnchor.MiddleLeft);
            _healthText = CreateText(root, "HP  5/5", new Vector2(-24f, -24f), new Vector2(280f, 62f), 30, TextAnchor.MiddleRight);
            _healthText.rectTransform.anchorMin = new Vector2(1f, 1f);
            _healthText.rectTransform.anchorMax = new Vector2(1f, 1f);
            _helpText = CreateText(root, "PC: WASD / SPACE / J   •   EKRAN: joystick + SKOK + ATAK", new Vector2(0f, -98f), new Vector2(900f, 42f), 18, TextAnchor.MiddleCenter);
            _helpText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            _helpText.rectTransform.anchorMax = new Vector2(0.5f, 1f);

            GameObject stick = CreateImage(root, "Virtual joystick", new Vector2(165f, 165f), new Vector2(210f, 210f), new Color(0.07f, 0.12f, 0.18f, 0.54f));
            stick.GetComponent<RectTransform>().anchorMin = Vector2.zero;
            stick.GetComponent<RectTransform>().anchorMax = Vector2.zero;
            Joystick = stick.AddComponent<VirtualJoystick>();

            GameObject knob = CreateImage(stick.GetComponent<RectTransform>(), "Joystick handle", Vector2.zero, new Vector2(82f, 82f), new Color(0.52f, 0.72f, 0.86f, 0.82f));
            Joystick.ConfigureHandle(knob.GetComponent<RectTransform>());

            CreateActionButton(root, "SKOK", new Vector2(-150f, 245f), new Vector2(170f, 112f), new Color(0.18f, 0.42f, 0.58f, 0.88f), player.RequestJump);
            CreateActionButton(root, "ATAK", new Vector2(-150f, 105f), new Vector2(190f, 126f), new Color(0.76f, 0.36f, 0.12f, 0.92f), player.RequestAttack);
        }

        private static Text CreateText(RectTransform parent, string value, Vector2 anchoredPosition, Vector2 size, int fontSize, TextAnchor alignment)
        {
            GameObject textObject = new GameObject(value, typeof(RectTransform), typeof(Text), typeof(Outline));
            RectTransform rect = textObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            Text text = textObject.GetComponent<Text>();
            text.text = value;
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.fontSize = fontSize;
            text.fontStyle = FontStyle.Bold;
            text.color = Color.white;
            text.alignment = alignment;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            textObject.GetComponent<Outline>().effectColor = new Color(0f, 0f, 0f, 0.72f);
            textObject.GetComponent<Outline>().effectDistance = new Vector2(1.5f, -1.5f);
            return text;
        }

        private static GameObject CreateImage(RectTransform parent, string objectName, Vector2 anchoredPosition, Vector2 size, Color color)
        {
            GameObject imageObject = new GameObject(objectName, typeof(RectTransform), typeof(Image));
            RectTransform rect = imageObject.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = new Vector2(0f, 0f);
            rect.anchorMax = new Vector2(0f, 0f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;
            imageObject.GetComponent<Image>().color = color;
            return imageObject;
        }

        private void CreateActionButton(RectTransform root, string label, Vector2 anchoredPosition, Vector2 size, Color color, UnityEngine.Events.UnityAction onClick)
        {
            GameObject buttonObject = CreateImage(root, label + " button", anchoredPosition, size, color);
            RectTransform rect = buttonObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(1f, 0f);
            rect.anchorMax = new Vector2(1f, 0f);
            Button button = buttonObject.AddComponent<Button>();
            button.onClick.AddListener(onClick);
            Text labelText = CreateText(rect, label, Vector2.zero, size, 25, TextAnchor.MiddleCenter);
            labelText.rectTransform.anchorMin = Vector2.zero;
            labelText.rectTransform.anchorMax = Vector2.one;
            labelText.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            labelText.rectTransform.anchoredPosition = Vector2.zero;
            labelText.rectTransform.sizeDelta = Vector2.zero;
        }

        private static void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
        }
    }
}
