"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { IconAt, IconBell, IconBrandDiscord, IconBrandGithub, IconCamera, IconCheck, IconChevronRight, IconEye, IconLink, IconLock, IconLogout, IconMail, IconMountain, IconPalette, IconPhoto, IconShield, IconUser, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { NookLogo } from "@/components/nook-logo";
import { AccountAvatar } from "./account-avatar";
import { AccountStatus } from "./account-status";
import { ProfileImageEditor } from "./profile-image-editor";
import { accountApi, profileImageUrl, profileName, type AccountProfile, type ImageKind, type UpdateAccount } from "@/lib/accounts/client";
import { accountError, useAccount } from "@/lib/accounts/use-account";

const groups = [
  { label: "My Account", items: [{ id: "profile", label: "Profile", icon: IconUser }, { id: "account", label: "Account", icon: IconLock }, { id: "security", label: "Security", icon: IconShield, unavailable: true }] },
  { label: "Social", items: [{ id: "connections", label: "Connections", icon: IconLink }] },
  { label: "App", items: [{ id: "notifications", label: "Notifications", icon: IconBell, unavailable: true }, { id: "appearance", label: "Appearance", icon: IconPalette, unavailable: true }, { id: "privacy", label: "Privacy", icon: IconEye, unavailable: true }] },
];

function profileDraft(profile: AccountProfile) {
  return { displayName: profile.displayName ?? "", username: profile.username, firstName: profile.firstName ?? "", lastName: profile.lastName ?? "", email: profile.email };
}

export function SettingsView() {
  const account = useAccount();
  if (!account.query.data || !account.session) return <AccountStatus account={account} />;
  return <SettingsPanel key={account.query.data.id} account={account} profile={account.query.data} />;
}

