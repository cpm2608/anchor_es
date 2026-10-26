"use client";

import { useMutation } from "@tanstack/react-query";
import { HTTPError } from "ky";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { changePassword } from "@/features/auth/api";
import { useOidcConfig } from "@/features/auth/hooks/use-oidc";
import { useAuthStore } from "@/features/auth/store";
import { Row, RowText, Section } from "./settings-blocks";

export function PasswordSection() {
  const user = useAuthStore((s) => s.user);
  const oidc = useOidcConfig();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [currentPasswordError, setCurrentPasswordError] = React.useState<
    string | null
  >(null);
  const [newPasswordError, setNewPasswordError] = React.useState<string | null>(
    null,
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  const passwordChange = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Contraseña cambiada");
    },
    onError: (e: Error) => {
      const status = e instanceof HTTPError ? e.response.status : 0;
      if (status === 403)
        setCurrentPasswordError("Esa no es tu contraseña actual.");
      else if (status === 400 && /different/i.test(e.message))
        setNewPasswordError(
          "Usa una contraseña diferente a la actual.",
        );
      else
        setFormError(
          status
            ? "No se pudo cambiar la contraseña. Inténtalo de nuevo."
            : "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
        );
    },
  });

  const isProviderOnly =
    !!oidc.data?.enabled && !!oidc.data?.disableInternalAuth;
  if (user?.hasPassword === false || isProviderOnly) {
    const providerName = oidc.data?.providerName || "tu proveedor de inicio de sesión";
    return (
      <Section id="password" title="Contraseña">
        <Row>
          <RowText
            title={`Tu contraseña es gestionada por ${providerName}`}
            text={`Cámbiala en ${providerName}.`}
          />
        </Row>
      </Section>
    );
  }

  return (
    <Section id="password" title="Contraseña">
      <Row className="block">
        <form
          className="grid gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 8)
              return setNewPasswordError("Usa al menos 8 caracteres.");
            setFormError(null);
            passwordChange.mutate({ currentPassword, newPassword });
          }}
        >
          <div className="grid grid-cols-2 items-start gap-3.5 max-md:grid-cols-1">
            <Field label="Contraseña actual" error={currentPasswordError}>
              <PasswordInput
                value={currentPassword}
                autoComplete="current-password"
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setCurrentPasswordError(null);
                }}
              />
            </Field>
            <Field
              label="Nueva contraseña"
              help="Al menos 8 caracteres."
              error={newPasswordError}
            >
              <PasswordInput
                value={newPassword}
                autoComplete="new-password"
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setNewPasswordError(null);
                }}
              />
            </Field>
          </div>
          {formError && <FormAlert>{formError}</FormAlert>}
          <div>
            <Button
              type="submit"
              disabled={!currentPassword || newPassword.length < 8}
              busy={passwordChange.isPending && "Cambiando contraseña…"}
            >
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Row>
    </Section>
  );
}
