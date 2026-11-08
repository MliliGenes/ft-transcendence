import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

/*
 * Chat-flavoured Markdown: GitHub extensions (tables, ~~strike~~, task lists, autolinks) and
 * single-newline line breaks, as people expect when pressing Shift+Enter in a chat composer.
 * Raw HTML stays disabled (react-markdown's default), so message content cannot inject markup.
 */
const remarkPlugins = [remarkGfm, remarkBreaks];

/** Drops react-markdown’s AST `node` prop so it is not forwarded to the DOM. */
function dom<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

const components: Components = {
  a: (props) => <a {...dom(props)} target="_blank" rel="noopener noreferrer nofollow" />,
  h1: (props) => <p {...dom(props)} className="mt-2 text-xl font-semibold tracking-tight first:mt-0" />,
  h2: (props) => <p {...dom(props)} className="mt-2 text-lg font-semibold tracking-tight first:mt-0" />,
  h3: (props) => <p {...dom(props)} className="mt-2 text-base font-semibold first:mt-0" />,
  h4: (props) => <p {...dom(props)} className="mt-2 font-semibold first:mt-0" />,
  h5: (props) => <p {...dom(props)} className="mt-2 font-semibold first:mt-0" />,
  h6: (props) => <p {...dom(props)} className="mt-2 font-semibold first:mt-0" />,
  table: (props) => <div className="my-2 max-w-full overflow-x-auto"><table {...dom(props)} className="border-collapse text-sm" /></div>,
  img: ({ alt }) => <span className="text-muted-foreground">[image: {alt || "untitled"}]</span>,
  input: (props) => <input {...dom(props)} disabled className="mr-1.5 align-middle accent-primary" />,
};

const markdownClass = [
  "chat-markdown min-w-0 break-words text-[15px] leading-6",
  "[&_p+p]:mt-1",
  "[&_a]:text-nook-accent-text [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:decoration-2",
  "[&_strong]:font-semibold [&_em]:italic [&_del]:text-muted-foreground [&_del]:line-through",
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_li:has(>input)]:list-none [&_li:has(>input)]:-ml-5",
  "[&_blockquote]:my-1 [&_blockquote]:border-l-[3px] [&_blockquote]:border-nook-text-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[13px]",
  "[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-5",
  "[&_hr]:my-3 [&_hr]:border-border",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5",
].join(" ");

export function ChatMarkdown({ children, className }: { children: string; className?: string }) {
  return <div className={cn(markdownClass, className)}>
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>{children}</ReactMarkdown>
  </div>;
}
