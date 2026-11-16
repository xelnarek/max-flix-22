using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

namespace MaxFlix.Unity.Runtime
{
    /// <summary>
    /// Ensures touch, mouse and gamepad UI work even when the bootstrap scene
    /// already contains an EventSystem with the legacy StandaloneInputModule.
    /// </summary>
    public static class UiEventSystemInstaller
    {
        public static void Ensure()
        {
            EventSystem eventSystem = Object.FindFirstObjectByType<EventSystem>();
            if (eventSystem == null)
            {
                GameObject host = new GameObject("EventSystem");
                eventSystem = host.AddComponent<EventSystem>();
            }

            InputSystemUIInputModule inputModule = eventSystem.GetComponent<InputSystemUIInputModule>();
            if (inputModule == null)
                inputModule = eventSystem.gameObject.AddComponent<InputSystemUIInputModule>();

            BaseInputModule[] modules = eventSystem.GetComponents<BaseInputModule>();
            foreach (BaseInputModule module in modules)
            {
                if (module != null && module != inputModule)
                    module.enabled = false;
            }

            inputModule.enabled = true;
            inputModule.pointerBehavior = UIPointerBehavior.SingleMouseOrPenButMultiTouchAndTrack;
            eventSystem.sendNavigationEvents = true;
        }
    }
}
