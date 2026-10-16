import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseLanguage, useLanguage } from "@/lib/i18n";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const label = language === "es" ? "Idioma" : language === "en" ? "Language" : "Langue";
  return (
    <Select value={language} onValueChange={(value) => setLanguage(parseLanguage(value))}>
      <SelectTrigger aria-label={label} title={label} className="h-8 w-36 shrink-0 gap-2 font-mono text-xs">
        <Languages className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="fr">Français</SelectItem>
      </SelectContent>
    </Select>
  );
}