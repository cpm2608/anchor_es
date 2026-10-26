"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Lock, UserCheck } from "lucide-react";
import { LoadFailedRow } from "@/components/ui/empty-state";
import { RadioCards } from "@/components/ui/radio-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  SaveStatus,
  SectionHeader,
  useSaveStatus,
} from "@/features/settings/components/settings-blocks";
import { useRetry } from "@/lib/hooks/use-retry";
import { getRegistrationSettings, updateRegistrationMode } from "../api";
import { adminKeys } from "../queries";
import type { RegistrationMode } from "../types";
import { LockNote } from "./admin-parts";
import { SingleSignOn } from "./single-sign-on";

export function SignInTab({ hidden }: { hidden?: boolean }) {
  const queryClient = useQueryClient();
  const registration = useQuery({
    queryKey: adminKeys.registration,
    queryFn: getRegistrationSettings,
  });
  const registrationRetry = useRetry(registration.refetch);
  const [registrationSaveState, setRegistrationSaveState] = useSaveStatus();

  const saveMode = useMutation({
    mutationFn: (mode: RegistrationMode) => updateRegistrationMode({ mode }),
    onMutate: (mode) => {
      const before = queryClient.getQueryData(adminKeys.registration);
      queryClient.setQueryData(
        adminKeys.registration,
        (prev: object | undefined) => (prev ? { ...prev, mode } : prev),
      );
      return { before };
    },
    onSuccess: () => {
      setRegistrationSaveState("saved");
      queryClient.invalidateQueries({
        queryKey: adminKeys.pendingUsers,
      });
    },
    onError: (_, mode, context) => {
      queryClient.setQueryData(adminKeys.registration, context?.before);
      toast.error("No se pudo cambiar quién puede registrarse", {
        retry: () => saveMode.mutate(mode),
      });
    },
  });
  const locked = !!registration.data?.isLocked;

  return (
    <div hidden={hidden} className="grid max-w-180 gap-6.5">
      <section className="grid gap-2.5">
        <SectionHeader
          title="Quién puede registrarse"
          description="Elige quién puede crear una cuenta."
          saved={<SaveStatus state={registrationSaveState} />}
        />
        {locked && (
          <LockNote>
            Definido por <code>USER_SIGNUP</code> en el servidor. Quítalo allí para cambiarlo aquí.
          </LockNote>
        )}
        {(registration.isError && !registration.data) ||
        registrationRetry.isRetrying ? (
          <LoadFailedRow
            message="No se pudo cargar la configuración de registro."
            onRetry={registrationRetry.retry}
            isRetrying={registrationRetry.isRetrying}
          />
        ) : registration.isLoading ? (
          <Skeleton className="h-22 w-full rounded-xl" />
        ) : (
          <RadioCards
            aria-label="Quién puede registrarse"
            value={registration.data?.mode ?? "enabled"}
            onValueChange={(mode) => saveMode.mutate(mode)}
            className="grid-cols-3 max-md:grid-cols-1"
            options={[
              {
                value: "enabled",
                label: "Abierto",
                icon: <DoorOpen />,
                description: "Cualquiera puede crear una cuenta.",
                disabled: locked,
              },
              {
                value: "review",
                label: "Requiere aprobación",
                icon: <UserCheck />,
                description: "Las cuentas nuevas requieren la aprobación de un administrador.",
                disabled: locked,
              },
              {
                value: "disabled",
                label: "Cerrado",
                icon: <Lock />,
                description: "Solo los administradores pueden añadir personas.",
                disabled: locked,
              },
            ]}
          />
        )}
      </section>
      <SingleSignOn isHidden={hidden} />
    </div>
  );
}
