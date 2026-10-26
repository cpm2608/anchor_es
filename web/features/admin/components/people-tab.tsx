"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { format, formatDistanceToNowStrict, isYesterday } from "date-fns";
import { HTTPError } from "ky";
import {
  Check,
  Ellipsis,
  Hash,
  KeyRound,
  NotebookPen,
  Pencil,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadFailedRow } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth";
import { useLastShown } from "@/lib/hooks/use-last-shown";
import { useRetry } from "@/lib/hooks/use-retry";
import { cn, firstName, plural } from "@/lib/utils";
import {
  approveUser,
  deleteUser,
  getOidcSettings,
  getPendingUsers,
  getUsers,
  rejectUser,
  resetPassword,
} from "../api";
import { adminKeys } from "../queries";
import type { AdminUser } from "../types";
import { cardClass } from "./admin-parts";
import {
  AddPersonDialog,
  EditPersonDialog,
  NewPasswordDialog,
} from "./person-dialogs";

const PAGE_SIZE = 50;

/** “Requested 2 hours ago”, “Requested yesterday”, “Requested Sep 3”. */
function requested(iso: string) {
  const date = new Date(iso);
  if (isYesterday(date)) return "Solicitado ayer";
  if (Date.now() - date.getTime() < 24 * 3600 * 1000)
    return `Solicitado hace ${formatDistanceToNowStrict(date)}`;
  return `Solicitado el ${format(date, "d MMM")}`;
}

function Person({
  user,
  you,
}: {
  user: Pick<AdminUser, "id" | "name" | "email" | "profileImage">;
  you?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar id={user.id} name={user.name} src={user.profileImage} />
      <span className="grid min-w-0 leading-[1.3]">
        <b className="truncate font-semibold text-ui">
          {user.name}
          {you && " (tú)"}
        </b>
        <small className="truncate text-muted-foreground text-small">
          {user.email}
        </small>
      </span>
    </span>
  );
}

