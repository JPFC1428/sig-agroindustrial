import { useEffect, useState } from "react";
import { Moon, Palette, Settings, Sun } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ACCENT_COLOR_OPTIONS,
  ACCENT_COLOR_SWATCHES,
  THEME_OPTIONS,
} from "@/lib/theme-config";
import type { AccentColor, ThemePreference } from "@/lib/types";

export default function Configuracion() {
  const { updatePreferences, user } = useAuth();
  const { accentColor, theme } = useTheme();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("light");
  const [selectedAccentColor, setSelectedAccentColor] =
    useState<AccentColor>("blue");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setThemePreference(user?.preferencias.themePreference ?? theme);
    setSelectedAccentColor(user?.preferencias.accentColor ?? accentColor);
  }, [accentColor, theme, user]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updatePreferences(themePreference, selectedAccentColor);
      setSuccess("Configuracion visual actualizada.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar la configuracion visual"
      );
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    themePreference !== (user?.preferencias.themePreference ?? theme) ||
    selectedAccentColor !== (user?.preferencias.accentColor ?? accentColor);

  return (
    <DashboardLayout
      titulo="Configuracion"
      descripcion="Personalizacion visual del sistema"
    >
      <div className="max-w-4xl space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {success}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Apariencia
              </h2>
              <p className="text-sm text-muted-foreground">
                Define tema y color principal sin alterar la estructura visual
                actual.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <Label htmlFor="config-theme">Tema</Label>
              <Select
                onValueChange={value =>
                  setThemePreference(value as ThemePreference)
                }
                value={themePreference}
              >
                <SelectTrigger id="config-theme">
                  <SelectValue placeholder="Selecciona un tema" />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="rounded-lg border border-border bg-accent/40 px-4 py-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-foreground">
                  {themePreference === "dark" ? (
                    <Moon size={16} />
                  ) : (
                    <Sun size={16} />
                  )}
                  <span className="font-medium">
                    {
                      THEME_OPTIONS.find(option => option.value === themePreference)
                        ?.label
                    }
                  </span>
                </div>
                {
                  THEME_OPTIONS.find(option => option.value === themePreference)
                    ?.description
                }
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="config-accent">Color principal</Label>
              <Select
                onValueChange={value =>
                  setSelectedAccentColor(value as AccentColor)
                }
                value={selectedAccentColor}
              >
                <SelectTrigger id="config-accent">
                  <SelectValue placeholder="Selecciona un color" />
                </SelectTrigger>
                <SelectContent>
                  {ACCENT_COLOR_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                {ACCENT_COLOR_OPTIONS.map(option => {
                  const isSelected = option.value === selectedAccentColor;

                  return (
                    <button
                      key={option.value}
                      className={`rounded-lg border px-4 py-3 text-left transition-smooth ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                      onClick={() => setSelectedAccentColor(option.value)}
                      type="button"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10"
                          style={{
                            backgroundColor: ACCENT_COLOR_SWATCHES[option.value],
                          }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {option.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-accent/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Palette size={16} />
              Vista previa de acento activo
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{
                  backgroundColor: ACCENT_COLOR_SWATCHES[selectedAccentColor],
                }}
              >
                Boton principal
              </span>
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{
                  backgroundColor: ACCENT_COLOR_SWATCHES[selectedAccentColor],
                }}
              >
                Badge
              </span>
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white"
                style={{
                  backgroundColor: ACCENT_COLOR_SWATCHES[selectedAccentColor],
                }}
              >
                <Palette size={16} />
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button disabled={saving || !hasChanges} onClick={() => void handleSave()}>
              {saving ? "Guardando..." : "Guardar configuracion"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
