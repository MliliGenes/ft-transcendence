export const buttonStyles = [
    "inline-flex items-center justify-center gap-2",
    "rounded-lg border border-white/15 bg-white/[.02]",
    "px-4 py-2.5 text-sm font-medium text-gray-200",
    "transition hover:border-violet-400/50 hover:bg-violet-400/10",
    "disabled:opacity-30 disabled:cursor-not-allowed"
].join(" ");

export const primaryButtonStyles = [
    buttonStyles,
    "!border-violet-400 !bg-violet-400 !text-black",
    "hover:!bg-violet-300"
].join(" ");

export const inputStyles = [
    "w-full rounded-lg border border-white/15 bg-black/20",
    "px-3 py-2.5 text-sm text-white",
    "outline-none focus:border-violet-400"
].join(" ");

export const panelStyles = "rounded-2xl border border-white/10 bg-[#151320]";

export function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric"
    });
}