export function PeopleTab({ hidden }: { hidden?: boolean }) {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminUser | null>(null);
  const [resetting, setResetting] = React.useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = React.useState<{
    user: AdminUser;
    password: string;
  } | null>(null);
  const [deleting, setDeleting] = React.useState<AdminUser | null>(null);
  const [declining, setDeclining] = React.useState<AdminUser | null>(null);
  const shownResetting = useLastShown(resetting, !!resetting);
  const shownDeleting = useLastShown(deleting, !!deleting);
  const shownDeclining = useLastShown(declining, !!declining);

  const pending = useQuery({
    queryKey: adminKeys.pendingUsers,
    queryFn: getPendingUsers,
  });
  const pendingRetry = useRetry(pending.refetch);
  const [searched, setSearched] = React.useState("");
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearched(query.trim());
      setLimit(PAGE_SIZE);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const users = useQuery({
    queryKey: adminKeys.activeUsers(searched, limit),
    queryFn: () => getUsers(0, limit, { q: searched, status: "active" }),
    placeholderData: keepPreviousData,
  });
  const usersRetry = useRetry(users.refetch);
  const oidc = useQuery({
    queryKey: adminKeys.oidc,
    queryFn: getOidcSettings,
  });
  const providerName = oidc.data?.providerName || "Single sign-on";

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.users }),
      queryClient.invalidateQueries({ queryKey: adminKeys.stats }),
    ]);

  const approve = useMutation({
    mutationFn: (user: AdminUser) => approveUser(user.id),
    onSuccess: async (_, user) => {
      await refresh();
      toast.success(`${firstName(user.name)} ya puede iniciar sesión`);
    },
    onError: (_, user) =>
      toast.error(`No se pudo aprobar a ${firstName(user.name)}`, {
        retry: () => approve.mutate(user),
      }),
  });
  const decline = useMutation({
    mutationFn: (user: AdminUser) => rejectUser(user.id),
    onSuccess: async (_, user) => {
      await refresh();
      setDeclining(null);
      toast.success(`Se rechazó la solicitud de ${firstName(user.name)}`);
    },
    onError: (_, user) =>
      toast.error(`No se pudo rechazar a ${firstName(user.name)}`),
  });
  const remove = useMutation({
    mutationFn: (user: AdminUser) => deleteUser(user.id),
    onSuccess: async (_, user) => {
      await refresh();
      setDeleting(null);
      toast.success(`Cuenta de ${firstName(user.name)} eliminada`);
    },
    onError: (e: Error, user) =>
      toast.error(
        e instanceof HTTPError && /last admin/i.test(e.message)
          ? `No se pudo eliminar a ${firstName(user.name)}. Es el único administrador.`
          : `No se pudo eliminar a ${firstName(user.name)}`,
      ),
  });
  const reset = useMutation({
    mutationFn: (user: AdminUser) => resetPassword(user.id),
    onSuccess: (res, user) => {
      setResetting(null);
      if (res.newPassword) setNewPassword({ user, password: res.newPassword });
      else toast.success(`Se restableció la contraseña de ${firstName(user.name)}`);
    },
    onError: (_, user) =>
      toast.error(`No se pudo restablecer la contraseña de ${firstName(user.name)}`),
  });

  const rows = users.data?.users ?? [];
  const total = users.data?.total ?? 0;
  const waiting = pending.data ?? [];

  return (
    <div hidden={hidden} className="grid gap-3.5">
      {((pending.isError && !pending.data) || pendingRetry.isRetrying) && (
        <LoadFailedRow
          message="No se pudo cargar la lista de espera."
          onRetry={pendingRetry.retry}
          isRetrying={pendingRetry.isRetrying}
        />
      )}
      {waiting.length > 0 && (
        <div className="grid gap-0.5 rounded-2xl bg-[color-mix(in_srgb,var(--warn)_70%,var(--card))] p-1.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--warn-foreground)_18%,transparent)]">
          <header className="flex items-center gap-2 px-2.5 pt-2 pb-1.5 font-semibold text-ui text-warn-foreground [&_svg]:size-4">
            <UserRoundPlus aria-hidden />
            {waiting.length === 1
              ? "1 persona esperando aprobación"
              : `${waiting.length} personas esperando aprobación`}
          </header>
          {waiting.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center gap-3 rounded-md bg-card px-2 py-1.5"
            >
              <span className="min-w-0 flex-1">
                <Person user={user} />
              </span>
              <span className="mr-1.5 whitespace-nowrap text-muted-foreground text-small max-md:hidden">
                {requested(user.createdAt)}
              </span>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setDeclining(user)}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                onClick={() => approve.mutate(user)}
                busy={
                  approve.isPending &&
                  approve.variables?.id === user.id &&
                  "Aprobando…"
                }
              >
                <Check aria-hidden />
                Aprobar
              </Button>
            </div>
          ))}
        </div>
      )}

      <div data-slot="card" className={cn(cardClass, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-2.5 py-3 pr-3 pl-3.5">
          <Input
            type="search"
            icon={<Search aria-hidden />}
            placeholder="Buscar personas"
            aria-label="Buscar personas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            boxClassName="h-9 w-65 bg-background shadow-none focus-within:w-70 max-md:w-auto max-md:flex-1 transition-[width,box-shadow]"
          />
          <span className="flex-1 max-md:hidden" />
          <Button onClick={() => setAdding(true)}>
            <UserPlus aria-hidden />
            Añadir persona
          </Button>
        </div>
        {users.isError || usersRetry.isRetrying ? (
          <LoadFailedRow
            className="mx-3.5 mb-3.5"
            message="No se pudieron cargar las personas."
            onRetry={usersRetry.retry}
            isRetrying={usersRetry.isRetrying}
          />
        ) : users.isLoading ? (
          <SkeletonRows count={5} className="px-3.5 py-3" />
        ) : (
          <Table className="max-md:min-w-0 max-md:[&_:is(th,td):nth-child(n+3):not(:last-child)]:hidden">
            <TableHeader>
              <tr>
                <TableHead>Persona</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Inicia sesión con</TableHead>
                <TableHead className="text-right">Notas</TableHead>
                <TableHead className="text-right">Etiquetas</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>
                  <span className="sr-only">Opciones</span>
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const you = user.id === me?.id;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Person user={user} you={you} />
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge tone="ink">
                          <ShieldCheck aria-hidden />
                          Administrador
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Miembro</span>
                      )}
                    </TableCell>
                    <TableCell dim>
                      {user.authMethod === "oidc" ? providerName : "Contraseña"}
                    </TableCell>
                    <TableCell numeric>{user._count?.notes ?? 0}</TableCell>
                    <TableCell numeric>{user._count?.tags ?? 0}</TableCell>
                    <TableCell dim>
                      {format(new Date(user.createdAt), "d MMM, yyyy")}
                    </TableCell>
                    <TableCell className="w-11 pr-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Opciones para ${user.name}`}
                            className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-foreground/6 hover:text-foreground aria-expanded:bg-foreground/6 [&_svg]:size-4"
                          >
                            <Ellipsis aria-hidden />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-52.5">
                          <DropdownMenuItem onSelect={() => setEditing(user)}>
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          {user.authMethod !== "oidc" && (
                            <DropdownMenuItem
                              onSelect={() => setResetting(user)}
                            >
                              <KeyRound />
                              Restablecer contraseña
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            tone="danger"
                            disabled={you}
                            onSelect={() => setDeleting(user)}
                          >
                            <Trash2 />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3.5 py-6 text-center text-muted-foreground"
                  >
                    {searched
                      ? `Nadie coincide con «${searched}».`
                      : "Aún no hay nadie aquí."}
                  </td>
                </tr>
              )}
            </TableBody>
          </Table>
        )}
        {users.data && !users.isError && !usersRetry.isRetrying && (
          <div className="flex items-center justify-between gap-2.5 border-border/55 border-t px-3.5 py-2.5 text-meta text-muted-foreground">
            <span>
              {rows.length} de {total} {total === 1 ? "persona" : "personas"}
            </span>
            {rows.length < total && (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                busy={users.isPlaceholderData && "Cargando…"}
              >
                Mostrar más
              </Button>
            )}
          </div>
        )}
      </div>

      <AddPersonDialog
        open={adding}
        onOpenChange={setAdding}
        onDone={refresh}
      />
      <EditPersonDialog
        user={editing}
        isSelf={editing?.id === me?.id}
        onClose={() => setEditing(null)}
        onDone={refresh}
      />
      <ConfirmationDialog
        open={!!resetting}
        onOpenChange={(open) => !open && setResetting(null)}
        title={`¿Restablecer la contraseña de ${firstName(shownResetting?.name ?? "")}?`}
        description="Su contraseña actual dejará de funcionar de inmediato. Podrás ver la nueva contraseña a continuación."
        confirmLabel="Restablecer contraseña"
        busyLabel="Restableciendo…"
        variant="primary"
        isPending={reset.isPending}
        onConfirm={() => resetting && reset.mutate(resetting)}
      />
      <NewPasswordDialog
        value={newPassword}
        onClose={() => setNewPassword(null)}
      />
      <ConfirmationDialog
        open={!!declining}
        onOpenChange={(open) => !open && setDeclining(null)}
        title={`¿Rechazar la solicitud de ${firstName(shownDeclining?.name ?? "")}?`}
        description="Su cuenta será eliminada. Podrá volver a solicitar acceso registrándose de nuevo."
        confirmLabel="Rechazar"
        busyLabel="Rechazando…"
        isPending={decline.isPending}
        onConfirm={() => declining && decline.mutate(declining)}
      />
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`¿Eliminar a ${shownDeleting?.name ?? ""}?`}
        description={
          <>
            Esta acción no se puede deshacer. Se eliminará permanentemente lo siguiente:
            <ul className="m-0 mt-2 grid list-none gap-1.5 p-0 text-foreground [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_svg]:size-3.75 [&_svg]:text-muted-foreground">
              <li>
                <UserRound aria-hidden />
                Su cuenta
              </li>
              <li>
                <NotebookPen aria-hidden />
                {shownDeleting?._count?.notes === 1 ? "1 nota" : `${shownDeleting?._count?.notes ?? 0} notas`}
              </li>
              <li>
                <Hash aria-hidden />
                {shownDeleting?._count?.tags === 1 ? "1 etiqueta" : `${shownDeleting?._count?.tags ?? 0} etiquetas`}
              </li>
            </ul>
            {shownDeleting?.isAdmin && (
              <span className="mt-3 flex items-center gap-2 rounded-lg bg-warn px-3 py-2.5 text-meta text-warn-foreground [&_svg]:size-4">
                <ShieldAlert aria-hidden />
                {firstName(shownDeleting.name)} es administrador.
              </span>
            )}
          </>
        }
        confirmLabel={`Eliminar a ${firstName(shownDeleting?.name ?? "")}`}
        busyLabel="Eliminando…"
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