function SettingsPanel({ account, profile }: { account: ReturnType<typeof useAccount>; profile: AccountProfile }) {
  const router = useRouter();
  const [section, setSection] = useState("profile");
  const [draft, setDraft] = useState(() => profileDraft(profile));
  const [message, setMessage] = useState("");
  const [focusField, setFocusField] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [editor, setEditor] = useState<{ kind: ImageKind; trigger: HTMLElement } | null>(null);
  const banner = profileImageUrl(profile, "banner");
  const update: UpdateAccount = {};
  for (const key of ["username", "email", "displayName", "firstName", "lastName"] as const) {
    const value = key === "username" || key === "email" ? draft[key].trim() : draft[key].trim() || null;
    if (value !== profile[key]) Object.assign(update, { [key]: value });
  }
  const dirty = Object.keys(update).length > 0;
  const save = useMutation({
    mutationFn: (data: UpdateAccount) => account.request(token => accountApi.updateMe(token, data)),
    onSuccess: updated => {
      account.setProfile(updated);
      setDraft(profileDraft(updated));
      setMessage(updated.email !== profile.email ? "Changes saved. Your new email address needs verification." : "Changes saved.");
    },
  });

  useEffect(() => {
    if (section === "profile" && focusField) document.getElementById(`settings-${focusField}`)?.focus();
  }, [section, focusField]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (dirty) save.mutate(update);
  }

  function edit(field: string) {
    setFocusField(field);
    setSection("profile");
  }

  const fields = [
    { key: "displayName" as const, label: "Display Name", autoComplete: "nickname", max: 50 },
    { key: "username" as const, label: "Username", autoComplete: "username", max: 30, icon: IconAt },
    { key: "firstName" as const, label: "First Name", autoComplete: "given-name", max: 50 },
    { key: "lastName" as const, label: "Last Name", autoComplete: "family-name", max: 50 },
    { key: "email" as const, label: "Email", autoComplete: "email", max: 254, icon: IconMail },
  ];

  return <div className="mx-auto w-full max-w-[1200px] p-3 sm:p-6 lg:p-8">
    <section aria-label="User settings" className="min-w-0 border border-border bg-background [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-ring">
      <header className="flex min-h-12 items-center gap-4 border-b border-border px-4">
        <NookLogo className="text-lg" /><span className="border-l border-border pl-4 text-xs text-nook-text-secondary">User Settings</span>
        <Link href="/profile" aria-label="Close settings and return to profile" className="ml-auto grid size-11 place-items-center text-nook-text-secondary hover:text-foreground"><IconX size={20} /></Link>
      </header>
      <div className="grid min-h-[640px] md:grid-cols-[216px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-b border-border p-4 md:border-r md:border-b-0">
          <div className="mb-4 flex items-center gap-3 border-b border-border pb-5">
            <AccountAvatar profile={profile} size={44} className="border border-border" />
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.username}</p><p className="mt-0.5 text-xs text-nook-text-muted">{profile.role === "SUPERADMIN" ? "Superadmin" : profile.role === "ADMIN" ? "Admin" : "Member"}</p></div>
          </div>
          <nav aria-label="Settings sections" className="hidden md:block">
            {groups.map(group => <div key={group.label} className="mb-4 border-b border-border pb-4">
              <p className="mb-2 px-2 text-xs text-nook-text-muted">{group.label}</p>
              {group.items.map(item => <button key={item.id} type="button" disabled={"unavailable" in item && item.unavailable} title={"unavailable" in item ? "Coming soon" : undefined} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)} className={`flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm disabled:cursor-not-allowed disabled:text-nook-text-muted ${section === item.id ? "bg-primary font-medium text-primary-foreground" : "text-nook-text-secondary enabled:hover:bg-nook-surface"}`}>
                <item.icon size={17} stroke={1.75} aria-hidden="true" />{item.label}{"unavailable" in item && <span className="ml-auto text-[10px]">Soon</span>}
              </button>)}
            </div>)}
          </nav>
          <label className="mb-4 block md:hidden"><span className="mb-2 block text-xs text-nook-text-muted">Settings section</span><select value={section} onChange={event => setSection(event.target.value)} className="min-h-11 w-full border border-border bg-nook-surface px-3 text-sm"><option value="profile">Profile</option><option value="account">Account</option><option value="connections">Connections</option></select></label>
          <button type="button" disabled={loggingOut || save.isPending || Boolean(editor)} onClick={async () => {
            setLoggingOut(true);
            try { await account.logout(); } catch { /* The local session is cleared even if logout is unreachable. */ }
            router.replace("/login");
          }} className="flex min-h-11 items-center gap-3 px-3 text-sm text-primary disabled:opacity-50"><IconLogout size={17} aria-hidden="true" />{loggingOut ? "Logging out…" : "Log Out"}</button>
        </aside>

        <div className="min-w-0 px-4 py-6 sm:p-7 lg:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{section === "profile" ? "Edit Profile" : section === "account" ? "Account" : "Connections"}</h1>
          <p className="mt-1 text-sm text-nook-text-muted">{section === "profile" ? "Update your public information on Nook." : section === "account" ? "Manage your account information." : "Your connected accounts on Nook."}</p>

          {section === "profile" && <>
            <div className="relative mt-6 mb-20">
              <div className="relative flex h-36 items-center justify-center overflow-hidden border border-border bg-nook-surface sm:h-44">
                {banner
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={banner} alt="Your profile banner" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
                  : <IconMountain size={32} stroke={1.25} className="text-nook-text-muted" aria-label="No banner uploaded" />}
                <Button variant="outline" onClick={event => setEditor({ kind: "banner", trigger: event.currentTarget })} disabled={save.isPending} className="absolute top-3 right-3 min-h-10 border-border bg-background/90 px-3"><IconPhoto />Change Banner</Button>
              </div>
              <div className="absolute -bottom-14 left-4">
                <AccountAvatar profile={profile} size={116} className="border-4 border-background outline outline-border" />
                <button type="button" aria-label="Change Avatar" onClick={event => setEditor({ kind: "avatar", trigger: event.currentTarget })} disabled={save.isPending} className="absolute right-0 bottom-0 grid size-11 place-items-center rounded-full border border-border bg-nook-surface-raised hover:bg-nook-surface-hover disabled:opacity-50"><IconCamera size={20} /></button>
              </div>
            </div>
            <p className="mb-5 text-xs leading-5 text-nook-text-muted">Image changes save immediately. Use Save Changes for the fields below.</p>
            <form onSubmit={submit}>
              <fieldset disabled={save.isPending} className="grid gap-x-5 gap-y-5 sm:grid-cols-2 disabled:opacity-70">
                <legend className="sr-only">Profile information</legend>
                {fields.map(field => <label key={field.key} htmlFor={`settings-${field.key}`} className={field.key === "email" ? "sm:col-span-2" : ""}>
                  <span className="mb-2 block text-xs font-medium">{field.label}</span>
                  <span className="flex min-h-11 items-center gap-2 border border-nook-control-border bg-nook-surface px-3 focus-within:border-primary">
                    {field.icon && <field.icon size={17} className="shrink-0 text-nook-text-muted" aria-hidden="true" />}
                    <input id={`settings-${field.key}`} name={field.key} type={field.key === "email" ? "email" : "text"} value={draft[field.key]} onChange={event => { setDraft({ ...draft, [field.key]: event.target.value }); setMessage(""); save.reset(); }} maxLength={field.max} minLength={field.key === "username" ? 3 : undefined} required={field.key === "username" || field.key === "email"} autoComplete={field.autoComplete} autoCapitalize={field.key === "username" || field.key === "email" ? "none" : undefined} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
                  </span>
                </label>)}
              </fieldset>
              {save.isError && <p role="alert" className="mt-5 text-sm text-destructive">{accountError(save.error)}</p>}
              <div className="mt-7 flex justify-end gap-3">
                <Button type="button" variant="outline" size="lg" disabled={!dirty || save.isPending} onClick={() => { setDraft(profileDraft(profile)); setMessage(""); save.reset(); }} className="min-h-11 px-4">Cancel</Button>
                <Button type="submit" size="lg" disabled={!dirty || save.isPending} className="min-h-11 px-5">{save.isPending ? "Saving…" : "Save Changes"}</Button>
              </div>
            </form>
          </>}

          {section === "account" && <div className="mt-6 space-y-3">
            {[
              { field: "email", label: "Email", value: profile.email, icon: IconMail },
              { field: "username", label: "Username", value: profile.username, icon: IconAt },
              { field: "displayName", label: "Display Name", value: profileName(profile), icon: IconUser },
              { field: "firstName", label: "Name", value: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Not set", icon: IconUser },
            ].map(row => <button key={row.field} type="button" onClick={() => edit(row.field)} className="flex min-h-20 w-full items-center gap-4 border border-border bg-nook-surface px-4 py-4 text-left hover:bg-nook-surface-raised">
              <row.icon size={22} stroke={1.5} className="shrink-0 text-nook-text-secondary" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{row.label}</span><span className="mt-1 block truncate text-xs text-nook-text-muted">{row.value}</span></span>
              {row.field === "email" && <span className={`hidden items-center gap-1 px-2 py-1 text-xs sm:inline-flex ${profile.emailVerifiedAt ? "bg-nook-success/15 text-nook-success" : "bg-nook-surface-raised text-nook-text-muted"}`}>{profile.emailVerifiedAt && <IconCheck size={13} />}{profile.emailVerifiedAt ? "Verified" : "Not verified"}</span>}
              <IconChevronRight size={18} className="shrink-0 text-nook-text-muted" aria-hidden="true" />
            </button>)}
          </div>}

          {section === "connections" && <div className="mt-6 space-y-3">
            {[{ label: "GitHub", connected: profile.hasGithub, icon: IconBrandGithub }, { label: "Discord", connected: profile.hasDiscord, icon: IconBrandDiscord }].map(provider => <div key={provider.label} className="flex min-h-20 items-center gap-4 border border-border bg-nook-surface px-4 py-4">
              <provider.icon size={28} className="shrink-0" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-medium">{provider.label}</p><p className="mt-1 text-xs text-nook-text-muted">{provider.connected ? "Connected" : "Not connected"}</p></div>{provider.connected && <IconCheck size={20} className="text-nook-success" aria-label="Connected" />}
            </div>)}
            <p className="text-xs leading-5 text-nook-text-muted">Connection management is coming soon.</p>
          </div>}
          <p role="status" aria-live="polite" className="mt-5 min-h-5 text-sm text-nook-success">{message}</p>
        </div>
      </div>
    </section>
    {editor && <ProfileImageEditor kind={editor.kind} profile={profile} trigger={editor.trigger} request={account.request} onProfile={account.setProfile} onMessage={setMessage} onClose={() => setEditor(null)} />}
  </div>;
}
