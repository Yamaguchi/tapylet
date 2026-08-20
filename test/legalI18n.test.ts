import i18next from "i18next"

import en from "~/extension/i18n/locales/en.json"
import ja from "~/extension/i18n/locales/ja.json"
import {
  consentLabelKeys,
  legalLabelKey,
  LEGAL_DOC_IDS,
} from "~/extension/legal"

// The screens address the legal wording by keys built in ~/extension/legal, so
// a missing translation is not a compile error — i18next hands back the key and
// it lands on screen as it is.
const LANGUAGES = { en, ja }

const t = (language: keyof typeof LANGUAGES, key: string, options = {}) =>
  i18next.getFixedT(language)(key, options)

beforeAll(async () => {
  await i18next.init({
    lng: "en",
    resources: {
      en: { translation: en },
      ja: { translation: ja },
    },
  })
})

describe.each(Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[])(
  "legal wording in %s",
  (language) => {
    it("names every document", () => {
      for (const id of LEGAL_DOC_IDS) {
        const label = t(language, legalLabelKey(id))
        expect(label).not.toBe(legalLabelKey(id))
        expect(label).not.toBe("")
      }
    })


    it("has the words that go around a document name in a checkbox", () => {
      for (const id of LEGAL_DOC_IDS) {
        const { prefix, suffix } = consentLabelKeys(id)
        // A prefix is empty in Japanese, where the words all follow the name.
        expect(t(language, prefix)).not.toBe(prefix)
        expect(t(language, suffix)).not.toBe(suffix)
      }
    })

    it("has the wording of the re-consent screen and the banner", () => {
      const label = t(language, legalLabelKey("terms"))
      const filled = [
        t(language, "legal.update.title", { docs: label }),
        t(language, "legal.update.description", { docs: label }),
        t(language, "legal.update.changesTitle", { doc: label }),
        t(language, "legal.notice.title", { doc: label, date: "2026-09-01" }),
        t(language, "legal.notice.read", { doc: label }),
      ]
      for (const text of filled) {
        expect(text).toContain(label)
        expect(text).not.toContain("{{")
      }
      for (const key of [
        "legal.separator",
        "legal.update.agreeAction",
        "legal.update.acknowledgeAction",
        "legal.notice.close",
      ]) {
        expect(t(language, key)).not.toBe(key)
      }
    })
  },
)
