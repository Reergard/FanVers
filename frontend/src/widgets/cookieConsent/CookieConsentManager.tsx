import { useEffect, useState } from "react";
import { useCookieConsent } from "../../settings/useCookieConsent";
import { useAuth } from "../../auth/useAuth";
import { CookieBanner } from "./CookieBanner";
import { CookieSettingsModal } from "./CookieSettingsModal";

const OPEN_SETTINGS_EVENT = "fv:open-cookie-settings";

export function openCookieSettingsModal() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

export function CookieConsentManager() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { consent, acceptAll, rejectAll, updateConsent } = useCookieConsent();
  const { authReady } = useAuth();

  useEffect(() => {
    const onOpen = () => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  const showBanner = authReady && consent == null;

  const handleAcceptAll = async () => {
    setSaving(true);
    try {
      await acceptAll();
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await rejectAll();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (next: { preferences: boolean; analytics: boolean }) => {
    setSaving(true);
    try {
      await updateConsent({
        necessary: true,
        preferences: Boolean(next.preferences),
        analytics: Boolean(next.analytics),
      });
      setSettingsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showBanner && (
        <CookieBanner
          saving={saving}
          onAcceptAll={() => void handleAcceptAll()}
          onReject={() => void handleReject()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <CookieSettingsModal
        open={settingsOpen}
        saving={saving}
        consent={consent}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => void handleSaveSettings(next)}
      />
    </>
  );
}

