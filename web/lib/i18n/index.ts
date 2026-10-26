import { en } from "./locales/en";
import { es } from "./locales/es";
import { usePreferencesStore } from "@/features/preferences/store";

export type Language = "es" | "en";

export const translations = {
  en,
  es,
};

export function getTranslation(
  lang: Language,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = translations[lang] || translations.es;
  const parts = key.split(".");
  let cur: any = dict;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in cur) {
      cur = cur[part];
    } else {
      // Fallback to English
      let fallbackCur: any = translations.en;
      for (const p of parts) {
        if (fallbackCur && typeof fallbackCur === "object" && p in fallbackCur) {
          fallbackCur = fallbackCur[p];
        } else {
          return key;
        }
      }
      cur = fallbackCur;
      break;
    }
  }

  if (typeof cur !== "string") return key;

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(new RegExp(`{${k}}`, "g"), String(v)),
      cur
    );
  }

  return cur;
}

export function useTranslation() {
  const language = usePreferencesStore((s) => (s.ui as any).language || "es") as Language;
  const setUIPreference = usePreferencesStore((s) => s.setUIPreference);

  const t = (key: string, params?: Record<string, string | number>) => {
    return getTranslation(language, key, params);
  };

  const setLanguage = (lang: Language) => {
    setUIPreference("language" as any, lang);
  };

  return { t, language, setLanguage };
}
