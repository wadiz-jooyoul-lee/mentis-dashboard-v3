import Link from "next/link";

/** 브레드크럼. href 가 있는 항목은 링크, 마지막(현재) 항목은 진한 글자로. */
export default function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="ui-crumbs" aria-label="현재 위치">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${i}-${it.label}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {it.href && !last ? (
              <Link href={it.href}>{it.label}</Link>
            ) : (
              <span className={last ? "is-current" : undefined} aria-current={last ? "page" : undefined}>
                {it.label}
              </span>
            )}
            {!last && <span className="sep" aria-hidden>/</span>}
          </span>
        );
      })}
    </nav>
  );
}
